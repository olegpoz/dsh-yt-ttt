/**
 * Local harness for the host half: serves a mock Tracker API and drives the
 * registered Web route directly, so duration summing, pagination, the org
 * header, and the failure paths are all exercised without the real service.
 */
import { createServer } from 'node:http';
import { apply } from '../index.js';
import { makeCredentialStore, TOKEN_KEY } from './helpers.mjs';

const seen = { headers: [], urls: [], bodies: [] };

/** Mock Tracker: /myself plus a two-page worklog search. */
const tracker = createServer((req, res) => {
	seen.headers.push(req.headers);
	seen.urls.push(req.url);
	let raw = '';
	req.on('data', (chunk) => {
		raw += chunk;
	});
	req.on('end', () => {
		if (raw !== '') seen.bodies.push(raw);
		res.setHeader('content-type', 'application/json');
		if (req.url.startsWith('/myself')) {
			res.end(JSON.stringify({ login: 'ivanov' }));
			return;
		}
		if (req.url.startsWith('/worklog/_search')) {
			const page = Number(new URL(req.url, 'http://x').searchParams.get('page'));
			// Today and yesterday are read concurrently and answer the same way, so
			// the day is identified by the range in the body rather than by the mock.
			// Page 1 is full (100 rows) so the loop must follow to page 2.
			const rows = page === 1
				? Array.from({ length: 100 }, () => ({ duration: 'PT1H' }))
				: [
					{ id: 11, duration: 'PT30M', start: '2026-03-04T09:00:00.000+0300', comment: 'standup', issue: { key: 'ABC-1', display: 'Fix the thing' } },
					{ id: 12, duration: 'P1DT2H' },
					{ id: 13, duration: '1h 15m' },
					{ id: 14, duration: 'nonsense' },
				];
			// 100 x 1h + 30m + 1d2h + 1h15m, with the nonsense row contributing zero.
			res.setHeader('x-total-pages', '2');
			res.end(JSON.stringify(rows));
			return;
		}
		res.statusCode = 404;
		res.end(JSON.stringify({ errorMessages: ['not found'] }));
	});
});

