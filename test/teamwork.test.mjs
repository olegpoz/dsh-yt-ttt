/**
 * Coverage for the pinned teamwork task's durable store.
 *
 * The task is plugin state, not Tracker data, so it lives in the profile's own
 * KV unit. These checks drive the GET/POST route over a KV-unit double: the
 * record shape, overwrite and clear paths, validation, the trust fence, and the
 * failure when the storage service is absent.
 */
import { Readable } from 'node:stream';
import { apply } from '../index.js';
import { makeCredentialStore, TOKEN_KEY, CALENDAR_PASSWORD_KEY } from './helpers.mjs';

const PATH = '/yandex-tracker-today/teamwork';
const SETTINGS_PATH = '/yandex-tracker-today/settings';

/** One in-memory KV unit, shaped like the JSON backend's single layout. */
function makeUnit() {
	const records = new Map();
	return {
		records,
		async loadAll() {
			return { tables: { settings: Object.fromEntries(records) }, global: null };
		},
		async putRecord(table, key, value) {
			if (table !== 'settings') throw new Error(`unexpected table ${table}`);
			records.set(key, value);
		},
		async deleteRecord(table, key) {
			return records.delete(key);
		},
		async deleteRecords(table, keys) {
			let deleted = 0;
			for (const key of keys) if (records.delete(key)) deleted += 1;
			return deleted;
		},
		async setGlobal() {},
		async close() {},
	};
}

const unit = makeUnit();
const opened = [];
const storage = {
	backend: {
		names() {
			return ['json'];
		},
		get(name) {
			return name === 'json'
				? {
					kv: {
						async open(descriptor) {
							// Mirror the JSON backend's unit-name rule so a regression like
							// the old hyphenated name is caught here.
							if (!/^[a-z][a-z0-9_]*$/u.test(descriptor.name)) {
								throw new Error(`invalid unit name: ${descriptor.name}`);
							}
							opened.push(descriptor);
							return unit;
						},
					},
				}
				: undefined;
		},
	},
};

/**
 * The credential store the base mount provides. The row config is not a secret
 * source any more, so the suites seed the token here.
 */
const baseCredentials = makeCredentialStore({ [TOKEN_KEY]: 't' });

/**
 * Mount the plugin over a context whose storage returns the double.
 * @param options - overrides for `get`, the trust fence and the row config.
 * @returns the registered routes by path.
 */
function mount({
	get = (name) => (name === 'storage' ? storage : (name === 'credentials' ? baseCredentials : undefined)),
	rejection = () => undefined,
	config = { orgId: '1' },
} = {}) {
	const routes = new Map();
	apply({
		webServer: { register: (definition) => { routes.set(definition.path, definition); return () => {}; } },
		connection: { requestRejection: rejection },
		effect: (callback) => { callback(); },
		get,
	}, config);
	return routes;
}

const routes = mount();
const route = routes.get(PATH);
const settingsRoute = routes.get(SETTINGS_PATH);

/** Drive the route with a request double. */
function call({ method = 'GET', body } = {}) {
	const text = body === undefined ? undefined : JSON.stringify(body);
	const req = Readable.from(text === undefined ? [] : [Buffer.from(text)]);
	req.method = method;
	req.url = PATH;
	req.headers = { 'content-type': 'application/json' };
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

const empty = await call();
const saved = await call({
	method: 'POST',
	body: {
		task: { key: 'ABC-1', summary: 'Fix the thing', status: 'Open', statusKey: 'open', extra: 'ignored' },
	},
});
const savedRecord = unit.records.get('teamworkTask');
const readBack = await call();
const replaced = await call({ method: 'POST', body: { task: { key: 'ABC-2', summary: 'Ship it' } } });
const replacedRecord = unit.records.get('teamworkTask');
const cleared = await call({ method: 'POST', body: { clear: true } });
const afterClear = await call();

const invalidKey = await call({ method: 'POST', body: { task: { key: 'nope' } } });
const emptyBody = await call({ method: 'POST', body: undefined });
const emptyObject = await call({ method: 'POST', body: {} });
const wrongMethod = await call({ method: 'PUT' });

/** Drive the settings route with a request double. */
function callSettings({ method = 'GET', body } = {}) {
	const text = body === undefined ? undefined : JSON.stringify(body);
	const req = Readable.from(text === undefined ? [] : [Buffer.from(text)]);
	req.method = method;
	req.url = SETTINGS_PATH;
	req.headers = { 'content-type': 'application/json' };
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
		settingsRoute.handler(req, res);
	});
}

