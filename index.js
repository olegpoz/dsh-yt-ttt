/**
 * Host half of the "Yandex Tracker logged today" badge.
 *
 * Owns the two operations the badge needs: sum the durations of the worklogs the
 * configured user started today, in the configured time zone, and add one new
 * worklog for that user. The Tracker token never leaves this process РІР‚вЂќ the
 * browser half only talks to the plugin's authenticated Web routes, so the page
 * never holds a credential and never talks to Tracker directly.
 *
 * Adding a worklog writes to Tracker, so the configured token needs the
 * `tracker:write` scope in addition to `tracker:read`.
 *
 * Configuration comes from the bundle row (see `cordis.patch.yml`):
 *
 *   token      OAuth token with `tracker:read` (required)
 *   orgId      Yandex 360 organization id  -> X-Org-ID       (one of the two)
 *   cloudOrgId Yandex Cloud organization id -> X-Cloud-Org-ID (one of the two)
 *   login      Tracker login; resolved from /myself when empty
 *   timeZone   IANA zone deciding what "today" means; the host zone when empty
 *   defaultQueue  queue key that a digits-only task key is expanded with
 *   workdayEnd    end of the working day, `HH:MM` (default 18:00)
 *   calendarLogin CalDAV login for Yandex Calendar, usually the full address
 *   calendarPassword  Yandex Calendar app password
 *   calendarUrl   CalDAV root, default https://caldav.yandex.ru
 *   apiBase    API root, default https://api.tracker.yandex.net/v3
 *   webBase    Web root used by the badge's link, default https://tracker.yandex.ru
 */

/** Authenticated route the browser half reads the summary from. */
const SUMMARY_PATH = '/yandex-tracker-today/summary';
/** Authenticated route the browser half adds a worklog through. */
const ADD_PATH = '/yandex-tracker-today/worklog';
/** Authenticated route the browser half deletes a worklog through. */
const DELETE_PATH = '/yandex-tracker-today/worklog/delete';
/** Authenticated route the task picker reads the account's open issues from. */
const TASKS_PATH = '/yandex-tracker-today/tasks';
/** Authenticated route the picker reads the pinned teamwork task from. */
const TASK_PATH = '/yandex-tracker-today/task';
/** Authenticated route the picker reads and writes its pinned teamwork task through. */
const TEAMWORK_PATH = '/yandex-tracker-today/teamwork';
/** Authenticated route the add form reads the day's calendar events through. */
const EVENTS_PATH = '/yandex-tracker-today/events';
/** Authenticated route the plugin settings are read and written through. */
const SETTINGS_PATH = '/yandex-tracker-today/settings';
/** Authenticated route the settings window probes both connections through. */
const TEST_PATH = '/yandex-tracker-today/test';
/** Storage key of the plugin settings inside the settings table. */
const PLUGIN_SETTINGS_RECORD = 'pluginSettings';
/** The record key an older build used; read once so its settings survive. */
const LEGACY_SETTINGS_RECORD = 'addingTime';
/** Credential record holding the Tracker OAuth token. */
const TOKEN_CREDENTIAL = 'yandex-tracker-today/tracker-token';
/** Credential record holding the Yandex Calendar app password. */
const CALENDAR_PASSWORD_CREDENTIAL = 'yandex-tracker-today/calendar-password';
/** The values the "When Duration changed" setting accepts. */
const DURATION_CHANGES = new Set(['end', 'start']);
/** Default CalDAV endpoint of Yandex Calendar. */
const DEFAULT_CALENDAR_URL = 'https://caldav.yandex.ru';
/**
 * Storage unit name holding the plugin's own settings.
 *
 * The JSON backend accepts only `[a-z][a-z0-9_]*`, so the plugin id's hyphens
 * cannot be used here.
 */
const TEAMWORK_UNIT = 'yandex_tracker_today';
/** Storage table inside that unit. */
const TEAMWORK_TABLE = 'settings';
/** Storage key of the pinned teamwork task inside that table. */
const TEAMWORK_RECORD = 'teamworkTask';
/** Largest JSON body a write route accepts; the forms send short fields. */
const MAX_WRITE_BODY_BYTES = 16 * 1024;
/** API root of the Tracker v3 endpoint. */
const DEFAULT_API_BASE = 'https://api.tracker.yandex.net/v3';
/** Web root of Tracker, used for the "My issues" link. */
const DEFAULT_WEB_BASE = 'https://tracker.yandex.ru';
/** Page size for the worklog search; the API caps one page at 100 records. */
const PAGE_SIZE = 100;
/** Upper bound on pages read per refresh, so one bad filter cannot loop forever. */
const MAX_PAGES = 20;
/** Deadline for one Tracker request. */
const REQUEST_TIMEOUT_MS = 20000;
/** How long one computed summary satisfies reads that arrive right after it. */
const CACHE_TTL_MS = 15000;
/** How long the picker's task list satisfies reads that arrive right after it. */
const TASKS_CACHE_TTL_MS = 60000;
/** How long the discovered calendar list satisfies repeat reads. */
const CALENDAR_LIST_TTL_MS = 300000;
/** How long one date's events satisfy repeat reads. */
const EVENTS_CACHE_TTL_MS = 60000;
/** Tracker Web page the badge opens; one place so every payload agrees. */
const MY_PAGE_PATH = '/pages/my';

/** Required services: the Web carrier and the browser-trust checks for its route. */
export const inject = ['webServer', 'connection'];

/**
 * Read one optional string field.
 * @param value - raw field value from the row config.
 * @returns the trimmed value, or an empty string when absent.
 */
function text(value) {
	return typeof value === 'string' ? value.trim() : '';
}

/**
 * The host's own IANA zone, used when the row does not name one.
 * @returns an IANA zone id, falling back to UTC.
 */
function hostTimeZone() {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
	} catch {
		return 'UTC';
	}
}

/**
 * The minutes-of-day an `HH:MM` text names.
 * @param value - raw text.
 * @returns minutes since midnight, or null when the text is not a clock time.
 */
function clockMinutes(value) {
	const matched = /^(\d{1,2}):(\d{2})$/u.exec(text(value));
	if (matched === null) return null;
	const hours = Number(matched[1]);
	const minutes = Number(matched[2]);
	return hours <= 23 && minutes < 60 ? hours * 60 + minutes : null;
}

/**
 * Normalize the raw row config into the shape the request path uses.
 * @param raw - the row's `config` value, which may be absent.
 * @returns the normalized configuration.
 */
function normalizeConfig(raw) {
	const source = raw !== null && typeof raw === 'object' ? raw : {};
	const dailyTarget = Number(source.dailyTargetHours);
	const defaultDuration = Number(source.defaultDurationMinutes);
	// Secrets are not read from the row config: the token and the calendar
	// password belong to the profile credential store and are entered in the
	// settings window. A value left in YAML is ignored on purpose, because the
	// config file is the one that gets copied, shared and committed.
	if (text(source.token) !== '' || text(source.calendarPassword) !== '') {
		console.warn('dsh-yt-ttt: the token and the calendar password in the plugin config are ignored;'
			+ ' set them in the plugin settings window.');
	}
	return {
		token: '',
		orgId: text(source.orgId),
		cloudOrgId: text(source.cloudOrgId),
		login: text(source.login),
		timeZone: text(source.timeZone) || hostTimeZone(),
		defaultQueue: text(source.defaultQueue),
		workdayStartMinutes: clockMinutes(source.workdayStart) ?? DEFAULT_WORKDAY_START_MINUTES,
		workdayEndMinutes: clockMinutes(source.workdayEnd) ?? WORKDAY_END_MINUTES,
		dailyTargetHours: Number.isFinite(dailyTarget) && dailyTarget > 0 && dailyTarget <= 24
			? dailyTarget
			: DEFAULT_DAILY_TARGET_HOURS,
		defaultDurationMinutes: Number.isInteger(defaultDuration) && defaultDuration >= 5 && defaultDuration <= 1440
			? defaultDuration
			: DEFAULT_DEFAULT_DURATION_MINUTES,
		eventCommentPrefix: typeof source.eventCommentPrefix === 'string'
			? source.eventCommentPrefix
			: (typeof source.meetingCommentPrefix === 'string' ? source.meetingCommentPrefix : DEFAULT_EVENT_COMMENT_PREFIX),
		calendarLogin: text(source.calendarLogin),
		calendarPassword: '',
		calendarUrl: (text(source.calendarUrl) || DEFAULT_CALENDAR_URL).replace(/\/+$/u, ''),
		apiBase: (text(source.apiBase) || DEFAULT_API_BASE).replace(/\/+$/u, ''),
		webBase: (text(source.webBase) || DEFAULT_WEB_BASE).replace(/\/+$/u, ''),
	};
}

/**
 * The `+HHMM`/`-HHMM` offset an IANA zone had at one instant.
 * @param timeZone - IANA zone id.
 * @param at - the instant to resolve the offset for.
 * @returns the offset suffix spelled the way Tracker accepts it.
 */
function zoneOffsetSuffix(timeZone, at) {
	try {
		const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' }).formatToParts(at);
		const name = parts.find((part) => part.type === 'timeZoneName');
		const matched = name === undefined ? null : /GMT([+-])(\d{2}):(\d{2})/u.exec(name.value);
		return matched === null ? '+0000' : `${matched[1]}${matched[2]}${matched[3]}`;
	} catch {
		return '+0000';
	}
}

/**
 * The wall-clock `HH:MM` an instant reads as inside a zone.
 * @param timeZone - IANA zone id.
 * @param value - an ISO timestamp, or nothing when the record has no start.
 * @returns the local time, or an empty string when it cannot be read.
 */
function localTime(timeZone, value) {
	if (typeof value !== 'string' || value.trim() === '') return '';
	const at = new Date(value);
	if (Number.isNaN(at.getTime())) return '';
	try {
		return new Intl.DateTimeFormat('en-GB', {
			timeZone, hour: '2-digit', minute: '2-digit', hour12: false,
		}).format(at);
	} catch {
		return at.toISOString().slice(11, 16);
	}
}

/**
 * The calendar date one instant falls on inside a zone.
 * @param timeZone - IANA zone id.
 * @param at - the instant to read.
 * @returns the local `YYYY-MM-DD` date.
 */
function localDate(timeZone, at) {
	try {
		const parts = new Intl.DateTimeFormat('en-CA', {
			timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
		}).formatToParts(at);
		const field = (type) => parts.find((part) => part.type === type)?.value ?? '';
		return `${field('year')}-${field('month')}-${field('day')}`;
	} catch {
		return new Date(at).toISOString().slice(0, 10);
	}
}

/**
 * Move a plain `YYYY-MM-DD` date by whole days.
 *
 * The date is anchored at UTC midnight, so the arithmetic is unaffected by the
 * zone's offset or by a DST transition; only the calendar day moves.
 * @param date - the plain starting date.
 * @param days - how many days to move (negative goes back).
 * @returns the shifted plain date.
 */
function shiftDate(date, days) {
	const at = new Date(`${date}T00:00:00Z`);
	at.setUTCDate(at.getUTCDate() + days);
	return at.toISOString().slice(0, 10);
}

/**
 * The day of the week one plain date falls on.
 * @param date - a plain `YYYY-MM-DD` date.
 * @returns the index, 0 for Sunday through 6 for Saturday.
 */