await new Promise((resolve) => tracker.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${tracker.address().port}`;

/** Capture the routes apply() registers, by path. */
const routes = new Map();
const effects = [];
const credentials = makeCredentialStore({ [TOKEN_KEY]: 'test-token' });
const ctx = {
	webServer: { register: (definition) => { routes.set(definition.path, definition); return () => {}; } },
	connection: { requestRejection: () => undefined },
	effect: (callback) => { effects.push(callback()); },
	get: (name) => (name === 'credentials' ? credentials : undefined),
};

apply(ctx, {
	orgId: '1234567',
	timeZone: 'Europe/Moscow',
	apiBase: origin,
	webBase: 'https://tracker.example',
});

/** The summary route; the add route has its own coverage in add.test.mjs. */
const route = routes.get('/yandex-tracker-today/summary');

/** Minimal request/response doubles. */
function call(url, method = 'GET') {
	const headers = {};
	return new Promise((resolve) => {
		const res = {
			statusCode: 0,
			setHeader: (name, value) => { headers[name.toLowerCase()] = value; },
			end: (body) => resolve({ status: headers === undefined ? 0 : res.statusCode, headers, body: JSON.parse(body) }),
		};
		route.handler({ method, url, headers: {} }, res);
	});
}

const first = await call('/yandex-tracker-today/summary');
const second = await call('/yandex-tracker-today/summary?force=1');

const expectedMinutes = 100 * 60 + 30 + 1560 + 75;
// Two days are read per payload, each following two pages, and the payload was
// built twice (a plain call and a forced one): 2 x 2 x 2.
const expectedSearches = 8;

/** The booked rows of a payload, excluding the unbooked stretches. */
const worklogsOf = (payload) => payload.rows.filter((row) => row.kind === 'worklog');
/** The unbooked stretches of a payload. */
const gapsOf = (payload) => payload.rows.filter((row) => row.kind === 'gap');
const checks = [
	['ok', first.body.ok === true],
	['pages read', seen.urls.filter((u) => u.startsWith('/worklog/_search')).length === expectedSearches],
	['minutes summed', first.body.minutes === expectedMinutes],
	['hours formatted', first.body.hours === '127:45'],
	['entries counted', first.body.entries === 104],
	['login resolved from /myself', first.body.login === 'ivanov'],
	['today date', /^\d{4}-\d{2}-\d{2}$/u.test(first.body.date)],
	['web url', first.body.webUrl === 'https://tracker.example/pages/my'],
	['org header used', seen.headers.every((h) => h['x-org-id'] === '1234567')],
	['oauth header used', seen.headers.every((h) => h.authorization === 'OAuth test-token')],
	['search body carries the login', seen.bodies.every((b) => JSON.parse(b).createdBy === 'ivanov')],
	['search body carries an offset range', seen.bodies.every((b) => /T00:00:00\.000\+0300$/u.test(JSON.parse(b).start.from))],
	['forced call re-read', second.body.ok === true],
	// The list is a padded timeline, so it holds the booked rows plus the unbooked
	// stretches of the working day; the two are told apart by `kind`.
	['a record is emitted per worklog', worklogsOf(first.body).length === 104],
	['the timeline carries gap rows', gapsOf(first.body).length === 1],
	['the timeline is the worklogs plus the gaps', first.body.rows.length === 104 + gapsOf(first.body).length],
	['records carry the issue key and title', worklogsOf(first.body)[0].issueKey === 'ABC-1' && worklogsOf(first.body)[0].issueDisplay === 'Fix the thing'],
	['records carry the comment', worklogsOf(first.body)[0].comment === 'standup'],
	['records carry the local clock', worklogsOf(first.body)[0].clock === '09:00'],
	['records carry their own duration', worklogsOf(first.body)[0].minutes === 30 && worklogsOf(first.body)[0].hours === '0:30'],
	['records link to their issue', worklogsOf(first.body)[0].issueUrl === 'https://tracker.example/ABC-1'],
	['the issue link carries no /issues/ segment', !first.body.rows.some((row) => row.issueUrl.includes('/issues/'))],
	['records without an issue fall back to the page', worklogsOf(first.body)[1].issueUrl === 'https://tracker.example/pages/my'],

	// ---- the padded working day --------------------------------------------
	// Only one record carries a readable start, so the day is: that record from
	// 09:00, then one unbooked stretch to the end of the working day.
	['the day is padded out to 18:00', (() => {
		const last = gapsOf(first.body).at(-1);
		return last !== undefined && last.clock === '09:30' && last.hours === '8:30';
	})()],
	['a gap carries no issue and no link', gapsOf(first.body).every((row) => row.issueKey === '' && row.issueUrl === '' && row.kind === 'gap')],
	['a gap is not counted as a worklog', first.body.entries === 104],
	['a gap contributes no booked minutes', gapsOf(first.body).every((row) => row.minutes > 0) && first.body.minutes === expectedMinutes],
	['gap rows are marked for the renderer', gapsOf(first.body).every((row) => typeof row.id === 'string' && row.id.startsWith('gap-'))],
	['the timeline reads in ascending clock order', (() => {
		const placed = first.body.rows.filter((row) => typeof row.startMinutes === 'number');
		for (let i = 1; i < placed.length; i += 1) {
			if (placed[i].startMinutes < placed[i - 1].startMinutes) return false;
		}
		return true;
	})()],
	// Rows with no readable start cannot be placed on the clock, so they keep their
	// own lines after the timeline rather than being dropped.
	['unplaceable records are kept', worklogsOf(first.body).filter((row) => row.start === '').length === 103],

	// ---- yesterday ---------------------------------------------------------
	['the payload carries yesterday', typeof first.body.yesterday === 'object' && first.body.yesterday !== null],
	['the payload carries the working-day end', first.body.workdayEndMinutes === 18 * 60],
	['yesterday has its own total', first.body.yesterday.minutes === expectedMinutes && first.body.yesterday.hours === '127:45'],
	['yesterday has its own count', first.body.yesterday.entries === 104],
	['yesterday is one day before today', (() => {
		const at = new Date(`${first.body.date}T00:00:00Z`);
		at.setUTCDate(at.getUTCDate() - 1);
		return first.body.yesterday.date === at.toISOString().slice(0, 10);
	})()],
	['yesterday reports its weekday', (() => {
		const day = new Date(`${first.body.yesterday.date}T00:00:00Z`).getUTCDay();
		return first.body.yesterday.weekday === day;
	})()],
	['yesterday reports the weekend flag', (() => {
		const day = new Date(`${first.body.yesterday.date}T00:00:00Z`).getUTCDay();
		return first.body.yesterday.weekend === (day === 0 || day === 6);
	})()],
	// The two days must be asked for separately, or yesterday would repeat today.
	['the two days are asked for apart', (() => {
		const froms = seen.bodies.map((b) => JSON.parse(b).start.from);
		return new Set(froms).size === 2;
	})()],
	['the earlier day is the one asked for too', (() => {
		const froms = seen.bodies.map((b) => JSON.parse(b).start.from).sort();
		return froms[0].slice(0, 10) === first.body.yesterday.date && froms[froms.length - 1].slice(0, 10) === first.body.date;
	})()],
];

// Unconfigured token is reported, not thrown.
const bareRoutes = new Map();
apply({
	...ctx,
	webServer: { register: (definition) => { bareRoutes.set(definition.path, definition); return () => {}; } },
	get: () => undefined,
}, { apiBase: origin });
const unconfigured = bareRoutes.get('/yandex-tracker-today/summary');
const bare = await new Promise((resolve) => {
	unconfigured.handler({ method: 'GET', url: '/x', headers: {} }, {
		statusCode: 0,
		setHeader: () => {},
		end: (body) => resolve(JSON.parse(body)),
	});
});
checks.push(['unconfigured reported', bare.ok === false && bare.reason === 'unconfigured']);

// A rejected request is refused before any API call.
const guardedRoutes = new Map();
apply({
	...ctx,
	connection: { requestRejection: () => 403 },
	webServer: { register: (definition) => { guardedRoutes.set(definition.path, definition); return () => {}; } },
}, { orgId: '1', apiBase: origin });
const guarded = guardedRoutes.get('/yandex-tracker-today/summary');
const refused = await new Promise((resolve) => {
	guarded.handler({ method: 'GET', url: '/x', headers: {} }, {
		statusCode: 0,
		setHeader: () => {},
		end: () => resolve(true),
	});
});
checks.push(['trust fence enforced', refused === true]);

tracker.close();
for (const [name, passed] of checks) console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}`);
const failed = checks.filter(([, passed]) => !passed).length;
console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