const settingsDefault = await callSettings();
const settingsSet = await callSettings({ method: 'POST', body: { durationChange: 'start' } });
const settingsRecord = unit.records.get('pluginSettings');
const settingsRead = await callSettings();
const settingsMax = await callSettings({ method: 'POST', body: { maxDurationHours: 10 } });
const settingsMaxRecord = unit.records.get('pluginSettings');
const settingsReadMax = await callSettings();
const settingsInvalid = await callSettings({ method: 'POST', body: { durationChange: 'middle' } });
const settingsBadMax = await callSettings({ method: 'POST', body: { maxDurationHours: 0 } });
const settingsDelay = await callSettings({ method: 'POST', body: { refreshDelaySeconds: 7 } });
const settingsDelayRecord = unit.records.get('pluginSettings');
const settingsReadDelay = await callSettings();
const settingsBadDelay = await callSettings({ method: 'POST', body: { refreshDelaySeconds: 0 } });
const settingsConfig = await callSettings({
	method: 'POST',
	body: {
		timeZone: 'UTC', defaultQueue: 'ABC', workdayEnd: '19:30', calendarLogin: 'cal@example.com',
		workdayStart: '08:30', dailyTargetHours: 7, defaultDurationMinutes: 45, eventCommentPrefix: 'Sync: ',
	},
});
const settingsConfigRecord = unit.records.get('pluginSettings');
const settingsConfigRead = await callSettings();
const settingsBadZone = await callSettings({ method: 'POST', body: { timeZone: 'Not/AZone' } });
const settingsBadEnd = await callSettings({ method: 'POST', body: { workdayEnd: '25:00' } });
const settingsBadStart = await callSettings({ method: 'POST', body: { workdayStart: 'nope' } });
const settingsBadTarget = await callSettings({ method: 'POST', body: { dailyTargetHours: 0 } });
const settingsBadDuration = await callSettings({ method: 'POST', body: { defaultDurationMinutes: 7 } });
const settingsBadPrefix = await callSettings({ method: 'POST', body: { eventCommentPrefix: 'x'.repeat(201) } });
const settingsBadOrder = await callSettings({ method: 'POST', body: { workdayStart: '20:00' } });
const settingsBadCrossDuration = await callSettings({
	method: 'POST', body: { maxDurationHours: 1, defaultDurationMinutes: 120 },
});
const settingsBadPoll = await callSettings({ method: 'POST', body: { pollIntervalMinutes: 0 } });
const settingsPoll = await callSettings({ method: 'POST', body: { pollIntervalMinutes: 15 } });
const settingsPollRecord = unit.records.get('pluginSettings');
const settingsPollRead = await callSettings();
const settingsSecrets = await callSettings({
	method: 'POST',
	body: { orgId: '42', login: 'ivanov', token: 'y0_new', calendarPassword: 'app-pass' },
});
const settingsSecretsRecord = unit.records.get('pluginSettings');
const settingsSecretsRead = await callSettings();
const settingsBadToken = await callSettings({ method: 'POST', body: { token: '' } });
const settingsBadPassword = await callSettings({ method: 'POST', body: { calendarPassword: '' } });
const settingsWrongMethod = await callSettings({ method: 'PUT' });

