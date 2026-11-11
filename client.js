window.__ModuleLoader__.load({
	id: 'dsh-yt-ttt',
	factory(require) {
		const React = require('react');
		const h = React.createElement;

		/** Locale namespace owned by this plugin. */
		const NS = 'yandex-tracker-today';
		/** Authenticated host route carrying the already-computed summary. */
		const SUMMARY_URL = '/yandex-tracker-today/summary';
		/** Authenticated host route the "+ Add" form writes one worklog through. */
		const ADD_URL = '/yandex-tracker-today/worklog';
		/** Authenticated host route a row's delete button removes a worklog through. */
		const DELETE_URL = '/yandex-tracker-today/worklog/delete';
		/** Authenticated host route the task picker reads the account's open issues from. */
		const TASKS_URL = '/yandex-tracker-today/tasks';
		/** Authenticated host route the picker reads the pinned teamwork task from. */
		const TASK_URL = '/yandex-tracker-today/task';
		/** Authenticated host route the pinned teamwork task is stored through. */
		const TEAMWORK_URL = '/yandex-tracker-today/teamwork';
		/** Authenticated host route the add form reads the day's calendar events through. */
		const EVENTS_URL = '/yandex-tracker-today/events';
		/** Authenticated host route the add form reads and writes its settings through. */
		const SETTINGS_URL = '/yandex-tracker-today/settings';
const TEST_URL = '/yandex-tracker-today/test';
		/** Browser storage key remembering the picker's pinned teamwork task. */
		const TEAMWORK_STORAGE = 'dsh-yt-ttt/teamwork-task';
		/**
		 * The one id shared by the sidebar rail entry and the central panel it
		 * opens: selecting a panel row dispatches this exact key into the keyed
		 * `main` slot, and selecting a key with no occupant throws.
		 */
		const PANEL_ID = 'tracker-today';
		/** Fallback Tracker page, used before a payload arrives. */
		const FALLBACK_URL = 'https://tracker.yandex.ru/pages/my';
		/** Style element marker, so a reload never stacks duplicate stylesheets. */
		const STYLE_TAG = 'dsh-yt-ttt/panel.css';
		/**
		 * How often the plate re-reads the host route on its own.
		 *
		 * Worklogs are edited in Tracker, outside this app, so nothing here can be
		 * told about a change: the figure has to be polled. Five minutes is frequent
		 * enough to catch a booking appearing and rare enough that the API sees one
		 * request per five minutes. The host caches for 15s, so a five-minute tick
		 * always misses that cache and reaches Tracker for real.
		 */
		const POLL_INTERVAL_MS = 300000;
		/**
		 * How long the list waits before re-reading after a write.
		 *
		 * Tracker's search index lags the write slightly, so a read issued the
		 * moment the dialog closes can still return the pre-write list. Three
		 * seconds is the default; the panel's settings can change it.
		 */
		const DEFAULT_REFRESH_DELAY_SECONDS = 3;
		/** The largest refresh delay the settings accept, in seconds. */
		const MAX_REFRESH_DELAY_SECONDS = 60;

		/** English messages; every other locale falls back here. */
		const en = {
			// The rail row's own label. The host uses it as the row's visible text
			// when the sidebar is expanded and as the collapsed tooltip, so the pill
			// itself carries no text beyond the value.
			'badge.label': 'Tracked time',
			// Native tooltip on the rail plate. It states the target as well as the
			// figure, so the green/yellow tint is never the only signal.
			'badge.hintEmpty': 'Nothing logged today yet',
			'badge.hintLoading': 'Reading today\u2019s logged time\u2026',
			'badge.hintError': 'Could not read today\u2019s logged time',
			'panel.title': 'Yandex Tracker',
			// The panel's subtitle names whose time is shown, so a shared screen is
			// never ambiguous about the account behind the figures.
			'panel.byUser': 'Time tracked by user: {login}',
			'panel.openHint': 'Open the Tracker page for this account',
			'panel.today': 'Today',
			'panel.yesterday': 'Yesterday',
			// The plates switch the list between the two days, so each carries the
			// action it performs rather than only the day it names.
			'panel.showToday': 'Show today\u2019s worklogs',
			'panel.showYesterday': 'Show yesterday\u2019s worklogs',
			// `{count}` is the worklog count; the plural-free form keeps this simple,
			// and the count reads correctly for one as well as many.
			'panel.count': '({count} entries)',
			// An unbooked stretch of the working day.
			'panel.gapAdd': '+ Insert',
			'panel.gapAddHint': 'Log time in this gap ({from}\u2013{to})',
			'panel.gapHint': '{from}\u2013{to} \u00b7 {hours}',
			// Colour meanings, stated as text so the tints are never the only signal.
			'panel.todayOk': 'Today: {hours} tracked, {target} hours reached',
			'panel.todayLow': 'Today: {hours} tracked, {target} hours not reached yet',
			'panel.yesterdayOk': 'Yesterday: {hours} tracked, at or above the {target}-hour target',
			'panel.yesterdayLow': 'Yesterday: {hours} tracked, below the {target}-hour target',
			'panel.yesterdayWeekend': 'Yesterday was a weekend day: {hours} tracked',
			'panel.yesterdayPlain': 'Yesterday: {hours} tracked',
			'panel.refresh': 'Refresh',
			'panel.refreshHint': 'Read today\u2019s worklogs again without leaving this page',
			'panel.staleWaiting': 'Updating in {seconds}s\u2026',
			'panel.staleRefreshing': 'Updating the list\u2026',
			'panel.deletingRow': 'Deleting\u2026',
			'panel.now': 'Now {date}, {weekday} {time}',
			// The plates end in a control that opens the small "Adding time" panel.
			'panel.new': 'New',
			'panel.addHint': 'Log time against an issue (Ctrl+Insert)',
			'panel.addingTime': 'Adding time',
			'panel.taskKey': 'Task key',
			'panel.taskKeyPlaceholder': 'ABC-123',
			'panel.pickTaskHint': 'Choose a task from your current ones (Down)',
			'panel.date': 'Date',
			'panel.dateHint': 'Open the calendar (Down)',
			'panel.calendarEvent': 'Calendar event',
			'panel.calendarEventPlaceholder': 'No event selected',
			'panel.calendarEventHint': 'Choose a calendar event (Down)',
			'panel.eventsTitle': 'Events list',
			'panel.eventsReading': 'Reading the calendar\u2026',
			'panel.eventsEmpty': 'No events on this date',
			'panel.eventsFailed': 'Could not read the calendar',
			'panel.eventsRefresh': 'Refresh',
			'panel.eventsRefreshHint': 'Read the calendar events again',
			'panel.addingSettings': 'Adding time settings',
			'panel.whenDurationChanged': 'When Duration changed',
			'panel.maxDuration': 'Maximum duration, hours',
			'panel.maxDurationInvalid': 'Enter a whole number of hours from 1 to 24.',
			'panel.panelSettings': 'Settings',
			'panel.panelSettingsHint': 'Open the plugin settings',
			'panel.refreshDelay': 'Delayed refresh, seconds',
			'panel.refreshDelayInvalid': 'Enter a whole number of seconds from 1 to 60.',
			'panel.timeZone': 'Time zone',
			'panel.timeZoneInvalid': 'Unknown time zone.',
			'panel.defaultQueue': 'Default queue',
			'panel.workdayStart': 'Workday start',
			'panel.workdayStartInvalid': 'Workday start must be HH:MM.',
			'panel.workdayEnd': 'Workday end',
			'panel.workdayEndInvalid': 'Workday end must be HH:MM.',
			'panel.dailyTarget': 'Daily target, hours',
			'panel.dailyTargetInvalid': 'Enter hours from 0.5 to 24.',
			'panel.defaultDuration': 'Default duration, minutes',
			'panel.defaultDurationInvalid': 'Enter minutes from 5 to 1440, a multiple of 5.',
			'panel.defaultDurationTooLong': 'Default duration cannot exceed the maximum duration.',
			'panel.eventPrefixHint': 'Text put before the event title when a calendar event fills the comment.',
			'panel.eventPrefixInvalid': 'Event comment prefix must be at most 200 characters.',
			'panel.tasksQuery': 'Task list query',
			'panel.tasksQueryHint': 'Tracker query the "Your current tasks" picker searches with.',
			'panel.tasksQueryInvalid': 'The task query must be non-empty text, at most 2000 characters.',
			'panel.calendarLogin': 'Calendar login',
			'panel.calendarLoginHint': 'CalDAV login, usually the full email address.',
			'panel.calendarPassword': 'Calendar app password',
			'panel.calendarPasswordHint': 'App password created in Yandex ID for Calendar. Leave blank to keep the current one.',
			'panel.settingsSave': 'Save',
			'panel.groupPanel': 'Panel',
			'panel.groupTracker': 'Yandex Tracker Integration',
			'panel.groupCalendar': 'Yandex Calendar Integration',
			'panel.orgId': 'Organization id',
			'panel.orgIdHint': 'Yandex 360 organization identifier (X-Org-ID).',
			'panel.login': 'Tracker login',
			'panel.loginHint': 'Login inside the organization; leave empty to resolve it from the token.',
			'panel.token': 'OAuth token',
			'panel.tokenHint': 'Token with tracker access. Leave blank to keep the current one.',
			'panel.secretKeepPlaceholder': '\u2022\u2022\u2022\u2022 set \u2014 leave blank to keep',
			'panel.secretEmptyPlaceholder': 'Paste a value',
			'panel.refreshDelayHint': 'Seconds the list waits after an add or delete before it re-reads Tracker.',
			'panel.timeZoneHint': 'Zone used for day boundaries and worklog timestamps.',
			'panel.workdayStartHint': 'First time the day timeline covers.',
			'panel.workdayEndHint': 'Time the timeline is padded to.',
			'panel.dailyTargetHint': 'Hours a day needs to turn the plates green.',
			'panel.whenDurationChangedHint': 'Which side of the interval moves when Duration changes.',
			'panel.maxDurationHint': 'Longest worklog the form accepts.',
			'panel.defaultQueueHint': 'Queue a digits-only task key expands with.',
			'panel.defaultDurationHint': 'Length a new worklog starts with when there is no gap.',
			'panel.recalcEnd': 'Recalc End',
			'panel.recalcStart': 'Recalc Start',
			'panel.settingsFailed': 'Could not save the setting',
			'panel.settingsLoadFailed': 'Could not load the plugin settings.',
			'panel.settingsLoading': 'Loading the settings\u2026',
			'panel.retry': 'Retry',
			'panel.pollInterval': 'Poll interval, minutes',
			'panel.pollIntervalHint': 'How often the panel re-reads Tracker in the background.',
			'panel.pollIntervalInvalid': 'Enter a whole number from 1 to 60 minutes.',
			'panel.workdayOrderInvalid': 'Workday start must be earlier than its end.',
			'panel.testConnection': 'Test connection',
			'panel.testing': 'Testing\u2026',
			'panel.testSavedNote': 'The test uses the saved settings.',
			'panel.testTrackerOk': 'Tracker: connected as {login}',
			'panel.testTrackerFailed': 'Tracker: {message}',
			'panel.testCalendarOk': 'Calendar: {count} calendars found',
			'panel.testCalendarFailed': 'Calendar: {message}',
			'panel.testFailed': 'The test failed: {message}',
			'panel.clearSecret': 'Clear the saved value',
			'panel.clearSecretHint': 'Removes the value stored by the plugin; the profile configuration remains a fallback.',
			'panel.eventsUnconfigured': 'Yandex Calendar is not connected. Set calendarLogin and calendarPassword in the plugin settings.',
			'panel.start': 'Start',
			'panel.duration': 'Duration',
			'panel.end': 'End',
			'panel.comment': 'Comment',
			'panel.commentPlaceholder': 'What was done',
			'panel.cancel': 'Cancel',
			'panel.cancelHint': 'Cancel (Esc)',
			'panel.save': 'Add',
			'panel.saveHint': 'Add (Enter)',
			'panel.saving': 'Adding\u2026',
			'panel.delete': 'Delete',
			'panel.deleteHint': 'Delete this record',
			'panel.deleteTitle': 'Delete time record',
			'panel.deleteQuestion': 'Remove {hours} on {key} from Tracker? This cannot be undone.',
			'panel.deleteFailed': 'Could not delete the record',
			'panel.deleting': 'Deleting\u2026',
			'panel.addKeyRequired': 'Enter a task key such as ABC-123.',
			'panel.addDateRequired': 'Enter the date the work belongs to.',
			'panel.addDateInvalid': 'Date must be today or yesterday.',
			'panel.addStartFuture': 'Start time cannot be in the future.',
			'panel.addTaskClosed': 'This task is closed and cannot receive time.',
			'panel.statusLine': 'Status: {status}',
			'panel.addTaskFailed': 'Could not read the task',
			'panel.addDurationRequired': 'Duration must be greater than zero.',
			'panel.addDurationStep': 'Duration must be a multiple of 5 minutes.',
			'panel.addDurationMax': 'Duration cannot exceed {hours} hours.',
			'panel.addCommentRequired': 'Enter a comment.',
			'panel.addQueueMissing': 'Set the default queue in the plugin settings.',
			'panel.addFailed': 'Could not add the time',
			'panel.hostRestart': 'The plugin\u2019s host half needs a restart before it can save records.',
			// --- the task picker -------------------------------------------------
			'panel.pickTask': 'Choose a task from your current ones',
			'panel.currentTasks': 'Your current tasks',
			'panel.teamworkTask': 'Task for Teamwork and Communication',
			'panel.teamworkFailed': 'Could not set the task',
			'panel.teamworkSaveFailed': 'Could not save the task',
			'panel.teamworkClearFailed': 'Could not forget the task',
			'panel.changeTeamworkTask': 'Change teamwork task',
			'panel.tasksReading': 'Reading your current tasks\u2026',
			'panel.tasksEmpty': 'No open tasks are assigned to you',
			'panel.tasksEmptyHint': 'The list shows issues that are not done, not in review, and not parked.',
			'panel.tasksFailed': 'Could not read your current tasks',
			'panel.close': 'Close',
			'panel.closeHint': 'Close (Esc)',
			'panel.empty': 'Nothing logged today yet',
			'panel.emptyHint': 'Worklogs appear here as soon as they are added in Tracker.',
			'panel.noRows': 'The worklog list is unavailable \u2014 the Tracker plugin\u2019s host half needs a restart to publish it. The total above is still correct.',
			'panel.failed': 'Could not read today\u2019s worklogs',
			'panel.reading': 'Reading today\u2019s worklogs\u2026',
		};

		/**
		 * Stylesheet for the rail pill and the panel.
		 *
		 * The pill keeps the deliberate fixed yellow brand fill, so it cannot be
		 * expressed with theme tokens; every color that sits ON that fill is fixed
		 * too, because a theme-derived label color would turn near-white in the dark
		 * theme and vanish against the light background. The panel itself is
		 * host-themed вЂ” it reuses the shipped page idiom (scroll region, centered
		 * content column, token colors), because nothing in it sits on the fill.
		 *
		 * The pill is NOT interactive: the sidebar shell renders the panel-list
		 * occupant inside its own row `<button>` (and inside an `aria-hidden` glyph
		 * box), so a nested control would be invalid markup. The row's own click
		 * opens the panel, and the panel carries the refresh control and the link.
		 * @returns the CSS text.
		 */
		function pluginCss() {
			return [
				// --- the plate inside the sidebar's panel row ---------------------
				'.ytt-pill{display:inline-flex;align-items:center;gap:5px;box-sizing:border-box;',
				'height:22px;padding:0 7px;border:1px solid rgba(0,0,0,0.14);border-radius:7px;',
				'background:#FBED9E;color:#1F1E1B;',
				'font-size:13px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1;',
				'white-space:nowrap;}',
				'.ytt-pill-value{display:block;}',
				// The 36x36 rail row gives the glyph box no slack, so the compact form
				// drops the words, the clock and the padding and keeps only the figure.
				'.ytt-pill[data-compact="true"]{height:22px;gap:0;padding:0 3px;justify-content:center;',
				'font-size:12px;border-radius:6px;}',
				'.ytt-pill[data-compact="true"] .ytt-pill-clock{display:none;}',
				'.ytt-pill[data-state="error"]{color:#8A1B0B;}',
				'.ytt-pill[data-state="loading"]{color:#4A4636;}',
				'.ytt-pill[data-state="ready"]{color:#1F1E1B;}',
				'.ytt-pill[data-today="empty"]{color:#5F5943;}',
				// Once the day has reached its target the plate turns green, matching
				// the panel's `Today` plate: the same three colours, and the same
				// meaning, on both surfaces. Green overrides every other state except
				// an error, which must stay legible as a failure.
				'.ytt-pill[data-reached="true"][data-state="ready"]{background:#CDEBCB;',
				'border-color:rgba(0,0,0,0.16);color:#14351A;}',

				// --- the panel ---------------------------------------------------
				'.ytt-page{display:flex;flex-direction:column;width:100%;min-width:0;height:100%;',
				'min-height:0;overflow:hidden;background:var(--dsw-alias-bg-base);',
				'color:var(--dsw-alias-label-primary);font-size:14px;line-height:1.6;}',
				'.ytt-scroll{flex:1;min-height:0;overflow:auto;scrollbar-gutter:stable;',
				'--dsh-scrollbar-width:9px;--dsh-scrollbar-thumb-border:2px;}',
				'.ytt-content{max-width:760px;margin:0 auto;padding:0 clamp(24px,4vw,48px) 48px;}',
				'.ytt-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;',
				'gap:16px;margin-bottom:20px;padding-top:28px;}',
				// The title and its icon share a row so the icon reads as attached to
				// the heading rather than floating beside the whole block.
				'.ytt-title{display:flex;align-items:center;gap:8px;}',
				'.ytt-head h1{margin:0;font-size:20px;font-weight:500;line-height:28px;}',
				// The icon is a link, so it carries the focus ring and the hover wash.
				'.ytt-title-link{display:inline-flex;align-items:center;justify-content:center;flex:none;',
				'width:26px;height:26px;border-radius:7px;color:var(--dsw-alias-label-tertiary);',
				'text-decoration:none;}',
				'.ytt-title-link:hover{background:var(--dsw-alias-interactive-bg-hover);',
				'color:var(--dsw-alias-label-primary);}',
				'.ytt-sub{margin:4px 0 0;color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:20px;}',
				'.ytt-refresh{display:inline-flex;align-items:center;gap:6px;flex:none;height:32px;',
				'padding:0 12px;border:.5px solid var(--dsw-alias-border-l3);border-radius:16px;',
				'background:0 0;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;',
				'line-height:20px;cursor:pointer;}',
				'.ytt-refresh:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);}',
				'.ytt-refresh:disabled{opacity:.4;cursor:default;}',
				'.ytt-head-actions{display:flex;align-items:center;gap:8px;flex:none;}',
				'.ytt-now{color:var(--dsw-alias-label-tertiary);font-size:13px;font-weight:500;',
				'line-height:20px;white-space:nowrap;font-variant-numeric:tabular-nums;}',
				'.ytt-head-settings{display:inline-flex;align-items:center;justify-content:center;flex:none;',
				'width:32px;height:32px;padding:0;border:1px solid var(--dsw-alias-border-l2);',
				'border-radius:50%;background:0 0;color:var(--dsw-alias-label-secondary);cursor:pointer;}',
				'.ytt-head-settings:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);',
				'color:var(--dsw-alias-label-primary);}',
				'.ytt-head-settings:disabled{opacity:.4;cursor:default;}',
				'.ytt-settings-group-title{margin:14px 0 0;color:var(--dsw-alias-label-secondary);',
				'font-size:12px;font-weight:600;line-height:18px;text-transform:uppercase;letter-spacing:.02em;}',
				'.ytt-field-hint{margin:2px 0 0;color:var(--dsw-alias-label-tertiary);font-size:12px;',
				'line-height:18px;}',
				'.ytt-task-box{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;',
				'background:var(--dsw-alias-bg-base);}',
				'.ytt-task-box .ytt-input{border:0;background:0 0;}',
				'.ytt-task-box .ytt-input:focus-visible{outline-offset:-2px;}',
				'.ytt-task-details{display:flex;flex-direction:column;gap:4px;padding:10px 12px;',
				'border-top:1px solid var(--dsw-alias-border-l1);}',
				'.ytt-task-details-name{color:var(--dsw-alias-label-primary);font-size:13px;',
				'line-height:18px;overflow-wrap:anywhere;}',
				'.ytt-task-details-status{color:var(--dsw-alias-label-tertiary);font-size:12px;',
				'line-height:18px;}',
				'.ytt-field-stack{display:flex;flex-direction:column;gap:6px;}',
				'.ytt-check{display:flex;align-items:center;gap:6px;cursor:pointer;',
				'color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;}',
				'.ytt-check input{margin:0;}',
				'.ytt-secret-clear{display:flex;flex-direction:column;gap:2px;}',
				'.ytt-settings-test{display:flex;flex-direction:column;gap:4px;margin-top:10px;}',
				'.ytt-settings-test-result{display:flex;flex-direction:column;gap:2px;',
				'color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;}',
				'.ytt-dialog-scroll{max-height:calc(100vh - 48px);overflow:auto;}',
				'.ytt-select{box-sizing:border-box;width:100%;height:34px;padding:0 6px;',
				'border:1px solid var(--dsw-alias-border-l2);border-radius:8px;',
				'background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);',
				'font:inherit;font-size:13px;line-height:20px;}',
				'.ytt-refresh:focus-visible,.ytt-title-link:focus-visible,.ytt-row-key:focus-visible,',
				'.ytt-select:focus-visible,.ytt-head-settings:focus-visible,',
				'.ytt-gap-add:focus-visible,',
				'.ytt-add:focus-visible,.ytt-total:focus-visible,.ytt-input:focus-visible,.ytt-btn:focus-visible,',
				'.ytt-row-delete:focus-visible,.ytt-pick:focus-visible,.ytt-task:focus-visible,',
				'.ytt-teamwork-pick:focus-visible,.ytt-teamwork-change:focus-visible,',
				'.ytt-combo-toggle:focus-visible,.ytt-combo-option:focus-visible,',
				'.ytt-textarea:focus-visible{',
				'outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));',
				'outline-offset:2px;}',
				'.ytt-spin{animation:ytt-spin 900ms linear infinite;}',
				'@keyframes ytt-spin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}',
				'@media (prefers-reduced-motion:reduce){.ytt-spin{animation:none;}}',

				// --- the two day plates -------------------------------------------
				// Today keeps the approved yellow; yesterday carries the target
				// verdict: green at or above target, red below, grey on a weekend.
				// Like the yellow, these tints are fixed rather than theme tokens
				// (a token would invert in the dark theme and lose the meaning), so
				// every colour sitting ON them is fixed too.
				'.ytt-plates{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:20px;}',
				// The plate reads as one phrase вЂ” `Today 3:00 (1 entries)` вЂ” so the name,
				// the figure and the count share a baseline. It is a button because it
				// switches the list below it between the two days.
				'.ytt-total{display:inline-flex;align-items:baseline;gap:8px;box-sizing:border-box;',
				'padding:10px 14px;border:1px solid rgba(0,0,0,0.14);border-radius:10px;',
				'background:#FBED9E;color:#1F1E1B;font:inherit;text-align:left;cursor:pointer;}',
				'.ytt-total[data-active="false"]{opacity:.55;}',
				'.ytt-total:hover{filter:brightness(0.96);}',
				'.ytt-total:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));',
				'outline-offset:2px;}',
				'.ytt-total-label{font-size:12px;font-weight:700;opacity:.72;}',
				'.ytt-total-value{font-size:20px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1;}',
				'.ytt-total-meta{font-size:12px;font-weight:700;opacity:.72;}',
				// The tint is never the only signal: each plate also states its verdict
				// in its tooltip, so the meaning survives the tint being missed.
				'.ytt-total[data-verdict="ok"]{background:#CDEBCB;color:#14351A;border-color:rgba(0,0,0,0.16);}',
				'.ytt-total[data-verdict="low"]{background:#F7CFC9;color:#5A150C;border-color:rgba(0,0,0,0.16);}',
				'.ytt-total[data-verdict="weekend"]{background:#DBDBD6;color:#2E2E2B;border-color:rgba(0,0,0,0.14);}',
				'.ytt-total[data-verdict="unknown"]{background:#EDEDEA;color:#2E2E2B;border-color:rgba(0,0,0,0.14);}',
				// The write control closes the plates row, so the two days and the
				// action of adding a record read as one band of controls. It is the
				// row's primary action, so it carries a filled, high-contrast fill вЂ”
				// the same inverse pair the dialogs' primary button uses, which stays
				// legible in both themes вЂ” and an auto left margin that pushes it to
				// the list's right edge. The row stretches it to the plates' height.
				'.ytt-add{display:inline-flex;align-items:center;justify-content:center;gap:6px;',
				'box-sizing:border-box;margin-left:auto;padding:0 16px;',
				'border:1px solid var(--dsw-alias-label-primary);border-radius:10px;',
				'background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-overlay);',
				'font:inherit;font-size:13px;font-weight:600;line-height:20px;cursor:pointer;}',
				'.ytt-add:hover{opacity:.88;}',
				'.ytt-add:active{opacity:.74;}',
				'.ytt-add-plus{font-size:15px;font-weight:700;line-height:1;opacity:.9;}',

				'.ytt-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:1px;}',
				'.ytt-list[data-stale="true"]{opacity:.6;}',
				'.ytt-stale{display:flex;align-items:center;gap:8px;margin:0 0 8px;padding:6px 10px;',
				'border-left:3px solid var(--dsw-alias-brand-primary);border-radius:8px;',
				'background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);',
				'font-size:13px;line-height:20px;}',
				'.ytt-row[data-pending="true"]{background:var(--dsw-alias-interactive-bg-hover);}',
				'.ytt-row[data-pending="true"] .ytt-row-key{text-decoration:line-through;}',
				'.ytt-row-pending{color:var(--dsw-alias-label-tertiary);font-size:12px;',
				'line-height:18px;white-space:nowrap;}',
				'.ytt-row{display:flex;align-items:flex-start;gap:12px;box-sizing:border-box;',
				'padding:10px 8px;border-radius:var(--dsw-radius-md);}',
				'.ytt-row:hover{background:var(--dsw-alias-interactive-bg-hover);}',
				'.ytt-row-time{flex:none;width:96px;color:var(--dsw-alias-label-tertiary);',
				'font-variant-numeric:tabular-nums;font-size:13px;line-height:22px;white-space:nowrap;}',
				'.ytt-row-body{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;}',
				'.ytt-row-key{color:var(--dsw-alias-label-primary);font-weight:500;font-size:13px;',
				'line-height:22px;text-decoration:none;}',
				'.ytt-row-key:hover{text-decoration:underline;}',
				'.ytt-row-comment{color:var(--dsw-alias-label-secondary);font-size:13px;',
				'line-height:20px;overflow-wrap:anywhere;}',
				'.ytt-row-title{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;',
				'overflow-wrap:anywhere;}',
				'.ytt-row-hours{flex:none;font-weight:700;font-variant-numeric:tabular-nums;',
				'font-size:13px;line-height:22px;}',
				// The delete control sits in the row's bottom-right corner, below the
				// hours and outside the text column, so it never covers a comment.
				'.ytt-row-delete{flex:none;display:inline-flex;align-items:center;justify-content:center;',
				'align-self:flex-end;width:22px;height:22px;margin:0 -6px -2px -8px;padding:0;border:0;',
				'border-radius:6px;background:0 0;color:var(--dsw-alias-label-tertiary);cursor:pointer;}',
				'.ytt-row-delete:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);',
				'color:var(--dsw-alias-state-error-primary);}',
				'.ytt-row-delete:disabled{opacity:.35;cursor:default;}',
				// An unbooked stretch of the working day.
				//
				// The fill is the theme's own subtle wash, which is a DARK veil in the
				// light theme and a LIGHT one in the dark theme, so it stays visible in
				// both. An opaque surface token would not: `bg-layer-2` resolves to pure
				// white in the light theme and would disappear into the page.
				//
				// The text is `label-secondary` rather than `label-tertiary`: against
				// this fill the tertiary colour only reaches 3.34:1 in the light theme,
				// below the 4.5:1 bar, where secondary reaches 5.22:1 (dark: 6.98:1
				// and 9.90:1). The row is also italic and lighter in weight, so it
				// still reads as secondary against the real worklogs.
				'.ytt-row-gap{background:var(--dsw-alias-interactive-bg-hover);}',
				'.ytt-gap-add{display:inline-flex;align-items:center;align-self:flex-start;',
				'height:24px;padding:0 10px;border:0;border-radius:10px;',
				'background:var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary);',
				'font:inherit;font-style:normal;font-size:13px;font-weight:600;line-height:20px;cursor:pointer;}',
				'.ytt-gap-add:hover{background:var(--dsw-alias-border-l2);}',
				'.ytt-row-gap .ytt-row-time,.ytt-row-gap .ytt-row-hours{',
				'color:var(--dsw-alias-label-secondary);font-weight:400;}',
				'.ytt-row-gap .ytt-row-body{color:var(--dsw-alias-label-secondary);font-size:13px;',
				'font-style:italic;line-height:22px;}',

				'.ytt-notice{margin:0;padding:12px 0;color:var(--dsw-alias-label-tertiary);}',
				'.ytt-notice-error{color:var(--dsw-alias-state-error-primary);}',

				// --- the "Adding time" panel --------------------------------------
				// Fixed positioning keeps the card over the page: the panel's own
				// column is a scroll region and would clip an in-flow dialog. The
				// backdrop is a neutral veil so it reads as a modal layer over both
				// themes; the card itself follows the theme tokens.
				'.ytt-backdrop{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;',
				'justify-content:center;padding:24px;background:rgba(20,20,20,0.45);}',
				'.ytt-dialog{width:min(420px,100%);box-sizing:border-box;padding:20px;border-radius:16px;',
				'border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-overlay);',
				'color:var(--dsw-alias-label-primary);box-shadow:0 18px 48px rgba(0,0,0,0.28);}',
				'.ytt-dialog h2{margin:0 0 16px;font-size:16px;font-weight:600;line-height:24px;}',
				'.ytt-dialog-text{margin:0 0 16px;color:var(--dsw-alias-label-secondary);font-size:13px;',
				'line-height:20px;overflow-wrap:anywhere;}',
				'.ytt-form{display:flex;flex-direction:column;gap:12px;}',
				'.ytt-field{display:flex;flex-direction:column;gap:5px;min-width:0;}',
				'.ytt-field-label{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;}',
				'.ytt-field-hint{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;}',
				'.ytt-input{box-sizing:border-box;width:100%;height:34px;padding:0 10px;',
				'border:1px solid var(--dsw-alias-border-l2);border-radius:8px;',
				'background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);',
				'font:inherit;font-size:13px;line-height:20px;}',
				'.ytt-input::placeholder{color:var(--dsw-alias-label-tertiary);}',
				// The date field keeps its editable segments but drops the browser's
				// calendar button; Down still opens the picker when one is wanted.
				'.ytt-input[type="date"]::-webkit-calendar-picker-indicator{display:none;',
				'-webkit-appearance:none;}',
				'.ytt-textarea{box-sizing:border-box;width:100%;min-height:76px;padding:8px 10px;',
				'border:1px solid var(--dsw-alias-border-l2);border-radius:8px;',
				'background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);',
				'font:inherit;font-size:13px;line-height:20px;resize:vertical;}',
				'.ytt-textarea::placeholder{color:var(--dsw-alias-label-tertiary);}',
				// Start, Duration and End sit side by side under the date, so the
				// clock controls read as one band.
				'.ytt-fields-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;}',
				// A clock field is a masked text input plus a chevron: the chevron
				// opens the preset list, the text entry takes four digits.
				'.ytt-combo{position:relative;}',
				'.ytt-combo .ytt-input{padding-right:28px;}',
				'.ytt-combo-toggle{position:absolute;right:3px;top:50%;transform:translateY(-50%);',
				'display:inline-flex;align-items:center;justify-content:center;width:22px;height:26px;',
				'padding:0;border:0;border-radius:6px;background:0 0;',
				'color:var(--dsw-alias-label-tertiary);cursor:pointer;}',
				'.ytt-combo-toggle:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);',
				'color:var(--dsw-alias-label-primary);}',
				'.ytt-combo-toggle:disabled{opacity:.5;cursor:default;}',
				'.ytt-combo-list{position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:20;',
				'max-height:220px;overflow:auto;margin:0;padding:4px;list-style:none;',
				'border:1px solid var(--dsw-alias-border-l2);border-radius:10px;',
				'background:var(--dsw-alias-bg-overlay);box-shadow:0 12px 28px rgba(0,0,0,0.22);}',
				'.ytt-combo-option{display:block;width:100%;box-sizing:border-box;padding:6px 10px;',
				'border:0;border-radius:7px;background:0 0;color:var(--dsw-alias-label-primary);',
				'font:inherit;font-size:13px;line-height:20px;text-align:left;cursor:pointer;}',
				'.ytt-combo-option:hover,.ytt-combo-option[data-selected="true"]{',
				'background:var(--dsw-alias-interactive-bg-hover);}',
				// The key field carries a picker button inside its own border, the way
				// the native date input carries its calendar button, so the input and
				// the control read as one field rather than two side by side.
				'.ytt-input-wrap{position:relative;display:block;min-width:0;}',
				'.ytt-input-wrap .ytt-input{padding-right:36px;}',
				'.ytt-pick{position:absolute;right:4px;top:50%;transform:translateY(-50%);',
				'display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;',
				'padding:0;border:0;border-radius:6px;background:0 0;',
				'color:var(--dsw-alias-label-tertiary);font:inherit;font-size:16px;font-weight:700;',
				'line-height:1;cursor:pointer;}',
				'.ytt-pick-dots{display:block;transform:translateY(-3px);letter-spacing:1px;}',
				'.ytt-pick:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);',
				'color:var(--dsw-alias-label-primary);}',
				'.ytt-pick:disabled{opacity:.5;cursor:default;}',
				// --- the "Your current tasks" picker ---------------------------------
				// It opens over the add dialog, so it carries a higher layer.
				'.ytt-backdrop-top{z-index:1010;}',
				'.ytt-dialog-wide{width:min(620px,100%);display:flex;flex-direction:column;max-height:80vh;}',
				'.ytt-task-list{flex:1;min-height:120px;max-height:46vh;overflow:auto;margin:0;padding:0;',
				'list-style:none;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;',
				'--dsh-scrollbar-width:10px;--dsh-scrollbar-thumb-border:2px;',
				'--dsh-scrollbar-thumb:var(--dsw-alias-label-secondary);',
				'--dsh-scrollbar-thumb-hover:var(--dsw-alias-label-primary);',
				'scrollbar-color:var(--dsw-alias-label-secondary) transparent;}',
				'.ytt-task-list::-webkit-scrollbar{width:10px;}',
				'.ytt-task-list::-webkit-scrollbar-track{background:transparent;}',
				'.ytt-task-list::-webkit-scrollbar-thumb{background:var(--dsw-alias-label-secondary);',
				'border:2px solid transparent;border-radius:5px;background-clip:padding-box;}',
				'.ytt-task-list::-webkit-scrollbar-thumb:hover{background:var(--dsw-alias-label-primary);',
				'background-clip:padding-box;}',
				// One task per row, stacked like the panel's worklog rows: key, then
				// the wrapping title, then the status. There are no column headers;
				// the order of the lines is the only layout.
				'.ytt-task{display:flex;flex-direction:column;gap:2px;width:100%;box-sizing:border-box;',
				'padding:9px 10px;border:0;border-bottom:1px solid var(--dsw-alias-border-l1);',
				'background:0 0;color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer;}',
				'.ytt-task:last-child{border-bottom:0;}',
				'.ytt-task:hover,.ytt-task[data-chosen="true"]{background:var(--dsw-alias-interactive-bg-hover);}',
				'.ytt-task[data-active="true"],.ytt-teamwork-selected[data-active="true"]{',
				'background:var(--dsw-alias-interactive-bg-hover);',
				'box-shadow:inset 3px 0 0 var(--dsw-alias-state-business-primary);}',
				'.ytt-task-key{font-weight:500;font-size:13px;line-height:22px;}',
				'.ytt-task-summary{color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px;',
				'overflow-wrap:anywhere;}',
				'.ytt-task-status{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;}',
				'.ytt-events-date{margin:4px 0 0;color:var(--dsw-alias-label-tertiary);font-size:12px;',
				'line-height:18px;}',
				'.ytt-dialog-head{display:flex;align-items:flex-start;justify-content:space-between;',
				'gap:12px;margin-bottom:16px;}',
				'.ytt-dialog-head h2{margin:0;}',
				// The pinned teamwork row: a title and a key input while nothing is
				// pinned, then the same key/title/status lines as the list rows. It
				// carries a light wash so it reads as the special row without
				// competing with the task text above it.
				'.ytt-teamwork{display:flex;flex-direction:column;gap:5px;padding:9px 10px;',
				'background:var(--dsw-alias-interactive-bg-hover);',
				'border-bottom:1px solid var(--dsw-alias-border-l1);}',
				'.ytt-teamwork-selected{flex-direction:row;align-items:flex-start;gap:8px;}',
				'.ytt-teamwork-selected:hover{filter:brightness(.97);}',
				'.ytt-teamwork-title{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;',
				'line-height:18px;}',
				'.ytt-teamwork-pick{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;',
				'padding:0;border:0;background:0 0;color:var(--dsw-alias-label-primary);font:inherit;',
				'text-align:left;cursor:pointer;}',
				'.ytt-teamwork-pick:hover .ytt-task-key{text-decoration:underline;}',
				'.ytt-teamwork-change{flex:none;width:22px;height:22px;padding:0;border:0;border-radius:6px;',
				'background:0 0;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:16px;',
				'line-height:1;cursor:pointer;}',
				'.ytt-teamwork-change:hover{background:var(--dsw-alias-bg-layer-2);',
				'color:var(--dsw-alias-label-primary);}',
				'.ytt-form-error{margin:0;color:var(--dsw-alias-state-error-primary);font-size:12px;',
				'line-height:18px;overflow-wrap:anywhere;}',
				'.ytt-dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:4px;}',
				'.ytt-btn{box-sizing:border-box;height:32px;padding:0 14px;border:1px solid transparent;',
				'border-radius:16px;font:inherit;font-size:13px;font-weight:500;line-height:20px;cursor:pointer;}',
				'.ytt-btn:disabled{opacity:.5;cursor:default;}',
				'.ytt-btn-ghost{background:0 0;border-color:var(--dsw-alias-border-l2);',
				'color:var(--dsw-alias-label-primary);}',
				'.ytt-btn-ghost:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);}',
				// The primary action swaps the label pair rather than using a fixed
				// brand fill, so it stays legible in the light and dark themes.
				'.ytt-btn-primary{background:var(--dsw-alias-label-primary);',
				'border-color:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-overlay);}',
				'.ytt-btn-primary:hover:not(:disabled){opacity:.88;}',
				'.ytt-btn-danger{background:0 0;border-color:var(--dsw-alias-state-error-primary);',
				'color:var(--dsw-alias-state-error-primary);}',
				'.ytt-btn-danger:hover:not(:disabled){background:var(--dsw-alias-state-error-primary);',
				'color:var(--dsw-alias-bg-overlay);}',
			].join('');
		}

		/**
		 * The daily target the plates judge a day against, in hours, when the
		 * settings do not provide one.
		 */
		const DEFAULT_DAILY_TARGET_HOURS = 8;

		/**
		 * Judge today's running total against its own target.
		 * @param summary - the payload, or nothing.
		 * @param targetHours - the daily target from the settings.
		 * @returns `ok` once the target is reached, otherwise `today` (the default
		 *   yellow state, which also covers a figure that cannot be read).
		 */
		function verdictOfToday(summary, targetHours = DEFAULT_DAILY_TARGET_HOURS) {
			const minutes = summary?.minutes;
			if (typeof minutes !== 'number' || !Number.isFinite(minutes)) return 'today';
			return minutes >= targetHours * 60 ? 'ok' : 'today';
		}

		/**
		 * Judge yesterday against the target.
		 *
		 * A weekend is reported as such regardless of hours вЂ” on a day off there is
		 * no target to miss вЂ” and an unreadable figure is reported as unknown rather
		 * than as a failure to reach the target.
		 * @param yesterday - the payload's yesterday block, or nothing.
		 * @param targetHours - the daily target from the settings.
		 * @returns the verdict: `ok`, `low`, `weekend` or `unknown`.
		 */
		function verdictOf(yesterday, targetHours = DEFAULT_DAILY_TARGET_HOURS) {
			if (yesterday === null || typeof yesterday !== 'object') return 'unknown';
			if (yesterday.weekend === true) return 'weekend';
			const minutes = yesterday.minutes;
			if (typeof minutes !== 'number' || !Number.isFinite(minutes)) return 'unknown';
			return minutes >= targetHours * 60 ? 'ok' : 'low';
		}

		/** Install the stylesheet once per page. */
		function installStyles() {
			if (typeof document === 'undefined') return;
			if (document.querySelector(`style[data-plugin-css=${JSON.stringify(STYLE_TAG)}]`) !== null) return;
			const tag = document.createElement('style');
			tag.dataset.plugin = 'dsh-yt-ttt';
			tag.dataset.pluginCss = STYLE_TAG;
			tag.textContent = pluginCss();
			document.head.appendChild(tag);
		}

		/**
		 * Clock artwork for the rail pill.
		 * @returns the SVG element.
		 */
		function ClockIcon() {
			return h('svg', {
				viewBox: '0 0 16 16', width: 12, height: 12,
				className: 'ytt-pill-clock', 'aria-hidden': true, focusable: false,
				style: { flex: 'none', display: 'block' },
			}, [
				h('circle', { key: 'ring', cx: 8, cy: 8, r: 6.25, fill: 'none', stroke: 'currentColor', strokeWidth: 1.6 }),
				h('path', {
					key: 'hands', d: 'M8 4.6V8.5l2.4 1.6',
					fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round',
				}),
			]);
		}

		/**
		 * Box-arrow artwork marking the link out to Tracker.
		 * @returns the SVG element.
		 */
		function OpenIcon() {
			return h('svg', {
				viewBox: '0 0 16 16', width: 14, height: 14,
				'aria-hidden': true, focusable: false, style: { display: 'block', flex: 'none' },
			}, [
				h('path', {
					key: 'box', d: 'M6.4 3.1H3.9a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9.6',
					fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round',
				}),
				h('path', {
					key: 'arrow', d: 'M9.6 2.9h3.5v3.5M13.1 2.9 7.9 8.1',
					fill: 'none', stroke: 'currentColor', strokeWidth: 1.5,
					strokeLinecap: 'round', strokeLinejoin: 'round',
				}),
			]);
		}

		/**
		 * Trash-can artwork for a worklog row's delete control.
		 * @returns the SVG element.
		 */
		function TrashIcon() {
			return h('svg', {
				viewBox: '0 0 16 16', width: 13, height: 13,
				'aria-hidden': true, focusable: false, style: { display: 'block', flex: 'none' },
			}, [
				h('path', {
					key: 'lid', d: 'M2.8 4.3h10.4M6.1 4.3V2.9h3.8v1.4',
					fill: 'none', stroke: 'currentColor', strokeWidth: 1.4,
					strokeLinecap: 'round', strokeLinejoin: 'round',
				}),
				h('path', {
					key: 'can', d: 'M4.2 4.3l.6 8.1a1 1 0 0 0 1 .9h4.4a1 1 0 0 0 1-.9l.6-8.1',
					fill: 'none', stroke: 'currentColor', strokeWidth: 1.4,
					strokeLinecap: 'round', strokeLinejoin: 'round',
				}),
				h('path', {
					key: 'lines', d: 'M6.6 6.8v3.8M9.4 6.8v3.8',
					fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round',
				}),
			]);
		}

		/**
		 * Circular-arrow artwork for the panel's refresh control.
		 * @param props - the spinning flag, applied as a class while a read is active.
		 * @returns the SVG element.
		 */
		function RefreshIcon({ spinning }) {
			return h('svg', {
				viewBox: '0 0 16 16', width: 13, height: 13,
				className: spinning ? 'ytt-spin' : undefined,
				'aria-hidden': true, focusable: false, style: { display: 'block' },
			}, [
				h('path', {
					key: 'arc',
					d: 'M12.8 6.6A5 5 0 1 0 13 9.4',
					fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round',
				}),
				h('path', {
					key: 'head', d: 'M13.4 3.4v3.4H10',
					fill: 'none', stroke: 'currentColor', strokeWidth: 1.6,
					strokeLinecap: 'round', strokeLinejoin: 'round',
				}),
			]);
		}

		/**
		 * The gear the settings buttons show.
		 * @returns the icon.
		 */
		function GearIcon() {
			return h('svg', {
				viewBox: '0 0 24 24', width: 15, height: 15,
				'aria-hidden': true, focusable: false, style: { display: 'block' },
			}, h('path', {
				fill: 'currentColor',
				d: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58'
					+ 'c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96'
					+ 'c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84'
					+ 'c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96'
					+ 'c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58'
					+ 'c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61'
					+ 'l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54'
					+ 'c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54'
					+ 'c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32'
					+ 'c.12-.22.07-.47-.12-.61l-2.01-1.58z'
					+ 'M12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6'
					+ '-1.62 3.6-3.6 3.6z',
			}));
		}

		/**
		 * One shared reading of the host summary, plus the poll that keeps it fresh.
		 *
		 * The plate and the panel are two mounts of one figure, and the plate is
		 * always mounted while the panel is mounted only when selected. Sharing one
		 * store here keeps them from disagreeing and keeps the poll down to a single
		 * timer and a single request per interval, no matter how many surfaces are
		 * showing it.
		 */
		const summaryStore = (() => {
			/** The single snapshot every surface renders. */
			let state = { summary: null, failure: null, loading: true, fetchedAt: 0 };
			/** Surfaces currently mounted; the poll runs only while this is non-empty. */
			let subscribers = 0;
			const listeners = new Set();
			/** The in-flight read, so a newer read supersedes an older one. */
			let inFlight = null;
			/** The recurring poll, or null while none is scheduled. */
			let timer = null;
			/** The poll's current period; the panel settings can change it. */
			let intervalMs = POLL_INTERVAL_MS;

			const emit = () => {
				for (const listener of listeners) listener(state);
			};
			const set = (patch) => {
				state = { ...state, ...patch };
				emit();
			};

			/**
			 * Read the host route once and publish the outcome.
			 * @param force - ask the host to bypass its own short cache.
			 * @returns a promise settling when the read finishes, never rejecting.
			 */
			const read = (force) => {
				if (inFlight !== null) inFlight.abort();
				const controller = new AbortController();
				inFlight = controller;
				// An existing figure stays on screen while a poll runs: dropping it
				// would blank the plate every five minutes for no reason.
				set({ loading: true });
				const url = force ? `${SUMMARY_URL}?force=1` : SUMMARY_URL;
				return fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } })
					.then((response) => response.json())
					.then((payload) => {
						if (inFlight !== controller) return;
						inFlight = null;
						if (payload !== null && typeof payload === 'object' && payload.ok === true) {
							set({ loading: false, summary: payload, failure: null, fetchedAt: Date.now() });
						} else {
							set({
								loading: false,
								summary: null,
								failure: payload !== null && typeof payload === 'object' ? payload : { message: 'unreadable answer' },
							});
						}
					})
					.catch((error) => {
						if (inFlight !== controller || error?.name === 'AbortError') return;
						inFlight = null;
						set({
							loading: false,
							summary: null,
							failure: { message: error instanceof Error ? error.message : String(error) },
						});
					});
			};

			/**
			 * One poll tick. A hidden window is skipped outright: a background tab
			 * does not need fresh minutes, and the next visible tick catches up.
			 */
			const tick = () => {
				if (typeof document !== 'undefined' && document.hidden === true) return;
				read(false);
			};

			/** A hidden window that becomes visible again catches up if it is stale. */
			const onVisibility = () => {
				if (typeof document === 'undefined' || document.hidden === true) return;
				if (Date.now() - state.fetchedAt >= intervalMs) read(false);
			};

			return {
				/**
				 * The current snapshot; the same object until something changes, so it
				 * is safe to compare by identity.
				 * @returns the snapshot.
				 */
				get: () => state,

				/**
				 * Observe snapshot changes.
				 * @param listener - called with the new snapshot.
				 * @returns a function that detaches the listener.
				 */
				subscribe: (listener) => {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},

				/**
				 * Mark a surface as mounted and make sure the poll is running.
				 * @returns a function that releases that surface.
				 */
				retain: () => {
					subscribers += 1;
					if (timer === null) {
						timer = setInterval(tick, intervalMs);
						if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
							document.addEventListener('visibilitychange', onVisibility);
						}
						// Nothing is known yet, or what is known has outlived the interval
						// (the poll was stopped while nothing was showing it): read now so
						// a returning surface never presents a stale figure.
						if (state.fetchedAt === 0 || Date.now() - state.fetchedAt >= intervalMs) read(false);
					}
					let released = false;
					return () => {
						if (released) return;
						released = true;
						subscribers -= 1;
						if (subscribers > 0 || timer === null) return;
						clearInterval(timer);
						timer = null;
						if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
							document.removeEventListener('visibilitychange', onVisibility);
						}
					};
				},

				read,

				/**
				 * Change the poll period; a running timer restarts with the new one.
				 * @param ms - the period in milliseconds; below a minute is ignored.
				 */
				setPollInterval: (ms) => {
					if (!Number.isFinite(ms) || ms < 60000) return;
					intervalMs = ms;
					if (timer !== null) {
						clearInterval(timer);
						timer = setInterval(tick, intervalMs);
					}
				},
			};
		})();

		/**
		 * Subscribe a surface to the shared summary and keep the poll alive while it
		 * is mounted.
		 * @returns the snapshot plus a `load` that re-reads on demand.
		 */
		function useSummary() {
			const [snapshot, setSnapshot] = React.useState(summaryStore.get());
			React.useEffect(() => {
				setSnapshot(summaryStore.get());
				return summaryStore.subscribe(setSnapshot);
			}, []);
			React.useEffect(() => summaryStore.retain(), []);
			return {
				summary: snapshot.summary,
				failure: snapshot.failure,
				loading: snapshot.loading,
				load: summaryStore.read,
			};
		}

		/**
		 * The sidebar rail's top-row occupant: a compact plate carrying today's
		 * total. It is decorative by construction вЂ” the shell renders it inside the
		 * row's own button and inside an `aria-hidden` glyph box вЂ” so it holds no
		 * control and no label of its own; the row's label and the panel carry the
		 * accessible text.
		 * @param props - the glyph `size` (18 in the rail, 16 expanded) and `t`.
		 * @returns the plate element.
		 */
		function TrackerPanelIcon({ size, t }) {
			const { summary, failure, loading } = useSummary();
			// Only the FIRST read counts as loading for presentation. A background poll
			// also raises the flag, and letting that recolour the plate would make it
			// flicker every five minutes while the figure it already shows is fine.
			const state = loading && summary === null ? 'loading' : failure !== null ? 'error' : 'ready';
			const empty = summary !== null && summary.minutes === 0;
			const hours = summary === null ? null : summary.hours;
			// The owner asks for an 18px glyph in the 36px rail row and 16px when
			// expanded; the compact form has room for one figure and no words.
			const compact = typeof size === 'number' && size >= 18;
			const shown = hours ?? (failure !== null ? '\u2014' : '\u2026');
			// The rail plate turns green at the same threshold as the panel's Today
			// plate, so the two surfaces never disagree about the day's colour.
			const targetHours = summary?.dailyTargetHours ?? DEFAULT_DAILY_TARGET_HOURS;
			const reached = verdictOfToday(summary, targetHours) === 'ok';
			const target = String(targetHours);

			// The rail shows today only. Two plates cannot fit the 36px box, and the
			// rail is a glance; the panel is where both days are read together.
			return h('span', {
				className: 'ytt-pill',
				'data-state': state,
				'data-today': empty ? 'empty' : 'filled',
				'data-compact': compact ? 'true' : 'false',
				'data-reached': reached ? 'true' : 'false',
				title: loading && summary === null
					? t('badge.hintLoading')
					: failure !== null
						? t('badge.hintError')
						: empty
							? t('badge.hintEmpty')
							: reached
								? t('panel.todayOk', { hours, target })
								: t('panel.todayLow', { hours, target }),
			}, [
				h(ClockIcon, { key: 'clock' }),
				h('span', { key: 'value', className: 'ytt-pill-value' }, shown),
			]);
		}

		/**
		 * One day's plate, reading as a single phrase: `Today 3:00 (1 entries)`.
		 *
		 * The plate is the control that switches the list below it, so it is a
		 * button and carries the active state as a data attribute rather than being
		 * styled by position.
		 * @param props - the day name, the hours, the count text, the tint's verdict,
		 *   the tooltip, the test id, whether it is the list's current day, and the
		 *   click handler.
		 * @returns the plate element.
		 */
		function DayPlate({ label, hours, countText, verdict, hint, testId, active, onClick }) {
			return h('button', {
				type: 'button',
				className: 'ytt-total',
				'data-verdict': verdict,
				'data-testid': testId,
				'data-active': active ? 'true' : 'false',
				'aria-pressed': active ? 'true' : 'false',
				title: hint,
				onClick,
			}, [
				h('span', { key: 'label', className: 'ytt-total-label' }, label),
				h('span', { key: 'value', className: 'ytt-total-value' }, hours),
				countText === null
					? null
					: h('span', { key: 'meta', className: 'ytt-total-meta' }, countText),
			]);
		}

		/**
		 * One unbooked stretch of the working day.
		 *
		 * It shares the worklog row's grid so the clock column stays aligned, but
		 * carries no issue, no comment and no link, and is marked `gap` so the tint
		 * and the styling can differ. Its body is an "+ Add" button that opens the
		 * form with this stretch already filled in.
		 * @param props - the row, the locale helper, and the add callback.
		 * @returns the gap element.
		 */
		function GapRow({ row, t, onAdd }) {
			return h('li', {
				className: 'ytt-row ytt-row-gap',
				'data-kind': 'gap',
				'data-testid': 'tracker-gap',
				title: t('panel.gapHint', { from: row.clock, to: formatEnd(row), hours: row.hours }),
			}, [
				h('span', { key: 'time', className: 'ytt-row-time' }, timeRangeOf(row)),
				h('span', { key: 'body', className: 'ytt-row-body' }, h('button', {
					key: 'add', type: 'button', className: 'ytt-gap-add',
					title: t('panel.gapAddHint', { from: row.clock, to: formatEnd(row) }),
					onClick: () => onAdd(row),
				}, t('panel.gapAdd'))),
				h('span', { key: 'hours', className: 'ytt-row-hours' }, row.hours),
			]);
		}

		/**
		 * The clock time a row ends at, for the gap tooltip.
		 * @param row - a gap row carrying `clock` and `minutes`.
		 * @returns the `HH:MM` end, or an empty string when it cannot be derived.
		 */
		function formatEnd(row) {
			const start = /^(\d{2}):(\d{2})$/u.exec(row.clock);
			if (start === null || typeof row.minutes !== 'number') return '';
			const total = (Number(start[1]) * 60 + Number(start[2]) + row.minutes) % 1440;
			return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
		}

		/**
		 * The clock range a row's first column shows: `Start - End`.
		 * @param row - a worklog or gap row carrying `clock` and `minutes`.
		 * @returns the range, just the start when the end cannot be derived, or a
		 *   dash when the row has no start at all.
		 */
		function timeRangeOf(row) {
			if (row.clock === '') return '\u2014';
			const end = formatEnd(row);
			return end === '' ? row.clock : `${row.clock} - ${end}`;
		}

		/** Minutes between the entries of the Start and End time selectors. */
		const TIME_STEP_MINUTES = 5;
		/** The comment prefix a picked calendar event writes. */
		/** The comment prefix a picked calendar event writes when settings do not say. */
		const DEFAULT_EVENT_COMMENT_PREFIX = '\u0412\u0441\u0442\u0440\u0435\u0447\u0430: ';
		/** The default behavior when Duration changes: move End. */
		const DEFAULT_DURATION_CHANGE = 'end';
		/** Every time of day the Start and End selectors offer. */
		const TIME_OPTIONS = Array.from(
			{ length: (24 * 60) / TIME_STEP_MINUTES },
			(_, index) => index * TIME_STEP_MINUTES,
		);

		/**
		 * The durations the Duration selector offers: the quarter-hour starters,
		 * then every half hour up to the six-hour maximum the form accepts.
		 * @returns the minute values, ascending.
		 */
		function durationPresets() {
			const presets = [15, 30, 45];
			for (let minutes = 60; minutes <= 6 * 60; minutes += 30) presets.push(minutes);
			return presets;
		}

		/** Every duration the Duration selector definitely offers. */
		const DURATION_PRESETS = durationPresets();
		/** The longest duration the form accepts, in minutes. */
		/** The default ceiling of one worklog, in hours. */
		const DEFAULT_MAX_DURATION_HOURS = 8;
		/** The largest ceiling the settings accept, in hours. */
		const MAX_DURATION_HOURS_LIMIT = 24;
		/** The default background poll interval, in minutes. */
		const DEFAULT_POLL_INTERVAL_MINUTES = 5;
		/** The largest poll interval the settings accept, in minutes. */
		const MAX_POLL_INTERVAL_MINUTES = 60;
		/** The default Tracker query the task picker searches with. */
		const DEFAULT_TASKS_QUERY = '"Status Type": !done Assignee: me() "Sort by": Updated DESC';

		/**
		 * A time of day as `HH:MM`.
		 * @param minutes - minutes since midnight.
		 * @returns the two-digit clock text.
		 */
		function formatClock(minutes) {
			const safe = ((Math.round(minutes) % 1440) + 1440) % 1440;
			return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
		}

		/**
		 * A duration as `hh:mm`.
		 * @param minutes - whole minutes.
		 * @returns the two-part text, hours first.
		 */
		function formatDuration(minutes) {
			const safe = Math.max(0, Math.round(minutes));
			return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
		}

		/**
		 * Minutes since local midnight right now.
		 * @returns the minute-of-day.
		 */
		function nowMinutes() {
			const now = new Date();
			return now.getHours() * 60 + now.getMinutes();
		}

		/**
		 * A generation gate for the post-write refresh: a newer refresh makes
		 * every older read unable to clear the staleness strip.
		 * @returns the gate.
		 */
		function createRefreshGate() {
			let current = 0;
			return {
				/**
				 * Start a refresh.
				 * @returns its generation.
				 */
				next: () => {
					current += 1;
					return current;
				},
				/**
				 * Whether a refresh is still the newest one.
				 * @param generation - the generation to test.
				 * @returns true for the newest generation.
				 */
				isCurrent: (generation) => generation === current,
			};
		}

		/**
		 * The current wall clock in a zone: the date, its display, the weekday,
		 * the time and the minutes since midnight.
		 *
		 * The panel's zone can differ from the browser's; every clock the form
		 * compares with "now" goes through this helper so the two agree.
		 * @param timeZone - the IANA zone, or empty for the browser's.
		 * @returns the clock parts.
		 */
		function zoneClock(timeZone) {
			const at = new Date();
			const two = (value) => String(value).padStart(2, '0');
			const local = {
				date: `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())}`,
				displayDate: `${two(at.getDate())}.${two(at.getMonth() + 1)}.${at.getFullYear()}`,
				weekday: new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(at),
				time: `${two(at.getHours())}:${two(at.getMinutes())}`,
				minutes: at.getHours() * 60 + at.getMinutes(),
			};
			if (typeof timeZone !== 'string' || timeZone === '') return local;
			try {
				const parts = new Intl.DateTimeFormat('en-GB', {
					timeZone,
					year: 'numeric',
					month: '2-digit',
					day: '2-digit',
					weekday: 'long',
					hour: '2-digit',
					minute: '2-digit',
					hourCycle: 'h23',
				}).formatToParts(at);
				const part = (type) => parts.find((entry) => entry.type === type)?.value ?? '';
				const year = part('year');
				const month = part('month');
				const day = part('day');
				const hour = Number(part('hour'));
				const minute = Number(part('minute'));
				if (!year || !month || !day || !Number.isInteger(hour) || !Number.isInteger(minute)) return local;
				return {
					date: `${year}-${month}-${day}`,
					displayDate: `${day}.${month}.${year}`,
					weekday: part('weekday'),
					time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
					minutes: hour * 60 + minute,
				};
			} catch {
				return local;
			}
		}

		/**
		 * The minutes-of-day an `HH:MM` clock text names.
		 * @param clock - the clock text.
		 * @returns minutes since midnight, or null when the text is not a clock.
		 */
		function minutesOfClock(clock) {
			const matched = /^(\d{2}):(\d{2})$/u.exec(typeof clock === 'string' ? clock : '');
			return matched === null ? null : Number(matched[1]) * 60 + Number(matched[2]);
		}

		/** Where the working day ends when the profile does not say. */
		const DEFAULT_WORKDAY_END_MINUTES = 18 * 60;
		/** The default length of a new worklog when the settings do not say. */
		const DEFAULT_DEFAULT_DURATION_MINUTES = 60;

		/**
		 * The form's starting clock.
		 *
		 * When the day's list ends with an unbooked stretch, the clock starts where
		 * that stretch starts and ends at the earlier of "now" and the working-day
		 * end, so the whole remaining gap is the duration. Otherwise End is the
		 * current time rounded up to the next five-minute mark, Start is the
		 * default duration before it, and the duration is that default.
		 * @param gapStart - minutes-of-day the last unbooked row starts at, or null.
		 * @param workdayEnd - minutes-of-day the working day ends at.
		 * @param defaultDuration - minutes a new worklog lasts when there is no gap.
		 * @param currentMinutes - the current wall-clock minute in the panel's
		 *   zone; the browser's when omitted.
		 * @returns the three values, in minutes.
		 */
		function initialTimes(gapStart, workdayEnd, defaultDuration = DEFAULT_DEFAULT_DURATION_MINUTES,
			currentMinutes = nowMinutes()) {
			const minutes = Number.isFinite(currentMinutes) ? currentMinutes : nowMinutes();
			const current = (Math.ceil(minutes / TIME_STEP_MINUTES) * TIME_STEP_MINUTES) % 1440;
			const dayEnd = typeof workdayEnd === 'number' && workdayEnd > 0
				? workdayEnd
				: DEFAULT_WORKDAY_END_MINUTES;
			if (typeof gapStart === 'number' && gapStart >= 0) {
				const end = Math.min(current, dayEnd);
				const duration = end - gapStart;
				if (duration > 0) return { start: gapStart, duration, end };
			}
			const safeDuration = typeof defaultDuration === 'number' && defaultDuration > 0
				? defaultDuration
				: DEFAULT_DEFAULT_DURATION_MINUTES;
			return {
				end: current,
				duration: safeDuration,
				start: (current - safeDuration + 1440) % 1440,
			};
		}

		/**
		 * Send one JSON POST to a write route.
		 *
		 * The browser never holds the token: the host route validates the fields
		 * and writes through Tracker.
		 * @param url - the route the request goes to.
		 * @param payload - the JSON-safe request body.
		 * @returns a promise for the host's answer; rejects with a readable message.
		 */
		function postJson(url, payload) {
			return fetch(url, {
				method: 'POST',
				headers: { accept: 'application/json', 'content-type': 'application/json' },
				body: JSON.stringify(payload),
			}).then(async (response) => {
				let body = null;
				try {
					body = await response.json();
				} catch {
					body = null;
				}
				if (body !== null && typeof body === 'object' && body.ok === true) return body;
				if (body !== null && typeof body === 'object' && typeof body.message === 'string' && body.message !== '') {
					throw new Error(body.message);
				}
				if (response.status === 404 || response.status === 405) {
					// The page reloaded but the host process still runs the previous
					// build, which has no write route yet: an unmatched POST reaches
					// the SPA fallback, which answers 405.
					const restart = new Error('host half is not loaded');
					restart.restart = true;
					throw restart;
				}
				throw new Error(`HTTP ${response.status}`);
			});
		}

		/**
		 * Ask the host half to create one worklog.
		 * @param payload - the form's `key`, `start`, `spent` and `comment` fields.
		 * @returns a promise for the host's answer.
		 */
		function postWorklog(payload) {
			return postJson(ADD_URL, payload);
		}

		/**
		 * Ask the host half to delete one worklog.
		 * @param payload - the record's `key` and `id`.
		 * @returns a promise for the host's answer.
		 */
		function requestDelete(payload) {
			return postJson(DELETE_URL, payload);
		}

		/**
		 * Read the account's current tasks for the picker.
		 * @returns a promise for the task rows; rejects with a readable message.
		 */
		function fetchTasks() {
			return fetch(TASKS_URL, { headers: { accept: 'application/json' } }).then(async (response) => {
				let body = null;
				try {
					body = await response.json();
				} catch {
					body = null;
				}
				if (body !== null && typeof body === 'object' && body.ok === true && Array.isArray(body.tasks)) {
					return body.tasks;
				}
				if (body !== null && typeof body === 'object' && typeof body.message === 'string' && body.message !== '') {
					throw new Error(body.message);
				}
				if (response.status === 404 || response.status === 405) {
					// The page reloaded but the host process still runs the previous
					// build, which has no tasks route yet.
					const restart = new Error('host half is not loaded');
					restart.restart = true;
					throw restart;
				}
				throw new Error(`HTTP ${response.status}`);
			});
		}

		/**
		 * Read one issue by key, for the picker's pinned teamwork row.
		 * @param key - the issue key the user typed.
		 * @returns a promise for the task row; rejects with a readable message.
		 */
		function fetchTask(key) {
			return fetch(`${TASK_URL}?key=${encodeURIComponent(key)}`, { headers: { accept: 'application/json' } })
				.then(async (response) => {
					let body = null;
					try {
						body = await response.json();
					} catch {
						body = null;
					}
					if (body !== null && typeof body === 'object' && body.ok === true
						&& body.task !== null && typeof body.task === 'object') {
						return body.task;
					}
					if (body !== null && typeof body === 'object' && typeof body.message === 'string' && body.message !== '') {
						throw new Error(body.message);
					}
					throw new Error(`HTTP ${response.status}`);
				});
		}

		/**
		 * Read the day's calendar events from the host.
		 * @param date - the local `YYYY-MM-DD` date.
		 * @param force - whether the host should bypass its cached list.
		 * @returns a promise for the events; rejects with a readable message and a reason.
		 */
		function fetchDayEvents(date, force = false) {
			const query = `date=${encodeURIComponent(date)}${force ? '&force=1' : ''}`;
			return fetch(`${EVENTS_URL}?${query}`, { headers: { accept: 'application/json' } })
				.then(async (response) => {
					let body = null;
					try {
						body = await response.json();
					} catch {
						body = null;
					}
					if (body !== null && typeof body === 'object' && body.ok === true && Array.isArray(body.events)) {
						return body.events;
					}
					const error = new Error(body !== null && typeof body === 'object' && typeof body.message === 'string'
						? body.message
						: `HTTP ${response.status}`);
					error.reason = body !== null && typeof body === 'object' ? body.reason : 'failed';
					throw error;
				});
		}

		/**
		 * Read the plugin settings from the host.
		 * @returns a promise for the settings and the connection status, or for
		 *   an error when the host could not provide them.
		 */
		function fetchPluginSettings() {
			return fetch(SETTINGS_URL, { headers: { accept: 'application/json' } })
				.then(async (response) => {
					let body = null;
					try {
						body = await response.json();
					} catch {
						body = null;
					}
					const failed = !response.ok || body === null || typeof body !== 'object' || body.ok !== true
						|| body.settings === null || typeof body.settings !== 'object';
					if (failed) {
						const message = body !== null && typeof body === 'object' && typeof body.message === 'string'
							? body.message
							: `The settings request failed (${response.status}).`;
						return { ok: false, settings: null, connection: null, error: message };
					}
					const settings = body.settings;
					const connection = body.connection !== null && typeof body.connection === 'object'
						? body.connection
						: null;
					const hours = Number(settings.maxDurationHours);
					const delay = Number(settings.refreshDelaySeconds);
					const target = Number(settings.dailyTargetHours);
					const duration = Number(settings.defaultDurationMinutes);
					const poll = Number(settings.pollIntervalMinutes);
					const text = (value, fallback) => (typeof value === 'string' ? value : fallback);
					return {
						ok: true,
						error: null,
						settings: {
							durationChange: settings.durationChange === 'start' ? 'start' : DEFAULT_DURATION_CHANGE,
							maxDurationHours: Number.isInteger(hours) && hours >= 1 && hours <= MAX_DURATION_HOURS_LIMIT
								? hours
								: DEFAULT_MAX_DURATION_HOURS,
							refreshDelaySeconds: Number.isInteger(delay) && delay >= 1 && delay <= MAX_REFRESH_DELAY_SECONDS
								? delay
								: DEFAULT_REFRESH_DELAY_SECONDS,
							timeZone: text(settings.timeZone, ''),
							defaultQueue: text(settings.defaultQueue, '').trim(),
							orgId: text(settings.orgId, '').trim(),
							login: text(settings.login, '').trim(),
							workdayStart: text(settings.workdayStart, '09:00'),
							workdayEnd: text(settings.workdayEnd, '18:00'),
							dailyTargetHours: Number.isFinite(target) && target > 0 && target <= 24
								? target
								: DEFAULT_DAILY_TARGET_HOURS,
							defaultDurationMinutes: Number.isInteger(duration) && duration >= 5 && duration <= 1440
								? duration
								: DEFAULT_DEFAULT_DURATION_MINUTES,
							eventCommentPrefix: text(settings.eventCommentPrefix, DEFAULT_EVENT_COMMENT_PREFIX),
							tasksQuery: text(settings.tasksQuery, DEFAULT_TASKS_QUERY).trim() || DEFAULT_TASKS_QUERY,
							pollIntervalMinutes: Number.isInteger(poll) && poll >= 1 && poll <= MAX_POLL_INTERVAL_MINUTES
								? poll
								: DEFAULT_POLL_INTERVAL_MINUTES,
							calendarLogin: text(settings.calendarLogin, '').trim(),
						},
						connection: connection === null ? null : {
							orgId: text(connection.orgId, ''),
							hasToken: connection.hasToken === true,
							login: text(connection.login, ''),
							hasCalendarPassword: connection.hasCalendarPassword === true,
						},
					};
				})
				.catch((error) => ({
					ok: false,
					settings: null,
					connection: null,
					error: error instanceof Error ? error.message : String(error),
				}));
		}

		/**
		 * Persist the plugin settings.
		 * @param settings - the settings fields to save; the host merges them.
		 * @returns a promise for the stored settings and the refreshed connection.
		 */
		function savePluginSettings(settings) {
			return postJson(SETTINGS_URL, settings).then((body) => ({
				settings: body !== null && typeof body === 'object'
					&& body.settings !== null && typeof body.settings === 'object'
					? body.settings
					: settings,
				connection: body !== null && typeof body === 'object'
					&& body.connection !== null && typeof body.connection === 'object'
					? body.connection
					: null,
			}));
		}

		/**
		 * Probe the saved Tracker and Calendar connections.
		 * @returns a promise for the two probe results.
		 */
		function fetchConnectionTest() {
			return fetch(TEST_URL, { headers: { accept: 'application/json' } })
				.then(async (response) => {
					let body = null;
					try {
						body = await response.json();
					} catch {
						body = null;
					}
					if (!response.ok || body === null || typeof body !== 'object' || body.ok !== true) {
						throw new Error(body !== null && typeof body === 'object' && typeof body.message === 'string'
							? body.message
							: `The connection test failed (${response.status}).`);
					}
					return body;
				});
		}

		/**
		 * Whether a task status means its work is closed.
		 *
		 * The pinned teamwork task loses its point once the work is done, so the
		 * row is cleared instead of keeping a closed task as the default. Tracker
		 * reports the closed status both by key (`closed`) and by display text
		 * (`Р—Р°РєСЂС‹С‚`); either spelling counts.
		 * @param status - the status display text, when known.
		 * @param statusKey - the status key, when known.
		 * @returns true when the status is the closed one.
		 */
		function isClosedStatus(status, statusKey) {
			const key = typeof statusKey === 'string' ? statusKey.trim().toLowerCase() : '';
			const display = typeof status === 'string' ? status.trim().toLowerCase() : '';
			return key === 'closed' || display === 'Р·Р°РєСЂС‹С‚' || display === 'closed';
		}

		/**
		 * The browser copy of the pinned teamwork task.
		 *
		 * The durable copy lives on the host; this one is the fallback when the
		 * host store is unavailable and the one-time migration source for a value
		 * saved by an earlier plugin build.
		 * @returns the stored task, or null when nothing usable is stored or the
		 *   remembered task was already closed when it was stored.
		 */
		function readTeamwork() {
			try {
				const raw = window.localStorage.getItem(TEAMWORK_STORAGE);
				if (raw === null) return null;
				const parsed = JSON.parse(raw);
				if (parsed === null || typeof parsed !== 'object'
					|| typeof parsed.key !== 'string' || parsed.key === '') return null;
				if (isClosedStatus(parsed.status, parsed.statusKey)) return null;
				return {
					key: parsed.key,
					summary: typeof parsed.summary === 'string' ? parsed.summary : '',
					status: typeof parsed.status === 'string' ? parsed.status : '',
					statusKey: typeof parsed.statusKey === 'string' ? parsed.statusKey : '',
				};
			} catch {
				return null;
			}
		}

		/**
		 * Remember or forget the browser copy of the teamwork task.
		 * @param task - the task to store, or null to forget it.
		 */
		function writeTeamwork(task) {
			try {
				if (task === null) {
					window.localStorage.removeItem(TEAMWORK_STORAGE);
					return;
				}
				window.localStorage.setItem(TEAMWORK_STORAGE, JSON.stringify({
					key: task.key,
					summary: task.summary,
					status: task.status,
					statusKey: typeof task.statusKey === 'string' ? task.statusKey : '',
				}));
			} catch {
				// Storage can be unavailable; the row still works for this opening.
			}
		}

		/**
		 * Read the pinned teamwork task from the host's durable store.
		 * @returns a promise for the task, or null when none is stored.
		 */
		function fetchStoredTeamwork() {
			return fetch(TEAMWORK_URL, { headers: { accept: 'application/json' } }).then(async (response) => {
				let body = null;
				try {
					body = await response.json();
				} catch {
					body = null;
				}
				if (body !== null && typeof body === 'object' && body.ok === true) {
					const task = body.task;
					if (task !== null && typeof task === 'object'
						&& typeof task.key === 'string' && task.key !== '') {
						return {
							key: task.key,
							summary: typeof task.summary === 'string' ? task.summary : '',
							status: typeof task.status === 'string' ? task.status : '',
							statusKey: typeof task.statusKey === 'string' ? task.statusKey : '',
						};
					}
					return null;
				}
				throw new Error(body !== null && typeof body === 'object' && typeof body.message === 'string'
					? body.message
					: `HTTP ${response.status}`);
			});
		}

		/**
		 * Store the pinned teamwork task durably on the host.
		 * @param task - the task to remember.
		 * @returns a promise for the host's answer.
		 */
		function saveStoredTeamwork(task) {
			return postJson(TEAMWORK_URL, {
				task: {
					key: task.key,
					summary: task.summary,
					status: task.status,
					statusKey: task.statusKey,
				},
			});
		}

		/**
		 * Forget the pinned teamwork task on the host.
		 * @returns a promise for the host's answer.
		 */
		function clearStoredTeamwork() {
			return postJson(TEAMWORK_URL, { clear: true });
		}

		/**
		 * Chevron artwork for a clock field's preset toggle.
		 * @returns the SVG element.
		 */
		function ChevronDownIcon() {
			return h('svg', {
				viewBox: '0 0 16 16', width: 12, height: 12,
				'aria-hidden': true, focusable: false, style: { display: 'block', flex: 'none' },
			}, h('path', {
				d: 'M4.2 6.2 8 10l3.8-3.8',
				fill: 'none', stroke: 'currentColor', strokeWidth: 1.6,
				strokeLinecap: 'round', strokeLinejoin: 'round',
			}));
		}

		/**
		 * A clock or duration field: masked text entry plus a preset list.
		 *
		 * Clicking selects the text; the first digit typed clears the old value,
		 * and four digits typed in a row become `HH:MM` without a colon. The
		 * duration variant also accepts a shorter entry: one digit is hours
		 * (`2` -> `02:00`), two digits are minutes (`15` -> `00:15`), and three
		 * digits are `H:mm` (`245` -> `02:45`). The chevron still opens the preset
		 * list, so choosing from it keeps working.
		 * @param props - id, label, current minutes, preset minutes, formatter,
		 *   commit callback, optional Enter callback, disabled flag, and the mask
		 *   variant (`clock` by default, `duration` for the duration field).
		 * @returns the field element.
		 */
		function ClockCombo({ id, label, value, options, format, onChange, onEnter, disabled, mask }) {
			const [text, setText] = React.useState(() => format(value));
			const [digits, setDigits] = React.useState('');
			const [focused, setFocused] = React.useState(false);
			const [open, setOpen] = React.useState(false);
			const replace = React.useRef(true);
			const wrap = React.useRef(null);
			const durationMask = mask === 'duration';

			// Another control can move this field's value (Start moves End, Duration
			// moves one of them, and so on); the text follows while this field is
			// not the one being edited.
			React.useEffect(() => {
				if (!focused) setText(format(value));
			}, [value, focused, format]);

			// A click anywhere outside the field closes the preset list.
			React.useEffect(() => {
				if (!open) return undefined;
				const onDown = (event) => {
					if (wrap.current !== null && !wrap.current.contains(event.target)) setOpen(false);
				};
				document.addEventListener('mousedown', onDown);
				return () => document.removeEventListener('mousedown', onDown);
			}, [open]);

			/**
			 * The text shown while digits are being typed.
			 * @param chars - the digits typed so far, at most four.
			 * @returns the progressive `HH:MM` preview.
			 */
			const preview = (chars) => {
				if (!durationMask) {
					return chars.length <= 2 ? chars : `${chars.slice(0, 2)}:${chars.slice(2)}`;
				}
				if (chars.length === 0) return format(value);
				if (chars.length === 1) return `0${chars}:00`;
				if (chars.length === 2) return `00:${chars}`;
				if (chars.length === 3) return `0${chars[0]}:${chars.slice(1)}`;
				return `${chars.slice(0, 2)}:${chars.slice(2)}`;
			};

			/**
			 * The minutes typed digits name.
			 * @param chars - the digits typed so far, at most four.
			 * @returns the duration in minutes, or null when the digits do not
			 *   name a valid value.
			 */
			const typedMinutes = (chars) => {
				if (durationMask) {
					if (chars.length === 1) return Number(chars) * 60;
					if (chars.length === 2) return Number(chars) <= 59 ? Number(chars) : null;
					if (chars.length === 3) {
						const minutes = Number(chars.slice(1));
						return minutes <= 59 ? Number(chars[0]) * 60 + minutes : null;
					}
					if (chars.length === 4) {
						const hours = Number(chars.slice(0, 2));
						const minutes = Number(chars.slice(2));
						return hours > 23 || minutes > 59 ? null : hours * 60 + minutes;
					}
					return null;
				}
				if (chars.length !== 4) return null;
				const hours = Number(chars.slice(0, 2));
				const minutes = Number(chars.slice(2));
				return hours > 23 || minutes > 59 ? null : hours * 60 + minutes;
			};

			/**
			 * Commit a minute value upward and reset the typing buffer.
			 * @param minutes - the committed value.
			 */
			const commit = (minutes) => {
				onChange(minutes);
				setText(format(minutes));
				setDigits('');
				replace.current = true;   // the next digit starts a fresh value
			};

			const choose = (minutes) => {
				setOpen(false);
				commit(minutes);
			};

			/**
			 * Append typed digits, previewing them and committing on the fourth.
			 * @param chars - the digits just typed or pasted.
			 */
			const type = (chars) => {
				const next = (replace.current ? '' : digits) + chars;
				replace.current = false;
				const clipped = next.slice(0, 4);
				setDigits(clipped);
				setText(preview(clipped));
				const minutes = typedMinutes(clipped);
				// A four-digit entry is complete; the shorter duration forms wait
				// for Enter or blur, so a fourth digit can still extend them.
				if (minutes !== null && clipped.length === 4) commit(minutes);
			};

			const onKeyDown = (event) => {
				if (disabled) return;
				if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
					// The chevron itself is out of the tab order; Down and Up stand in.
					event.preventDefault();
					setOpen(true);
					return;
				}
				if (event.key === 'Escape') {
					if (open) {
						event.preventDefault();
						setOpen(false);
					}
					return;
				}
				if (event.key === 'Enter') {
					// Enter commits this field instead of submitting the whole form.
					event.preventDefault();
					const minutes = typedMinutes(digits);
					if (minutes !== null) commit(minutes);
					setOpen(false);
					if (typeof onEnter === 'function') onEnter();
					return;
				}
				if (event.key === 'Backspace') {
					event.preventDefault();
					const next = replace.current ? '' : digits.slice(0, -1);
					replace.current = false;
					setDigits(next);
					setText(preview(next));
					return;
				}
				if (event.key === ':') {
					// The mask inserts the colon itself.
					event.preventDefault();
					return;
				}
				if (!/^\d$/u.test(event.key)) return;
				event.preventDefault();
				setOpen(false);
				type(event.key);
			};

			const onFocus = (event) => {
				setFocused(true);
				replace.current = true;
				setDigits('');
				event.target.select();
			};

			const onBlur = () => {
				setFocused(false);
				setOpen(false);
				const minutes = typedMinutes(digits);
				if (minutes !== null) commit(minutes);
				else setText(format(value));
				setDigits('');
				replace.current = true;
			};

			const onPaste = (event) => {
				const raw = event.clipboardData !== undefined && event.clipboardData !== null
					? event.clipboardData.getData('text')
					: '';
				const chars = raw.replace(/\D/gu, '').slice(0, 4);
				if (chars === '') return;
				event.preventDefault();
				type(chars);
			};

			return h('div', { className: 'ytt-field', ref: wrap },
				h('label', { key: 'label', className: 'ytt-field-label', htmlFor: id }, label),
				h('div', { key: 'control', className: 'ytt-combo' }, [
					h('input', {
						key: 'input', id, className: 'ytt-input', type: 'text',
						role: 'combobox', 'aria-expanded': open ? 'true' : 'false',
						'aria-haspopup': 'listbox', 'aria-controls': `${id}-list`,
						value: text, disabled, spellCheck: false, autoComplete: 'off',
						inputMode: 'numeric',
						onFocus, onBlur, onKeyDown, onPaste,
						onChange: () => {},
					}),
					h('button', {
						key: 'toggle', type: 'button', className: 'ytt-combo-toggle',
						disabled, tabIndex: -1, 'aria-label': label, title: `${label} (Down)`,
						onMouseDown: (event) => event.preventDefault(),
						onClick: () => setOpen((current) => !current),
					}, h(ChevronDownIcon, { key: 'icon' })),
					// The list is positioned against the control, not the dialog: an
					// absolute list outside it would resolve against the fixed backdrop
					// and land below the viewport.
					open
						? h('ul', {
							key: 'list', id: `${id}-list`, className: 'ytt-combo-list', role: 'listbox',
						}, options.map((minutes) => h('li', {
							key: minutes, role: 'none',
						}, h('button', {
							type: 'button', role: 'option', className: 'ytt-combo-option',
							'aria-selected': minutes === value ? 'true' : 'false',
							'data-selected': minutes === value ? 'true' : 'false',
							onMouseDown: (event) => event.preventDefault(),
							onClick: () => choose(minutes),
						}, format(minutes)))))
						: null,
				]),
			);
		}

		/**
		 * Whether a text names a time zone the browser accepts.
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
		 * One labelled settings field with its explanation.
		 * @param props - the input id, its label, the hint under it, and the input.
		 * @returns the field element.
		 */
		function SettingsField({ id, label, hint, children }) {
			return h('div', { className: 'ytt-field' }, [
				h('label', { key: 'label', className: 'ytt-field-label', htmlFor: id }, label),
				children,
				hint === '' ? null : h('p', { key: 'hint', className: 'ytt-field-hint' }, hint),
			]);
		}

		/**
		 * The task's name and status under the key field: attributes of the task
		 * the key names.
		 * @param props - the locale helper and the looked-up task.
		 * @returns the details block.
		 */
		function TaskCard({ t, task }) {
			return h('div', { className: 'ytt-task-details' }, [
				h('span', { key: 'name', className: 'ytt-task-details-name' },
					task.summary === '' ? '\u2014' : task.summary),
				h('span', { key: 'status', className: 'ytt-task-details-status' },
					t('panel.statusLine', { status: task.status })),
			]);
		}

		/**
		 * Keep the highlighted row visible inside a scrolling list.
		 * @param active - the highlighted row index, or null.
		 * @param list - the scrolling list element.
		 */
		function useActiveRowScroll(active, list) {
			React.useEffect(() => {
				if (active === null || list.current === null) return;
				const row = list.current.querySelector(`[data-index="${active}"]`);
				if (row !== null && typeof row.scrollIntoView === 'function') {
					row.scrollIntoView({ block: 'nearest' });
				}
			}, [active]);
		}

		/**
		 * Keep the keyboard inside a modal dialog: Tab cycles through its
		 * controls, and Shift+Tab from the first wraps to the last.
		 * @param ref - the dialog element.
		 */
		function useFocusTrap(ref) {
			React.useEffect(() => {
				const node = ref.current;
				if (node === null) return undefined;
				const onKeyDown = (event) => {
					if (event.key !== 'Tab') return;
					const selector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), '
						+ 'textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';
					const items = [...node.querySelectorAll(selector)]
						.filter((element) => element.getClientRects().length > 0);
					if (items.length === 0) {
						event.preventDefault();
						return;
					}
					const first = items[0];
					const last = items[items.length - 1];
					const active = document.activeElement;
					if (!event.shiftKey && (active === last || !node.contains(active))) {
						event.preventDefault();
						first.focus();
					} else if (event.shiftKey && (active === first || !node.contains(active))) {
						event.preventDefault();
						last.focus();
					}
				};
				node.addEventListener('keydown', onKeyDown);
				return () => node.removeEventListener('keydown', onKeyDown);
			}, [ref]);
		}

		/**
		 * The common frame of the two settings windows: the backdrop, the modal
		 * with its focus trap and Escape handler. The body and the actions stay
		 * with each window, because their fields differ.
		 * @param props - the title id, the test id, the saving flag, the close
		 *   callback, and the window body.
		 * @returns the modal element.
		 */
		function SettingsDialogFrame({ titleId, testId, saving, onClose, children }) {
			const dialog = React.useRef(null);
			useFocusTrap(dialog);
			React.useEffect(() => {
				const onKeyDown = (event) => {
					if (event.key === 'Escape') onClose();
				};
				document.addEventListener('keydown', onKeyDown);
				return () => document.removeEventListener('keydown', onKeyDown);
			}, [onClose]);
			return h('div', {
				className: 'ytt-backdrop ytt-backdrop-top',
				onMouseDown: (event) => { if (event.target === event.currentTarget && !saving) onClose(); },
			}, h('div', {
				ref: dialog, className: 'ytt-dialog ytt-dialog-scroll', role: 'dialog', 'aria-modal': 'true',
				'aria-labelledby': titleId, 'data-testid': testId,
			}, children));
		}

		/**
		 * The main plugin settings: the panel's own preferences, the poll interval,
		 * and the two integration groups. Secrets are written to the profile
		 * credential store; a blank field keeps the stored value, and the clear
		 * checkbox removes it.
		 * @param props - the locale helper, the settings, the connection status, a
		 *   load error with its retry, a save callback, and a close callback.
		 * @returns the settings window.
		 */
		function MainSettingsDialog({ t, settings, connection, loadError, onRetry, onSave, onClose }) {
			const draftOf = (value) => (value === null ? null : {
				refreshDelaySeconds: value.refreshDelaySeconds,
				timeZone: value.timeZone,
				workdayStart: value.workdayStart,
				workdayEnd: value.workdayEnd,
				dailyTargetHours: value.dailyTargetHours,
				pollIntervalMinutes: value.pollIntervalMinutes,
				orgId: value.orgId ?? connection?.orgId ?? '',
				login: value.login ?? connection?.login ?? '',
				token: '',
				clearToken: false,
				calendarLogin: value.calendarLogin,
				calendarPassword: '',
				clearCalendarPassword: false,
			});
			const [draft, setDraft] = React.useState(() => draftOf(settings));
			const [error, setError] = React.useState(null);
			const [saving, setSaving] = React.useState(false);
			const [testing, setTesting] = React.useState(false);
			const [testResult, setTestResult] = React.useState(null);

			// A retry can deliver the settings after the window is already open.
			React.useEffect(() => {
				setDraft(draftOf(settings));
			}, [settings]);


			/**
			 * One draft field, so every input edits the same object.
			 * @param field - the settings key.
			 * @param value - its new text, number or flag.
			 */
			const setField = (field, value) => {
				setDraft((current) => (current === null ? current : { ...current, [field]: value }));
			};

			const save = () => {
				if (draft === null) return;
				const delay = Number(draft.refreshDelaySeconds);
				if (!Number.isInteger(delay) || delay < 1 || delay > MAX_REFRESH_DELAY_SECONDS) {
					setError(t('panel.refreshDelayInvalid'));
					return;
				}
				const zone = draft.timeZone.trim();
				if (zone !== '' && !validTimeZone(zone)) {
					setError(t('panel.timeZoneInvalid'));
					return;
				}
				const start = draft.workdayStart.trim();
				const startMinutes = minutesOfClock(start);
				if (startMinutes === null) {
					setError(t('panel.workdayStartInvalid'));
					return;
				}
				const end = draft.workdayEnd.trim();
				const endMinutes = minutesOfClock(end);
				if (endMinutes === null) {
					setError(t('panel.workdayEndInvalid'));
					return;
				}
				if (startMinutes >= endMinutes) {
					setError(t('panel.workdayOrderInvalid'));
					return;
				}
				const target = Number(draft.dailyTargetHours);
				if (!Number.isFinite(target) || target <= 0 || target > 24) {
					setError(t('panel.dailyTargetInvalid'));
					return;
				}
				const poll = Number(draft.pollIntervalMinutes);
				if (!Number.isInteger(poll) || poll < 1 || poll > MAX_POLL_INTERVAL_MINUTES) {
					setError(t('panel.pollIntervalInvalid'));
					return;
				}
				const payload = {
					refreshDelaySeconds: delay,
					timeZone: zone,
					workdayStart: start,
					workdayEnd: end,
					dailyTargetHours: target,
					pollIntervalMinutes: poll,
					calendarLogin: draft.calendarLogin.trim(),
				};
				// Empty connection fields keep their stored values instead of
				// clearing them by accident.
				if (draft.orgId.trim() !== '') payload.orgId = draft.orgId.trim();
				if (draft.login.trim() !== '') payload.login = draft.login.trim();
				if (draft.token.trim() !== '') payload.token = draft.token.trim();
				if (draft.calendarPassword !== '') payload.calendarPassword = draft.calendarPassword;
				if (draft.clearToken) payload.clearToken = true;
				if (draft.clearCalendarPassword) payload.clearCalendarPassword = true;
				setSaving(true);
				setError(null);
				Promise.resolve(onSave(payload)).then(() => setSaving(false), (failure) => {
					setSaving(false);
					setError(`${t('panel.settingsFailed')}: ${failure instanceof Error ? failure.message : String(failure)}`);
				});
			};

			/** Probe the saved connections and show both outcomes. */
			const runTest = () => {
				setTesting(true);
				setTestResult(null);
				fetchConnectionTest().then((result) => {
					setTestResult(result);
				}, (failure) => {
					setTestResult({ error: failure instanceof Error ? failure.message : String(failure) });
				}).finally(() => setTesting(false));
			};

			const testLines = testResult === null ? [] : testResult.error !== undefined
				? [t('panel.testFailed', { message: testResult.error })]
				: [
					testResult.tracker?.ok === true
						? t('panel.testTrackerOk', { login: testResult.tracker.login ?? '' })
						: t('panel.testTrackerFailed', { message: testResult.tracker?.message ?? '' }),
					testResult.calendar?.ok === true
						? t('panel.testCalendarOk', { count: String(testResult.calendar.calendars ?? 0) })
						: t('panel.testCalendarFailed', { message: testResult.calendar?.message ?? '' }),
				];

			/**
			 * The per-secret "clear" row, shown only when a value is configured.
			 * @param field - the draft flag the checkbox writes.
			 * @param configured - whether the connection reports a stored value.
			 * @returns the row, or null.
			 */
			const clearRow = (field, configured) => (configured
				? h('div', { key: `${field}-clear`, className: 'ytt-secret-clear' }, [
					h('label', { key: 'label', className: 'ytt-check' }, [
						h('input', {
							key: 'box', type: 'checkbox', checked: draft[field] === true, disabled: saving,
							onChange: (event) => setField(field, event.target.checked),
						}),
						h('span', { key: 'text' }, t('panel.clearSecret')),
					]),
					h('span', { key: 'hint', className: 'ytt-field-hint' }, t('panel.clearSecretHint')),
				])
				: null);

			return h(SettingsDialogFrame, {
				titleId: 'ytt-settings-title',
				testId: 'tracker-settings-dialog',
				saving,
				onClose,
				children: draft === null ? [
				h('h2', { key: 'title', id: 'ytt-settings-title' }, t('panel.panelSettings')),
				h('p', { key: 'load-error', className: 'ytt-form-error', role: 'alert' },
					loadError === null
					? t('panel.settingsLoading')
					: `${t('panel.settingsLoadFailed')} ${loadError}`.trim()),
				h('div', { key: 'actions', className: 'ytt-dialog-actions' }, [
					onRetry === undefined || loadError === null ? null : h('button', {
						key: 'retry', type: 'button', className: 'ytt-btn ytt-btn-ghost',
						onClick: onRetry,
					}, t('panel.retry')),
					h('button', {
						key: 'close', type: 'button', className: 'ytt-btn ytt-btn-primary',
						onClick: onClose, title: t('panel.cancelHint'),
					}, t('panel.cancel')),
				]),
			] : [
				h('h2', { key: 'title', id: 'ytt-settings-title' }, t('panel.panelSettings')),
				h('p', { key: 'group-panel', className: 'ytt-settings-group-title' }, t('panel.groupPanel')),
				SettingsField({
					id: 'ytt-refresh-delay', label: t('panel.refreshDelay'),
					hint: t('panel.refreshDelayHint'),
					children: h('input', {
						key: 'input', id: 'ytt-refresh-delay', className: 'ytt-input', type: 'number',
						min: 1, max: MAX_REFRESH_DELAY_SECONDS, step: 1, value: draft.refreshDelaySeconds,
						disabled: saving, autoFocus: true,
						onChange: (event) => setField('refreshDelaySeconds', event.target.value),
					}),
				}),
				SettingsField({
					id: 'ytt-poll-interval', label: t('panel.pollInterval'),
					hint: t('panel.pollIntervalHint'),
					children: h('input', {
						key: 'input', id: 'ytt-poll-interval', className: 'ytt-input', type: 'number',
						min: 1, max: MAX_POLL_INTERVAL_MINUTES, step: 1, value: draft.pollIntervalMinutes,
						disabled: saving,
						onChange: (event) => setField('pollIntervalMinutes', event.target.value),
					}),
				}),
				SettingsField({
					id: 'ytt-time-zone', label: t('panel.timeZone'), hint: t('panel.timeZoneHint'),
					children: h('input', {
						key: 'input', id: 'ytt-time-zone', className: 'ytt-input', type: 'text',
						value: draft.timeZone, disabled: saving, spellCheck: false, autoComplete: 'off',
						placeholder: 'Europe/Moscow',
						onChange: (event) => setField('timeZone', event.target.value),
					}),
				}),
				SettingsField({
					id: 'ytt-workday-start', label: t('panel.workdayStart'),
					hint: t('panel.workdayStartHint'),
					children: h('input', {
						key: 'input', id: 'ytt-workday-start', className: 'ytt-input', type: 'text',
						value: draft.workdayStart, disabled: saving, spellCheck: false, autoComplete: 'off',
						placeholder: '09:00',
						onChange: (event) => setField('workdayStart', event.target.value),
					}),
				}),
				SettingsField({
					id: 'ytt-workday-end', label: t('panel.workdayEnd'), hint: t('panel.workdayEndHint'),
					children: h('input', {
						key: 'input', id: 'ytt-workday-end', className: 'ytt-input', type: 'text',
						value: draft.workdayEnd, disabled: saving, spellCheck: false, autoComplete: 'off',
						placeholder: '18:00',
						onChange: (event) => setField('workdayEnd', event.target.value),
					}),
				}),
				SettingsField({
					id: 'ytt-daily-target', label: t('panel.dailyTarget'),
					hint: t('panel.dailyTargetHint'),
					children: h('input', {
						key: 'input', id: 'ytt-daily-target', className: 'ytt-input', type: 'number',
						min: 0.5, max: 24, step: 0.5, value: draft.dailyTargetHours, disabled: saving,
						onChange: (event) => setField('dailyTargetHours', event.target.value),
					}),
				}),
				h('p', { key: 'group-tracker', className: 'ytt-settings-group-title' }, t('panel.groupTracker')),
				SettingsField({
					id: 'ytt-org-id', label: t('panel.orgId'), hint: t('panel.orgIdHint'),
					children: h('input', {
						key: 'input', id: 'ytt-org-id', className: 'ytt-input', type: 'text',
						value: draft.orgId, disabled: saving, spellCheck: false, autoComplete: 'off',
						onChange: (event) => setField('orgId', event.target.value),
					}),
				}),
				SettingsField({
					id: 'ytt-login', label: t('panel.login'), hint: t('panel.loginHint'),
					children: h('input', {
						key: 'input', id: 'ytt-login', className: 'ytt-input', type: 'text',
						value: draft.login, disabled: saving, spellCheck: false, autoComplete: 'off',
						onChange: (event) => setField('login', event.target.value),
					}),
				}),
				SettingsField({
					id: 'ytt-token', label: t('panel.token'), hint: t('panel.tokenHint'),
					children: h('div', { key: 'stack', className: 'ytt-field-stack' }, [
						h('input', {
							key: 'input', id: 'ytt-token', className: 'ytt-input', type: 'password',
							value: draft.token, disabled: saving, autoComplete: 'off',
							placeholder: connection !== null && connection.hasToken
								? t('panel.secretKeepPlaceholder')
								: t('panel.secretEmptyPlaceholder'),
							onChange: (event) => setField('token', event.target.value),
						}),
						clearRow('clearToken', connection !== null && connection.hasToken),
					]),
				}),
				h('p', { key: 'group-calendar', className: 'ytt-settings-group-title' }, t('panel.groupCalendar')),
				SettingsField({
					id: 'ytt-calendar-login', label: t('panel.calendarLogin'),
					hint: t('panel.calendarLoginHint'),
					children: h('input', {
						key: 'input', id: 'ytt-calendar-login', className: 'ytt-input', type: 'text',
						value: draft.calendarLogin, disabled: saving, spellCheck: false, autoComplete: 'off',
						onChange: (event) => setField('calendarLogin', event.target.value),
					}),
				}),
				SettingsField({
					id: 'ytt-calendar-password', label: t('panel.calendarPassword'),
					hint: t('panel.calendarPasswordHint'),
					children: h('div', { key: 'stack', className: 'ytt-field-stack' }, [
						h('input', {
							key: 'input', id: 'ytt-calendar-password', className: 'ytt-input', type: 'password',
							value: draft.calendarPassword, disabled: saving, autoComplete: 'off',
							placeholder: connection !== null && connection.hasCalendarPassword
								? t('panel.secretKeepPlaceholder')
								: t('panel.secretEmptyPlaceholder'),
							onChange: (event) => setField('calendarPassword', event.target.value),
						}),
						clearRow('clearCalendarPassword', connection !== null && connection.hasCalendarPassword),
					]),
				}),
				error === null ? null : h('p', {
					key: 'error', className: 'ytt-form-error', role: 'alert',
				}, error),
				h('div', { key: 'test', className: 'ytt-settings-test' }, [
					h('button', {
						key: 'button', type: 'button', className: 'ytt-btn ytt-btn-ghost',
						disabled: saving || testing, onClick: runTest,
					}, testing ? t('panel.testing') : t('panel.testConnection')),
					h('span', { key: 'note', className: 'ytt-field-hint' }, t('panel.testSavedNote')),
					testLines.length === 0 ? null : h('div', {
						key: 'result', className: 'ytt-settings-test-result', role: 'status',
					}, testLines.map((line, index) => h('span', { key: `line-${index}` }, line))),
				]),
				h('div', { key: 'actions', className: 'ytt-dialog-actions' }, [
					h('button', {
						key: 'cancel', type: 'button', className: 'ytt-btn ytt-btn-ghost',
						disabled: saving, onClick: onClose, title: t('panel.cancelHint'),
					}, t('panel.cancel')),
					h('button', {
						key: 'save', type: 'button', className: 'ytt-btn ytt-btn-primary',
						disabled: saving, onClick: save, title: t('panel.settingsSave'),
					}, saving ? t('panel.saving') : t('panel.settingsSave')),
				]),
			] });
		}

		/**
		 * The Adding time settings: the Duration behavior and ceiling, the default
		 * queue, the default duration, and the event comment prefix.
		 * @param props - the locale helper, the current values, a load error with
		 *   its retry, a save callback, and a close callback.
		 * @returns the settings window.
		 */
		function AddingSettingsDialog({ t, settings, loadError, onRetry, onSave, onClose }) {
			const [draft, setDraft] = React.useState(settings);
			const [error, setError] = React.useState(null);
			const [saving, setSaving] = React.useState(false);

			React.useEffect(() => {
				setDraft(settings);
			}, [settings]);


			/**
			 * One draft field, so every input edits the same object.
			 * @param field - the settings key.
			 * @param value - its new text or number.
			 */
			const setField = (field, value) => {
				setDraft((current) => (current === null ? current : { ...current, [field]: value }));
			};

			const save = () => {
				if (draft === null) return;
				const hours = Number(draft.maxDurationHours);
				if (!Number.isInteger(hours) || hours < 1 || hours > MAX_DURATION_HOURS_LIMIT) {
					setError(t('panel.maxDurationInvalid'));
					return;
				}
				const duration = Number(draft.defaultDurationMinutes);
				if (!Number.isInteger(duration) || duration < 5 || duration > 1440 || duration % 5 !== 0) {
					setError(t('panel.defaultDurationInvalid'));
					return;
				}
				if (duration > hours * 60) {
					setError(t('panel.defaultDurationTooLong'));
					return;
				}
				if (draft.eventCommentPrefix.length > 200) {
					setError(t('panel.eventPrefixInvalid'));
					return;
				}
				const query = typeof draft.tasksQuery === 'string' ? draft.tasksQuery.trim() : '';
				if (query === '' || query.length > 2000) {
					setError(t('panel.tasksQueryInvalid'));
					return;
				}
				const payload = {
					durationChange: draft.durationChange === 'start' ? 'start' : 'end',
					maxDurationHours: hours,
					defaultQueue: draft.defaultQueue.trim(),
					defaultDurationMinutes: duration,
					eventCommentPrefix: draft.eventCommentPrefix,
					tasksQuery: query,
				};
				setSaving(true);
				setError(null);
				Promise.resolve(onSave(payload)).then(() => setSaving(false), (failure) => {
					setSaving(false);
					setError(`${t('panel.settingsFailed')}: ${failure instanceof Error ? failure.message : String(failure)}`);
				});
			};

			return h(SettingsDialogFrame, {
				titleId: 'ytt-adding-settings-title',
				testId: 'tracker-adding-settings-dialog',
				saving,
				onClose,
				children: draft === null ? [
				h('h2', { key: 'title', id: 'ytt-adding-settings-title' }, t('panel.addingSettings')),
				h('p', { key: 'load-error', className: 'ytt-form-error', role: 'alert' },
					loadError === null
					? t('panel.settingsLoading')
					: `${t('panel.settingsLoadFailed')} ${loadError}`.trim()),
				h('div', { key: 'actions', className: 'ytt-dialog-actions' }, [
					onRetry === undefined || loadError === null ? null : h('button', {
						key: 'retry', type: 'button', className: 'ytt-btn ytt-btn-ghost',
						onClick: onRetry,
					}, t('panel.retry')),
					h('button', {
						key: 'close', type: 'button', className: 'ytt-btn ytt-btn-primary',
						onClick: onClose, title: t('panel.cancelHint'),
					}, t('panel.cancel')),
				]),
			] : [
				h('h2', { key: 'title', id: 'ytt-adding-settings-title' }, t('panel.addingSettings')),
				SettingsField({
					id: 'ytt-tasks-query', label: t('panel.tasksQuery'), hint: t('panel.tasksQueryHint'),
					children: h('input', {
						key: 'input', id: 'ytt-tasks-query', className: 'ytt-input', type: 'text',
						value: draft.tasksQuery ?? DEFAULT_TASKS_QUERY, disabled: saving,
						spellCheck: false, autoComplete: 'off',
						onChange: (event) => setField('tasksQuery', event.target.value),
					}),
				}),
				SettingsField({
					id: 'ytt-duration-mode', label: t('panel.whenDurationChanged'),
					hint: t('panel.whenDurationChangedHint'),
					children: h('select', {
						key: 'select', id: 'ytt-duration-mode', className: 'ytt-select',
						value: draft.durationChange, disabled: saving,
						onChange: (event) => setField('durationChange', event.target.value),
					}, [
						h('option', { key: 'end', value: 'end' }, t('panel.recalcEnd')),
						h('option', { key: 'start', value: 'start' }, t('panel.recalcStart')),
					]),
				}),
				SettingsField({
					id: 'ytt-max-duration', label: t('panel.maxDuration'), hint: t('panel.maxDurationHint'),
					children: h('input', {
						key: 'input', id: 'ytt-max-duration', className: 'ytt-input', type: 'number',
						min: 1, max: MAX_DURATION_HOURS_LIMIT, step: 1, value: draft.maxDurationHours,
						disabled: saving, autoFocus: true,
						onChange: (event) => setField('maxDurationHours', event.target.value),
					}),
				}),
				SettingsField({
					id: 'ytt-default-queue', label: t('panel.defaultQueue'), hint: t('panel.defaultQueueHint'),
					children: h('input', {
						key: 'input', id: 'ytt-default-queue', className: 'ytt-input', type: 'text',
						value: draft.defaultQueue, disabled: saving, spellCheck: false, autoComplete: 'off',
						onChange: (event) => setField('defaultQueue', event.target.value),
					}),
				}),
				SettingsField({
					id: 'ytt-default-duration', label: t('panel.defaultDuration'),
					hint: t('panel.defaultDurationHint'),
					children: h('input', {
						key: 'input', id: 'ytt-default-duration', className: 'ytt-input', type: 'number',
						min: 5, max: 1440, step: 5, value: draft.defaultDurationMinutes, disabled: saving,
						onChange: (event) => setField('defaultDurationMinutes', event.target.value),
					}),
				}),
				SettingsField({
					id: 'ytt-event-prefix', label: t('panel.eventPrefix'), hint: t('panel.eventPrefixHint'),
					children: h('input', {
						key: 'input', id: 'ytt-event-prefix', className: 'ytt-input', type: 'text',
						value: draft.eventCommentPrefix, disabled: saving, spellCheck: false,
						autoComplete: 'off',
						onChange: (event) => setField('eventCommentPrefix', event.target.value),
					}),
				}),
				error === null ? null : h('p', {
					key: 'error', className: 'ytt-form-error', role: 'alert',
				}, error),
				h('div', { key: 'actions', className: 'ytt-dialog-actions' }, [
					h('button', {
						key: 'cancel', type: 'button', className: 'ytt-btn ytt-btn-ghost',
						disabled: saving, onClick: onClose, title: t('panel.cancelHint'),
					}, t('panel.cancel')),
					h('button', {
						key: 'save', type: 'button', className: 'ytt-btn ytt-btn-primary',
						disabled: saving, onClick: save, title: t('panel.settingsSave'),
					}, saving ? t('panel.saving') : t('panel.settingsSave')),
				]),
			] });
		}

		/**
		 * The "Events list" window: the calendar's events for the chosen date.
		 *
		 * It reads the date's events from the host's CalDAV route; rows show the
		 * event's clock, title, and the calendar (with the location when present).
		 * @param props - the locale helper, the date, the chosen event id, a pick
		 *   callback, and a close callback.
		 * @returns the events window.
		 */
		function EventsDialog({ t, date, chosenId, onPick, onClose }) {
			const [state, setState] = React.useState({ loading: true, events: [], failure: null });
			// The row the arrow keys highlight, as an index; null means none yet.
			const [active, setActive] = React.useState(null);
			const alive = React.useRef(true);
			const dialog = React.useRef(null);
			useFocusTrap(dialog);
			const list = React.useRef(null);

			/**
			 * Read the day's events, optionally bypassing the host cache.
			 * @param force - whether to ask the host for a fresh read.
			 */
			const load = (force) => {
				setState((current) => ({ ...current, loading: true }));
				fetchDayEvents(date, force).then(
					(events) => {
						if (alive.current) setState({ loading: false, events, failure: null });
					},
					(failure) => {
						if (alive.current) setState({ loading: false, events: [], failure });
					},
				);
			};

			React.useEffect(() => {
				alive.current = true;
				load(false);
				// The window takes the keyboard as soon as it opens, so the arrows
				// work without a click first.
				if (dialog.current !== null) dialog.current.focus();
				return () => { alive.current = false; };
			}, [date]);
			React.useEffect(() => {
				const onKeyDown = (event) => {
					if (event.key === 'Escape') onClose();
				};
				document.addEventListener('keydown', onKeyDown);
				return () => document.removeEventListener('keydown', onKeyDown);
			}, [onClose]);

			// A changed list invalidates the old highlight, and the highlighted row
			// stays visible inside the scrolling list.
			React.useEffect(() => {
				setActive(null);
			}, [state.events]);
			useActiveRowScroll(active, list);

			/**
			 * Arrow keys walk the events and Enter picks the highlighted one. Buttons
			 * and fields keep their own Enter behavior.
			 * @param event - the keydown event from anywhere inside the window.
			 */
			const onDialogKeyDown = (event) => {
				if (event.altKey || event.ctrlKey || event.metaKey) return;
				if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
					if (state.events.length === 0) return;
					event.preventDefault();
					if (event.target !== dialog.current && dialog.current !== null) dialog.current.focus();
					setActive((current) => {
						if (event.key === 'ArrowDown') {
							return current === null ? 0 : Math.min(current + 1, state.events.length - 1);
						}
						return current === null ? state.events.length - 1 : Math.max(current - 1, 0);
					});
					return;
				}
				if (event.key !== 'Enter' || active === null || state.events[active] === undefined) return;
				const target = event.target;
				const tag = target !== null && typeof target.tagName === 'string' ? target.tagName.toLowerCase() : '';
				if (tag === 'input' || tag === 'textarea' || tag === 'button' || tag === 'select') return;
				event.preventDefault();
				onPick(state.events[active]);
			};

			const body = [];
			if (state.loading && state.events.length === 0) {
				body.push(h('p', { key: 'reading', className: 'ytt-notice' }, t('panel.eventsReading')));
			} else if (state.failure !== null) {
				const detail = state.failure instanceof Error ? state.failure.message : String(state.failure);
				const unconfigured = state.failure !== null && typeof state.failure === 'object'
					&& state.failure.reason === 'calendar-unconfigured';
				body.push(h('p', { key: 'failed', className: 'ytt-notice ytt-notice-error' },
					unconfigured ? t('panel.eventsUnconfigured') : `${t('panel.eventsFailed')}: ${detail}`));
			} else if (state.events.length === 0) {
				body.push(h('p', { key: 'empty', className: 'ytt-notice' }, t('panel.eventsEmpty')));
			} else {
				body.push(h('ul', {
					key: 'list', ref: list, className: 'ytt-task-list', role: 'list',
					'aria-label': t('panel.eventsTitle'),
				}, state.events.map((event, index) => h('li', {
					key: event.id, 'data-index': index,
				}, h('button', {
					type: 'button', className: 'ytt-task',
					'data-chosen': event.id === chosenId ? 'true' : 'false',
					'data-active': active === index ? 'true' : 'false',
					'aria-current': event.id === chosenId || active === index ? 'true' : undefined,
					'data-testid': 'tracker-event',
					onClick: () => onPick(event),
				}, [
					h('span', { key: 'clock', className: 'ytt-task-key' }, event.clock),
					h('span', { key: 'title', className: 'ytt-task-summary' },
						event.title === '' ? '\u2014' : event.title),
					h('span', { key: 'meta', className: 'ytt-task-status' },
						[event.calendar, event.location].filter((part) => typeof part === 'string' && part !== '').join(' \u00b7 ')),
				])))));
			}

			return h('div', {
				className: 'ytt-backdrop ytt-backdrop-top',
				onMouseDown: (event) => { if (event.target === event.currentTarget) onClose(); },
			}, h('div', {
				ref: dialog, tabIndex: -1, onKeyDown: onDialogKeyDown,
				className: 'ytt-dialog ytt-dialog-wide', role: 'dialog', 'aria-modal': 'true',
				'aria-labelledby': 'ytt-events-title', 'data-testid': 'tracker-events-dialog',
			}, [
				h('div', { key: 'head', className: 'ytt-dialog-head' }, [
					h('div', { key: 'titles' }, [
						h('h2', { key: 'title', id: 'ytt-events-title' }, t('panel.eventsTitle')),
						h('p', { key: 'date', className: 'ytt-events-date' }, date),
					]),
					h('button', {
						key: 'refresh', type: 'button', className: 'ytt-refresh',
						title: t('panel.eventsRefreshHint'), 'aria-label': t('panel.eventsRefresh'),
						disabled: state.loading, onClick: () => load(true),
					}, h(RefreshIcon, { key: 'icon', spinning: state.loading })),
				]),
				...body,
				h('div', { key: 'actions', className: 'ytt-dialog-actions' }, h('button', {
					key: 'close', type: 'button', className: 'ytt-btn ytt-btn-ghost', onClick: onClose,
					title: t('panel.closeHint'),
				}, t('panel.close'))),
			]));
		}

		/**
		 * The "Adding time" panel: task, date, then Start/Duration/End, comment.
		 *
		 * It is a modal over the whole page rather than an inserted row, so the
		 * day's timeline stays visible beneath it and no scrolling is needed to
		 * reach the form. Escape and a click on the veil close it without saving.
		 * @param props - the locale helper, the date the form starts at (the day
		 *   the panel is showing), the two dates the form accepts, the default
		 *   queue that expands a digits-only key, the start of the day's last
		 *   unbooked stretch (or null), the working-day end, the default duration,
		 *   the calendar comment prefix, an optional preset for one gap row, a
		 *   close callback, and one fired after the host confirms the new worklog.
		 * @returns the modal element.
		 */
		function AddTimeDialog({
			t, date, today, yesterdayDate, defaultQueue, gapStart, workdayEnd,
			defaultDurationMinutes = DEFAULT_DEFAULT_DURATION_MINUTES,
			eventCommentPrefix = DEFAULT_EVENT_COMMENT_PREFIX,
			timeZone = '',
			preset, onClose, onAdded, onSettingsSaved,
		}) {
			const [key, setKey] = React.useState('');
			const [recordDate, setRecordDate] = React.useState(date);
			const [times, setTimes] = React.useState(() => (
				preset !== null && preset !== undefined
					&& typeof preset.start === 'number' && typeof preset.duration === 'number'
					&& preset.start >= 0 && preset.duration > 0
					? {
						start: preset.start,
						duration: preset.duration,
						end: (preset.start + preset.duration) % 1440,
					}
					: initialTimes(gapStart, workdayEnd, defaultDurationMinutes, zoneClock(timeZone).minutes)
			));
			const [comment, setComment] = React.useState('');
			const [error, setError] = React.useState(null);
			const [saving, setSaving] = React.useState(false);
			// The task behind the key field, for the name and status shown under it.
			const [taskInfo, setTaskInfo] = React.useState(null);
			// Whether the task picker is open over this dialog.
			const [picking, setPicking] = React.useState(false);
			// The selected calendar event, and whether the events window is open.
			const [calendarEvent, setCalendarEvent] = React.useState(null);
			const [eventsOpen, setEventsOpen] = React.useState(false);
			// The "When Duration changed" behavior and the duration ceiling, loaded
			// from the host settings.
			const [durationMode, setDurationMode] = React.useState(DEFAULT_DURATION_CHANGE);
			const [maxDurationHours, setMaxDurationHours] = React.useState(DEFAULT_MAX_DURATION_HOURS);
			const [tasksQuery, setTasksQuery] = React.useState(DEFAULT_TASKS_QUERY);
			// Whether the Adding time settings window is open over this dialog.
			const [settingsOpen, setSettingsOpen] = React.useState(false);
			// Whether the add-form settings arrived; a failure shows a retry in the
			// Adding time settings instead of saving defaults over the real ones.
			const [settingsLoaded, setSettingsLoaded] = React.useState(false);
			const [settingsError, setSettingsError] = React.useState(null);
			const alive = React.useRef(true);
			const keyInput = React.useRef(null);
			const calendarInput = React.useRef(null);
			const saveButton = React.useRef(null);
			const form = React.useRef(null);
			const dialog = React.useRef(null);
			useFocusTrap(dialog);
			const gearButton = React.useRef(null);
			// A sequence number invalidates an older key's in-flight lookup.
			const lookupSeq = React.useRef(0);

			// Read the add form settings once; the Adding time window offers a retry
			// when the read fails.
			const loadAddingSettings = React.useCallback(() => {
				let cancelled = false;
				fetchPluginSettings().then((result) => {
					if (cancelled) return;
					if (!result.ok) {
						setSettingsError(result.error);
						return;
					}
					setSettingsError(null);
					setSettingsLoaded(true);
					setDurationMode(result.settings.durationChange);
					setMaxDurationHours(result.settings.maxDurationHours);
					setTasksQuery(result.settings.tasksQuery);
				});
				return () => { cancelled = true; };
			}, []);
			React.useEffect(loadAddingSettings, [loadAddingSettings]);

			// A save in flight must not set state after the dialog is gone. The flag
			// is re-armed on mount because a strict-mode double mount would
			// otherwise leave it false for the live instance.
			React.useEffect(() => {
				alive.current = true;
				return () => { alive.current = false; };
			}, []);
			// The picker's own controls disappear when it closes; hand focus back to
			// the key field so Enter and Tab continue the form's usual flow.
			React.useEffect(() => {
				if (!picking && keyInput.current !== null) keyInput.current.focus();
			}, [picking]);

			// Read the task behind a complete key after a short pause, for the name
			// and status under the field. A newer key invalidates the older read.
			React.useEffect(() => {
				const seq = lookupSeq.current + 1;
				lookupSeq.current = seq;
				const cleaned = key.trim();
				if (!/^[A-Za-z][A-Za-z0-9]*-\d+$/u.test(cleaned)) {
					setTaskInfo(null);
					return undefined;
				}
				const timer = setTimeout(() => {
					fetchTask(cleaned).then(
						(task) => {
							if (alive.current && lookupSeq.current === seq) setTaskInfo(task);
						},
						() => {
							if (alive.current && lookupSeq.current === seq) setTaskInfo(null);
						},
					);
				}, 350);
				return () => clearTimeout(timer);
			}, [key]);

			/**
			 * Close the events window and hand focus back to the event field.
			 */
			const closeEvents = () => {
				setEventsOpen(false);
				window.requestAnimationFrame(() => {
					if (calendarInput.current !== null) calendarInput.current.focus();
				});
			};

			React.useEffect(() => {
				const onKeyDown = (event) => {
					// A save in flight is not abandoned by Escape: the host call
					// cannot be cancelled, so the dialog stays until it answers. The
					// picker and the events window have their own Escape handlers and
					// are closed first.
					if (event.key === 'Escape' && !saving && !picking && !eventsOpen && !settingsOpen) onClose();
				};
				document.addEventListener('keydown', onKeyDown);
				return () => document.removeEventListener('keydown', onKeyDown);
			}, [onClose, saving, picking, eventsOpen, settingsOpen]);

			/** Start moved: End follows from Start + Duration. */
			const changeStart = (value) => {
				setTimes((current) => ({
					...current,
					start: value,
					end: (value + current.duration) % 1440,
				}));
			};

			/**
			 * Duration moved. The "When Duration changed" setting decides the fixed
			 * side: Recalc End keeps Start and moves End; Recalc Start keeps End and
			 * moves Start.
			 */
			const changeDuration = (value) => {
				setTimes((current) => (
					durationMode === 'start'
						? { ...current, duration: value, start: (current.end - value + 1440) % 1440 }
						: { ...current, duration: value, end: (current.start + value) % 1440 }
				));
			};

			/** End moved: the duration becomes the distance from Start. */
			const changeEnd = (value) => {
				setTimes((current) => ({
					...current,
					end: value,
					duration: (value - current.start + 1440) % 1440,
				}));
			};

			const submit = async (event) => {
				event.preventDefault();
				if (saving) return;
				// A key made only of digits is expanded with the configured queue, so
				// the user can just type the issue number.
				let taskKey = key.trim();
				if (/^\d+$/u.test(taskKey)) {
					if (defaultQueue === '') {
						setError(t('panel.addQueueMissing'));
						return;
					}
					taskKey = `${defaultQueue}-${taskKey}`;
					setKey(taskKey);
				}
				if (taskKey === '') {
					setError(t('panel.addKeyRequired'));
					return;
				}
				if (recordDate === '') {
					setError(t('panel.addDateRequired'));
					return;
				}
				if (recordDate !== today && recordDate !== yesterdayDate) {
					setError(t('panel.addDateInvalid'));
					return;
				}
				// A worklog cannot start in the future. The comparison uses the
				// panel's zone, the same one the host validates the record in.
				const zone = zoneClock(timeZone);
				const startIsPast = recordDate < zone.date
					|| (recordDate === zone.date && times.start <= zone.minutes);
				if (!startIsPast) {
					setError(t('panel.addStartFuture'));
					return;
				}
				if (times.duration <= 0) {
					setError(t('panel.addDurationRequired'));
					return;
				}
				if (times.duration % TIME_STEP_MINUTES !== 0) {
					setError(t('panel.addDurationStep'));
					return;
				}
				if (times.duration > maxDurationHours * 60) {
					setError(t('panel.addDurationMax', { hours: maxDurationHours }));
					return;
				}
				if (comment.trim() === '') {
					setError(t('panel.addCommentRequired'));
					return;
				}
				setError(null);
				setSaving(true);
				// The task's status is the one check that cannot be made from the form
				// alone, so the fresh task is read right before the write.
				let task;
				try {
					task = await fetchTask(taskKey);
				} catch (failure) {
					setSaving(false);
					setError(`${t('panel.addTaskFailed')}: ${failure instanceof Error ? failure.message : String(failure)}`);
					return;
				}
				if (isClosedStatus(task.status, task.statusKey)) {
					setSaving(false);
					setError(t('panel.addTaskClosed'));
					return;
				}
				postWorklog({
					key: taskKey,
					// The worklog starts on the chosen date at the chosen clock time;
					// the host turns that wall time into a zone-bearing timestamp.
					start: `${recordDate}T${formatClock(times.start)}`,
					spent: formatDuration(times.duration),
					comment: comment.trim(),
				})
					.then(() => {
						if (!alive.current) return;
						setSaving(false);
						onAdded();
					})
					.catch((failure) => {
						if (!alive.current) return;
						setSaving(false);
						if (failure !== null && typeof failure === 'object' && failure.restart === true) {
							setError(t('panel.hostRestart'));
							return;
						}
						const detail = failure instanceof Error ? failure.message : String(failure);
						setError(`${t('panel.addFailed')}: ${detail}`);
					});
			};

			/**
			 * One labelled field, so every input carries the same label placement.
			 * @param id - the input's id and the label's target.
			 * @param label - the visible label text.
			 * @param input - the input element.
			 * @param hint - optional examples shown under the input.
			 * @returns the field block.
			 */
			const field = (id, label, input, hint) => h('div', { key: id, className: 'ytt-field' },
				h('label', { key: 'label', className: 'ytt-field-label', htmlFor: id }, label),
				input,
				hint === undefined ? null : h('span', { key: 'hint', className: 'ytt-field-hint' }, hint),
			);

			// Ending the work at an arbitrary time makes a duration no preset
			// offers, so the selector takes an extra option for that value.
			const durationOptions = DURATION_PRESETS.includes(times.duration)
				? DURATION_PRESETS
				: [...DURATION_PRESETS, times.duration].sort((left, right) => left - right);

			return h('div', {
				className: 'ytt-backdrop',
				onMouseDown: (event) => { if (event.target === event.currentTarget && !saving) onClose(); },
			}, [
				h('div', {
					key: 'dialog', ref: dialog, className: 'ytt-dialog', role: 'dialog', 'aria-modal': 'true',
					'aria-labelledby': 'ytt-add-title', 'data-testid': 'tracker-add-dialog',
				}, [
					h('div', { key: 'head', className: 'ytt-dialog-head' }, [
						h('h2', { key: 'title', id: 'ytt-add-title' }, t('panel.addingTime')),
						h('button', {
							key: 'settings', ref: gearButton, type: 'button', className: 'ytt-head-settings',
							disabled: saving, title: t('panel.addingSettings'),
							'aria-label': t('panel.addingSettings'),
							onClick: () => setSettingsOpen(true),
						}, h(GearIcon, { key: 'icon' })),
					]),
					h('form', { key: 'form', ref: form, className: 'ytt-form', onSubmit: submit }, [
						h('div', { key: 'key-field', className: 'ytt-field' }, [
							h('label', { key: 'label', className: 'ytt-field-label', htmlFor: 'ytt-add-key' },
								t('panel.taskKey')),
							h('div', { key: 'box', className: 'ytt-task-box' }, [
								h('div', { key: 'row', className: 'ytt-input-wrap' }, [
									h('input', {
										key: 'input', ref: keyInput, id: 'ytt-add-key', className: 'ytt-input', type: 'text',
										value: key, autoFocus: true, disabled: saving, spellCheck: false,
										autoComplete: 'off', placeholder: t('panel.taskKeyPlaceholder'),
										onChange: (event) => setKey(event.target.value),
										onKeyDown: (event) => {
											if (event.key === 'ArrowDown') {
												// The picker button is out of the tab order; Down stands in.
												event.preventDefault();
												setPicking(true);
												return;
											}
											if (event.key === 'Enter') {
												// The first field leads to the event picker's field, not
												// straight to the clock.
												event.preventDefault();
												const calendarField = document.getElementById('ytt-add-calendar');
												if (calendarField !== null) calendarField.focus();
												return;
											}
											if (event.key === 'Tab' && event.shiftKey) {
												// The form loops: Shift+Tab from the first field reaches
												// the last control, mirroring Tab from it.
												event.preventDefault();
												if (saveButton.current !== null) saveButton.current.focus();
											}
										},
										onBlur: () => {
											// A number-only key becomes the full default-queue key as
											// soon as the field is left, so the user sees it.
											const current = key.trim();
											if (defaultQueue !== '' && /^\d+$/u.test(current)) {
												setKey(`${defaultQueue}-${current}`);
											}
										},
									}),
									h('button', {
										key: 'pick', type: 'button', className: 'ytt-pick', disabled: saving,
										tabIndex: -1,
										title: t('panel.pickTaskHint'), 'aria-label': t('panel.pickTask'),
										'data-testid': 'tracker-pick-task',
										onClick: () => setPicking(true),
									}, h('span', { key: 'dots', className: 'ytt-pick-dots', 'aria-hidden': 'true' }, '...')),
								]),
								taskInfo === null ? null : h(TaskCard, { key: 'details', t, task: taskInfo }),
							]),
						]),
						field('ytt-add-calendar', t('panel.calendarEvent'), h('div', { className: 'ytt-input-wrap' }, [
							h('input', {
								key: 'input', ref: calendarInput, id: 'ytt-add-calendar', className: 'ytt-input',
								type: 'text', readOnly: true, value: calendarEvent === null ? '' : calendarEvent.title,
								disabled: saving, placeholder: t('panel.calendarEventPlaceholder'),
								title: t('panel.calendarEventHint'),
								onClick: () => setEventsOpen(true),
								onKeyDown: (event) => {
									if (event.key === 'ArrowDown') {
										event.preventDefault();
										setEventsOpen(true);
										return;
									}
									if (event.key !== 'Enter') return;
									event.preventDefault();
									// With a picked event and the clock and comment already in
									// place, Enter adds the worklog; otherwise it moves on to
									// Duration so the remaining fields can be filled.
									const ready = calendarEvent !== null
										&& typeof times.start === 'number'
										&& times.duration > 0
										&& comment.trim() !== '';
									if (!ready) {
										const durationField = document.getElementById('ytt-add-duration');
										if (durationField !== null) durationField.focus();
										return;
									}
									if (form.current !== null && typeof form.current.requestSubmit === 'function') {
										form.current.requestSubmit();
									} else {
										submit({ preventDefault: () => {} });
									}
								},
							}),
							h('button', {
								key: 'pick', type: 'button', className: 'ytt-pick', disabled: saving,
								tabIndex: -1, title: t('panel.calendarEventHint'),
								'aria-label': t('panel.calendarEvent'),
								'data-testid': 'tracker-pick-event',
								onClick: () => setEventsOpen(true),
							}, h('span', { key: 'dots', className: 'ytt-pick-dots', 'aria-hidden': 'true' }, '...')),
						])),
					field('ytt-add-date', t('panel.date'), h('input', {
						id: 'ytt-add-date', className: 'ytt-input', type: 'date',
						value: recordDate, disabled: saving, title: t('panel.dateHint'),
						onChange: (event) => {
							setRecordDate(event.target.value);
							// An event belongs to the date it was read for.
							setCalendarEvent(null);
						},
						onKeyDown: (event) => {
							if (event.key === 'ArrowDown') {
								event.preventDefault();
								const field = event.currentTarget;
								if (typeof field.showPicker === 'function') {
									try {
										field.showPicker();
									} catch {
										// The browser refused the picker; the field still works.
									}
								}
								return;
							}
							if (event.key === 'Tab') {
								// A date input turns Tab into segment navigation; step to
								// the adjacent field instead of the next date part.
								event.preventDefault();
								const next = document.getElementById(event.shiftKey ? 'ytt-add-calendar' : 'ytt-add-start');
								if (next !== null) next.focus();
							}
						},
					})),
					// Start, Duration and End share one row: the duration is the
					// difference between the two clocks, and each control keeps the
					// other two consistent when it moves. Each takes typed digits or
					// a choice from its preset list.
					h('div', { key: 'times', className: 'ytt-fields-row' }, [
						h(ClockCombo, {
							key: 'start', id: 'ytt-add-start', label: t('panel.start'),
							value: times.start, options: TIME_OPTIONS, format: formatClock,
							onChange: changeStart, disabled: saving,
						}),
						h(ClockCombo, {
							key: 'duration', id: 'ytt-add-duration', label: t('panel.duration'),
							value: times.duration, options: durationOptions, format: formatDuration,
							mask: 'duration', onChange: changeDuration, disabled: saving,
							onEnter: () => {
								// Enter after the duration moves on to the comment.
								const commentField = document.getElementById('ytt-add-comment');
								if (commentField !== null) commentField.focus();
							},
						}),
						h(ClockCombo, {
							key: 'end', id: 'ytt-add-end', label: t('panel.end'),
							value: times.end, options: TIME_OPTIONS, format: formatClock,
							onChange: changeEnd, disabled: saving,
						}),
					]),
					field('ytt-add-comment', t('panel.comment'), h('textarea', {
						id: 'ytt-add-comment', className: 'ytt-textarea', rows: 3,
						value: comment, disabled: saving, maxLength: 2000,
						placeholder: t('panel.commentPlaceholder'),
						onChange: (event) => setComment(event.target.value),
						onKeyDown: (event) => {
							// Enter submits the form; Shift+Enter keeps inserting a line.
							if (event.key !== 'Enter' || event.shiftKey) return;
							event.preventDefault();
							submit(event);
						},
					})),
					error === null ? null : h('p', {
						key: 'error', className: 'ytt-form-error', role: 'alert',
					}, error),
					h('div', { key: 'actions', className: 'ytt-dialog-actions' }, [
						h('button', {
							key: 'cancel', type: 'button', className: 'ytt-btn ytt-btn-ghost',
							disabled: saving, onClick: onClose, title: t('panel.cancelHint'),
						}, t('panel.cancel')),
						h('button', {
							key: 'save', ref: saveButton, type: 'submit', className: 'ytt-btn ytt-btn-primary',
							disabled: saving, title: t('panel.saveHint'),
							onKeyDown: (event) => {
								if (event.key !== 'Tab' || event.shiftKey) return;
								// Tab past the last control wraps back to the first field.
								event.preventDefault();
								if (keyInput.current !== null) keyInput.current.focus();
							},
						}, saving ? t('panel.saving') : t('panel.save')),
					]),
				]),
				picking
					? h(TaskPickerDialog, {
						key: 'picker', t, chosenKey: key,
						onPick: (picked) => { setKey(picked); setPicking(false); },
						onClose: () => setPicking(false),
					})
					: null,
				eventsOpen
					? h(EventsDialog, {
						key: 'events', t, date: recordDate,
						chosenId: calendarEvent === null ? '' : calendarEvent.id,
						onPick: (event) => {
							setCalendarEvent(event);
							// A timed meeting fills the clock and the comment; an all-day
							// event has no clock to copy.
							if (!event.allDay
								&& typeof event.startMinutes === 'number'
								&& typeof event.durationMinutes === 'number'
								&& event.durationMinutes > 0) {
								setTimes({
									start: event.startMinutes,
									duration: event.durationMinutes,
									end: (event.startMinutes + event.durationMinutes) % 1440,
								});
							}
							if (typeof event.title === 'string' && event.title !== '') {
								setComment(`${eventCommentPrefix}${event.title}`);
							}
							closeEvents();
						},
						onClose: closeEvents,
					})
					: null,
				settingsOpen
					? h(AddingSettingsDialog, {
						key: 'adding-settings', t,
						settings: settingsLoaded ? {
							durationChange: durationMode,
							maxDurationHours,
							defaultQueue,
							defaultDurationMinutes,
							eventCommentPrefix,
							tasksQuery,
						} : null,
						loadError: settingsError,
						onRetry: loadAddingSettings,
						onSave: (payload) => savePluginSettings(payload).then(({ settings: stored }) => {
							setDurationMode(stored.durationChange === 'start' ? 'start' : 'end');
							setMaxDurationHours(stored.maxDurationHours);
							setTasksQuery(stored.tasksQuery ?? DEFAULT_TASKS_QUERY);
							setSettingsOpen(false);
							if (typeof onSettingsSaved === 'function') onSettingsSaved();
						}),
						onClose: () => {
							setSettingsOpen(false);
							window.requestAnimationFrame(() => {
								if (gearButton.current !== null) gearButton.current.focus();
							});
						},
					})
					: null,
				]),
			]);
		}

		/**
		 * The "Your current tasks" picker the key field's "..." button opens.
		 *
		 * The first row is always the user's pinned teamwork task: a title and a
		 * key input while nothing is pinned, then the ordinary key/title/status
		 * lines once a key has been entered. The rest of the account's open issues
		 * follows, each row stacked the way the panel stacks worklogs. Picking a
		 * row hands its key back to the form.
		 * @param props - the locale helper, the key already in the form, a pick
		 *   callback, and a close callback.
		 * @returns the picker element.
		 */
		function TaskPickerDialog({ t, chosenKey, onPick, onClose }) {
			const [state, setState] = React.useState({ loading: true, tasks: [], failure: null });
			const [teamwork, setTeamwork] = React.useState(readTeamwork);
			const [draft, setDraft] = React.useState('');
			const [teamworkError, setTeamworkError] = React.useState(null);
			const [teamworkSaving, setTeamworkSaving] = React.useState(false);
			// The row the arrow keys highlight, as an index into the selectable
			// tasks; null means nothing is highlighted yet.
			const [active, setActive] = React.useState(null);
			const alive = React.useRef(true);
			const dialog = React.useRef(null);
			useFocusTrap(dialog);
			const list = React.useRef(null);
			const teamworkInput = React.useRef(null);
			// The browser value this opening started with, read once: it is the
			// fallback and the one-time migration source for an older value.
			const browserTeamwork = React.useRef(teamwork);

			/** The keys the arrow keys walk: the pinned task first, then the list. */
			const pickable = [];
			if (teamwork !== null) pickable.push(teamwork.key);
			for (const task of state.tasks) pickable.push(task.key);

			// A changed list invalidates the old highlight.
			React.useEffect(() => {
				setActive(null);
			}, [state.tasks, teamwork]);

			// Keep the highlighted row visible inside the scrolling list.
			useActiveRowScroll(active, list);

			React.useEffect(() => {
				alive.current = true;
				// The key input takes the focus when the pinned task is empty; the
				// dialog itself takes it otherwise.
				if (teamworkInput.current !== null) teamworkInput.current.focus();
				else if (dialog.current !== null) dialog.current.focus();
				fetchTasks().then(
					(tasks) => {
						if (alive.current) setState({ loading: false, tasks, failure: null });
					},
					(failure) => {
						if (alive.current) setState({ loading: false, tasks: [], failure });
					},
				);
				(async () => {
					// The host's durable store wins when it holds a task; a task that
					// exists only in this browser is migrated into it once. Without a
					// usable store the browser value still stands for this opening.
					let effective = browserTeamwork.current;
					try {
						const stored = await fetchStoredTeamwork();
						if (stored !== null) effective = stored;
						else if (browserTeamwork.current !== null) {
							saveStoredTeamwork(browserTeamwork.current).catch(() => {});
						}
					} catch {
						// Storage is unavailable; the browser value is the best known.
					}
					if (!alive.current || effective === null) return;
					try {
						const fresh = await fetchTask(effective.key);
						if (!alive.current) return;
						if (isClosedStatus(fresh.status, fresh.statusKey)) {
							// A closed task is no longer the teamwork task to book against.
							writeTeamwork(null);
							setDraft('');
							setTeamworkError(null);
							await clearStoredTeamwork().catch(() => {});
							if (alive.current) setTeamwork(null);
							return;
						}
						setTeamwork(fresh);
						writeTeamwork(fresh);
						saveStoredTeamwork(fresh).catch(() => {});
					} catch {
						// The details cannot be refreshed; the remembered row stands.
						if (alive.current) setTeamwork(effective);
					}
				})();
				return () => { alive.current = false; };
			}, []);
			// Once the pinned task is cleared, the key input replaces it and should
			// take the focus.
			React.useEffect(() => {
				if (teamwork === null && teamworkInput.current !== null) teamworkInput.current.focus();
			}, [teamwork]);
			React.useEffect(() => {
				const onKeyDown = (event) => {
					if (event.key === 'Escape') onClose();
				};
				document.addEventListener('keydown', onKeyDown);
				return () => document.removeEventListener('keydown', onKeyDown);
			}, [onClose]);

			/**
			 * Arrow keys walk the tasks and Enter picks the highlighted one. Text
			 * fields and buttons keep their own Enter behaviour.
			 * @param event - the keydown event from anywhere inside the dialog.
			 */
			const onDialogKeyDown = (event) => {
				if (event.altKey || event.ctrlKey || event.metaKey) return;
				if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
					if (pickable.length === 0) return;
					event.preventDefault();
					// Navigation lives on the dialog, so a focused field or button
					// cannot swallow the next Enter.
					if (event.target !== dialog.current && dialog.current !== null) dialog.current.focus();
					setActive((current) => {
						if (event.key === 'ArrowDown') {
							return current === null ? 0 : Math.min(current + 1, pickable.length - 1);
						}
						return current === null ? pickable.length - 1 : Math.max(current - 1, 0);
					});
					return;
				}
				if (event.key !== 'Enter' || active === null || pickable[active] === undefined) return;
				const target = event.target;
				const tag = target !== null && typeof target.tagName === 'string' ? target.tagName.toLowerCase() : '';
				if (tag === 'input' || tag === 'textarea' || tag === 'button') return;
				event.preventDefault();
				onPick(pickable[active]);
			};

			const saveTeamwork = () => {
				if (teamworkSaving) return;
				const key = draft.trim();
				if (key === '') return;
				setTeamworkError(null);
				setTeamworkSaving(true);
				fetchTask(key).then(
					(task) => saveStoredTeamwork(task).then(
						() => {
							if (!alive.current) return;
							setTeamworkSaving(false);
							setTeamwork(task);
							writeTeamwork(task);
							setDraft('');
						},
						(failure) => {
							if (!alive.current) return;
							setTeamworkSaving(false);
							const detail = failure instanceof Error ? failure.message : String(failure);
							setTeamworkError(`${t('panel.teamworkSaveFailed')}: ${detail}`);
						},
					),
					(failure) => {
						if (!alive.current) return;
						setTeamworkSaving(false);
						const detail = failure instanceof Error ? failure.message : String(failure);
						setTeamworkError(`${t('panel.teamworkFailed')}: ${detail}`);
					},
				);
			};

			const clearTeamwork = () => {
				setTeamworkError(null);
				clearStoredTeamwork().then(
					() => {
						if (!alive.current) return;
						setTeamwork(null);
						writeTeamwork(null);
						setDraft('');
					},
					(failure) => {
						if (!alive.current) return;
						// The row is cleared here so the user is not stuck with it; the
						// error says why the durable copy may still return.
						setTeamwork(null);
						writeTeamwork(null);
						setDraft('');
						const detail = failure instanceof Error ? failure.message : String(failure);
						setTeamworkError(`${t('panel.teamworkClearFailed')}: ${detail}`);
					},
				);
			};

			const pinned = h('li', { key: 'teamwork', 'data-index': teamwork === null ? undefined : 0 }, teamwork === null
				? h('div', { className: 'ytt-teamwork' }, [
					h('p', { key: 'title', className: 'ytt-teamwork-title' }, t('panel.teamworkTask')),
					h('input', {
						key: 'input', ref: teamworkInput, className: 'ytt-input', type: 'text',
						value: draft, disabled: teamworkSaving, spellCheck: false, autoComplete: 'off',
						placeholder: t('panel.taskKeyPlaceholder'), 'aria-label': t('panel.teamworkTask'),
						onChange: (event) => setDraft(event.target.value),
						onKeyDown: (event) => {
							if (event.key !== 'Enter') return;
							event.preventDefault();
							saveTeamwork();
						},
					}),
					teamworkError === null ? null : h('p', {
						key: 'error', className: 'ytt-form-error', role: 'alert',
					}, teamworkError),
				])
				: h('div', {
					className: 'ytt-teamwork ytt-teamwork-selected',
					'data-active': active === 0 ? 'true' : 'false',
				}, [
					h('button', {
						key: 'pick', type: 'button', className: 'ytt-teamwork-pick',
						'data-testid': 'tracker-teamwork-task',
						'aria-current': teamwork.key === chosenKey || active === 0 ? 'true' : undefined,
						onClick: () => onPick(teamwork.key),
					}, [
						h('span', { key: 'key', className: 'ytt-task-key' }, teamwork.key),
						h('span', { key: 'summary', className: 'ytt-task-summary' },
							teamwork.summary === '' ? '\u2014' : teamwork.summary),
						h('span', { key: 'status', className: 'ytt-task-status' }, teamwork.status),
					]),
					h('button', {
						key: 'change', type: 'button', className: 'ytt-teamwork-change',
						title: t('panel.changeTeamworkTask'), 'aria-label': t('panel.changeTeamworkTask'),
						onClick: clearTeamwork,
					}, '\u00d7'),
				]));

			const body = [];
			if (state.loading) {
				body.push(h('p', { key: 'reading', className: 'ytt-notice' }, t('panel.tasksReading')));
			} else if (state.failure !== null) {
				const detail = state.failure instanceof Error ? state.failure.message : String(state.failure);
				body.push(h('p', { key: 'failed', className: 'ytt-notice ytt-notice-error' },
					`${t('panel.tasksFailed')}: ${detail}`));
			} else if (state.tasks.length === 0) {
				body.push(h('div', { key: 'empty' }, [
					h('p', { key: 'a', className: 'ytt-notice' }, t('panel.tasksEmpty')),
					h('p', { key: 'b', className: 'ytt-notice' }, t('panel.tasksEmptyHint')),
				]));
			}
			body.push(h('ul', {
				key: 'list', ref: list, className: 'ytt-task-list', role: 'list',
				'aria-label': t('panel.currentTasks'),
			}, [
				pinned,
				...state.tasks.map((row, index) => {
					const itemIndex = index + (teamwork === null ? 0 : 1);
					return h('li', { key: row.key, 'data-index': itemIndex }, h('button', {
						type: 'button', className: 'ytt-task',
						'data-chosen': row.key === chosenKey ? 'true' : 'false',
						'data-active': active === itemIndex ? 'true' : 'false',
						'aria-current': row.key === chosenKey || active === itemIndex ? 'true' : undefined,
						'data-testid': 'tracker-task',
						onClick: () => onPick(row.key),
					}, [
						h('span', { key: 'key', className: 'ytt-task-key' }, row.key),
						h('span', { key: 'summary', className: 'ytt-task-summary' },
							row.summary === '' ? '\u2014' : row.summary),
						h('span', { key: 'status', className: 'ytt-task-status' }, row.status),
					]));
				}),
			]));

			return h('div', {
				className: 'ytt-backdrop ytt-backdrop-top',
				onMouseDown: (event) => { if (event.target === event.currentTarget) onClose(); },
			}, h('div', {
				ref: dialog, tabIndex: -1, onKeyDown: onDialogKeyDown,
				className: 'ytt-dialog ytt-dialog-wide', role: 'dialog', 'aria-modal': 'true',
				'aria-labelledby': 'ytt-tasks-title', 'data-testid': 'tracker-tasks-dialog',
			}, [
				h('h2', { key: 'title', id: 'ytt-tasks-title' }, t('panel.currentTasks')),
				...body,
				h('div', { key: 'actions', className: 'ytt-dialog-actions' }, h('button', {
					key: 'close', type: 'button', className: 'ytt-btn ytt-btn-ghost', onClick: onClose,
					title: t('panel.closeHint'),
				}, t('panel.close'))),
			]));
		}

		/**
		 * The confirmation the row's delete control opens.
		 *
		 * Deleting is irreversible, so the row's icon only asks the question; the
		 * modal names the record and offers Cancel beside the destructive action.
		 * @param props - the locale helper, the row being removed, a close
		 *   callback, and one fired after the host confirms the deletion.
		 * @returns the modal element.
		 */
		function DeleteTimeDialog({ t, row, onClose, onDeleted }) {
			const [error, setError] = React.useState(null);
			const [saving, setSaving] = React.useState(false);
			const alive = React.useRef(true);

			React.useEffect(() => {
				alive.current = true;
				return () => { alive.current = false; };
			}, []);
			React.useEffect(() => {
				const onKeyDown = (event) => {
					// A delete in flight is not abandoned by Escape: the dialog must
					// stay long enough to report its outcome.
					if (event.key === 'Escape' && !saving) onClose();
				};
				document.addEventListener('keydown', onKeyDown);
				return () => document.removeEventListener('keydown', onKeyDown);
			}, [onClose, saving]);

			const submit = (event) => {
				event.preventDefault();
				if (saving) return;
				setError(null);
				setSaving(true);
				requestDelete({ key: row.issueKey, id: row.id })
					.then(() => {
						if (!alive.current) return;
						setSaving(false);
						onDeleted();
					})
					.catch((failure) => {
						if (!alive.current) return;
						setSaving(false);
						if (failure !== null && typeof failure === 'object' && failure.restart === true) {
							setError(t('panel.hostRestart'));
							return;
						}
						const detail = failure instanceof Error ? failure.message : String(failure);
						setError(`${t('panel.deleteFailed')}: ${detail}`);
					});
			};

			return h('div', {
				className: 'ytt-backdrop',
				onMouseDown: (event) => { if (event.target === event.currentTarget && !saving) onClose(); },
			}, h('div', {
				className: 'ytt-dialog', role: 'dialog', 'aria-modal': 'true',
				'aria-labelledby': 'ytt-delete-title', 'data-testid': 'tracker-delete-dialog',
			}, [
				h('h2', { key: 'title', id: 'ytt-delete-title' }, t('panel.deleteTitle')),
				h('p', { key: 'text', className: 'ytt-dialog-text' },
					t('panel.deleteQuestion', { hours: row.hours, key: row.issueKey })),
				h('form', { key: 'form', className: 'ytt-form', onSubmit: submit }, [
					error === null ? null : h('p', {
						key: 'error', className: 'ytt-form-error', role: 'alert',
					}, error),
					h('div', { key: 'actions', className: 'ytt-dialog-actions' }, [
						h('button', {
							key: 'cancel', type: 'button', className: 'ytt-btn ytt-btn-ghost',
							disabled: saving, onClick: onClose, autoFocus: true,
							title: t('panel.cancelHint'),
						}, t('panel.cancel')),
						h('button', {
							key: 'delete', type: 'submit', className: 'ytt-btn ytt-btn-danger',
							disabled: saving,
						}, saving ? t('panel.deleting') : t('panel.delete')),
					]),
				]),
			]));
		}

		/** One worklog line: clock, issue link, comment, duration and delete. */
		function WorklogRow({ row, t, onDelete, pending, locked }) {
			// A row without its issue key or id cannot be addressed for deletion, so
			// it carries no delete control instead of one that always fails.
			const deletable = row.issueKey !== '' && row.id !== '';
			return h('li', {
				className: 'ytt-row',
				'data-pending': pending === true ? 'true' : 'false',
			}, [
				h('span', { key: 'time', className: 'ytt-row-time' }, timeRangeOf(row)),
				h('div', { key: 'body', className: 'ytt-row-body' }, [
					h('a', {
						key: 'key', className: 'ytt-row-key', href: row.issueUrl,
						target: '_blank', rel: 'noopener noreferrer',
					}, row.issueKey === '' ? 'Tracker' : row.issueKey),
					row.comment === '' ? null : h('span', { key: 'comment', className: 'ytt-row-comment' }, row.comment),
					row.issueDisplay === '' || row.issueDisplay === row.issueKey
						? null
						: h('span', { key: 'title', className: 'ytt-row-title' }, row.issueDisplay),
				]),
				h('span', { key: 'hours', className: 'ytt-row-hours' }, row.hours),
				pending === true
					? h('span', { key: 'pending', className: 'ytt-row-pending' }, t('panel.deletingRow'))
					: deletable
						? h('button', {
							key: 'delete', type: 'button', className: 'ytt-row-delete',
							title: t('panel.deleteHint'), 'aria-label': t('panel.deleteHint'),
							disabled: locked === true,
							'data-testid': 'tracker-delete', onClick: () => onDelete(row),
						}, h(TrashIcon, { key: 'icon' }))
						: null,
			]);
		}

		/**
		 * The panel the rail row opens: a plate per day, then one row per worklog.
		 * @param props - the locale helper injected by the slot registration.
		 * @returns the panel element.
		 */
		function TrackerTodayPage({ t }) {
			const { summary, failure, loading, load } = useSummary();
			// Which day the list below the plates shows. Today is the default, and a
			// day the payload has no rows for falls back to today rather than
			// rendering an empty list under a plate that names a real total.
			const [day, setDay] = React.useState('today');
			// The header clock: the local date and time, refreshed on the minute.
			const [now, setNow] = React.useState(() => new Date());
			React.useEffect(() => {
				let timer = null;
				const schedule = () => {
					const delay = 60000 - (Date.now() % 60000);
					timer = setTimeout(() => {
						setNow(new Date());
						schedule();
					}, delay + 50);
				};
				schedule();
				return () => {
					if (timer !== null) clearTimeout(timer);
				};
			}, []);
			// Whether the small "Adding time" panel is open over the page.
			const [adding, setAdding] = React.useState(false);
			// The gap row whose "+ Add" opened the form, or null for the usual form.
			const [gapPreset, setGapPreset] = React.useState(null);
			// The worklog row whose deletion is being confirmed, or null.
			const [deletingRow, setDeletingRow] = React.useState(null);
			// The panel settings: runtime preferences plus the queue and connection
			// defaults shown in the settings window.
			const [settings, setSettings] = React.useState(null);
			const [connection, setConnection] = React.useState(null);
			const [settingsOpen, setSettingsOpen] = React.useState(false);
			// The pending post-write read, so a second write inside the wait
			// replaces the first instead of stacking reads.
			const refreshTimer = React.useRef(null);
			// The header gear, so closing the settings window can return its focus.
			const settingsButton = React.useRef(null);
			// A newer wait supersedes an older read; only the newest may clear the
			// strip when its read settles.
			// A newer refresh invalidates older reads so only the newest clears
			// the strip.
			const refreshGate = React.useRef(null);
			if (refreshGate.current === null) refreshGate.current = createRefreshGate();
			// The post-write staleness: null while the list is current, else the
			// wait phase, its deadline, and the row a confirmed deletion removed.
			const [stale, setStale] = React.useState(null);
			const [staleSeconds, setStaleSeconds] = React.useState(0);
			React.useEffect(() => () => {
				if (refreshTimer.current !== null) clearTimeout(refreshTimer.current);
			}, []);

			// The countdown the strip shows while the read is still delayed.
			React.useEffect(() => {
				if (stale === null || stale.phase !== 'waiting') return undefined;
				const tick = () => setStaleSeconds(Math.max(0, Math.ceil((stale.deadline - Date.now()) / 1000)));
				tick();
				const id = setInterval(tick, 250);
				return () => clearInterval(id);
			}, [stale]);

			// Read the panel settings once. A failed read is kept as an error so the
			// settings window can offer a retry instead of showing defaults.
			const [settingsError, setSettingsError] = React.useState(null);
			const loadSettings = React.useCallback(() => {
				let cancelled = false;
				fetchPluginSettings().then((result) => {
					if (cancelled) return;
					if (!result.ok) {
						setSettingsError(result.error);
						setSettings(null);
						setConnection(null);
						return;
					}
					setSettingsError(null);
					setSettings(result.settings);
					setConnection(result.connection);
					summaryStore.setPollInterval(result.settings.pollIntervalMinutes * 60000);
				});
				return () => { cancelled = true; };
			}, []);
			React.useEffect(loadSettings, [loadSettings]);

			/**
			 * Re-read the list after a write, once Tracker has had a moment to
			 * reflect it. A newer write restarts the wait.
			 * @param deletedId - the worklog a confirmed deletion removed, so its
			 *   row can be marked while the read is pending.
			 */
			const scheduleRefresh = (deletedId = null) => {
				const generation = refreshGate.current.next();
				if (refreshTimer.current !== null) clearTimeout(refreshTimer.current);
				const delaySeconds = settings?.refreshDelaySeconds ?? DEFAULT_REFRESH_DELAY_SECONDS;
				const deadline = Date.now() + delaySeconds * 1000;
				setStale({ phase: 'waiting', deadline, deletedId });
				setStaleSeconds(delaySeconds);
				refreshTimer.current = setTimeout(() => {
					refreshTimer.current = null;
					if (!refreshGate.current.isCurrent(generation)) return;
					setStale((current) => (current === null ? current : { ...current, phase: 'refreshing' }));
					Promise.resolve(load(true)).then(() => {
						if (!refreshGate.current.isCurrent(generation)) return;
						setStale(null);
						setStaleSeconds(0);
					});
				}, delaySeconds * 1000);
			};

			/**
			 * Refresh right now: the header's Refresh button also ends a pending
			 * post-write wait instead of leaving the strip behind.
			 */
			const refreshNow = () => {
				const generation = refreshGate.current.next();
				if (refreshTimer.current !== null) {
					clearTimeout(refreshTimer.current);
					refreshTimer.current = null;
				}
				if (stale !== null) {
					setStale((current) => (current === null ? current : { ...current, phase: 'refreshing' }));
					Promise.resolve(load(true)).then(() => {
						if (!refreshGate.current.isCurrent(generation)) return;
						setStale(null);
						setStaleSeconds(0);
					});
					return;
				}
				if (!loading) load(true);
			};

			/**
			 * Persist the settings window's draft, apply it, and re-read the list so
			 * the queue, zone and working-day defaults take effect at once.
			 * @param payload - the settings fields to save.
			 * @returns a promise settling when the save and the read finish.
			 */
			const saveSettings = (payload) => savePluginSettings(payload).then(({ settings: stored, connection: nextConnection }) => {
				setSettings((current) => ({ ...(current ?? {}), ...stored }));
				if (nextConnection !== null) setConnection(nextConnection);
				if (Number.isInteger(stored?.pollIntervalMinutes)) {
					summaryStore.setPollInterval(stored.pollIntervalMinutes * 60000);
				}
				setSettingsOpen(false);
				return load(true);
			});

			// Ctrl+Insert opens the add form from anywhere in the panel, but not
			// while another dialog is already covering it.
			React.useEffect(() => {
				const onKeyDown = (event) => {
					if (event.key !== 'Insert' || !event.ctrlKey) return;
					if (adding || deletingRow !== null || settingsOpen) return;
					event.preventDefault();
					setGapPreset(null);
					setAdding(true);
				};
				document.addEventListener('keydown', onKeyDown);
				return () => document.removeEventListener('keydown', onKeyDown);
			}, [adding, deletingRow, settingsOpen]);

			const yesterday = summary?.yesterday ?? null;
			const rowsMissing = summary !== null && !Array.isArray(summary.rows);
			const webUrl = summary?.webUrl ?? failure?.webUrl ?? FALLBACK_URL;
			// One target judges both plates, so the settings figure is the only
			// threshold the panel knows.
			const targetHours = summary?.dailyTargetHours ?? DEFAULT_DAILY_TARGET_HOURS;
			const verdict = verdictOf(yesterday, targetHours);
			const target = String(targetHours);
			const todayVerdict = verdictOfToday(summary, targetHours);
			const todayTarget = String(targetHours);

			// The rows for the selected day. Yesterday's rows arrive in the same
			// payload, so switching costs no request.
			const yesterdayRows = Array.isArray(yesterday?.rows) ? yesterday.rows : [];
			const showingYesterday = day === 'yesterday' && yesterday !== null;
			const rows = showingYesterday ? yesterdayRows : (Array.isArray(summary?.rows) ? summary.rows : []);
			// When the day ends with an unbooked stretch, the add form starts its
			// clock where that stretch starts instead of an hour before "now".
			const lastRow = rows.length === 0 ? null : rows[rows.length - 1];
			const gapStart = lastRow !== null && lastRow?.kind === 'gap' ? minutesOfClock(lastRow.clock) : null;

			// The subtitle names the account the figures belong to.
			const login = summary?.login ?? failure?.login ?? null;
			const subtitle = login === null || login === ''
				? null
				: h('p', { key: 'sub', className: 'ytt-sub' }, t('panel.byUser', { login }));

			// The title's trailing icon is the link out: small, right of the heading,
			// and the link's own target is named by its title and label.
			const clock = zoneClock(summary?.timeZone ?? '');
			const nowLine = t('panel.now', {
				date: clock.displayDate,
				weekday: clock.weekday,
				time: clock.time,
			});
			const heading = h('div', { key: 'head', className: 'ytt-head' }, [
				h('div', { key: 'titles' }, [
					h('div', { key: 'title', className: 'ytt-title' }, [
						h('h1', { key: 'h1' }, t('panel.title')),
						h('a', {
							key: 'open', className: 'ytt-title-link', href: webUrl,
							target: '_blank', rel: 'noopener noreferrer',
							title: t('panel.openHint'), 'aria-label': t('panel.openHint'),
						}, h(OpenIcon, { key: 'icon' })),
					]),
					subtitle,
				]),
				h('div', { key: 'head-actions', className: 'ytt-head-actions' }, [
					h('span', {
						key: 'now', className: 'ytt-now', 'data-testid': 'tracker-now',
					}, nowLine),
					h('button', {
						key: 'settings', ref: settingsButton, type: 'button', className: 'ytt-head-settings',
						title: t('panel.panelSettingsHint'), 'aria-label': t('panel.panelSettings'),
						'data-testid': 'tracker-panel-settings',
						onClick: () => setSettingsOpen(true),
					}, h(GearIcon, { key: 'icon' })),
					h('button', {
						key: 'refresh', type: 'button', className: 'ytt-refresh',
						disabled: loading, title: t('panel.refreshHint'),
						onClick: refreshNow,
					}, [h(RefreshIcon, { key: 'icon', spinning: loading }), t('panel.refresh')]),
				]),
			]);

			/**
			 * Yesterday's tooltip states the verdict, so the tint is never the only
			 * signal. An unreadable figure says just the total rather than claiming
			 * the target was missed.
			 */
			const yesterdayHint = yesterday === null
				? ''
				: verdict === 'weekend'
					? t('panel.yesterdayWeekend', { hours: yesterday.hours })
					: verdict === 'ok'
						? t('panel.yesterdayOk', { hours: yesterday.hours, target })
						: verdict === 'low'
							? t('panel.yesterdayLow', { hours: yesterday.hours, target })
							: t('panel.yesterdayPlain', { hours: yesterday.hours });

			const body = [];
			if (loading && summary === null) {
				body.push(h('p', { key: 'reading', className: 'ytt-notice' }, t('panel.reading')));
			} else if (failure !== null) {
				body.push(h('p', { key: 'failed', className: 'ytt-notice ytt-notice-error' }, `${t('panel.failed')}: ${failure.message}`));
			} else if (summary !== null) {
				// Yesterday sits to the LEFT of today, in reading order. Each plate
				// switches the list, so each is a button carrying its day and its own
				// accessible name.
				body.push(h('div', { key: 'plates', className: 'ytt-plates' }, [
					yesterday === null
						? null
						: h(DayPlate, {
							key: 'yesterday', label: t('panel.yesterday'), hours: yesterday.hours,
							countText: t('panel.count', { count: yesterday.entries }),
							verdict, hint: `${yesterdayHint} \u2014 ${t('panel.showYesterday')}`,
							testId: 'tracker-yesterday',
							active: showingYesterday,
							onClick: () => setDay('yesterday'),
						}),
					h(DayPlate, {
						key: 'today', label: t('panel.today'), hours: summary.hours,
						countText: t('panel.count', { count: summary.entries }),
						// Today turns green once it reaches its own 8-hour target; until
						// then it keeps the default yellow.
						verdict: todayVerdict,
						hint: `${t(todayVerdict === 'ok' ? 'panel.todayOk' : 'panel.todayLow', { hours: summary.hours, target: todayTarget })} \u2014 ${t('panel.showToday')}`,
						testId: 'tracker-today',
						active: !showingYesterday,
						onClick: () => setDay('today'),
					}),
					// The write action closes the same row, right of the two days.
					h('button', {
						key: 'add', type: 'button', className: 'ytt-add',
						title: t('panel.addHint'), 'data-testid': 'tracker-add',
						onClick: () => { setGapPreset(null); setAdding(true); },
					}, [
						h('span', { key: 'plus', className: 'ytt-add-plus', 'aria-hidden': 'true' }, '+'),
						h('span', { key: 'label' }, t('panel.new')),
					]),
				]));
				// The list is stale from a write until the post-write read lands. The
				// strip names the wait (with the pending seconds) and the list below
				// is dimmed, so an old list never reads as the current one.
				if (stale !== null) {
					body.push(h('div', {
						key: 'stale', className: 'ytt-stale', role: 'status', 'aria-live': 'polite',
					}, [
						h(RefreshIcon, { key: 'icon', spinning: true }),
						h('span', { key: 'text' }, stale.phase === 'waiting'
							? t('panel.staleWaiting', { seconds: staleSeconds })
							: t('panel.staleRefreshing')),
					]));
				}
				// Only today can be missing its list: the host that omits today's rows
				// omits yesterday's too, so this notice stands for both days.
				if (rowsMissing) {
					body.push(h('p', { key: 'norows', className: 'ytt-notice' }, t('panel.noRows')));
				} else if (rows.length === 0) {
					body.push(h('div', { key: 'empty' }, [
						h('p', { key: 'a', className: 'ytt-notice' }, t('panel.empty')),
						h('p', { key: 'b', className: 'ytt-notice' }, t('panel.emptyHint')),
					]));
				} else {
					// Booked and unbooked rows share one list, so the day reads as one
					// timeline from its start to its end.
					const items = rows.map((row, index) => (row?.kind === 'gap'
						? h(GapRow, {
							key: row.id ?? `gap-${index}`, row, t,
							onAdd: (target) => {
								// The gap's start and length prefill the form.
								setGapPreset({
									start: minutesOfClock(target.clock),
									duration: target.minutes,
								});
								setAdding(true);
							},
						})
						: h(WorklogRow, {
							key: row?.id ?? index, row, t,
							pending: stale !== null && stale.deletedId !== null && row?.id === stale.deletedId,
							locked: stale !== null,
							onDelete: (target) => setDeletingRow(target),
						})));
					body.push(h('ul', {
						key: `list-${showingYesterday ? 'yesterday' : 'today'}`,
						className: 'ytt-list',
						'data-day': showingYesterday ? 'yesterday' : 'today',
						'data-stale': stale !== null ? 'true' : 'false',
						'aria-busy': stale !== null ? 'true' : 'false',
					}, items));
				}
			}

			return h('section', {
				className: 'ytt-page',
				'aria-label': t('panel.title'),
				'data-testid': 'tracker-today-page',
			}, [
				h('div', { key: 'scroll', className: 'ytt-scroll' }, h('div', { className: 'ytt-content' }, [heading, ...body])),
				// The dialog closes over the page, so a confirmed record refreshes the
				// figures behind it instead of leaving the panel stale.
				adding
					? h(AddTimeDialog, {
						key: 'add-dialog', t,
						// The form starts on the day the list is showing: the selected
						// filter decides whether that is today or yesterday.
						date: (showingYesterday ? yesterday.date : summary?.date) ?? '',
						today: summary?.date ?? '',
						yesterdayDate: yesterday?.date ?? '',
						defaultQueue: summary?.defaultQueue ?? '',
						gapStart,
						workdayEnd: summary?.workdayEndMinutes ?? DEFAULT_WORKDAY_END_MINUTES,
						defaultDurationMinutes: summary?.defaultDurationMinutes ?? DEFAULT_DEFAULT_DURATION_MINUTES,
						eventCommentPrefix: summary?.eventCommentPrefix ?? DEFAULT_EVENT_COMMENT_PREFIX,
						timeZone: summary?.timeZone ?? '',
						preset: gapPreset,
						onClose: () => { setAdding(false); setGapPreset(null); },
						onAdded: () => { setAdding(false); setGapPreset(null); scheduleRefresh(); },
						onSettingsSaved: () => { load(true); },
					})
					: null,
				// The delete confirmation works the same way: the figures behind the
				// dialog are re-read once Tracker has removed the record.
				deletingRow === null
					? null
					: h(DeleteTimeDialog, {
						key: 'delete-dialog', t, row: deletingRow,
						onClose: () => setDeletingRow(null),
						onDeleted: () => {
							const deleted = deletingRow;
							setDeletingRow(null);
							scheduleRefresh(deleted?.id ?? null);
						},
					}),
				settingsOpen
					? h(MainSettingsDialog, {
						key: 'settings', t, settings, connection,
						loadError: settingsError,
						onRetry: loadSettings,
						onSave: saveSettings,
						onClose: () => {
							setSettingsOpen(false);
							window.requestAnimationFrame(() => {
								if (settingsButton.current !== null) settingsButton.current.focus();
							});
						},
					})
					: null,
			]);
		}

		/** Required client services: the slot registry and the locale dictionaries. */
		const inject = ['slots', 'locale'];

		/**
		 * Register the rail entry, the panel it opens, and the dictionary.
		 *
		 * The dictionary is keyed `en` only: the shipped client carries `en` and
		 * `zh`, and this plugin deliberately does not extend the shared language
		 * catalog, so its text follows the host's English fallback.
		 * @param ctx - the client plugin context.
		 */
		function apply(ctx) {
			installStyles();
			ctx.effect(() => ctx.locale.register(NS, 'en', en), 'yandex-tracker-today: en dictionary');
			const t = ctx.locale.bind(NS);

			// The panel the rail row selects. Selecting a key with no `main` occupant
			// throws, so this registration and the row below it share one id.
			ctx.slots.inject('main', () => ctx.slots.register({
				name: 'main',
				key: PANEL_ID,
				locale: NS,
			}, TrackerTodayPage));

			// The rail row itself, in the global panel list: that list is rendered
			// above the workspace/session region, so this is the seat at the top of
			// the rail, above Workspaces. `order: -1` keeps it first in that group.
			ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
				name: 'sidebar.panellist',
				id: PANEL_ID,
				order: -1,
				locale: NS,
				label: () => t('badge.label'),
			}, TrackerPanelIcon));
		}

		return { inject, apply };
	},
});
