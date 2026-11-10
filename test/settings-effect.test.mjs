/**
 * The plugin settings' effect on the summary route.
 *
 * A storage double and a mock Tracker let the test save the zone, queue and
 * working-day end through the settings route, then read the summary and check
 * that the effective configuration actually used them.
 */
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { apply } from '../index.js';
import { makeCredentialStore, TOKEN_KEY } from './helpers.mjs';

const tracker = createServer((req, res) => {
	let raw = '';
	req.on('data', (chunk) => { raw += chunk; });
	req.on('end', () => {
		res.setHeader('content-type', 'application/json');
		if (req.url.startsWith('/myself')) {
			res.end(JSON.stringify({ login: 'testuser' }));
			return;
		}
		if (req.url.startsWith('/worklog/_search')) {
			res.end(JSON.stringify([]));
			return;
		}
		res.statusCode = 404;
		res.end(JSON.stringify({ errorMessages: ['not found'] }));
	});
});
await new Promise((resolve) => tracker.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${tracker.address().port}`;

/** One in-memory KV unit, shaped like the JSON backend's single layout. */
function makeUnit() {
	const records = new Map();
	return {
		async loadAll() {
			return { tables: { settings: Object.fromEntries(records) }, global: null };
		},
		async putRecord(table, key, value) {
			records.set(key, value);
		},
		async deleteRecord(table, key) {
			return records.delete(key);
		},
		async deleteRecords() { return 0; },
		async setGlobal() {},
		async close() {},
	};
}
const unit = makeUnit();
const storage = {
	backend: {
		names: () => ['json'],
		get: (name) => (name === 'json' ? { kv: { open: async () => unit } } : undefined),
	},
};

const routes = new Map();
const credentials = makeCredentialStore({ [TOKEN_KEY]: 't' });
apply({
	webServer: { register: (definition) => { routes.set(definition.path, definition); return () => {}; } },
	connection: { requestRejection: () => undefined },
	effect: (callback) => { callback(); },
	get: (name) => (name === 'storage' ? storage : (name === 'credentials' ? credentials : undefined)),
}, {
	orgId: '1', login: 'testuser', apiBase: origin,
	timeZone: 'Europe/Moscow', defaultQueue: 'BASE', workdayEnd: '18:00',
});

/** Drive one route with a request double. */
function call(path, { method = 'GET', body } = {}) {
	const text = body === undefined ? undefined : JSON.stringify(body);
	const req = Readable.from(text === undefined ? [] : [Buffer.from(text)]);
	req.method = method;
	req.url = path;
	req.headers = { 'content-type': 'application/json' };
	return new Promise((resolve) => {
		const route = routes.get(path.split('?')[0]);
		route.handler(req, {
			statusCode: 0,
			setHeader() {},
			end(payload) {
				resolve({ status: this.statusCode, body: payload === undefined ? null : JSON.parse(payload) });
			},
		});
	});
}

const defaults = await call('/yandex-tracker-today/settings');
const saved = await call('/yandex-tracker-today/settings', {
	method: 'POST',
	body: {
		timeZone: 'UTC', defaultQueue: 'XYZ', workdayEnd: '19:30', calendarLogin: 'cal@example.com',
		workdayStart: '08:30', dailyTargetHours: 7, defaultDurationMinutes: 45, eventCommentPrefix: 'Sync: ',
	},
});
const summary = await call('/yandex-tracker-today/summary');
const readBack = await call('/yandex-tracker-today/settings');

const checks = [
	['the defaults come from the install config', defaults.body.settings.timeZone === 'Europe/Moscow'
		&& defaults.body.settings.defaultQueue === 'BASE'
		&& defaults.body.settings.workdayEnd === '18:00'],
	['the save is accepted', saved.status === 200 && saved.body.ok === true],
	['the summary uses the saved zone', summary.body.timeZone === 'UTC'],
	['the summary uses the saved queue', summary.body.defaultQueue === 'XYZ'],
	['the summary uses the saved workday end', summary.body.workdayEndMinutes === 1170],
	['the summary uses the saved workday start', summary.body.workdayStartMinutes === 510
		&& summary.body.rows[0].clock === '08:30'],
	['the summary uses the saved target and duration', summary.body.dailyTargetHours === 7
		&& summary.body.defaultDurationMinutes === 45],
	['the summary uses the saved meeting prefix', summary.body.eventCommentPrefix === 'Sync: '],
	['the settings read back', readBack.body.settings.timeZone === 'UTC'
		&& readBack.body.settings.calendarLogin === 'cal@example.com'],
];

tracker.close();
for (const [name, passed] of checks) console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}`);
const failed = checks.filter(([, passed]) => !passed).length;
console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);


