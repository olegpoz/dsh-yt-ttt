/**
 * Coverage for the two write routes the panel calls: adding a worklog from the
 * "Adding time" form and deleting one from a record row's delete control.
 *
 * A mock Tracker stands in for the real API, so the request shape Tracker
 * receives РІР‚вЂќ issue path, offset-bearing start, ISO duration, comment, record id
 * РІР‚вЂќ is checked without touching the live service. The validation and failure
 * paths are driven the same way.
 */
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { apply } from '../index.js';
import { makeCredentialStore, TOKEN_KEY } from './helpers.mjs';

const seen = [];
/** What the mock Tracker answers a worklog write with: `ok` or `forbidden`. */
let writeAnswer = 'ok';
/** What the mock Tracker answers a worklog delete with: `ok` or `forbidden`. */
let deleteAnswer = 'ok';
const TRACKER = createServer((req, res) => {
	seen.push({ method: req.method, url: req.url, headers: req.headers, body: '' });
	const record = seen.at(-1);
	req.on('data', (chunk) => { record.body += chunk; });
	req.on('end', () => {
		res.setHeader('content-type', 'application/json');
		if (req.url.startsWith('/myself')) {
			res.end(JSON.stringify({ login: 'ivanov' }));
			return;
		}
		if (req.url.startsWith('/worklog/_search')) {
			res.setHeader('x-total-pages', '1');
			res.end(JSON.stringify([]));
			return;
		}
		if (req.method === 'POST' && /^\/issues\/[^/]+\/worklog$/u.test(req.url)) {
			if (writeAnswer === 'forbidden') {
				res.statusCode = 403;
				res.end(JSON.stringify({ errorMessages: ['Р СњР ВµР Т‘Р С•РЎРѓРЎвЂљР В°РЎвЂљР С•РЎвЂЎР Р…Р С• Р С—РЎР‚Р В°Р Р†'] }));
				return;
			}
			res.statusCode = 201;
			res.end(JSON.stringify({ id: 900, duration: JSON.parse(record.body).duration }));
			return;
		}
		if (req.method === 'POST' && req.url.startsWith('/issues/_search')) {
			res.setHeader('x-total-pages', '1');
			res.end(JSON.stringify([
				{
					key: 'ABC-1', summary: 'Fix the thing',
					status: { key: 'open', display: 'Open' }, updatedAt: '2026-11-09T10:00:00.000+0000',
				},
				{
					key: 'ABC-2', summary: 'Ship it',
					status: { key: 'inProgress', display: 'In progress' }, updatedAt: '2026-11-08T10:00:00.000+0000',
				},
			]));
			return;
		}
		if (req.method === 'DELETE' && /^\/issues\/[^/]+\/worklog\/[^/]+$/u.test(req.url)) {
			if (deleteAnswer === 'forbidden') {
				res.statusCode = 403;
				res.end(JSON.stringify({ errorMessages: ['Р СњР ВµР Т‘Р С•РЎРѓРЎвЂљР В°РЎвЂљР С•РЎвЂЎР Р…Р С• Р С—РЎР‚Р В°Р Р†'] }));
				return;
			}
			// Tracker answers a successful delete with 204 and no body.
			res.statusCode = 204;
			res.end();
			return;
		}
		if (req.method === 'GET' && req.url === '/issues/ABC-1') {
			res.end(JSON.stringify({
				key: 'ABC-1', summary: 'Fix the thing',
				status: { key: 'open', display: 'Open' }, updatedAt: '2026-11-09T10:00:00.000+0000',
			}));
			return;
		}
		if (req.method === 'GET' && /^\/issues\/[^/]+$/u.test(req.url)) {
			const key = decodeURIComponent(req.url.slice('/issues/'.length));
			if (key === 'UNKNOWN-1') {
				res.statusCode = 404;
				res.end(JSON.stringify({ errorMessages: ['not found'] }));
				return;
			}
			const closed = key === 'CLOSED-1';
			res.end(JSON.stringify({
				key, summary: `Task ${key}`,
				status: { key: closed ? 'closed' : 'open', display: closed ? 'Р вЂ”Р В°Р С”РЎР‚РЎвЂ№РЎвЂљ' : 'Open' },
				updatedAt: '2026-11-09T10:00:00.000+0000',
			}));
			return;
		}
		res.statusCode = 404;
		res.end(JSON.stringify({ errorMessages: ['not found'] }));
	});
});
await new Promise((resolve) => TRACKER.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${TRACKER.address().port}`;

/** Register the plugin on a fresh context and return its routes by path. */
function mount(rawConfig) {
	const routes = new Map();
	// The token is not a config value: the suite seeds the credential store the
	// way the settings window would.
	const { token, ...config } = rawConfig ?? {};
	const credentials = makeCredentialStore(token === undefined ? {} : { [TOKEN_KEY]: token });
	apply({
		webServer: { register: (definition) => { routes.set(definition.path, definition); return () => {}; } },
		connection: { requestRejection: () => undefined },
		effect: (callback) => { callback(); },
		get: (name) => (name === 'credentials' ? credentials : undefined),
	}, { apiBase: origin, webBase: 'https://tracker.example', ...config });
	return routes;
}

const routes = mount({ token: 'test-token', orgId: '1234567', timeZone: 'Europe/Moscow' });
const add = routes.get('/yandex-tracker-today/worklog');
const del = routes.get('/yandex-tracker-today/worklog/delete');
const tasksRoute = routes.get('/yandex-tracker-today/tasks');
const taskRoute = routes.get('/yandex-tracker-today/task');
const summary = routes.get('/yandex-tracker-today/summary');

/**
 * Drive one route with a request double.
 * @param route - the registered route.
 * @param options - method, JSON body (or raw string), extra headers.
 * @returns the parsed answer, status and headers.
 */
function call(route, { method = 'POST', body, raw, url, headers = {} } = {}) {
	const text = raw !== undefined ? raw : body === undefined ? undefined : JSON.stringify(body);
	const req = Readable.from(text === undefined ? [] : [Buffer.from(text)]);
	req.method = method;
	req.url = url ?? route.path;
	req.headers = { 'content-type': 'application/json', ...headers };
	return new Promise((resolve) => {
		const out = { status: 0, headers: {} };
		const res = {
			statusCode: 0,
			setHeader(name, value) { out.headers[name.toLowerCase()] = value; },
			end(payload) {
				out.status = res.statusCode;
				out.body = payload === undefined ? null : JSON.parse(payload);
				resolve(out);
			},
		};
		route.handler(req, res);
	});
}

const base = {
	key: 'ABC-123',
	start: '2026-11-09T14:30',
	spent: '5h10m',
	comment: '  fixing the form  ',
};

const added = await call(add, { body: base });
const posted = seen.filter((row) => row.method === 'POST');
const sent = posted.length === 0 ? null : JSON.parse(posted[0].body);
const utcCall = await call(add, { body: { ...base, start: '2026-11-09T11:30:00.000Z' } });
const utcSent = JSON.parse(seen.at(-1).body);
const decimal = await call(add, { body: { ...base, spent: '5,5' } });
const decimalSent = JSON.parse(seen.at(-1).body);
const quarter = await call(add, { body: { ...base, spent: '4,25' } });
const pair = await call(add, { body: { ...base, spent: '2-20' } });
const pairSent = JSON.parse(seen.at(-1).body);
const deleted = await call(del, { body: { key: 'ABC-123', id: '900' } });
const deleteSent = seen.at(-1);
const tasks = await call(tasksRoute, { method: 'GET' });
const taskQuery = JSON.parse(seen.find((row) => row.url.startsWith('/issues/_search')).body).query;
const tasksAgain = await call(tasksRoute, { method: 'GET' });
const taskSearches = seen.filter((row) => row.url.startsWith('/issues/_search')).length;
const task = await call(taskRoute, { method: 'GET', url: '/yandex-tracker-today/task?key=ABC-1' });
const taskSent = seen.at(-1);
const missingTask = await call(taskRoute, { method: 'GET', url: '/yandex-tracker-today/task?key=UNKNOWN-1' });

const digitsRoute = mount({
	token: 'test-token', orgId: '1234567', timeZone: 'Europe/Moscow', defaultQueue: 'MYQUEUE',
}).get('/yandex-tracker-today/worklog');
const digits = await call(digitsRoute, { body: { ...base, key: '426', spent: '1:00' } });
const digitsSent = seen.at(-1);
const digitsWithoutQueue = await call(add, { body: { ...base, key: '426' } });
const queryRoute = mount({
	token: 'test-token', orgId: '1234567', timeZone: 'Europe/Moscow', tasksQuery: 'Assignee: me()',
}).get('/yandex-tracker-today/tasks');
const queryTasks = await call(queryRoute, { method: 'GET' });
const customQuery = JSON.parse(seen.at(-1).body).query;
const closedTask = await call(add, { body: { ...base, key: 'CLOSED-1' } });
const futureStart = await call(add, { body: { ...base, start: '2099-01-01T10:00' } });

const checks = [
	['a valid request is accepted', added.status === 200 && added.body.ok === true],
	['a closed task is refused', closedTask.status === 400 && closedTask.body.reason === 'closed'],
	['a future start is refused', futureStart.status === 400 && futureStart.body.reason === 'invalid'],
	['the created worklog id is reported', added.body.id === '900'],
	['minutes are echoed back', added.body.minutes === 310 && added.body.hours === '5:10'],
	['the issue is addressed by key', posted[0]?.url === '/issues/ABC-123/worklog'],
	['the start carries the zone offset', sent?.start === '2026-11-09T14:30:00.000+0300'],
	['the duration is ISO 8601', sent?.duration === 'PT5H10M'],
	['the comment is trimmed', sent?.comment === 'fixing the form'],
	['the worklog is written for the token account', sent !== null && !('createdBy' in sent)],

	// ---- duration and date spellings ---------------------------------------
	['an ISO duration is accepted', (await call(add, { body: { ...base, spent: 'PT1H30M' } })).body.ok === true],
	['an absolute start is accepted', utcCall.body.ok === true],
	['an absolute start is sent as +0000', utcSent.start === '2026-11-09T11:30:00.000+0000'],
	['a spaced duration is accepted', (await call(add, { body: { ...base, spent: '1h 30m' } })).body.minutes === 90],
	['a bare-minute duration is accepted', (await call(add, { body: { ...base, spent: '45' } })).body.minutes === 45],
	['a duration over a day is refused', (await call(add, { body: { ...base, spent: '25h' } })).status === 400],

	// ---- decimal hours and hours-minutes pairs ------------------------------
	['a comma decimal is read as hours', decimal.body.minutes === 330 && decimalSent.duration === 'PT5H30M'],
	['a quarter decimal is read exactly', quarter.body.minutes === 255 && quarter.body.hours === '4:15'],
	['a dot decimal is read as hours', (await call(add, { body: { ...base, spent: '5.5' } })).body.minutes === 330],
	['a decimal hour with an h is read', (await call(add, { body: { ...base, spent: '1,5h' } })).body.minutes === 90],
	['an hours-minutes pair is read', pair.body.minutes === 140 && pairSent.duration === 'PT2H20M'],
	['a pair of zero hours is read', (await call(add, { body: { ...base, spent: '0-45' } })).body.minutes === 45],
	['spaces around the pair separator are ignored', (await call(add, { body: { ...base, spent: '1 - 10' } })).body.minutes === 70],
	['an hh:mm duration is accepted', (await call(add, { body: { ...base, spent: '01:30' } })).body.minutes === 90],
	['a quarter-hour hh:mm is read', (await call(add, { body: { ...base, spent: '00:15' } })).body.minutes === 15],
	['an eight-hour hh:mm is read', (await call(add, { body: { ...base, spent: '08:00' } })).body.minutes === 480],

	// ---- refusals -----------------------------------------------------------
	['a missing key is refused', (await call(add, { body: { ...base, key: '  ' } })).body.message.includes('Task key')],
	['a key without a number is refused', (await call(add, { body: { ...base, key: 'ABC' } })).status === 400],
	['a digits-only key is expanded with the default queue', digits.status === 200 && digits.body.ok === true],
	['the expanded key reaches Tracker', digitsSent.url === '/issues/MYQUEUE-426/worklog'],
	['a digits-only key without a queue is refused', digitsWithoutQueue.status === 400],
	['an unreadable duration is refused', (await call(add, { body: { ...base, spent: 'soon' } })).status === 400],
	['a zero duration is refused', (await call(add, { body: { ...base, spent: '0m' } })).status === 400],
	['a pair with a full hour of minutes is refused', (await call(add, { body: { ...base, spent: '1-60' } })).status === 400],
	['an hh:mm with a one-digit minute is refused', (await call(add, { body: { ...base, spent: '1:5' } })).status === 400],
	['an hh:mm over a day is refused', (await call(add, { body: { ...base, spent: '25:00' } })).status === 400],
	['an hh:mm with 60 minutes is refused', (await call(add, { body: { ...base, spent: '01:60' } })).status === 400],
	['an unreadable date is refused', (await call(add, { body: { ...base, start: 'tomorrow' } })).status === 400],
	['malformed JSON is refused', (await call(add, { raw: '{oops' })).status === 400],
	['an empty body is refused', (await call(add, { body: undefined })).body.reason === 'invalid'],

	// ---- deleting a record --------------------------------------------------
	['a valid delete is accepted', deleted.status === 200 && deleted.body.ok === true],
	['the delete addresses the record', deleteSent.method === 'DELETE' && deleteSent.url === '/issues/ABC-123/worklog/900'],
	['a delete without an id is refused', (await call(del, { body: { key: 'ABC-123' } })).status === 400],
	['a delete with a malformed id is refused', (await call(del, { body: { key: 'ABC-123', id: '../x' } })).status === 400],
	['a delete with a bad key is refused', (await call(del, { body: { key: 'bad key', id: '900' } })).status === 400],
	['GET on the delete route is refused', (await call(del, { method: 'GET' })).status === 405],

	// ---- the task picker ----------------------------------------------------
	['the task list is served', tasks.body.ok === true && tasks.body.tasks.length === 2],
	['a task carries key, summary and status', tasks.body.tasks[0].key === 'ABC-1'
		&& tasks.body.tasks[0].summary === 'Fix the thing'
		&& tasks.body.tasks[0].status === 'Open'],
	['a task links to Tracker', tasks.body.tasks[0].url === 'https://tracker.example/ABC-1'],
	['the picker query is the agreed filter', taskQuery === '"Status Type": !done Assignee: me() "Sort by": Updated DESC'],
	['the picker uses a configured task query', queryTasks.body.ok === true && customQuery === 'Assignee: me()'],
	['the task list is cached between openings', tasksAgain.body.ok === true && taskSearches === 1],
	['POST on the task route is refused', (await call(tasksRoute, { method: 'POST' })).status === 405],

	// ---- one issue for the pinned teamwork row ------------------------------
	['a task is read by key', task.status === 200 && task.body.ok === true && task.body.task.key === 'ABC-1'],
	['the task carries its summary and status', task.body.task.summary === 'Fix the thing'
		&& task.body.task.status === 'Open'],
	['the task is addressed upstream by key', taskSent.url === '/issues/ABC-1'],
	['a missing key is refused', (await call(taskRoute, { method: 'GET', url: '/yandex-tracker-today/task' })).status === 400],
	['an unknown task is reported', missingTask.status === 404 && missingTask.body.reason === 'notfound'],
	['POST on the single-task route is refused', (await call(taskRoute, { method: 'POST' })).status === 405],
];

const getAnswer = await call(add, { method: 'GET' });
checks.push(['GET answers 405', getAnswer.status === 405 && getAnswer.headers.allow === 'POST']);

// A rejected request never reaches Tracker.
const guardedRoutes = (() => {
	const captured = new Map();
	apply({
		webServer: { register: (definition) => { captured.set(definition.path, definition); return () => {}; } },
		connection: { requestRejection: () => 403 },
		effect: (callback) => { callback(); },
	}, { orgId: '1', apiBase: origin });
	return captured;
})();
const refused = await call(guardedRoutes.get('/yandex-tracker-today/worklog'), { body: base });
checks.push(['a rejected browser is refused', refused.status === 403]);

// An unconfigured row explains itself instead of calling the API.
const bareRoutes = mount({ apiBase: origin });
const unconfigured = await call(bareRoutes.get('/yandex-tracker-today/worklog'), { body: base });
checks.push(['an unconfigured row is refused', unconfigured.status === 400 && unconfigured.body.reason === 'unconfigured']);

// The delete route shares the same guards.
const refusedDelete = await call(guardedRoutes.get('/yandex-tracker-today/worklog/delete'), {
	body: { key: 'ABC-123', id: '900' },
});
checks.push(['the delete route is trust-fenced', refusedDelete.status === 403]);
const unconfiguredDelete = await call(bareRoutes.get('/yandex-tracker-today/worklog/delete'), {
	body: { key: 'ABC-123', id: '900' },
});
checks.push([
	'the delete route reports an unconfigured row',
	unconfiguredDelete.status === 400 && unconfiguredDelete.body.reason === 'unconfigured',
]);

// The task picker route is a read, and shares the same fence and config checks.
const tasksGuarded = await call(guardedRoutes.get('/yandex-tracker-today/tasks'), { method: 'GET' });
checks.push(['the task route is trust-fenced', tasksGuarded.status === 403]);
const tasksUnconfigured = await call(bareRoutes.get('/yandex-tracker-today/tasks'), { method: 'GET' });
checks.push([
	'the task route reports an unconfigured row',
	tasksUnconfigured.status === 400 && tasksUnconfigured.body.reason === 'unconfigured',
]);

// The single-task route shares the same fence and configuration checks.
const taskGuarded = await call(guardedRoutes.get('/yandex-tracker-today/task'), {
	method: 'GET', url: '/yandex-tracker-today/task?key=ABC-1',
});
checks.push(['the single-task route is trust-fenced', taskGuarded.status === 403]);
const taskUnconfigured = await call(bareRoutes.get('/yandex-tracker-today/task'), {
	method: 'GET', url: '/yandex-tracker-today/task?key=ABC-1',
});
checks.push([
	'the single-task route reports an unconfigured row',
	taskUnconfigured.status === 400 && taskUnconfigured.body.reason === 'unconfigured',
]);

// A Tracker refusal is reported with its own message, not a silent success.
const before = seen.length;
writeAnswer = 'forbidden';
const upstreamRefusal = await call(
	mount({ token: 'test-token', orgId: '1234567', timeZone: 'Europe/Moscow' }).get('/yandex-tracker-today/worklog'),
	{ body: base },
);
writeAnswer = 'ok';
checks.push([
	'a Tracker refusal is reported',
	upstreamRefusal.status === 502
		&& upstreamRefusal.body.ok === false
		&& upstreamRefusal.body.reason === 'unauthorized'
		&& upstreamRefusal.body.message.includes('Р СњР ВµР Т‘Р С•РЎРѓРЎвЂљР В°РЎвЂљР С•РЎвЂЎР Р…Р С• Р С—РЎР‚Р В°Р Р†'),
]);
checks.push(['the refused request still reached Tracker', seen.slice(before).some((row) => row.method === 'POST'
	&& /^\/issues\/[^/]+\/worklog$/u.test(row.url))]);

// A Tracker refusal to delete is reported too.
deleteAnswer = 'forbidden';
const upstreamDeleteRefusal = await call(del, { body: { key: 'ABC-123', id: '900' } });
deleteAnswer = 'ok';
checks.push([
	'a Tracker refusal to delete is reported',
	upstreamDeleteRefusal.status === 502
		&& upstreamDeleteRefusal.body.ok === false
		&& upstreamDeleteRefusal.body.reason === 'unauthorized'
		&& upstreamDeleteRefusal.body.message.includes('Р СњР ВµР Т‘Р С•РЎРѓРЎвЂљР В°РЎвЂљР С•РЎвЂЎР Р…Р С• Р С—РЎР‚Р В°Р Р†'),
]);

// ---- the summary cache is invalidated by a write --------------------------
const searches = () => seen.filter((row) => row.url.startsWith('/worklog/_search')).length;
const firstRead = await call(summary, { method: 'GET' });
const afterFirst = searches();
const cachedRead = await call(summary, { method: 'GET' });
const afterCached = searches();
const write = await call(add, { body: { ...base, spent: '1h' } });
const afterWrite = searches();
const freshRead = await call(summary, { method: 'GET' });
const afterFresh = searches();

checks.push([
	'the summary is cached between reads',
	firstRead.body.ok === true && cachedRead.body.ok === true && afterFirst === 2 && afterCached === 2,
]);
checks.push([
	'a write clears the cached summary',
	write.status === 200 && freshRead.body.ok === true && afterWrite === 2 && afterFresh === 4,
]);

const deleteWrite = await call(del, { body: { key: 'ABC-123', id: '900' } });
const afterDelete = searches();
const deleteRead = await call(summary, { method: 'GET' });
const afterDeleteRead = searches();
checks.push([
	'a delete clears the cached summary',
	deleteWrite.status === 200 && deleteRead.body.ok === true && afterDelete === 4 && afterDeleteRead === 6,
]);

TRACKER.close();
for (const [name, passed] of checks) console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}`);
const failed = checks.filter(([, passed]) => !passed).length;
console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
