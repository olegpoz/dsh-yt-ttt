/**
 * Coverage for the calendar route the add form's "Calendar event" field calls.
 *
 * A mock CalDAV server answers discovery and the events REPORT, so the route's
 * query shape, ICS parsing (timed, all-day, recurring), caching, validation and
 * the unconfigured state are exercised without Yandex Calendar.
 */
import { createServer } from 'node:http';
import { apply } from '../index.js';
import { makeCredentialStore, TOKEN_KEY, CALENDAR_PASSWORD_KEY } from './helpers.mjs';

const TRACKER = createServer((req, res) => {
	let raw = '';
	req.on('data', (chunk) => { raw += chunk; });
	req.on('end', () => {
		const method = req.method ?? '';
		const url = req.url ?? '';
		res.setHeader('content-type', 'application/xml; charset=utf-8');
		if (method === 'PROPFIND' && url === '/') {
			res.end(`<?xml version="1.0" encoding="utf-8"?>
<d:multistatus xmlns:d="DAV:"><d:response><d:href>/</d:href><d:propstat><d:prop>
<d:current-user-principal><d:href>/principals/users/test/</d:href></d:current-user-principal>
</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>`);
			return;
		}
		if (method === 'PROPFIND' && url === '/principals/users/test/') {
			res.end(`<?xml version="1.0" encoding="utf-8"?>
<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/principals/users/test/</d:href><d:propstat><d:prop>
<c:calendar-home-set><d:href>/calendars/test/</d:href></c:calendar-home-set>
</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>`);
			return;
		}
		if (method === 'PROPFIND' && url === '/calendars/test/') {
			res.end(`<?xml version="1.0" encoding="utf-8"?>
<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/calendars/test/default/</d:href><d:propstat><d:prop>
<d:resourcetype><d:collection/><c:calendar/></d:resourcetype><d:displayname>Default</d:displayname>
</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>`);
			return;
		}
		if (method === 'REPORT' && url === '/calendars/test/default/') {
			reports += 1;
			res.end(`<?xml version="1.0" encoding="utf-8"?>
<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/calendars/test/default/events.ics</d:href><d:propstat><d:prop>
<c:calendar-data>BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:standup
SUMMARY:Daily standup
DTSTART;TZID=Europe/Moscow:20261109T100000
DTEND;TZID=Europe/Moscow:20261109T101500
LOCATION:Room 1
END:VEVENT
BEGIN:VEVENT
UID:recurring
SUMMARY:Weekly sync
DTSTART;TZID=Europe/Moscow:20261102T090000
DTEND;TZID=Europe/Moscow:20261102T093000
RRULE:FREQ=WEEKLY;INTERVAL=1
END:VEVENT
BEGIN:VEVENT
UID:allday
SUMMARY:Conference
DTSTART;VALUE=DATE:20261109
DTEND;VALUE=DATE:20261110
END:VEVENT
END:VCALENDAR</c:calendar-data>
</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>`);
			return;
		}
		res.statusCode = 404;
		res.end('<d:multistatus xmlns:d="DAV:"/>');
	});
});
let reports = 0;
await new Promise((resolve) => TRACKER.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${TRACKER.address().port}`;

/**
 * Mount the plugin and return the calendar route.
 * @param config - extra plugin configuration.
 * @param rejection - the trust-fence verdict.
 * @returns the route.
 */
function mount(config, rejection = () => undefined) {
	const routes = new Map();
	// The calendar password is a secret, so it comes from the credential store and
	// not from the row config: the suite seeds a store the way the window would.
	const { token, calendarPassword, ...rest } = {
		token: 't', orgId: '1', timeZone: 'Europe/Moscow', apiBase: origin,
		calendarLogin: 'test', calendarPassword: 'secret', calendarUrl: origin,
		...config,
	};
	const credentials = makeCredentialStore({
		...(typeof token === 'string' && token !== '' ? { [TOKEN_KEY]: token } : {}),
		...(typeof calendarPassword === 'string' && calendarPassword !== ''
			? { [CALENDAR_PASSWORD_KEY]: calendarPassword }
			: {}),
	});
	apply({
		webServer: { register: (definition) => { routes.set(definition.path, definition); return () => {}; } },
		connection: { requestRejection: rejection },
		effect: (callback) => { callback(); },
		get: (name) => (name === 'credentials' ? credentials : undefined),
	}, rest);
	return routes.get('/yandex-tracker-today/events');
}

const route = mount();

/** Drive the route with a request double. */
function call(target, { method = 'GET', url } = {}) {
	return new Promise((resolve) => {
		const req = { method, url: url ?? '/yandex-tracker-today/events?date=2026-11-09', headers: {} };
		const res = {
			statusCode: 0,
			setHeader() {},
			end(payload) {
				resolve({ status: res.statusCode, body: payload === undefined ? null : JSON.parse(payload) });
			},
		};
		target.handler(req, res);
	});
}

const events = await call(route);
const afterFirst = reports;
const again = await call(route);
const afterAgain = reports;
const forced = await call(route, { url: '/yandex-tracker-today/events?date=2026-11-09&force=1' });
const afterForced = reports;
const titles = events.body.events.map((event) => event.title);
const standup = events.body.events.find((event) => event.title === 'Daily standup');
const recurring = events.body.events.find((event) => event.title === 'Weekly sync');
const allDay = events.body.events.find((event) => event.title === 'Conference');

const unconfigured = mount({ calendarLogin: '', calendarPassword: '' });
const unconfiguredAnswer = await call(unconfigured);
const badDate = await call(route, { url: '/yandex-tracker-today/events?date=nope' });
const wrongMethod = await call(route, { method: 'POST' });
const guarded = mount({}, () => 403);
const guardedAnswer = await call(guarded);

TRACKER.close();
const checks = [
	['the day is read', events.status === 200 && events.body.ok === true],
	['three events are returned', events.body.events.length === 3],
	['events are ordered by start', titles.join('|') === 'Conference|Weekly sync|Daily standup'],
	['a timed event carries its clock', standup.clock === '10:00\u201310:15'],
	['a timed event carries its clock minutes', standup.startMinutes === 600 && standup.durationMinutes === 15],
	['a recurring event carries its clock minutes', recurring.startMinutes === 540 && recurring.durationMinutes === 30],
	['a timed event carries its calendar and place', standup.calendar === 'Default' && standup.location === 'Room 1'],
	['a recurring event lands on the date', recurring.clock === '09:00\u201309:30'],
	['an all-day event reads as all day', allDay.clock === 'All day'],
	['the events are cached between openings', again.status === 200 && afterFirst === 1 && afterAgain === 1],
	['a forced read bypasses the cache', forced.status === 200 && forced.body.events.length === 3 && afterForced === 2],
	['an unconfigured calendar is reported', unconfiguredAnswer.body.reason === 'calendar-unconfigured'],
	['a malformed date is refused', badDate.status === 400],
	['an unsupported method is refused', wrongMethod.status === 405 && wrongMethod.body.reason === 'method'],
	['the route is trust-fenced', guardedAnswer.status === 403],
];

for (const [name, passed] of checks) console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}`);
const failed = checks.filter(([, passed]) => !passed).length;
console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