function weekdayOf(date) {
	return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/**
 * The half-open range Tracker filters `start` by for one local day.
 * @param timeZone - IANA zone id.
 * @param date - the plain local date.
 * @param at - an instant used to resolve the zone's offset on that side of the year.
 * @returns the inclusive local-day bounds as offset-bearing timestamps.
 */
function dayRange(timeZone, date, at) {
	const suffix = zoneOffsetSuffix(timeZone, at);
	return { date, from: `${date}T00:00:00.000${suffix}`, to: `${date}T23:59:59.999${suffix}` };
}

/**
 * The half-open "today" range Tracker filters `start` by.
 * @param timeZone - IANA zone id.
 * @param at - the instant deciding which day is today.
 * @returns the inclusive local-day bounds as offset-bearing timestamps.
 */
function todayRange(timeZone, at) {
	return dayRange(timeZone, localDate(timeZone, at), at);
}

/**
 * The half-open "yesterday" range, one local day back from `at`.
 * @param timeZone - IANA zone id.
 * @param at - the instant deciding which day is today.
 * @returns the previous local day's bounds, its plain date, and whether it was a weekend.
 */
function yesterdayRange(timeZone, at) {
	const date = shiftDate(localDate(timeZone, at), -1);
	// The offset is resolved from noon of that day, so a DST transition earlier
	// that same morning cannot hand the range the wrong side's offset.
	const range = dayRange(timeZone, date, new Date(`${date}T12:00:00Z`));
	const weekday = weekdayOf(date);
	return { ...range, weekday, weekend: weekday === 0 || weekday === 6 };
}

/**
 * Minutes carried by one duration spelling.
 *
 * Tracker's own shape is ISO 8601 (`PT2H30M`). The form also accepts the
 * compact `5h10m`, decimal hours (`5,5` or `5.5`), and an hours-minutes pair
 * (`1-10`), because those are how people usually type a day's work. The human
 * forms some older records carry (`1h 30m`, `90m`) keep working.
 * @param value - the duration text.
 * @returns whole minutes; unknown shapes contribute zero.
 */
function durationMinutes(value) {
	if (typeof value !== 'string') return 0;
	// The form's decimal hours use a comma (`5,5`); the patterns below spell the
	// decimal point, so the comma is folded into it first.
	const trimmed = value.trim().replace(/,/gu, '.');
	const iso = /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/u.exec(trimmed);
	if (iso !== null && trimmed !== 'P') {
		return Math.round(
			Number(iso[1] ?? 0) * 1440 + Number(iso[2] ?? 0) * 60 + Number(iso[3] ?? 0) + Number(iso[4] ?? 0) / 60,
		);
	}
	// `1-10` is one hour and ten minutes. A minutes part of 60 or more is not a
	// pair at all, so `1-60` is refused rather than silently read as two hours.
	const pair = /^(\d{1,3})\s*-\s*(\d{1,2})$/u.exec(trimmed);
	if (pair !== null) {
		const minutes = Number(pair[2]);
		return minutes < 60 ? Number(pair[1]) * 60 + minutes : 0;
	}
	// The add form submits its Duration as `hh:mm`.
	const clock = /^(\d{1,3}):(\d{2})$/u.exec(trimmed);
	if (clock !== null) {
		const minutes = Number(clock[2]);
		return minutes < 60 ? Number(clock[1]) * 60 + minutes : 0;
	}
	// Tolerate the human forms some deployments and older records carry (`1h 30m`, `90m`).
	const human = /^(?:(\d+(?:\.\d+)?)\s*[h\u0447])?\s*(?:(\d+(?:\.\d+)?)\s*(?:m|\u043c\u0438\u043d))?$/iu.exec(trimmed);
	if (human !== null && (human[1] !== undefined || human[2] !== undefined)) {
		return Math.round(Number(human[1] ?? 0) * 60 + Number(human[2] ?? 0));
	}
	// A bare decimal is hours (`5,5` is five and a half hours), while a bare
	// integer keeps its long-standing meaning of minutes (`45` is 45m).
	if (/^\d+\.\d+$/u.test(trimmed)) return Math.round(Number(trimmed) * 60);
	if (/^\d+$/u.test(trimmed)) return Number(trimmed);
	return 0;
}

/**
 * Format minutes the way the badge shows them (`3:40`, `12:05`).
 * @param minutes - total logged minutes.
 * @returns the compact `H:MM` text.
 */
function formatMinutes(minutes) {
	const safe = Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : 0;
	return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

/**
 * Turn a date-and-time entered in a zone into an offset-bearing timestamp.
 *
 * The browser's `datetime-local` input sends a plain wall time, and Tracker
 * wants a start carrying its zone. The offset comes from the target zone, not
 * from the browser's own, and is resolved twice so a DST transition near the
 * entered time cannot leave the record an hour off.
 * @param timeZone - IANA zone id.
 * @param value - `YYYY-MM-DDTHH:mm` (or richer), possibly already offset-bearing.
 * @returns the offset-bearing `YYYY-MM-DDTHH:mm:ss.sss+HHMM` stamp, or null when
 *   the value is not a date and time.
 */
function wallClockStamp(timeZone, value) {
	const raw = text(value);
	if (raw === '') return null;
	// A value that already names its zone is used as-is; Tracker wants the
	// `Р’В±hhmm` form, so a `Z` suffix becomes `+0000`.
	if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/u.test(raw)) {
		const at = new Date(raw);
		return Number.isNaN(at.getTime()) ? null : at.toISOString().replace(/Z$/u, '+0000');
	}
	const matched = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/u.exec(raw);
	if (matched === null) return null;
	const wall = `${matched[1]}-${matched[2]}-${matched[3]}T${matched[4]}:${matched[5]}:${matched[6] ?? '00'}`;
	const epoch = Date.parse(`${wall}Z`);
	if (Number.isNaN(epoch)) return null;
	// Two passes: the first guesses the offset from the entered time read as UTC,
	// the second re-reads it at the instant the first pass produced.
	let suffix = zoneOffsetSuffix(timeZone, new Date(epoch));
	for (let pass = 0; pass < 2; pass += 1) {
		const instant = Date.parse(`${wall}.000${suffix}`);
		if (Number.isNaN(instant)) break;
		suffix = zoneOffsetSuffix(timeZone, new Date(instant));
	}
	return `${wall}.000${suffix}`;
}

/**
 * The issue key a form may address, or an empty string.
 *
 * Tracker keys are `QUEUE-123`; a value with spaces, slashes or no numeric tail
 * cannot address an issue and would only reach the API as a confusing 404.
 * @param value - the raw field value.
 * @returns the key, or an empty string when it is not one.
 */
function issueKeyOf(value) {
	const key = text(value);
	return /^[A-Za-z0-9][A-Za-z0-9_]*-[0-9]+$/u.test(key) ? key : '';
}

/**
 * The worklog id a delete request may address, or an empty string.
 * @param value - the raw field value.
 * @returns the id, or an empty string when it is not one.
 */
function worklogIdOf(value) {
	const id = text(value);
	return /^[A-Za-z0-9_-]{1,64}$/u.test(id) ? id : '';
}

/**
 * The ISO 8601 duration Tracker stores for a number of minutes.
 * @param minutes - whole minutes, greater than zero.
 * @returns the duration, such as `PT5H10M`.
 */
function isoDuration(minutes) {
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	const spelled = `PT${hours > 0 ? `${hours}H` : ''}${rest > 0 ? `${rest}M` : ''}`;
	return spelled === 'PT' ? 'PT0M' : spelled;
}

/**
 * Validate and normalize one add-worklog request.
 *
 * A key made only of digits is expanded with the configured default queue, so
 * `426` becomes `INTWORK-426`; the form does the same before sending, and this
 * keeps the shorthand working for any other caller.
 * @param payload - the parsed request body.
 * @param config - normalized configuration (zone and default queue).
 * @returns the normalized worklog fields, or the reason the request is refused.
 */
function normalizeAddInput(payload, config) {
	if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
		return { ok: false, message: 'Send a JSON object with key, start, spent and comment.' };
	}
	const rawKey = text(payload.key);
	const issueKey = /^\d+$/u.test(rawKey) && config.defaultQueue !== ''
		? `${config.defaultQueue}-${rawKey}`
		: issueKeyOf(rawKey);
	if (issueKey === '') {
		return { ok: false, message: 'Task key must look like ABC-123.' };
	}
	const start = wallClockStamp(config.timeZone, payload.start);
	if (start === null) {
		return { ok: false, message: 'Record date must be a date and a time.' };
	}
	const minutes = durationMinutes(text(payload.spent));
	if (!(minutes > 0) || minutes > 24 * 60) {
		return { ok: false, message: 'Spent must be a positive duration such as 5h10m, 1:30 or 1-10.' };
	}
	const comment = text(payload.comment);
	if (comment.length > 2000) {
		return { ok: false, message: 'Comment is longer than 2000 characters.' };
	}
	return { ok: true, value: { issueKey, start, minutes, duration: isoDuration(minutes), comment } };
}

/**
 * Read one JSON request body.
 * @param req - the incoming request stream.
 * @param limit - the largest accepted body, in bytes.
 * @returns the parsed body, null for an empty body; rejects on oversized or
 *   malformed input.
 */
function readJsonBody(req, limit) {
	return new Promise((resolve, reject) => {
		let settled = false;
		const fail = (error) => {
			if (settled) return;
			settled = true;
			reject(error);
		};
		const chunks = [];
		let size = 0;
		req.on('data', (chunk) => {
			if (settled) return;
			const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
			size += buffer.length;
			if (size > limit) {
				req.resume?.();
				fail(new Error('request body is too large'));
				return;
			}
			chunks.push(buffer);
		});
		req.on('end', () => {
			if (settled) return;
			settled = true;
			const raw = Buffer.concat(chunks).toString('utf8').trim();
			if (raw === '') {
				resolve(null);
				return;
			}
			try {
				resolve(JSON.parse(raw));
			} catch {
				reject(new Error('request body is not valid JSON'));
			}
		});
		req.on('error', fail);
	});
}

/**
 * Run one authenticated Tracker request.
 * @param config - normalized configuration.
 * @param path - API path below the configured root, starting with a slash.
 * @param init - optional request overrides (method, body).
 * @returns the parsed JSON body.
 * @throws an Error carrying the API's status and message when it refuses.
 */
async function trackerRequest(config, path, init = {}) {
	const headers = {
		authorization: `OAuth ${config.token}`,
		accept: 'application/json',
	};
	if (config.cloudOrgId !== '') headers['x-cloud-org-id'] = config.cloudOrgId;
	else if (config.orgId !== '') headers['x-org-id'] = config.orgId;
	if (init.body !== undefined) headers['content-type'] = 'application/json';
	const response = await fetch(`${config.apiBase}${path}`, {
		method: init.method ?? 'GET',
		headers,
		body: init.body,
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	});
	const raw = await response.text();
	let parsed = null;
	try {
		parsed = raw === '' ? null : JSON.parse(raw);
	} catch {
		parsed = null;
	}
	if (!response.ok) {
		const detail = parsed !== null && typeof parsed === 'object'
			? [parsed.errorMessages, parsed.message, parsed.error].flat().filter((item) => typeof item === 'string').join('; ')
			: '';
		const error = new Error(detail === '' ? `Tracker answered ${response.status}` : `${response.status}: ${detail}`);
		error.status = response.status;
		throw error;
	}
	return { body: parsed, headers: response.headers };
}

/**
 * Read the configured account's login from Tracker.
 * @param config - normalized configuration.
 * @returns the login string.
 */
async function resolveLogin(config) {
	const { body } = await trackerRequest(config, '/myself');
	const login = body !== null && typeof body === 'object' ? text(body.login) : '';
	if (login === '') throw new Error('Tracker did not report a login for this token');
	return login;
}

/**
 * Create one worklog for the configured account.
 *
 * `start` and `duration` are the API's own shapes: an offset-bearing timestamp
 * and an ISO 8601 duration. Tracker derives the worklog's author from the token,
 * so no login is sent. The write endpoint is singular (`/worklog`); the plural
 * `/worklogs` collection is read-only and refuses POST.
 * @param config - normalized configuration.
 * @param input - the normalized fields from {@link normalizeAddInput}.
 * @returns the created worklog's id, or null when Tracker answers without one.
 */