// ---- credential store ------------------------------------------------------
const credentialService = makeCredentialStore();
const credentialRecords = credentialService.records;
const credentialMount = mount({
	get: (name) => (name === 'storage' ? storage : (name === 'credentials' ? credentialService : undefined)),
});
/** Drive one settings route with a request double. */
function callSettingsOn(target, { method = 'GET', body } = {}) {
	const text = body === undefined ? undefined : JSON.stringify(body);
	const req = Readable.from(text === undefined ? [] : [Buffer.from(text)]);
	req.method = method;
	req.url = SETTINGS_PATH;
	req.headers = { 'content-type': 'application/json' };
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
		target.handler(req, res);
	});
}
const credentialSave = await callSettingsOn(credentialMount.get(SETTINGS_PATH), {
	method: 'POST', body: { token: 'cred-token', calendarPassword: 'cred-pass' },
});
const credentialRecord = unit.records.get('pluginSettings');
const credentialTokenRecord = credentialRecords.get('yandex-tracker-today/tracker-token');
const credentialPasswordRecord = credentialRecords.get('yandex-tracker-today/calendar-password');
const credentialRead = await callSettingsOn(credentialMount.get(SETTINGS_PATH));
const credentialClear = await callSettingsOn(credentialMount.get(SETTINGS_PATH), {
	method: 'POST', body: { clearToken: true },
});
const tokenAfterClear = credentialRecords.has('yandex-tracker-today/tracker-token');

const guarded = mount({ rejection: () => 403 });
const guardedResult = await new Promise((resolve) => {
	const req = Readable.from([]);
	req.method = 'GET';
	req.url = PATH;
	req.headers = {};
	guarded.get(PATH).handler(req, {
		statusCode: 0,
		setHeader() {},
		end() { resolve({ status: this.statusCode }); },
	});
});

const storageMissing = mount({ get: () => undefined });
const missingResult = await new Promise((resolve) => {
	const req = Readable.from([]);
	req.method = 'GET';
	req.url = PATH;
	req.headers = {};
	storageMissing.get(PATH).handler(req, {
		statusCode: 0,
		setHeader() {},
		end(payload) { resolve({ status: this.statusCode, body: JSON.parse(payload) }); },
	});
});

// The row config is not a secret source, and a profile without a store cannot
// save one: both rules are pinned here.
const noStoreMount = mount({ get: (name) => (name === 'storage' ? storage : undefined) });
const noStoreSecret = await callSettingsOn(noStoreMount.get(SETTINGS_PATH), {
	method: 'POST', body: { token: 'nope' },
});
const configTokenMount = mount({
	get: (name) => (name === 'storage' ? storage : undefined),
	config: { token: 'from-config', orgId: '1' },
});
const configTokenRead = await callSettingsOn(configTokenMount.get(SETTINGS_PATH));

