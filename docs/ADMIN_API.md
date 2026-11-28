# Ugent admin API

Base path `/admin/v1`. JSON in and out. Exists only when `STAFF_AUTH_SECRET` is set (see `ADMIN_CONFIG.md`).

Every route except sign-in needs `Authorization: Bearer <staff session token>`. The server checks the staff member's
roles on every request (permissions in `packages/core/src/admin.ts`). Errors look like
`{ "error": "forbidden", "message": "Your role can't do this." }` with status 400, 401, 403, 404 or 409.

Every change takes a `reason` (at least 5 characters) and writes an audit entry in the same transaction.

## Sign-in

| Method and path | Permission | Body → response |
| --- | --- | --- |
| `POST /auth/login` | none | `{accessKey}` → `{token, staff:{id,name,roles}, expiresAt}`. 8 tries per 15 min per address. |
| `POST /auth/logout` | signed in | → `{signedOut:true}` |
| `GET /me` | signed in | → `{staff, permissions}` |

## Screens

| Method and path | Permission | Notes |
| --- | --- | --- |
| `GET /overview` | `overview.view` | People, usage, action outcomes (24 h), open counts and an `attention` list `{level,title,detail,go}` |
| `GET /users?q=` | `users.view` | Masked rows |
| `GET /users/:id` | `users.view` | Account, counts, connections (masked), trust levels, notes, activity, privacy requests |
| `POST /users/:id` | per action | `{action, reason, note?}`; `suspend` / `restore` (`users.suspend`; lifting a ban needs Trust & Safety or Super Admin), `ban`, `logout`, `disconnect`, `trust_lower`, `note` |
| `GET /activity?status=&type=&user=` | `activity.view` | Content-free events |
| `GET /controls` | `controls.view` | Action types, integrations, channels, each with `killSwitch` and `affectedUsers`; recent history |
| `POST /controls` | see notes | `{op:'kill', targetType, targetKey, reason}` and `{op:'clear', id, reason}` (`controls.kill_action` for actions, `controls.kill_integration` otherwise); `{op:'request_enable', key, reason}` (`controls.request_high_risk`) |
| `GET /approvals` | `approvals.view` | With requester names and `mine` |
| `POST /approvals/:id` | `approvals.decide` | `{decision:'approve'|'reject', reason}`; your own request is refused (`own_request`) |
| `GET /tickets`, `GET /tickets/:id` | `support.view` | Message and contact are redacted |
| `POST /tickets/:id` | `support.reply` | `{action:'reply', body}`, `{action:'assign_me'}`, `{action:'status', status, reason}`, `{action:'priority', priority, reason}` |
| `GET /privacy` | `privacy.view` | Requests with due dates (30 days) |
| `POST /privacy` | `privacy.process` | `{userId, type:'export'|'deletion'|'correction'|'consent_withdrawal', reason}` |
| `POST /privacy/:id` | `privacy.process` | `{action:'complete'|'run_deletion'|'reject', reason}` |
| `GET /incidents` | `incidents.view` | With timeline |
| `POST /incidents` | `incidents.manage` | `{title, severity:'SEV-1'|'SEV-2'|'SEV-3', components, reason}` → id `INC-n` |
| `POST /incidents/:id` | `incidents.manage` | `{action:'update'|'comms'|'resolve', body}` |
| `GET /usage` | `usage.view` | Daily (14 days) and per model (30 days); cost in USD once prices are set; `ngnPerUsd` |
| `POST /usage` | `usage.configure` | `{prices?:{model:{inUsdPerMTok,outUsdPerMTok}}, ngnPerUsd?, reason}`; stored as new versions |
| `GET /audit?view=users|controls|staff|money&target=` | `audit.view` | Newest first |
| `GET /staff` | `staff.manage` | Keys appear only as `ugk_<prefix>_…`; secrets are never returned |
| `POST /staff` | `staff.manage` | `{name, email?, role, expiresInDays, reason}` → `accessKey`, shown this once |
| `POST /staff/:id` | `staff.manage` | `{action:'issue_key', expiresInDays}` (returns `accessKey` once), `revoke_key {keyId}`, `set_roles {roles}`, `disable`, `enable`; always keeps one Super Admin; you can't disable yourself |

## For the phone (user API)

| Method and path | Notes |
| --- | --- |
| `GET /api/config` | `{policy:{version, disabledActions, disabledIntegrations, cloudChat, trustLevel, status}}` |
| `POST /api/me/trust` | `{level:0|1|2}`, the user's own choice → `{policy}` |
| `POST /api/telemetry/actions` | `{events:[{type, status, errorCode?, latencyMs?}]}`, strict: anything else is rejected |
| `POST /api/privacy/requests` | The user asks for a copy or deletion |
| `GET /api/me/export` | What the server holds about the user |

## Checks

`npm run smoke:admin -w @ugent/api` with `SUPER_KEY` and `SUPER2_KEY` set to two Super Admin keys runs 14 end-to-end checks
against a running API.