async function createWorklog(config, input) {
	const { body } = await trackerRequest(config, `/issues/${encodeURIComponent(input.issueKey)}/worklog`, {
		method: 'POST',
		body: JSON.stringify({ start: input.start, duration: input.duration, comment: input.comment }),
	});
	return body !== null && typeof body === 'object' && (typeof body.id === 'number' || typeof body.id === 'string')
		? String(body.id)
		: null;
}

/**
 * Delete one worklog of the configured account.
 *
 * The delete endpoint is the singular `/worklog/{record}` addressed at one
 * record, mirroring the create endpoint; the API answers 204 with no body.
 * @param config - normalized configuration.
 * @param issueKey - the issue the record belongs to.
 * @param id - the worklog id the summary reported.
 */
async function deleteWorklog(config, issueKey, id) {
	await trackerRequest(config, `/issues/${encodeURIComponent(issueKey)}/worklog/${encodeURIComponent(id)}`, {
		method: 'DELETE',
	});
}

/**
 * The Tracker query behind the task picker's "Your current tasks" list.
 *
 * Open issues assigned to the token's own account, minus the three statuses that
 * are not work in progress, most recently updated first. Tracker's query
 * language spells the clauses; the host passes them through unchanged so the
 * filter stays one readable string rather than a set of API parameters.
 */
const CURRENT_TASKS_QUERY = '"Status Type": !done Assignee: me() Status: !reviewcode'
	+ ' Status: !architecturealignment Status: !podklucennoeRassirenie "Sort by": Updated DESC';

/**
 * Map one Tracker issue record onto the row the picker renders.
 * @param row - an issue record from the API.
 * @param config - normalized configuration, for the web link.
 * @returns the task row: key, summary, status and where it opens.
 */
function taskOf(row, config) {
	return {
		key: text(row.key),
		summary: text(row.summary),
		status: text(row.status?.display),
		statusKey: text(row.status?.key),
		updatedAt: text(row.updatedAt),
		url: `${config.webBase}/${text(row.key)}`,
	};
}

/** The default ceiling of one worklog, in hours. */
const DEFAULT_MAX_DURATION_HOURS = 8;
/** The largest ceiling the settings accept, in hours. */
const MAX_DURATION_HOURS_LIMIT = 24;
/** The default delay before the list re-reads after a write, in seconds. */
const DEFAULT_REFRESH_DELAY_SECONDS = 3;
/** The largest refresh delay the settings accept, in seconds. */
const MAX_REFRESH_DELAY_SECONDS = 60;
/** The default start of the working day, in minutes. */
const DEFAULT_WORKDAY_START_MINUTES = 9 * 60;
/** The default daily target, in hours. */
const DEFAULT_DAILY_TARGET_HOURS = 8;
/** The default duration of a new worklog, in minutes. */
const DEFAULT_DEFAULT_DURATION_MINUTES = 60;
/** The default comment prefix a picked calendar event writes. */
const DEFAULT_EVENT_COMMENT_PREFIX = '\u0412\u0441\u0442\u0440\u0435\u0447\u0430: ';
/** The default background poll interval, in minutes. */
const DEFAULT_POLL_INTERVAL_MINUTES = 5;
/** The largest poll interval the settings accept, in minutes. */
const MAX_POLL_INTERVAL_MINUTES = 60;

/**
 * Whether a text names a time zone the runtime accepts.
 * @param value - the zone id.
 * @returns true when Intl can format with it.
 */
function validTimeZone(value) {
	try {
		new Intl.DateTimeFormat('en-GB', { timeZone: value }).format();
		return true;
	} catch {
		return false;
	}
}

/**
 * The stored plugin settings in their canonical shape.
 *
 * The runtime preferences sit next to the connection and queue defaults, so the
 * settings window is the one place they are edited. Absent fields fall back to
 * the configuration the row was installed with.
 * @param value - the record read from the storage unit.
 * @param config - normalized configuration, the fallback for absent fields.
 * @returns the settings with their effective values.
 */
/**
 * The settings fields a POST may carry, each with its own validator.
 *
 * The route loops over this table instead of repeating one block per field; a
 * validator returns `{ value }` for the normalized setting or `{ error }` for
 * the message the caller should see. Secrets are not fields here: they go to
 * the credential store and are handled by the route itself.
 */
const SETTINGS_FIELDS = {
	durationChange: (value) => (DURATION_CHANGES.has(value)
		? { value }
		: { error: 'durationChange must be "end" or "start".' }),
	maxDurationHours: (value) => {
		const hours = Number(value);
		return Number.isInteger(hours) && hours >= 1 && hours <= MAX_DURATION_HOURS_LIMIT
			? { value: hours }
			: { error: `maxDurationHours must be a whole number from 1 to ${MAX_DURATION_HOURS_LIMIT}.` };
	},
	refreshDelaySeconds: (value) => {
		const seconds = Number(value);
		return Number.isInteger(seconds) && seconds >= 1 && seconds <= MAX_REFRESH_DELAY_SECONDS
			? { value: seconds }
			: { error: `refreshDelaySeconds must be a whole number from 1 to ${MAX_REFRESH_DELAY_SECONDS}.` };
	},
	pollIntervalMinutes: (value) => {
		const minutes = Number(value);
		return Number.isInteger(minutes) && minutes >= 1 && minutes <= MAX_POLL_INTERVAL_MINUTES
			? { value: minutes }
			: { error: `pollIntervalMinutes must be a whole number from 1 to ${MAX_POLL_INTERVAL_MINUTES}.` };
	},
	timeZone: (value) => {
		if (typeof value !== 'string') return { error: 'timeZone must be text.' };
		const zone = value.trim();
		if (zone !== '' && !validTimeZone(zone)) return { error: 'Unknown time zone.' };
		return { value: zone };
	},
	defaultQueue: (value) => (typeof value === 'string'
		? { value: value.trim() }
		: { error: 'defaultQueue must be text.' }),
	workdayStart: (value) => (typeof value === 'string' && clockMinutes(value) !== null
		? { value: value.trim() }
		: { error: 'workdayStart must be HH:MM.' }),
	workdayEnd: (value) => (typeof value === 'string' && clockMinutes(value) !== null
		? { value: value.trim() }
		: { error: 'workdayEnd must be HH:MM.' }),
	dailyTargetHours: (value) => {
		const target = Number(value);
		return Number.isFinite(target) && target > 0 && target <= 24
			? { value: target }
			: { error: 'dailyTargetHours must be from 0 to 24 hours.' };
	},
	defaultDurationMinutes: (value) => {
		const minutes = Number(value);
		return Number.isInteger(minutes) && minutes >= 5 && minutes <= 1440 && minutes % 5 === 0
			? { value: minutes }
			: { error: 'defaultDurationMinutes must be 5 to 1440, a multiple of 5.' };
	},
	eventCommentPrefix: (value) => (typeof value === 'string' && value.length <= 200
		? { value }
		: { error: 'eventCommentPrefix must be short text.' }),
	orgId: (value) => (typeof value === 'string' && value.trim() !== ''
		? { value: value.trim() }
		: { error: 'orgId must be non-empty text.' }),
	login: (value) => (typeof value === 'string'
		? { value: value.trim() }
		: { error: 'login must be text.' }),
	calendarLogin: (value) => (typeof value === 'string'
		? { value: value.trim() }
		: { error: 'calendarLogin must be text.' }),
};

function storedPluginSettings(value, config) {
	const source = value !== null && typeof value === 'object' ? value : {};
	const hours = Number(source.maxDurationHours);
	const delay = Number(source.refreshDelaySeconds);
	const zone = typeof source.timeZone === 'string' ? source.timeZone.trim() : '';
	const queue = typeof source.defaultQueue === 'string' ? source.defaultQueue.trim() : null;
	const end = typeof source.workdayEnd === 'string' ? source.workdayEnd.trim() : '';
	const start = typeof source.workdayStart === 'string' ? source.workdayStart.trim() : '';
	const login = typeof source.calendarLogin === 'string' ? source.calendarLogin.trim() : null;
	const target = Number(source.dailyTargetHours);
	const duration = Number(source.defaultDurationMinutes);
	const poll = Number(source.pollIntervalMinutes);
	const prefix = typeof source.eventCommentPrefix === 'string'
		? source.eventCommentPrefix
		: (typeof source.meetingCommentPrefix === 'string' ? source.meetingCommentPrefix : null);
	const token = typeof source.token === 'string' && source.token.trim() !== '' ? source.token.trim() : null;
	const orgId = typeof source.orgId === 'string' ? source.orgId.trim() : null;
	const trackerLogin = typeof source.login === 'string' ? source.login.trim() : null;
	const calendarPassword = typeof source.calendarPassword === 'string' && source.calendarPassword !== ''
		? source.calendarPassword
		: null;
	return {
		durationChange: DURATION_CHANGES.has(source.durationChange) ? source.durationChange : 'end',
		maxDurationHours: Number.isInteger(hours) && hours >= 1 && hours <= MAX_DURATION_HOURS_LIMIT
			? hours
			: DEFAULT_MAX_DURATION_HOURS,
		refreshDelaySeconds: Number.isInteger(delay) && delay >= 1 && delay <= MAX_REFRESH_DELAY_SECONDS
			? delay
			: DEFAULT_REFRESH_DELAY_SECONDS,
		timeZone: zone !== '' && validTimeZone(zone) ? zone : config.timeZone,
		defaultQueue: queue ?? config.defaultQueue,
		workdayStart: start !== '' && clockMinutes(start) !== null ? start : formatClock(config.workdayStartMinutes),
		workdayEnd: end !== '' && clockMinutes(end) !== null ? end : formatClock(config.workdayEndMinutes),
		dailyTargetHours: Number.isFinite(target) && target > 0 && target <= 24
			? target
			: config.dailyTargetHours,
		defaultDurationMinutes: Number.isInteger(duration) && duration >= 5 && duration <= 1440
			? duration
			: config.defaultDurationMinutes,
		eventCommentPrefix: prefix ?? config.eventCommentPrefix,
		pollIntervalMinutes: Number.isInteger(poll) && poll >= 1 && poll <= MAX_POLL_INTERVAL_MINUTES
			? poll
			: DEFAULT_POLL_INTERVAL_MINUTES,
		calendarLogin: login ?? config.calendarLogin,
		orgId: orgId ?? config.orgId,
		login: trackerLogin ?? config.login,
		token: token ?? '',
		calendarPassword: calendarPassword ?? '',
	};
}

/**
 * The stored teamwork task in its canonical shape.
 * @param value - the record read from the storage unit.
 * @returns the task, or null when the record is absent or unusable.
 */
function storedTaskOf(value) {
	if (value === null || typeof value !== 'object') return null;
	const key = issueKeyOf(value.key);
	if (key === '') return null;
	return {
		key,
		summary: typeof value.summary === 'string' ? value.summary : '',
		status: typeof value.status === 'string' ? value.status : '',
		statusKey: typeof value.statusKey === 'string' ? value.statusKey : '',
	};
}

/**
 * Read one issue by key, for the picker's pinned teamwork task.
 * @param config - normalized configuration.
 * @param key - the issue key the user typed.
 * @returns the task row.
 */
async function readTask(config, key) {
	const { body } = await trackerRequest(config, `/issues/${encodeURIComponent(key)}`);
	if (body === null || typeof body !== 'object') throw new Error('Tracker did not return the task');
	return taskOf(body, config);
}

/**
 * Whether a task's status is the closed one.
 * @param task - a task row.
 * @returns true when the status key or the display text is closed.
 */
