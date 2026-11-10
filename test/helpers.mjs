/**
 * Test doubles shared by the plugin's suites.
 *
 * The plugin keeps its token and calendar password in the profile credential
 * store, so every suite that exercises a host route needs a store stand-in.
 * The real service is looked up as `ctx.get('credentials')` and used through
 * `readRecord`, `modifyRecord` and `deleteRecord`.
 */

/**
 * An in-memory credential store.
 * @param initial - record keys mapped to their plain secret values.
 * @returns the service double; `records` exposes the stored records.
 */
export function makeCredentialStore(initial = {}) {
	const records = new Map();
	for (const [key, value] of Object.entries(initial)) {
		if (typeof value === 'string' && value !== '') records.set(key, { kind: 'api-key', key: value });
	}
	return {
		records,
		async readRecord(key) {
			return records.has(key) ? records.get(key) : null;
		},
		async modifyRecord(key, mutate) {
			const next = await mutate(records.has(key) ? records.get(key) : null);
			if (next !== undefined && next !== null) records.set(key, next);
			return records.has(key) ? records.get(key) : null;
		},
		async deleteRecord(key) {
			records.delete(key);
		},
	};
}

/** Credential record key of the Tracker token. */
export const TOKEN_KEY = 'yandex-tracker-today/tracker-token';
/** Credential record key of the Yandex Calendar app password. */
export const CALENDAR_PASSWORD_KEY = 'yandex-tracker-today/calendar-password';

/**
 * A `ctx.get` that answers with the credential store and nothing else.
 * @param store - the credential store double, or null for a profile without one.
 * @returns the getter.
 */
export const credentialsOnly = (store) => (name) => (name === 'credentials' && store !== null ? store : undefined);
