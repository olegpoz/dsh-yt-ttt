// Unit checks for the client's pure helpers: the settings parser, the initial
// clock, the refresh gate and the zone clock. The client ships as a single
// loader module, so the test evaluates its source with a fake loader and asks
// the factory for a test-only export.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8');
const marker = 'return { inject, apply };';
if (!source.includes(marker)) {
	console.error('FAIL  the client factory return marker is missing');
	process.exit(1);
}
const instrumented = source.replace(
	marker,
	'return { inject, apply, __test: { fetchPluginSettings, initialTimes, zoneClock, createRefreshGate } };',
);

let factory = null;
const sandbox = {
	window: {
		__ModuleLoader__: {
			load: (definition) => {
				factory = definition.factory;
			},
		},
	},
	React: {
		useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
		useEffect: () => {},
		useRef: (initial) => ({ current: initial }),
		useCallback: (callback) => callback,
		useMemo: (callback) => callback(),
	},
	document: {
		addEventListener() {},
		removeEventListener() {},
		getElementById() { return null; },
		querySelector() { return null; },
	},
	fetch: async () => {
		throw new Error('fetch was not stubbed');
	},
	Intl,
	Date,
	Math,
	Number,
	String,
	Array,
	Object,
	JSON,
	Set,
	Map,
	Error,
	AbortController,
	URLSearchParams,
	setTimeout,
	clearTimeout,
	setInterval,
	clearInterval,
	console,
};
vm.createContext(sandbox);
try {
	vm.runInContext(instrumented, sandbox, { filename: 'client.js' });
} catch (error) {
	console.error(`FAIL  the client source did not evaluate: ${error.message}`);
	process.exit(1);
}
if (factory === null) {
	console.error('FAIL  the client factory was not captured');
	process.exit(1);
}
const api = factory((name) => {
	if (name === 'react') return sandbox.React;
	throw new Error(`unexpected require: ${name}`);
});
const test = api.__test;
if (test === undefined) {
	console.error('FAIL  the client test export is missing');
	process.exit(1);
}

/**
 * A fetch double returning one JSON answer.
 * @param payload - the body.
 * @param status - the HTTP status.
 * @returns the response-like object.
 */
function answer(payload, status = 200) {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: async () => payload,
	};
}

const checks = [];
const check = (name, passed) => checks.push([name, passed === true]);

// ---- settings parsing ------------------------------------------------------
sandbox.fetch = async () => answer({
	ok: true,
	settings: {
		durationChange: 'start',
		maxDurationHours: 99,
		refreshDelaySeconds: 0,
		pollIntervalMinutes: 0,
		timeZone: 'Europe/Moscow',
		defaultQueue: ' Q ',
		workdayStart: '08:00',
		workdayEnd: '19:00',
		dailyTargetHours: 2,
		defaultDurationMinutes: 3,
		eventCommentPrefix: '',
		orgId: ' 1 ',
		login: 'u',
		calendarLogin: 'c',
	},
	connection: { hasToken: true, hasCalendarPassword: true, orgId: '1', login: 'u' },
});
const clamped = await test.fetchPluginSettings();
check('a settings answer is accepted', clamped.ok === true && clamped.error === null);
check('bad durations fall back to their defaults', clamped.settings.maxDurationHours === 8
	&& clamped.settings.defaultDurationMinutes === 60);
check('bad delays and poll intervals fall back', clamped.settings.refreshDelaySeconds === 3
	&& clamped.settings.pollIntervalMinutes === 5);
check('text fields are trimmed', clamped.settings.defaultQueue === 'Q'
	&& clamped.settings.orgId === '1');
check('the zone survives', clamped.settings.timeZone === 'Europe/Moscow');
check('the connection flags survive', clamped.connection.hasToken === true
	&& clamped.connection.hasCalendarPassword === true);

sandbox.fetch = async () => answer({
	ok: true,
	settings: {
		durationChange: 'end', maxDurationHours: 4, refreshDelaySeconds: 9, pollIntervalMinutes: 15,
		timeZone: 'UTC', workdayStart: '10:00', workdayEnd: '18:00', dailyTargetHours: 7.5,
		defaultDurationMinutes: 30, eventCommentPrefix: 'Sync: ', orgId: '9', login: '',
	},
	connection: { hasToken: false, hasCalendarPassword: false, orgId: '9', login: '' },
});
const valid = await test.fetchPluginSettings();
check('valid settings pass through', valid.ok === true
	&& valid.settings.maxDurationHours === 4
	&& valid.settings.pollIntervalMinutes === 15
	&& valid.settings.dailyTargetHours === 7.5
	&& valid.settings.defaultDurationMinutes === 30);

sandbox.fetch = async () => answer({ ok: false, message: 'storage down' }, 500);
const failed = await test.fetchPluginSettings();
check('a failed answer is reported', failed.ok === false
	&& failed.settings === null
	&& failed.error === 'storage down');

sandbox.fetch = async () => ({
	ok: true,
	status: 200,
	json: async () => {
		throw new Error('bad json');
	},
});
const malformed = await test.fetchPluginSettings();
check('an unreadable answer is reported', malformed.ok === false
	&& typeof malformed.error === 'string' && malformed.error !== '');

// ---- initial clock ---------------------------------------------------------
const gap = test.initialTimes(600, 1080, 60, 660);
check('a gap starts at its own clock', gap.start === 600 && gap.duration === 60 && gap.end === 660);
const noGap = test.initialTimes(null, 1080, 60, 661);
check('no gap rounds the clock up to five minutes', noGap.end === 665
	&& noGap.duration === 60 && noGap.start === 605);

// ---- refresh gate ----------------------------------------------------------
const gate = test.createRefreshGate();
const first = gate.next();
const second = gate.next();
check('an older refresh generation is stale', gate.isCurrent(first) === false);
check('the newest refresh generation is current', gate.isCurrent(second) === true);

// ---- zone clock ------------------------------------------------------------
const moscow = test.zoneClock('Europe/Moscow');
check('the zone clock has a readable time', /^\d{2}:\d{2}$/u.test(moscow.time)
	&& moscow.minutes >= 0 && moscow.minutes < 1440);
check('the zone clock has a date and a weekday', /^\d{2}\.\d{2}\.\d{4}$/u.test(moscow.displayDate)
	&& /^\d{4}-\d{2}-\d{2}$/u.test(moscow.date)
	&& typeof moscow.weekday === 'string' && moscow.weekday !== '');
const fallback = test.zoneClock('Not/AZone');
check('an unknown zone falls back to the browser clock', /^\d{2}:\d{2}$/u.test(fallback.time));

let failedCount = 0;
for (const [name, passed] of checks) {
	console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}`);
	if (!passed) failedCount += 1;
}
console.log(failedCount === 0 ? '\nALL PASS' : `\n${failedCount} FAILED`);
process.exit(failedCount === 0 ? 0 : 1);