function isClosedTask(task) {
	const statusKey = typeof task?.statusKey === 'string' ? task.statusKey.trim().toLowerCase() : '';
	const status = typeof task?.status === 'string' ? task.status.trim().toLowerCase() : '';
	return statusKey === 'closed' || status === 'закрыт' || status === 'closed';
}

// --- Yandex Calendar (CalDAV) ------------------------------------------------
//
// The calendar is read over CalDAV with the account's app password; the Tracker
// OAuth token does not authenticate there. The plugin only reads events for one
// day, so it discovers the calendar home once, queries each calendar, and
// expands the recurrence rules a day list needs.

/** XML-escape-free property lookup inside one CalDAV response block. */
const XML_VALUE = (block, name) => {
	// Yandex mixes prefixed (`<D:href>`) and default-namespace (`<href>`) forms.
	const matched = new RegExp(
		`<(?:[\\w-]+:)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${name}>`, 'iu',
	).exec(block);
	return matched === null ? '' : decodeXml(matched[1]);
};

/**
 * Decode the entities a CalDAV XML body carries.
 * @param text - the raw element text.
 * @returns the decoded text.
 */
function decodeXml(text) {
	return text
		.replace(/&#x([0-9a-f]+);/giu, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
		.replace(/&#(\d+);/gu, (_, dec) => String.fromCodePoint(Number(dec)))
		.replace(/&lt;/gu, '<')
		.replace(/&gt;/gu, '>')
		.replace(/&quot;/gu, '"')
		.replace(/&apos;/gu, "'")
		.replace(/&amp;/gu, '&');
}

/**
 * The `<d:response>` blocks of a CalDAV multistatus body.
 * @param text - the response body.
 * @returns the blocks.
 */
function xmlBlocks(text) {
	return [...text.matchAll(/<(?:[\w-]+:)?response\b[\s\S]*?<\/(?:[\w-]+:)?response>/giu)]
		.map((matched) => matched[0]);
}

/**
 * The first `href` inside one XML fragment.
 * @param text - an element body or a whole block.
 * @returns the trimmed href, or an empty string.
 */
function xmlHref(text) {
	const matched = /<(?:[\w-]+:)?href\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?href>/iu.exec(text);
	return matched === null ? '' : decodeXml(matched[1]).trim();
}

/**
 * Run one authenticated CalDAV request.
 * @param config - normalized configuration.
 * @param method - PROPFIND, REPORT, and so on.
 * @param path - a path below the calendar root, or an absolute URL.
 * @param body - the XML body.
 * @param depth - the Depth header value.
 * @returns the response text.
 */
async function caldavRequest(config, method, path, body, depth) {
	const url = /^https?:/iu.test(path) ? path : `${config.calendarUrl}${path.startsWith('/') ? path : `/${path}`}`;
	const response = await fetch(url, {
		method,
		headers: {
			authorization: `Basic ${Buffer.from(`${config.calendarLogin}:${config.calendarPassword}`).toString('base64')}`,
			'content-type': 'application/xml; charset=utf-8',
			accept: 'application/xml, text/xml',
			depth: String(depth),
		},
		body,
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	});
	const text = await response.text();
	if (!response.ok) {
		const error = new Error(`Calendar answered ${response.status}`);
		error.status = response.status;
		throw error;
	}
	return text;
}

/**
 * Discover the calendar collections of the configured account.
 * @param config - normalized configuration.
 * @returns the calendars: their path and display name.
 */
async function discoverCalendars(config) {
	const principalXml = await caldavRequest(config, 'PROPFIND', '/',
		'<?xml version="1.0" encoding="utf-8"?>'
		+ '<d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/></d:prop></d:propfind>', 0);
	const principalBlock = xmlBlocks(principalXml)[0] ?? '';
	const principal = xmlHref(XML_VALUE(principalBlock, 'current-user-principal'))
		|| `/principals/users/${config.calendarLogin}/`;
	const homeXml = await caldavRequest(config, 'PROPFIND', principal,
		'<?xml version="1.0" encoding="utf-8"?>'
		+ '<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">'
		+ '<d:prop><c:calendar-home-set/></d:prop></d:propfind>', 0);
	const homeBlock = xmlBlocks(homeXml)[0] ?? '';
	const home = xmlHref(XML_VALUE(homeBlock, 'calendar-home-set')) || principal;
	const listXml = await caldavRequest(config, 'PROPFIND', home,
		'<?xml version="1.0" encoding="utf-8"?>'
		+ '<d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:displayname/></d:prop></d:propfind>', 1);
	const calendars = [];
	for (const block of xmlBlocks(listXml)) {
		const href = XML_VALUE(block, 'href');
		if (href === '' || !/<(?:[\w-]+:)?calendar\b/iu.test(XML_VALUE(block, 'resourcetype'))) continue;
		calendars.push({ path: href, name: XML_VALUE(block, 'displayname') || href });
	}
	return calendars;
}

/**
 * Parse one `DTSTART`/`DTEND` value.
 * @param rawName - the property line before the colon, including parameters.
 * @param value - the value after the colon.
 * @param timeZone - the zone floating times belong to.
 * @returns the instant and whether it is a whole-day value.
 */
function icsMoment(rawName, value, timeZone) {
	const raw = value.trim();
	const dateOnly = /^(\d{4})(\d{2})(\d{2})$/u.exec(raw);
	if (dateOnly !== null) {
		return { at: new Date(`${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}T00:00:00`), allDay: true };
	}
	const matched = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/u.exec(raw);
	if (matched === null) return null;
	const wall = `${matched[1]}-${matched[2]}-${matched[3]}T${matched[4]}:${matched[5]}:${matched[6]}`;
	if (matched[7] === 'Z') return { at: new Date(`${wall}Z`), allDay: false };
	const tzid = /TZID=([^;:]+)/iu.exec(rawName)?.[1]?.replace(/^"|"$/gu, '') ?? '';
	const stamp = wallClockStamp(tzid === '' ? timeZone : tzid, wall);
	return {
		at: stamp === null ? new Date(wall) : new Date(stamp.replace(/([+-]\d{2})(\d{2})$/u, '$1:$2')),
		allDay: false,
	};
}

/**
 * The minutes one ICS duration names.
 * @param value - a duration such as `PT1H30M`.
 * @returns whole minutes, or null when the text is not a duration.
 */
function icsDurationMinutes(value) {
	const matched = /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/u.exec(value.trim());
	if (matched === null || value.trim() === 'P') return null;
	return Math.round(
		Number(matched[1] ?? 0) * 10080
		+ Number(matched[2] ?? 0) * 1440
		+ Number(matched[3] ?? 0) * 60
		+ Number(matched[4] ?? 0)
		+ Number(matched[5] ?? 0) / 60,
	);
}

/**
 * Undo the escaping an ICS text value carries.
 * @param value - the raw text.
 * @returns the readable text.
 */
function unescapeIcs(value) {
	return value
		.replace(/\\n/giu, '\n')
		.replace(/\\,/gu, ',')
		.replace(/\\;/gu, ';')
		.replace(/\\\\/gu, '\\');
}

/**
 * Read the VEVENTs of one ICS document.
 * @param text - the calendar data.
 * @param timeZone - the zone floating times belong to.
 * @returns the events, with resolved start and end instants.
 */
function parseIcs(text, timeZone) {
	const lines = text.replace(/\r?\n[ \t]/gu, '').split(/\r?\n/u);
	const events = [];
	let current = null;
	const flush = () => {
		if (current !== null && current.start !== null) {
			let end = current.end;
			if (end === null || end.getTime() <= current.start.getTime()) {
				const minutes = current.duration ?? (current.allDay ? 1440 : 60);
				end = new Date(current.start.getTime() + minutes * 60000);
			}
			events.push({ ...current, end });
		}
		current = null;
	};
	for (const line of lines) {
		if (line === 'BEGIN:VEVENT') {
			current = {
				uid: '', summary: '', location: '', start: null, end: null,
				allDay: false, duration: null, rrule: '', recurrenceId: null,
			};
			continue;
		}
		if (line === 'END:VEVENT') {
			flush();
			continue;
		}
		if (current === null) continue;
		const colon = line.indexOf(':');
		if (colon <= 0) continue;
		const rawName = line.slice(0, colon);
		const value = line.slice(colon + 1);
		const name = rawName.split(';')[0].toUpperCase();
		if (name === 'UID') current.uid = value.trim();
		else if (name === 'SUMMARY') current.summary = unescapeIcs(value).trim();
		else if (name === 'LOCATION') current.location = unescapeIcs(value).trim();
		else if (name === 'DTSTART') {
			const moment = icsMoment(rawName, value, timeZone);
			if (moment !== null) {
				current.start = moment.at;
				current.allDay = moment.allDay;
			}
		} else if (name === 'DTEND') {
			current.end = icsMoment(rawName, value, timeZone)?.at ?? null;
		} else if (name === 'DURATION') {
			current.duration = icsDurationMinutes(value);
		} else if (name === 'RRULE') {
			current.rrule = value.trim();
		} else if (name === 'RECURRENCE-ID') {
			current.recurrenceId = icsMoment(rawName, value, timeZone)?.at ?? null;
		}
	}
	return events;
}

/** Weekday codes of an ICS BYDAY list. */
const ICS_WEEKDAYS = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

/**
 * Whether one recurring event has an occurrence on one local date.
 * @param event - a parsed event.
 * @param date - the local `YYYY-MM-DD` date.
 * @param timeZone - the zone the date belongs to.
 * @returns the occurrence's start instant, or null when there is none.
 */
function recurrenceStart(event, date, timeZone) {
	const rule = {};
	for (const piece of event.rrule.split(';')) {
		const eq = piece.indexOf('=');
		if (eq > 0) rule[piece.slice(0, eq).toUpperCase()] = piece.slice(eq + 1).trim();
	}
	const freq = (rule.FREQ ?? '').toUpperCase();
	const interval = Math.max(1, Number(rule.INTERVAL ?? 1) || 1);
	const startDate = localDate(timeZone, event.start);
	const dayDiff = Math.round(
		(Date.parse(`${date}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000,
	);
	if (dayDiff < 0) return null;
	const clock = localTime(timeZone, event.start.toISOString());
	const stamp = wallClockStamp(timeZone, `${date}T${clock === '' ? '00:00' : clock}`);
	if (stamp === null) return null;
	const at = new Date(stamp.replace(/([+-]\d{2})(\d{2})$/u, '$1:$2'));
	if (rule.UNTIL !== undefined) {
		const until = icsMoment('', rule.UNTIL, timeZone);
		if (until !== null) {
			// A date-only UNTIL includes that whole day.
			const limit = until.allDay ? until.at.getTime() + 86400000 : until.at.getTime();
			if (at.getTime() > limit) return null;
		}
	}
	if (freq === 'DAILY') return dayDiff % interval === 0 ? at : null;
	if (freq === 'WEEKLY') {
		const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
		const startWeekday = new Date(`${startDate}T00:00:00Z`).getUTCDay();
		const byday = (rule.BYDAY ?? '')
			.split(',').map((code) => ICS_WEEKDAYS[code.trim().toUpperCase()])
			.filter((day) => typeof day === 'number');
		const days = byday.length === 0 ? [startWeekday] : byday;
		if (!days.includes(weekday)) return null;
		return Math.floor(dayDiff / 7) % interval === 0 ? at : null;
	}
	if (freq === 'MONTHLY' || freq === 'YEARLY') {
		const [year, month, day] = date.split('-').map(Number);
		const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
		if (day !== startDay) return null;
		if (freq === 'MONTHLY') {
			return ((year - startYear) * 12 + (month - startMonth)) % interval === 0 ? at : null;
		}
		if (month !== startMonth) return null;
		return (year - startYear) % interval === 0 ? at : null;
	}
	// An unknown rule shape is shown only on its own start day.
	return date === startDate ? at : null;
}

/**
 * The minute-of-day an instant reads as inside a zone.
 * @param timeZone - IANA zone id.
 * @param at - the instant.
 * @returns minutes since midnight, or null when the clock cannot be read.
 */
function clockMinutesAt(timeZone, at) {
	const clock = localTime(timeZone, at.toISOString());
	const matched = /^(\d{2}):(\d{2})$/u.exec(clock);
	return matched === null ? null : Number(matched[1]) * 60 + Number(matched[2]);
}

/**
 * The occurrence of one event that falls on the requested day, if any.
 * @param event - a parsed event.
 * @param date - the local `YYYY-MM-DD` date.
 * @param timeZone - the zone the date belongs to.
 * @returns `{ start, end, allDay, clock }`, or null when the day has no occurrence.
 */
function occurrenceOn(event, date, timeZone) {
	let start = event.start;
	let end = event.end;
	let allDay = event.allDay;
	if (event.recurrenceId === null && event.rrule !== '') {
		const recurrence = recurrenceStart(event, date, timeZone);
		if (recurrence === null) return null;
		const duration = event.end.getTime() - event.start.getTime();
		start = recurrence;
		end = new Date(recurrence.getTime() + duration);
	} else {
		const dayStartStamp = wallClockStamp(timeZone, `${date}T00:00`);
		const dayEndStamp = wallClockStamp(timeZone, `${shiftDate(date, 1)}T00:00`);
		if (dayStartStamp !== null && dayEndStamp !== null) {
			const dayStart = new Date(dayStartStamp.replace(/([+-]\d{2})(\d{2})$/u, '$1:$2'));
			const dayEnd = new Date(dayEndStamp.replace(/([+-]\d{2})(\d{2})$/u, '$1:$2'));
			if (start.getTime() >= dayEnd.getTime() || end.getTime() <= dayStart.getTime()) return null;
		}
	}
	const clock = allDay
		? 'All day'
		: `${localTime(timeZone, start.toISOString())}\u2013${localTime(timeZone, end.toISOString())}`;
	return { start, end, allDay, clock };
}

/**
 * The UTC `time-range` bounds of one local day, in the compact CalDAV form.
 * @param timeZone - the zone the date belongs to.
 * @param date - the local `YYYY-MM-DD` date.
 * @returns the range bounds, or null when they cannot be computed.
 */
function dayUtcRange(timeZone, date) {
	const from = wallClockStamp(timeZone, `${date}T00:00`);
	const to = wallClockStamp(timeZone, `${shiftDate(date, 1)}T00:00`);
	if (from === null || to === null) return null;
	const compact = (stamp) => new Date(stamp.replace(/([+-]\d{2})(\d{2})$/u, '$1:$2'))
		.toISOString().replace(/[-:]/gu, '').replace(/\.\d{3}Z$/u, 'Z');
	return { start: compact(from), end: compact(to) };
}

/**
 * Read the events of one calendar for one day.
 * @param config - normalized configuration.
 * @param calendarPath - the calendar collection path.
 * @param range - the UTC day bounds.
 * @param timeZone - the zone the day belongs to.
 * @returns the parsed events.
 */
async function queryCalendarEvents(config, calendarPath, range, timeZone) {
	const body = '<?xml version="1.0" encoding="utf-8"?>'
		+ '<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">'
		+ '<d:prop><c:calendar-data/></d:prop>'
		+ '<c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT">'
		+ `<c:time-range start="${range.start}" end="${range.end}"/>`
		+ '</c:comp-filter></c:comp-filter></c:filter>'
		+ '</c:calendar-query>';
	const xml = await caldavRequest(config, 'REPORT', calendarPath, body, 1);
	const events = [];
	for (const block of xmlBlocks(xml)) {
		const data = XML_VALUE(block, 'calendar-data');
		if (data !== '') events.push(...parseIcs(data, timeZone));
	}
	return events;
}

/**
 * Read the day's events across every calendar of the account.
 * @param config - normalized configuration.
 * @param date - the local `YYYY-MM-DD` date.
 * @param calendars - the account's calendars.
 * @returns the events, sorted by start.
 */
async function fetchCalendarEvents(config, date, calendars) {
	const range = dayUtcRange(config.timeZone, date);
	if (range === null) return [];
	const lists = await Promise.all(calendars.map((calendar) =>
		queryCalendarEvents(config, calendar.path, range, config.timeZone)
			.then((events) => events.map((event) => ({ event, calendar: calendar.name })))
			.catch(() => []),
	));
	const out = [];
	for (const list of lists) {
		for (const { event, calendar } of list) {
			const occurrence = occurrenceOn(event, date, config.timeZone);
			if (occurrence === null) continue;
			out.push({
				id: `${event.uid}@${calendar}`,
				title: event.summary,
				clock: occurrence.clock,
				allDay: occurrence.allDay,
				startMinutes: clockMinutesAt(config.timeZone, occurrence.start),
				durationMinutes: Math.max(0, Math.round((occurrence.end.getTime() - occurrence.start.getTime()) / 60000)),
				location: event.location,
				calendar,
				sort: occurrence.start.getTime(),
			});
		}
	}
	out.sort((left, right) => left.sort - right.sort || left.title.localeCompare(right.title));
	return out.map(({ sort, ...event }) => event);
}


/**
 * Read the issues the current work is booked against.
 *
 * One page is what a picker needs РІР‚вЂќ the list is scanned by eye, not paged
 * through РІР‚вЂќ so the search asks for the API's largest page and stops there.
 * @param config - normalized configuration.
 * @returns the tasks, most recently updated first.
 */
async function searchCurrentTasks(config) {
	const { body } = await trackerRequest(config, `/issues/_search?perPage=${PAGE_SIZE}`, {
		method: 'POST',
		body: JSON.stringify({ query: CURRENT_TASKS_QUERY }),
	});
	const rows = Array.isArray(body) ? body : [];
	return rows
		.filter((row) => row !== null && typeof row === 'object' && text(row.key) !== '')
		.map((row) => taskOf(row, config));
}

/**
 * The working day the unbooked rows are measured against, as local minutes.
 *
 * The list is padded out to these bounds, so a reader can see at a glance which
 * part of the day was never booked.
 */
const WORKDAY_START_MINUTES = 9 * 60;
const WORKDAY_END_MINUTES = 18 * 60;
/** A break longer than this between two worklogs becomes an unbooked row. */
const GAP_THRESHOLD_MINUTES = 5;

/**
 * The wall-clock minute-of-day an instant reads as inside a zone.
 * @param timeZone - IANA zone id.
 * @param value - an ISO timestamp.
 * @returns minutes since local midnight, or null when no time can be read.
 */
function minutesOfDay(timeZone, value) {
	const clock = localTime(timeZone, value);
	const matched = /^(\d{2}):(\d{2})$/u.exec(clock);
	return matched === null ? null : Number(matched[1]) * 60 + Number(matched[2]);
}

/**
 * Format a minute-of-day as `HH:MM`.
 * @param minutes - minutes since local midnight.
 * @returns the clock text.
 */
function formatClock(minutes) {
	const safe = Math.max(0, Math.round(minutes));
	return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

/**
 * One unbooked stretch of the working day.
 * @param from - the minute-of-day it starts at.
 * @param to - the minute-of-day it ends at.
 * @returns the row, shaped like a worklog so the list can render both alike.
 */
function gapRow(from, to) {
	return {
		id: `gap-${from}-${to}`,
		kind: 'gap',
		issueKey: '',
		issueDisplay: '',
		comment: '',
		start: '',
		startMinutes: from,
		clock: formatClock(from),
		duration: '',
		minutes: to - from,
		hours: formatMinutes(to - from),
		issueUrl: '',
	};
}

/**
 * Pad a day's worklogs out to a full working day.
 *
 * The records arrive in API order and are placed on the clock in ascending
 * order, then every stretch of the working day not covered by a record is
 * emitted as a `gap` row: one before the first record, one in each break longer
 * than {@link GAP_THRESHOLD_MINUTES}, and one after the last record.
 * @param worklogs - the day's records, each carrying `startMinutes` and `minutes`.
 * @param workdayEnd - minute-of-day the day is padded out to.
 * @returns the timeline, ascending, with unbooked rows interleaved.
 */
function withGaps(worklogs, workdayStart = WORKDAY_START_MINUTES, workdayEnd = WORKDAY_END_MINUTES) {
	const placed = worklogs
		.filter((row) => typeof row.startMinutes === 'number')
		.sort((left, right) => left.startMinutes - right.startMinutes);
	// A record with no readable start cannot be placed on the clock, so it keeps
	// its own line at the end rather than being silently dropped.
	const unplaced = worklogs.filter((row) => typeof row.startMinutes !== 'number');

	const out = [];
	let cursor = workdayStart;
	let anyPlaced = false;
	for (const row of placed) {
		// Anything uncovered before this record is unbooked. The leading stretch has
		// no threshold РІР‚вЂќ the day simply starts late РІР‚вЂќ while a break between two
		// records only becomes a row once it is longer than the threshold.
		const threshold = anyPlaced ? GAP_THRESHOLD_MINUTES : 0;
		if (row.startMinutes > cursor && row.startMinutes - cursor > threshold) {
			out.push(gapRow(cursor, row.startMinutes));
		}
		out.push(row);
		cursor = Math.max(cursor, row.startMinutes + row.minutes);
		anyPlaced = true;
	}
	// The day is padded to its end, unless a record already ran past it.
	if (cursor < workdayEnd) out.push(gapRow(cursor, workdayEnd));
	return [...out, ...unplaced];
}

/**
 * Sum one day's worklogs for one login, as a padded timeline.
 * @param config - normalized configuration.
 * @param login - the account whose worklogs are summed.
 * @param range - the local-day bounds to filter `start` by.
 * @returns the booked minutes and count, plus the day's timeline.
 */
async function sumWorklogs(config, login, range) {
	const body = JSON.stringify({ createdBy: login, start: { from: range.from, to: range.to } });
	let minutes = 0;
	let entries = 0;
	const rowsOut = [];
	for (let page = 1; page <= MAX_PAGES; page += 1) {
		const { body: answer, headers } = await trackerRequest(
			config,
			`/worklog/_search?perPage=${PAGE_SIZE}&page=${page}`,
			{ method: 'POST', body },
		);
		const rows = Array.isArray(answer) ? answer : [];
		for (const row of rows) {
			if (row === null || typeof row !== 'object') continue;
			const rowMinutes = durationMinutes(row.duration);
			minutes += rowMinutes;
			entries += 1;
			rowsOut.push({
				id: typeof row.id === 'number' || typeof row.id === 'string' ? String(row.id) : `${entries}`,
				kind: 'worklog',
				issueKey: text(row.issue?.key) || text(row.issue?.display),
				issueDisplay: text(row.issue?.display),
				comment: text(row.comment),
				start: text(row.start),
				startMinutes: minutesOfDay(config.timeZone, row.start),
				clock: localTime(config.timeZone, row.start),
				duration: text(row.duration),
				minutes: rowMinutes,
				hours: formatMinutes(rowMinutes),
				// Tracker's web form puts the key straight under the host
				// (`tracker.yandex.ru/INTWORK-426`); the `/issues/` segment belongs to
				// the API, and a web link carrying it does not resolve.
				issueUrl: text(row.issue?.key) === '' ? myPageUrl(config) : `${config.webBase}/${text(row.issue.key)}`,
			});
		}
		const pages = Number(headers.get('x-total-pages') ?? '1');
		if (rows.length < PAGE_SIZE || !Number.isFinite(pages) || page >= pages) break;
	}
	return { minutes, entries, rows: withGaps(rowsOut, config.workdayStartMinutes, config.workdayEndMinutes) };
}

/**
 * The Tracker Web page the badge opens.
 * @param config - normalized configuration.
 * @returns the absolute URL of the user's page.
 */
function myPageUrl(config) {
	return `${config.webBase}${MY_PAGE_PATH}`;
}

/**
 * Compose the summary the badge renders, caching it briefly so the page's
 * mount-time and click-time reads do not both hit the API.
 * @param config - normalized configuration.
 * @returns the summary payload, or a descriptive failure.
 */
async function summarize(config) {
	if (config.token === '') {
		return {
			ok: false,
			reason: 'unconfigured',
			webUrl: myPageUrl(config),
			message: 'No OAuth token is configured for the Yandex Tracker badge.',
		};
	}
	if (config.orgId === '' && config.cloudOrgId === '') {
		return {
			ok: false,
			reason: 'unconfigured',
			webUrl: myPageUrl(config),
			message: 'Neither orgId nor cloudOrgId is configured for the Yandex Tracker badge.',
		};
	}
	const now = new Date();
	const range = todayRange(config.timeZone, now);
	const previous = yesterdayRange(config.timeZone, now);
	const login = config.login === '' ? await resolveLogin(config) : config.login;
	// The two days are independent reads, so they run together rather than in turn.
	const [today, yesterday] = await Promise.all([
		sumWorklogs(config, login, range),
		sumWorklogs(config, login, previous),
	]);
	return {
		ok: true,
		minutes: today.minutes,
		hours: formatMinutes(today.minutes),
		entries: today.entries,
		rows: today.rows,
		login,
		date: range.date,
		// Yesterday, as the second plate needs it: its own total, count, plain date,
		// whether it fell on a weekend (which colouring depends on), and its rows РІР‚вЂќ
		// already read above, so switching the list to yesterday costs no new call.
		yesterday: {
			minutes: yesterday.minutes,
			hours: formatMinutes(yesterday.minutes),
			entries: yesterday.entries,
			rows: yesterday.rows,
			date: previous.date,
			weekend: previous.weekend,
			weekday: previous.weekday,
		},
		timeZone: config.timeZone,
		// The queue the add form expands a digits-only key with; the page hands
		// it to the dialog so the user sees the full key before sending.
		defaultQueue: config.defaultQueue,
		// Where the working day ends, so the add form can start the clock after
		// the last unbooked stretch and stop it at the end of the day.
		workdayStartMinutes: config.workdayStartMinutes,
		workdayEndMinutes: config.workdayEndMinutes,
		dailyTargetHours: config.dailyTargetHours,
		defaultDurationMinutes: config.defaultDurationMinutes,
		eventCommentPrefix: config.eventCommentPrefix,
		webUrl: myPageUrl(config),
		fetchedAt: now.toISOString(),
	};
}

/**
 * Answer one request with JSON.
 * @param res - server response.
 * @param status - HTTP status code.
 * @param payload - JSON-serializable body.
 */
function sendJson(res, status, payload) {
	const body = JSON.stringify(payload);
	res.statusCode = status;
	res.setHeader('content-type', 'application/json; charset=utf-8');
	res.setHeader('cache-control', 'no-store');
	res.end(body);
}

/**
 * Answer one failed write with the API's own message.
 * @param res - server response.
 * @param error - the error thrown by the request path.
 */
function sendUpstreamFailure(res, error) {
	const status = error !== null && typeof error === 'object' && typeof error.status === 'number' ? error.status : 0;
	sendJson(res, 502, {
		ok: false,
		reason: status === 401 || status === 403 ? 'unauthorized' : 'failed',
		message: error instanceof Error ? error.message : String(error),
	});
}

/**
 * Apply the guards both write routes share: the trust fence, the POST method,
 * a configured Tracker connection, and a JSON body within the size limit.
 * @param ctx - the plugin context.
 * @param config - normalized configuration.
 * @param req - the incoming request.
 * @param res - the response being written.
 * @returns the parsed body, or null when a response was already sent.
 */
async function acceptWrite(ctx, config, req, res) {
	const rejection = ctx.connection.requestRejection(req);
	if (rejection !== undefined) {
		res.statusCode = rejection;
		res.end();
		return null;
	}
	if (req.method !== 'POST') {
		res.setHeader('allow', 'POST');
		sendJson(res, 405, { ok: false, reason: 'method', message: 'Use POST.' });
		return null;
	}
	if (config.token === '' || (config.orgId === '' && config.cloudOrgId === '')) {
		sendJson(res, 400, {
			ok: false,
			reason: 'unconfigured',
			message: 'The Tracker badge has no token or organization configured.',
		});
		return null;
	}
	try {
		return { body: await readJsonBody(req, MAX_WRITE_BODY_BYTES) };
	} catch (error) {
		sendJson(res, 400, {
			ok: false,
			reason: 'body',
			message: error instanceof Error ? error.message : String(error),
		});
		return null;
	}
}

/**
 * Register the authenticated summary and write routes.
 * @param ctx - the plugin context, carrying `webServer` and `connection`.
 * @param rawConfig - the row's config value.
 */
export function apply(ctx, rawConfig) {
	const config = normalizeConfig(rawConfig);
	/** Latest computed summary and the instant it was produced. */
	let cached = null;
	/** The in-flight computation, so concurrent reads share one API round trip. */
	let pending = null;
	/** Bumped by every write, so a read that started before it cannot re-cache. */
	let revision = 0;
	/** Resolved once per process; the token's account does not change under it. */
	let login = config.login;

	/** The opened settings unit, created on first use and shared by the route. */
	let teamworkStore = null;

	/**
	 * Open the plugin's own storage unit over the JSON backend's KV facet.
	 *
	 * The unit is a plain key-value document under the profile's `storages`
	 * directory, so the pinned task survives browser restarts and a GUI opened in
	 * another browser вЂ” it belongs to the profile, not to one origin.
	 * @returns the opened unit.
	 */
	const openTeamworkStore = async () => {
		const storage = ctx.get('storage');
		if (storage === undefined || storage === null || typeof storage.backend?.get !== 'function') {
			throw new Error('The storage service is not available in this profile.');
		}
		const names = typeof storage.backend.names === 'function' ? storage.backend.names() : [];
		const name = names.includes('json') ? 'json' : names[0];
		if (name === undefined) throw new Error('No storage backend is configured in this profile.');
		const backend = storage.backend.get(name);
		if (backend === undefined || backend === null || backend.kv === undefined) {
			throw new Error('The configured storage backend offers no key-value facet.');
		}
		const unit = await backend.kv.open({
			name: TEAMWORK_UNIT,
			version: 1,
			tables: [TEAMWORK_TABLE],
			hasGlobal: false,
			layout: 'single',
		});
		// Load once, so a later write cannot rewrite the unit from empty memory.
		await unit.loadAll();
		return unit;
	};

	const teamworkUnit = () => {
		if (teamworkStore === null) {
			teamworkStore = openTeamworkStore().catch((error) => {
				teamworkStore = null;
				throw error;
			});
		}
		return teamworkStore;
	};

	ctx.effect(() => () => {
		if (teamworkStore !== null) {
			teamworkStore.then((unit) => unit.close()).catch(() => {});
		}
	});

	/** The plugin settings record, falling back to the key an older build used. */
	const settingsRecordOf = (tables) => tables[TEAMWORK_TABLE]?.[PLUGIN_SETTINGS_RECORD]
		?? tables[TEAMWORK_TABLE]?.[LEGACY_SETTINGS_RECORD];

	/**
	 * The profile credential store, when the profile provides one.
	 * @returns the service, or null when it is absent.
	 */
	const credentialStore = () => {
		const service = typeof ctx.get === 'function' ? ctx.get('credentials') : undefined;
		return service !== undefined && service !== null
			&& typeof service.readRecord === 'function'
			&& typeof service.modifyRecord === 'function'
			&& typeof service.deleteRecord === 'function'
			? service
			: null;
	};

	/**
	 * Read one secret from the credential store.
	 * @param key - the credential record key.
	 * @returns the secret, or null when it is absent or unreadable.
	 */
	const readSecret = async (key) => {
		const store = credentialStore();
		if (store === null) return null;
		try {
			const record = await store.readRecord(key);
			return record !== null && typeof record === 'object'
				&& record.kind === 'api-key'
				&& typeof record.key === 'string' && record.key !== ''
				? record.key
				: null;
		} catch {
			return null;
		}
	};

	/**
	 * Store one secret in the credential store.
	 * @param key - the credential record key.
	 * @param value - the non-empty secret.
	 * @returns a promise settling when stored.
	 */
	const writeSecret = async (key, value) => {
		const store = credentialStore();
		if (store === null) throw new Error('The profile credential store is not available.');
		await store.modifyRecord(key, async () => ({ kind: 'api-key', key: value }));
	};

	/**
	 * Remove one secret from the credential store.
	 * @param key - the credential record key.
	 * @returns a promise settling when removed.
	 */
	const clearSecret = async (key) => {
		const store = credentialStore();
		if (store === null) return;
		await store.deleteRecord(key);
	};

	/**
	 * The effective token and calendar password: the credential store first, a
	 * value left behind by an older build in the settings record second. The
	 * installed configuration is never a secret source.
	 * @param settings - the stored settings record, when readable.
	 * @returns the two secret values.
	 */
	const effectiveSecrets = async (settings) => {
		const credentialToken = await readSecret(TOKEN_CREDENTIAL);
		const credentialPassword = await readSecret(CALENDAR_PASSWORD_CREDENTIAL);
		const legacyToken = settings !== null && typeof settings?.token === 'string' && settings.token !== ''
			? settings.token
			: '';
		const legacyPassword = settings !== null && typeof settings?.calendarPassword === 'string'
			&& settings.calendarPassword !== ''
			? settings.calendarPassword
			: '';
		return {
			token: credentialToken ?? legacyToken,
			calendarPassword: credentialPassword ?? legacyPassword,
		};
	};

	/**
	 * The configuration the routes use: the installed config with the stored
	 * plugin settings layered over it.
	 * @returns a promise for the effective configuration.
	 */
	const effectiveConfig = async () => {
		try {
			const unit = await teamworkUnit();
			const { tables } = await unit.loadAll();
			const settings = storedPluginSettings(settingsRecordOf(tables), config);
			const secrets = await effectiveSecrets(settings);
			return {
				...config,
				timeZone: settings.timeZone,
				defaultQueue: settings.defaultQueue,
				workdayStartMinutes: clockMinutes(settings.workdayStart) ?? config.workdayStartMinutes,
				workdayEndMinutes: clockMinutes(settings.workdayEnd) ?? config.workdayEndMinutes,
				dailyTargetHours: settings.dailyTargetHours,
				defaultDurationMinutes: settings.defaultDurationMinutes,
				eventCommentPrefix: settings.eventCommentPrefix,
				pollIntervalMinutes: settings.pollIntervalMinutes,
				calendarLogin: settings.calendarLogin,
				orgId: settings.orgId,
				login: settings.login,
				token: secrets.token,
				calendarPassword: secrets.calendarPassword,
			};
		} catch {
			const secrets = await effectiveSecrets(null);
			return { ...config, token: secrets.token, calendarPassword: secrets.calendarPassword };
		}
	};

	/** Discovered calendars and the instant they were read. */
	let calendarsCache = null;
	/** The in-flight discovery, so concurrent readers share one round trip. */
	let calendarsPending = null;
	/** Bumped when a settings change invalidates the discovery. */
	let calendarRevision = 0;
	/** One date's events, keyed by the local date. */
	const eventsCache = new Map();

	/**
	 * The account's calendars, discovered once and refreshed occasionally.
	 * @param effective - the configuration to discover with.
	 * @returns a promise for the calendars.
	 */
	const readCalendars = (effective = config) => {
		if (calendarsCache !== null && Date.now() - calendarsCache.at < CALENDAR_LIST_TTL_MS) {
			return Promise.resolve(calendarsCache.calendars);
		}
		if (calendarsPending !== null) return calendarsPending;
		const started = calendarRevision;
		let pending;
		pending = discoverCalendars(effective).then(
			(calendars) => {
				if (started === calendarRevision) {
					calendarsCache = { at: Date.now(), calendars };
					if (calendarsPending === pending) calendarsPending = null;
				}
				return calendars;
			},
			(error) => {
				if (started === calendarRevision && calendarsPending === pending) calendarsPending = null;
				throw error;
			},
		);
		calendarsPending = pending;
		return pending;
	};

	/**
	 * One day's events, briefly cached so reopening the window is free.
	 * @param date - the local `YYYY-MM-DD` date.
	 * @param force - whether to bypass the cached list.
	 * @param effective - the configuration to read with.
	 * @returns a promise for the events.
	 */
	const readEvents = (date, force = false, effective = config) => {
		const hit = eventsCache.get(date);
		if (!force && hit !== undefined && Date.now() - hit.at < EVENTS_CACHE_TTL_MS) {
			return Promise.resolve(hit.events);
		}
		return readCalendars(effective)
			.then((calendars) => fetchCalendarEvents(effective, date, calendars))
			.then((events) => {
				eventsCache.set(date, { at: Date.now(), events });
				if (eventsCache.size > 20) {
					const oldest = [...eventsCache.entries()].sort((left, right) => left[1].at - right[1].at)[0];
					if (oldest !== undefined) eventsCache.delete(oldest[0]);
				}
				return events;
			});
	};

	const compute = () => effectiveConfig().then((base) => {
		const effective = base.login !== '' ? base : (login === '' ? base : { ...base, login });
		return summarize(effective).then((summary) => {
			if (summary.ok && base.login === '' && login === '') login = summary.login;
			return summary;
		});
	});

	const read = (force) => {
		const now = Date.now();
		if (!force && cached !== null && now - cached.at < CACHE_TTL_MS) return Promise.resolve(cached.summary);
		if (pending !== null) return pending;
		const started = revision;
		pending = compute().then(
			(summary) => {
				if (started === revision) cached = { at: Date.now(), summary };
				pending = null;
				return summary;
			},
			(error) => {
				pending = null;
				const message = error instanceof Error ? error.message : String(error);
				return {
					ok: false,
					reason: error !== null && typeof error === 'object' && typeof error.status === 'number' && (error.status === 401 || error.status === 403)
						? 'unauthorized'
						: 'failed',
					webUrl: myPageUrl(config),
					message,
				};
			},
		);
		return pending;
	};

	/** Cached task list for the picker, and the instant it was read. */
	let tasksCached = null;
	/** The in-flight task read, so concurrent openings share one API call. */
	let tasksPending = null;
	/** Bumped when a settings change invalidates the task list. */
	let tasksRevision = 0;

	/**
	 * Read the picker's task list, briefly cached.
	 *
	 * A minute is short enough that a task finished in Tracker leaves the list
	 * soon, and long enough that reopening the dialog does not re-query.
	 * @param effective - the configuration to read with.
	 * @returns a promise for the task rows.
	 */
	const readTasks = (effective = config) => {
		if (tasksCached !== null && Date.now() - tasksCached.at < TASKS_CACHE_TTL_MS) {
			return Promise.resolve(tasksCached.tasks);
		}
		if (tasksPending !== null) return tasksPending;
		const started = tasksRevision;
		let pending;
		pending = searchCurrentTasks(effective).then(
			(tasks) => {
				if (started === tasksRevision) {
					tasksCached = { at: Date.now(), tasks };
					if (tasksPending === pending) tasksPending = null;
				}
				return tasks;
			},
			(error) => {
				if (started === tasksRevision && tasksPending === pending) tasksPending = null;
				throw error;
			},
		);
		tasksPending = pending;
		return pending;
	};

	ctx.effect(() => ctx.webServer.register({
		kind: 'exact',
		path: SUMMARY_PATH,
		handler: async (req, res) => {
			const rejection = ctx.connection.requestRejection(req);
			if (rejection !== undefined) {
				res.statusCode = rejection;
				res.end();
				return;
			}
			if (req.method !== 'GET') {
				res.setHeader('allow', 'GET');
				sendJson(res, 405, { ok: false, reason: 'method', message: 'Use GET.' });
				return;
			}
			const force = new URL(String(req.url ?? '/'), 'http://localhost').searchParams.has('force');
			sendJson(res, 200, await read(force));
		},
	}), `yandex-tracker-today: GET ${SUMMARY_PATH}`);

	// The picker's own list of the account's open issues. It is a read, so it
	// takes GET, and it is short-lived-cached like the summary: the dialog is
	// opened, closed and reopened while one task is chosen.
	ctx.effect(() => ctx.webServer.register({
		kind: 'exact',
		path: TASKS_PATH,
		handler: async (req, res) => {
			const rejection = ctx.connection.requestRejection(req);
			if (rejection !== undefined) {
				res.statusCode = rejection;
				res.end();
				return;
			}
			if (req.method !== 'GET') {
				res.setHeader('allow', 'GET');
				sendJson(res, 405, { ok: false, reason: 'method', message: 'Use GET.' });
				return;
			}
			const effective = await effectiveConfig();
			if (effective.token === '' || (effective.orgId === '' && effective.cloudOrgId === '')) {
				sendJson(res, 400, {
					ok: false,
					reason: 'unconfigured',
					message: 'The Tracker badge has no token or organization configured.',
				});
				return;
			}
			try {
				sendJson(res, 200, { ok: true, tasks: await readTasks(effective) });
			} catch (error) {
				sendUpstreamFailure(res, error);
			}
		},
	}), `yandex-tracker-today: GET ${TASKS_PATH}`);

	// One issue by key: the picker's pinned teamwork task resolves its summary
	// and status here, so a remembered key still shows as a task row.
	ctx.effect(() => ctx.webServer.register({
		kind: 'exact',
		path: TASK_PATH,
		handler: async (req, res) => {
			const rejection = ctx.connection.requestRejection(req);
			if (rejection !== undefined) {
				res.statusCode = rejection;
				res.end();
				return;
			}
			if (req.method !== 'GET') {
				res.setHeader('allow', 'GET');
				sendJson(res, 405, { ok: false, reason: 'method', message: 'Use GET.' });
				return;
			}
			const effective = await effectiveConfig();
			if (effective.token === '' || (effective.orgId === '' && effective.cloudOrgId === '')) {
				sendJson(res, 400, {
					ok: false,
					reason: 'unconfigured',
					message: 'The Tracker badge has no token or organization configured.',
				});
				return;
			}
			const key = issueKeyOf(new URL(String(req.url ?? '/'), 'http://localhost').searchParams.get('key'));
			if (key === '') {
				sendJson(res, 400, { ok: false, reason: 'invalid', message: 'Task key must look like ABC-123.' });
				return;
			}
			try {
				sendJson(res, 200, { ok: true, task: await readTask(effective, key) });
			} catch (error) {
				const status = error !== null && typeof error === 'object' && typeof error.status === 'number' ? error.status : 0;
				if (status === 404) {
					sendJson(res, 404, { ok: false, reason: 'notfound', message: `Task ${key} was not found in Tracker.` });
					return;
				}
				sendUpstreamFailure(res, error);
			}
		},
	}), `yandex-tracker-today: GET ${TASK_PATH}`);

	// The pinned teamwork task. It is the plugin's own preference, not Tracker
	// data, so it lives in the profile's storage unit and outlives any browser.
	ctx.effect(() => ctx.webServer.register({
		kind: 'exact',
		path: TEAMWORK_PATH,
		handler: async (req, res) => {
			const rejection = ctx.connection.requestRejection(req);
			if (rejection !== undefined) {
				res.statusCode = rejection;
				res.end();
				return;
			}
			if (req.method !== 'GET' && req.method !== 'POST') {
				res.setHeader('allow', 'GET, POST');
				sendJson(res, 405, { ok: false, reason: 'method', message: 'Use GET or POST.' });
				return;
			}
			try {
				const unit = await teamworkUnit();
				if (req.method === 'GET') {
					const { tables } = await unit.loadAll();
					sendJson(res, 200, { ok: true, task: storedTaskOf(tables[TEAMWORK_TABLE]?.[TEAMWORK_RECORD]) });
					return;
				}
				let payload;
				try {
					payload = await readJsonBody(req, MAX_WRITE_BODY_BYTES);
				} catch (error) {
					sendJson(res, 400, {
						ok: false,
						reason: 'body',
						message: error instanceof Error ? error.message : String(error),
					});
					return;
				}
				if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
					sendJson(res, 400, { ok: false, reason: 'invalid', message: 'Send a JSON object.' });
					return;
				}
				if (payload.clear === true) {
					await unit.deleteRecord(TEAMWORK_TABLE, TEAMWORK_RECORD);
					sendJson(res, 200, { ok: true, task: null });
					return;
				}
				const task = storedTaskOf(payload.task ?? payload);
				if (task === null) {
					sendJson(res, 400, { ok: false, reason: 'invalid', message: 'Task key must look like ABC-123.' });
					return;
				}
				await unit.putRecord(TEAMWORK_TABLE, TEAMWORK_RECORD, task);
				sendJson(res, 200, { ok: true, task });
			} catch (error) {
				sendJson(res, 500, {
					ok: false,
					reason: 'storage',
					message: error instanceof Error ? error.message : String(error),
				});
			}
		},
	}), `yandex-tracker-today: GET/POST ${TEAMWORK_PATH}`);

	// The day's calendar events, for the add form's "Calendar event" field. The
	// calendar has its own credentials: the Tracker token does not authenticate
	// against CalDAV.
	ctx.effect(() => ctx.webServer.register({
		kind: 'exact',
		path: EVENTS_PATH,
		handler: async (req, res) => {
			const rejection = ctx.connection.requestRejection(req);
			if (rejection !== undefined) {
				res.statusCode = rejection;
				res.end();
				return;
			}
			if (req.method !== 'GET') {
				res.setHeader('allow', 'GET');
				sendJson(res, 405, { ok: false, reason: 'method', message: 'Use GET.' });
				return;
			}
			const url = new URL(String(req.url ?? '/'), 'http://localhost');
			const date = url.searchParams.get('date') ?? '';
			if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) {
				sendJson(res, 400, { ok: false, reason: 'invalid', message: 'Pass a date as YYYY-MM-DD.' });
				return;
			}
			const effective = await effectiveConfig();
			if (effective.calendarLogin === '' || effective.calendarPassword === '') {
				sendJson(res, 200, {
					ok: false,
					reason: 'calendar-unconfigured',
					message: 'Yandex Calendar is not connected: set calendarLogin and calendarPassword in the plugin settings.',
				});
				return;
			}
			try {
				sendJson(res, 200, {
					ok: true,
					date,
					events: await readEvents(date, url.searchParams.has('force'), effective),
				});
			} catch (error) {
				sendJson(res, 200, {
					ok: false,
					reason: 'calendar-failed',
					message: error instanceof Error ? error.message : String(error),
				});
			}
		},
	}), `yandex-tracker-today: GET ${EVENTS_PATH}`);

	// The plugin settings: runtime behavior, panel defaults, connection values,
	// and the poll interval. Secrets are not stored here: the token and the
	// calendar password live in the profile credential store and are only
	// reported as present or absent.
	ctx.effect(() => ctx.webServer.register({
		kind: 'exact',
		path: SETTINGS_PATH,
		handler: async (req, res) => {
			const rejection = ctx.connection.requestRejection(req);
			if (rejection !== undefined) {
				res.statusCode = rejection;
				res.end();
				return;
			}
			if (req.method !== 'GET' && req.method !== 'POST') {
				res.setHeader('allow', 'GET, POST');
				sendJson(res, 405, { ok: false, reason: 'method', message: 'Use GET or POST.' });
				return;
			}
			try {
				const unit = await teamworkUnit();
				const { tables } = await unit.loadAll();
				const rawRecord = settingsRecordOf(tables);
				const stored = storedPluginSettings(rawRecord, config);
				// Secrets saved by an older build in this record are moved into the
				// credential store and then dropped from it. Only the record's own
				// values migrate; the installed configuration stays its fallback.
				const canMigrateSecrets = credentialStore() !== null;
				const legacyToken = typeof rawRecord?.token === 'string' && rawRecord.token !== '' ? rawRecord.token : '';
				const legacyPassword = typeof rawRecord?.calendarPassword === 'string' && rawRecord.calendarPassword !== ''
					? rawRecord.calendarPassword
					: '';
				if (canMigrateSecrets && legacyToken !== '' && (await readSecret(TOKEN_CREDENTIAL)) === null) {
					await writeSecret(TOKEN_CREDENTIAL, legacyToken).catch(() => {});
				}
				if (canMigrateSecrets && legacyPassword !== ''
					&& (await readSecret(CALENDAR_PASSWORD_CREDENTIAL)) === null) {
					await writeSecret(CALENDAR_PASSWORD_CREDENTIAL, legacyPassword).catch(() => {});
				}
				const secrets = await effectiveSecrets(stored);
				const connection = {
					orgId: stored.orgId,
					hasToken: secrets.token !== '',
					login: login !== '' ? login : stored.login,
					hasCalendarPassword: secrets.calendarPassword !== '',
				};
				// The token and the calendar password are never returned; the window
				// edits them by leaving the field blank, which keeps the stored one.
				const { token: _legacyToken, calendarPassword: _legacyPassword, ...publicSettings } = stored;
				if (req.method === 'GET') {
					sendJson(res, 200, { ok: true, settings: publicSettings, connection });
					return;
				}
				let payload;
				try {
					payload = await readJsonBody(req, MAX_WRITE_BODY_BYTES);
				} catch (error) {
					sendJson(res, 400, {
						ok: false,
						reason: 'body',
						message: error instanceof Error ? error.message : String(error),
					});
					return;
				}
				if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
					sendJson(res, 400, { ok: false, reason: 'invalid', message: 'Send a JSON object.' });
					return;
				}
				const next = { ...publicSettings };
				for (const [field, validate] of Object.entries(SETTINGS_FIELDS)) {
					if (payload[field] === undefined) continue;
					const result = validate(payload[field]);
					if (result.error !== undefined) {
						sendJson(res, 400, { ok: false, reason: 'invalid', message: result.error });
						return;
					}
					next[field] = result.value;
				}
				// Secrets go to the credential store, never into this record. A
				// profile without the service keeps them in the record as before.
				if (payload.token !== undefined) {
					if (typeof payload.token !== 'string' || payload.token.trim() === '') {
						sendJson(res, 400, { ok: false, reason: 'invalid', message: 'token must be non-empty text.' });
						return;
					}
					if (credentialStore() === null) {
						sendJson(res, 503, {
							ok: false,
							reason: 'unavailable',
							message: 'The profile credential store is not available, so the token cannot be saved.',
						});
						return;
					}
					await writeSecret(TOKEN_CREDENTIAL, payload.token.trim());
				}
				if (payload.clearToken === true) {
					if (credentialStore() !== null) await clearSecret(TOKEN_CREDENTIAL);
					else delete next.token;
				}
				if (payload.calendarPassword !== undefined) {
					if (typeof payload.calendarPassword !== 'string' || payload.calendarPassword === '') {
						sendJson(res, 400, {
							ok: false, reason: 'invalid', message: 'calendarPassword must be non-empty text.',
						});
						return;
					}
					if (credentialStore() === null) {
						sendJson(res, 503, {
							ok: false,
							reason: 'unavailable',
							message: 'The profile credential store is not available, so the calendar password cannot be saved.',
						});
						return;
					}
					await writeSecret(CALENDAR_PASSWORD_CREDENTIAL, payload.calendarPassword);
				}
				if (payload.clearCalendarPassword === true) {
					if (credentialStore() !== null) await clearSecret(CALENDAR_PASSWORD_CREDENTIAL);
					else delete next.calendarPassword;
				}
				// Cross-field checks run on the merged result, so a partial save
				// cannot leave the day or the duration range contradictory.
				const startMinutes = clockMinutes(next.workdayStart);
				const endMinutes = clockMinutes(next.workdayEnd);
				if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) {
					sendJson(res, 400, {
						ok: false, reason: 'invalid', message: 'workdayStart must be before workdayEnd.',
					});
					return;
				}
				if (next.defaultDurationMinutes > next.maxDurationHours * 60) {
					sendJson(res, 400, {
						ok: false, reason: 'invalid', message: 'defaultDurationMinutes cannot exceed the maximum duration.',
					});
					return;
				}
				// A profile without the credential service has nowhere to move the
				// legacy secrets, so a save keeps them in the record. New secrets
				// cannot be written there: the route refuses them above.
				if (!canMigrateSecrets) {
					if (legacyToken !== '' && payload.token === undefined && payload.clearToken !== true) {
						next.token = legacyToken;
					}
					if (legacyPassword !== '' && payload.calendarPassword === undefined
						&& payload.clearCalendarPassword !== true) {
						next.calendarPassword = legacyPassword;
					}
				}
				await unit.putRecord(TEAMWORK_TABLE, PLUGIN_SETTINGS_RECORD, next);
				if (typeof unit.deleteRecord === 'function') {
					await unit.deleteRecord(TEAMWORK_TABLE, LEGACY_SETTINGS_RECORD).catch(() => {});
				}
				// The login and the caches depend on the settings; drop them.
				login = '';
				tasksRevision += 1;
				tasksCached = null;
				tasksPending = null;
				calendarRevision += 1;
				calendarsCache = null;
				calendarsPending = null;
				eventsCache.clear();
				cached = null;
				revision += 1;
				const savedSecrets = await effectiveSecrets(next);
				const savedConnection = {
					orgId: next.orgId,
					hasToken: savedSecrets.token !== '',
					login: next.login,
					hasCalendarPassword: savedSecrets.calendarPassword !== '',
				};
				const { token: _savedToken, calendarPassword: _savedPassword, ...savedPublic } = next;
				sendJson(res, 200, { ok: true, settings: savedPublic, connection: savedConnection });
			} catch (error) {
				sendJson(res, 500, {
					ok: false,
					reason: 'storage',
					message: error instanceof Error ? error.message : String(error),
				});
			}
		},
	}), `yandex-tracker-today: GET/POST ${SETTINGS_PATH}`);

	// A connection probe for the settings window: the Tracker token and the
	// calendar credentials are exercised without touching the day's data.
	ctx.effect(() => ctx.webServer.register({
		kind: 'exact',
		path: TEST_PATH,
		handler: async (req, res) => {
			const rejection = ctx.connection.requestRejection(req);
			if (rejection !== undefined) {
				res.statusCode = rejection;
				res.end();
				return;
			}
			if (req.method !== 'GET') {
				res.setHeader('allow', 'GET');
				sendJson(res, 405, { ok: false, reason: 'method', message: 'Use GET.' });
				return;
			}
			const effective = await effectiveConfig();
			const tracker = await (async () => {
				if (effective.token === '') return { ok: false, message: 'No OAuth token is configured.' };
				try {
					const { body } = await trackerRequest(effective, '/myself');
					const name = body !== null && typeof body === 'object' ? text(body.login) : '';
					return { ok: true, login: name };
				} catch (error) {
					return { ok: false, message: error instanceof Error ? error.message : String(error) };
				}
			})();
			const calendar = await (async () => {
				if (effective.calendarLogin === '' || effective.calendarPassword === '') {
					return { ok: false, message: 'Calendar login or app password is not configured.' };
				}
				try {
					const calendars = await discoverCalendars(effective);
					return { ok: true, calendars: calendars.length };
				} catch (error) {
					return { ok: false, message: error instanceof Error ? error.message : String(error) };
				}
			})();
			sendJson(res, 200, { ok: true, tracker, calendar });
		},
	}), `yandex-tracker-today: GET ${TEST_PATH}`);

	// The write side. It shares the trust fence and the configuration with the
	// summary route, and invalidates the cache once Tracker has the record, so
	// the next read reflects the new worklog instead of a stale total.
	ctx.effect(() => ctx.webServer.register({
		kind: 'exact',
		path: ADD_PATH,
		handler: async (req, res) => {
			const effective = await effectiveConfig();
			const accepted = await acceptWrite(ctx, effective, req, res);
			if (accepted === null) return;
			const input = normalizeAddInput(accepted.body, effective);
			if (!input.ok) {
				sendJson(res, 400, { ok: false, reason: 'invalid', message: input.message });
				return;
			}
			// The same business rules the form checks are enforced here, so a
			// direct request cannot book a future start or a closed task.
			if (new Date(input.value.start).getTime() > Date.now()) {
				sendJson(res, 400, {
					ok: false, reason: 'invalid', message: 'Start time cannot be in the future.',
				});
				return;
			}
			let task;
			try {
				task = await readTask(effective, input.value.issueKey);
			} catch (error) {
				const status = error !== null && typeof error === 'object' && typeof error.status === 'number' ? error.status : 0;
				if (status === 404) {
					sendJson(res, 404, {
						ok: false,
						reason: 'notfound',
						message: `Task ${input.value.issueKey} was not found in Tracker.`,
					});
					return;
				}
				sendUpstreamFailure(res, error);
				return;
			}
			if (isClosedTask(task)) {
				sendJson(res, 400, {
					ok: false,
					reason: 'closed',
					message: 'This task is closed and cannot receive time.',
				});
				return;
			}
			try {
				const id = await createWorklog(effective, input.value);
				cached = null;
				revision += 1;
				sendJson(res, 200, {
					ok: true,
					id,
					issueKey: input.value.issueKey,
					start: input.value.start,
					minutes: input.value.minutes,
					hours: formatMinutes(input.value.minutes),
					comment: input.value.comment,
				});
			} catch (error) {
				sendUpstreamFailure(res, error);
			}
		},
	}), `yandex-tracker-today: POST ${ADD_PATH}`);

	// Deleting one record. One path carries one operation, and a successful
	// delete invalidates the same cached summary the add route clears.
	ctx.effect(() => ctx.webServer.register({
		kind: 'exact',
		path: DELETE_PATH,
		handler: async (req, res) => {
			const effective = await effectiveConfig();
			const accepted = await acceptWrite(ctx, effective, req, res);
			if (accepted === null) return;
			const payload = accepted.body;
			if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
				sendJson(res, 400, {
					ok: false,
					reason: 'invalid',
					message: 'Send a JSON object with key and id.',
				});
				return;
			}
			const issueKey = issueKeyOf(payload.key);
			if (issueKey === '') {
				sendJson(res, 400, { ok: false, reason: 'invalid', message: 'Task key must look like ABC-123.' });
				return;
			}
			const id = worklogIdOf(payload.id);
			if (id === '') {
				sendJson(res, 400, { ok: false, reason: 'invalid', message: 'A worklog id is required.' });
				return;
			}
			try {
				await deleteWorklog(effective, issueKey, id);
				cached = null;
				revision += 1;
				sendJson(res, 200, { ok: true, issueKey, id });
			} catch (error) {
				sendUpstreamFailure(res, error);
			}
		},
	}), `yandex-tracker-today: POST ${DELETE_PATH}`);
}