const checks = [
	['an empty store reads as null', empty.status === 200 && empty.body.ok === true && empty.body.task === null],
	['a save is accepted', saved.status === 200 && saved.body.ok === true && saved.body.task.key === 'ABC-1'],
	['the record is normalized', savedRecord.key === 'ABC-1' && savedRecord.summary === 'Fix the thing'
		&& savedRecord.status === 'Open' && savedRecord.statusKey === 'open' && !('extra' in savedRecord)],
	['the unit is opened with its descriptor', opened.length >= 1
		&& opened.every((row) => row.name === 'yandex_tracker_today'
			&& row.version === 1
			&& row.layout === 'single'
			&& Array.isArray(row.tables))
		&& opened[0].tables.includes('settings')],
	['the saved task reads back', readBack.body.task.key === 'ABC-1' && readBack.body.task.summary === 'Fix the thing'],
	['a newer save replaces the task', replaced.status === 200 && replacedRecord.key === 'ABC-2'],
	['clearing removes the record', cleared.status === 200 && cleared.body.task === null && !unit.records.has('teamworkTask')],
	['the cleared store reads as null', afterClear.body.task === null],
	['a malformed key is refused', invalidKey.status === 400 && invalidKey.body.reason === 'invalid'],
	['an empty body is refused', emptyBody.status === 400 && emptyBody.body.reason === 'invalid'],
	['a body without a task is refused', emptyObject.status === 400 && emptyObject.body.reason === 'invalid'],
	['an unsupported method is refused', wrongMethod.status === 405 && wrongMethod.headers.allow === 'GET, POST'],
	['the settings default to Recalc End', settingsDefault.status === 200
		&& settingsDefault.body.settings.durationChange === 'end'
		&& settingsDefault.body.settings.maxDurationHours === 8
		&& settingsDefault.body.settings.refreshDelaySeconds === 3
		&& settingsDefault.body.settings.workdayStart === '09:00'
		&& settingsDefault.body.settings.dailyTargetHours === 8
		&& settingsDefault.body.settings.defaultDurationMinutes === 60
		&& settingsDefault.body.settings.eventCommentPrefix === '\u0412\u0441\u0442\u0440\u0435\u0447\u0430: '],
	['the connection status is reported', settingsDefault.body.connection !== null
		&& settingsDefault.body.connection.hasToken === true
		&& settingsDefault.body.connection.orgId === '1'
		&& settingsDefault.body.connection.hasCalendarPassword === false],
	['a settings change is stored', settingsSet.status === 200
		&& settingsSet.body.settings.durationChange === 'start'
		&& settingsRecord.durationChange === 'start'
		&& settingsRecord.maxDurationHours === 8],
	['the settings read back', settingsRead.body.settings.durationChange === 'start'],
	['a new duration ceiling is stored', settingsMax.status === 200
		&& settingsMaxRecord.maxDurationHours === 10
		&& settingsMaxRecord.durationChange === 'start'],
	['the ceiling reads back with the behavior', settingsReadMax.status === 200
		&& settingsReadMax.body.settings.maxDurationHours === 10
		&& settingsReadMax.body.settings.durationChange === 'start'],
	['an unknown duration behavior is refused', settingsInvalid.status === 400
		&& settingsInvalid.body.reason === 'invalid'],
	['a ceiling below one hour is refused', settingsBadMax.status === 400
		&& settingsBadMax.body.reason === 'invalid'],
	['a new refresh delay is stored', settingsDelay.status === 200
		&& settingsDelayRecord.refreshDelaySeconds === 7
		&& settingsDelayRecord.durationChange === 'start'
		&& settingsDelayRecord.maxDurationHours === 10],
	['the refresh delay reads back', settingsReadDelay.status === 200
		&& settingsReadDelay.body.settings.refreshDelaySeconds === 7],
	['a delay below one second is refused', settingsBadDelay.status === 400
		&& settingsBadDelay.body.reason === 'invalid'],
	['zone, queue and workday defaults are stored', settingsConfig.status === 200
		&& settingsConfigRecord.timeZone === 'UTC'
		&& settingsConfigRecord.defaultQueue === 'ABC'
		&& settingsConfigRecord.workdayEnd === '19:30'
		&& settingsConfigRecord.calendarLogin === 'cal@example.com'],
	['zone, queue and workday defaults read back', settingsConfigRead.status === 200
		&& settingsConfigRead.body.settings.timeZone === 'UTC'
		&& settingsConfigRead.body.settings.defaultQueue === 'ABC'
		&& settingsConfigRead.body.settings.workdayEnd === '19:30'
		&& settingsConfigRead.body.settings.calendarLogin === 'cal@example.com'],
	['the day shape settings are stored', settingsConfigRecord.workdayStart === '08:30'
		&& settingsConfigRecord.dailyTargetHours === 7
		&& settingsConfigRecord.defaultDurationMinutes === 45
		&& settingsConfigRecord.eventCommentPrefix === 'Sync: '],
	['the day shape settings read back', settingsConfigRead.body.settings.workdayStart === '08:30'
		&& settingsConfigRead.body.settings.dailyTargetHours === 7
		&& settingsConfigRead.body.settings.defaultDurationMinutes === 45
		&& settingsConfigRead.body.settings.eventCommentPrefix === 'Sync: '],
	['an unknown time zone is refused', settingsBadZone.status === 400
		&& settingsBadZone.body.reason === 'invalid'],
	['a malformed workday end is refused', settingsBadEnd.status === 400
		&& settingsBadEnd.body.reason === 'invalid'],
	['a malformed workday start is refused', settingsBadStart.status === 400
		&& settingsBadStart.body.reason === 'invalid'],
	['a zero daily target is refused', settingsBadTarget.status === 400
		&& settingsBadTarget.body.reason === 'invalid'],
	['a duration not on the grid is refused', settingsBadDuration.status === 400
		&& settingsBadDuration.body.reason === 'invalid'],
	['an overlong meeting prefix is refused', settingsBadPrefix.status === 400
		&& settingsBadPrefix.body.reason === 'invalid'],
	['the connection fields are stored', settingsSecrets.status === 200
		&& settingsSecretsRecord.orgId === '42'
		&& settingsSecretsRecord.login === 'ivanov'],
	['the typed secrets go to the credential store', baseCredentials.records.get(TOKEN_KEY)?.key === 'y0_new'
		&& baseCredentials.records.get(CALENDAR_PASSWORD_KEY)?.key === 'app-pass'],
	['the secrets stay out of the settings record', !('token' in settingsSecretsRecord)
		&& !('calendarPassword' in settingsSecretsRecord)],
	['a token in the row config is ignored', configTokenRead.body.connection.hasToken === false],
	['a secret without the credential store is refused', noStoreSecret.status === 503
		&& noStoreSecret.body.reason === 'unavailable'],
	['the secrets are never returned', !('token' in settingsSecretsRead.body.settings)
		&& !('calendarPassword' in settingsSecretsRead.body.settings)],
	['the credential store receives the secrets', credentialSave.status === 200
		&& credentialTokenRecord?.key === 'cred-token'
		&& credentialPasswordRecord?.key === 'cred-pass'],
	['the secrets stay out of the credential mount record', !('token' in credentialRecord)
		&& !('calendarPassword' in credentialRecord)],
	['the credential presence is reported', credentialRead.body.connection.hasToken === true
		&& !('token' in credentialRead.body.settings)],
	['clearing the token deletes its record', credentialClear.status === 200 && tokenAfterClear === false],
	['a workday that ends before it starts is refused', settingsBadOrder.status === 400
		&& settingsBadOrder.body.reason === 'invalid'],
	['a default duration over the ceiling is refused', settingsBadCrossDuration.status === 400
		&& settingsBadCrossDuration.body.reason === 'invalid'],
	['a zero poll interval is refused', settingsBadPoll.status === 400
		&& settingsBadPoll.body.reason === 'invalid'],
	['the poll interval is stored and read back', settingsPollRecord.pollIntervalMinutes === 15
		&& settingsPollRead.body.settings.pollIntervalMinutes === 15],
	['the connection status follows the stored values', settingsSecretsRead.body.connection.hasToken === true
		&& settingsSecretsRead.body.connection.orgId === '42'
		&& settingsSecretsRead.body.connection.login === 'ivanov'
		&& settingsSecretsRead.body.connection.hasCalendarPassword === true
		&& settingsSecretsRead.body.settings.orgId === '42'],
	['an empty token is refused', settingsBadToken.status === 400
		&& settingsBadToken.body.reason === 'invalid'],
	['an empty calendar password is refused', settingsBadPassword.status === 400
		&& settingsBadPassword.body.reason === 'invalid'],
	['the settings route refuses other methods', settingsWrongMethod.status === 405
		&& settingsWrongMethod.headers.allow === 'GET, POST'],
	['the route is trust-fenced', guardedResult.status === 403],
	['a missing storage service is reported', missingResult.status === 500 && missingResult.body.reason === 'storage'],
];

for (const [name, passed] of checks) console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}`);
const failed = checks.filter(([, passed]) => !passed).length;
console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);


