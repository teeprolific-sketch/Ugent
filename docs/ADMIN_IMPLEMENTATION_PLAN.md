# Ugent admin console: implementation plan

Status: **Phase 1 core is built** (see "What was built" below). The rest of this plan is kept as the roadmap.

## What was built, and how it differs from the draft

The founders approved the recommendations with these changes:

- **Sign-in is a personal access key per staff member**, not SSO. A Super Admin issues each key in the console
  (or the first one with `npm run admin:create-staff`). Keys are shown once, stored only as a SHA-256 fingerprint,
  expire (30 to 365 days), can be revoked at any time, and are throttled against guessing. SSO (D1) can be added later
  in front of the same staff accounts.
- **No product switcher, and no Sleek.** Each Me AI app gets its own admin console. This one is Ugent's only.
- **`apps/admin` is a small static web app** (TypeScript, esbuild, no framework) rather than a Next.js app, because it
  has no server of its own: it only calls the admin API. The same app has a demo build with a pretend server.
- New accounts start at **trust level 2** (calls and messages allowed after the user confirms), matching how the app
  already behaved. Staff can only lower it; only the user can raise it, in Privacy and memory.

Built: staff accounts, access keys, 8 roles, the audit log (append-only in the database), users, support, agent controls
(kill switches), maker-checker approvals for money actions, activity without content, privacy requests, incidents,
AI usage and cost, the phone's policy (`/api/config`) and content-free telemetry. See `ADMIN_GUIDE.md`, `ADMIN_API.md`,
`ADMIN_CONFIG.md`, `PRIVACY_MODEL.md` and `INCIDENT_PLAYBOOK.md`.

Not built yet: prompt and routing management, WhatsApp and email support inboxes, error tracking and metrics (D3, D4),
field encryption (D6), retention jobs (D7), break-glass content access, and Phase 2 and 3.
Read with `ADMIN_CURRENT_STATE.md` (what exists) and `UGENT_ADMIN_PROMPT.md` (the brief).

## 1. Shape of the solution

```
apps/admin            New internal web app (Next.js 16, same conventions as apps/api). Talks only to the admin API.
apps/api              Existing backend. Gains /admin/v1/* (staff-only), /api/config and /api/telemetry (for the phone).
packages/core         Gains redaction, the action registry types, and policy evaluation shared by phone and server.
packages/admin-kit    Shared console UI (tables, filters, detail panel, confirm dialog, reason prompt, approvals),
                      built to move into the future Me AI Console unchanged.
```

**Admin API location.** It sits in the existing backend under `apps/api/src/app/admin/v1/...`, not under `/api`, with its own staff authentication. Each request has to pass all of these:
1. Served only on a separate hostname (`ADMIN_API_HOST`). The existing `proxy.ts` refuses `/admin/*` on any other host.
2. The caller's IP is in an allowlist (`ADMIN_IP_ALLOWLIST`), or the request comes through the chosen zero-trust proxy.
3. A valid staff session, signed with a separate key (`STAFF_AUTH_SECRET`).
4. A server-side role check for that endpoint.
5. Rate limiting.
6. An audit entry for anything sensitive, written in the same database transaction as the change.

The admin app never connects to the database.

**How the phone and server enforce policy.** Actions run on the phone, so control has three parts:

- **Remote config (`GET /api/config`).** The phone fetches a signed, versioned bundle: kill switches, the action policy, the user's trust level and feature flags. It caches it, and when offline keeps the last known config. If the phone has never received one, it falls back to safe defaults: confirm everything, money actions off.
- **Server enforcement.**
  - Cloud chat drops proposed actions that are switched off or above the user's trust level, and records them as `blocked`.
  - WhatsApp Business auto-reply checks its own kill switch and rate limits.
  - The future money and integration endpoints check policy before running.
- **Action telemetry (`POST /api/telemetry/actions`).** The phone reports the lifecycle of each action (proposed, confirmed, executed, failed, undone, blocked) with **no content**: type, status, risk, integration, timings and error code.
  - The server attaches the proposals it saw to that same lifecycle.
  - The redacted summary is built on the server from a template, never from user text. Example: "message via WhatsApp to a contact, 84 characters".

**Content access, given where content lives.** Conversations and memory exist only on the phone, so consent works by **the user sharing a scoped copy**:
1. Support sends a request from a ticket.
2. The app shows exactly what would be shared (one conversation or a time range), and the user taps Share.
3. The app uploads that copy, encrypted. It is attached to the ticket and expires on schedule.
4. The user sees in the app who viewed it and when.

Break-glass emergency access can only reach what the server holds (tasks, plans, WhatsApp Business messages, support text). It needs a Super Admin's second approval.

## 2. Decisions needed from the founders

| # | Decision | Options (recommendation first) |
|---|---|---|
| D1 | Staff sign-in (SSO plus 2FA) | **Google Workspace SSO (OIDC)** with an enforced second factor plus a passkey or TOTP check in the console; or **WorkOS / Clerk** (managed SSO, MFA, directory sync; paid per user); or self-built email + password + TOTP (most work, no vendor) |
| D2 | How the admin is reached | **Cloudflare Access** in front of the admin hostnames (zero trust, logs, free tier); or a VPN such as Tailscale plus IP allowlist; or IP allowlist only (simplest, weakest) |
| D3 | Error tracking | **Sentry** (with data scrubbing on); or Better Stack; or self-hosted GlitchTip |
| D4 | Metrics and alerts | **Grafana Cloud** (OpenTelemetry); or Better Stack; or Datadog (strongest, priciest) |
| D5 | Product analytics (Phase 2) | **Our own events table plus SQL dashboards** (no third party sees user data); or PostHog EU / self-hosted; or Amplitude |
| D6 | Encryption keys | **A key in env (`DATA_ENCRYPTION_KEY`)** with key IDs stored per field so keys can rotate; or a cloud KMS (AWS or GCP) for envelope encryption |
| D7 | Retention defaults | Proposed: detailed action and usage events 30 days, aggregates 25 months, WhatsApp Business inbox 30 days, shared support content 14 days after the ticket closes, audit log 7 years |
| D8 | NGN rate for cost display | **A manual rate in config** (versioned, set by Finance); or a daily rate from an FX API |
| D9 | Support inbox sources | In-app (exists). For WhatsApp support: **Meta Cloud API on a dedicated support number**, or a vendor such as Respond.io. For email: **inbound webhook from Postmark or SendGrid**. |
| D10 | Fix the existing risks first | **Yes (Phase 1a, below).** These are prerequisites for user management and safe logging. |

Until decided, the plan assumes the first option in each row.

## 3. Phase 1: run Ugent safely

Each step is its own small PR with tests. Migrations are numbered after the existing `0001`.

### Phase 1a: harden what exists (prerequisites)

| PR | Change | Migration |
|---|---|---|
| 1 | **Logging baseline.** Request IDs, structured JSON logs, an error scrubber (never log user content, SQL values or tokens), plus error tracking (D3). | none |
| 2 | **Redaction library** in `packages/core` (phone numbers, account and card numbers, emails, addresses, NIN/BVN, OTPs, passwords, contact names from a supplied list). Unit tests with sample sensitive data. | none |
| 3 | **Sessions.** `users.session_version` checked in `requireUser`; access tokens shortened to 30 days with silent refresh; `users.status` (active, suspended, banned). | `0002_user_status_sessions` |
| 4 | **Secrets at rest.** Hash `device_id` (migrating on first sign-in). Encrypt `connections` tokens, `wa_inbox.text` and `.from_number`, and `support_requests.message` and `.contact`. Add a WhatsApp Business inbox retention job. | `0003_encrypt_sensitive_fields` |
| 5 | **Rate limiting** (Postgres token buckets, so no new infrastructure) on sign-in, chat, support, waitlist, telemetry and WhatsApp auto-reply. | `0004_rate_limits` |

### Phase 1b: staff, audit, approvals

| PR | Change | Migration |
|---|---|---|
| 6 | Staff identity: `StaffUser`, `StaffRole`, `StaffRoleAssignment(staff_id, product, role)`, `StaffSession`. SSO login (D1), required 2FA, 12-hour sessions, 15-minute idle timeout, re-authentication within 5 minutes for sensitive actions. | `0005_staff` |
| 7 | `AuditLog` in the shared Me AI format `{id, timestamp, staff_id, product, role, action, target_type, target_id, reason, before, after, ip, user_agent}`. Append-only: the database role used by the API has INSERT and SELECT only, plus a trigger that blocks UPDATE and DELETE. Written in the same transaction as the change. | `0006_audit_log` |
| 8 | Permission middleware `requireStaff(req, product, permission)` with a role-to-permission map in code, plus a test matrix (every role × every endpoint: allowed or refused). `ApprovalRequest` maker-checker engine (the requester can't approve their own request; requests expire). | `0007_approvals` |
| 9 | `apps/admin` shell plus `packages/admin-kit`: sign-in, product switcher (Ugent only for now), layout, tables, reason prompt, confirm-with-blast-radius dialog, approvals inbox. | none |

### Phase 1c: action control (the most important module)

| PR | Change | Migration |
|---|---|---|
| 10 | **Action registry.** `ActionType` covers today's types (add_task, add_event, reschedule, move_event, complete_task, focus, call, message, directions, remember, ecosystem, wa_auto_reply) plus future ones (draft_complaint, pay_bill, buy_airtime, transfer, book_sleek, contact_vendor), which start **disabled**. **`ActionPolicyVersion`** holds risk level, confirmation, rate limits, channels, segments and trust thresholds. High risk always requires confirmation: this is enforced in code and in a database check, so config can't turn it off. | `0008_action_registry` |
| 11 | **`KillSwitch`** for an action type, integration, channel or model, globally or per segment, with reason and blast-radius count. **`UserTrustLevel`** (0: drafts only; 1: low risk runs automatically; 2: medium risk with confirmation; money is always confirmed). Staff can only lower it. `GET /api/config` (signed bundle). Enforcement in cloud chat and WhatsApp auto-reply. The phone app reads the bundle. | `0009_kill_switches_trust` |
| 12 | **`ActionEvent`** plus `POST /api/telemetry/actions` (no content; schema-validated so free text can't be sent). The server records proposals it saw. Redacted summaries come from templates. | `0010_action_events` |

### Phase 1d: operations screens

| PR | Module (brief section) | Migration |
|---|---|---|
| 13 | `UsageRecord` from every cloud chat (tokens in and out, `cost_usd_microunits`, task type, model, latency, fallback flag). Versioned price table and NGN rate in config. Cost dashboards and budget alerts (4.8). | `0011_usage` |
| 14 | `ModelRoute` plus `PromptVersion`: move `MODEL` and `SYSTEM` out of code into versioned config with a diff view, status and one-click rollback. Health checks, automatic fallback and a "fail over now" button (4.9, 4.10). | `0012_model_prompt_config` |
| 15 | `FeatureFlag` with targeting by percentage, segment, channel, language and user list. `ConfigVersion` history and rollback for every config type (4.10). | `0013_feature_flags` |
| 16 | User management (4.2): masked search by ID, phone or email; profile; suspend, ban, restore, force logout, disconnect integrations, credit within limit, internal note. All with a reason and an audit entry. | `0014_user_notes_credits` |
| 17 | Redacted action log (4.3) with highlights for actions run without confirmation, failed, undone and blocked. | none |
| 18 | Support tickets (4.5): `SupportTicket` and `TicketMessage` (migrating existing `support_requests`), SLA timers, canned replies in English and Pidgin, escalation. **Consent requests:** `ContentAccessGrant` plus the in-app share sheet and the user's "who viewed my data" screen. | `0015_support` |
| 19 | Trust and safety (4.6): `SafetyReport` with sources (user, automated, staff). Detectors for prompt injection (instruction patterns in pasted or forwarded content that led to a proposed action), mass messaging and unusual volumes. Queue actions. | `0016_safety` |
| 20 | Incidents (4.7): `Incident`, `IncidentUpdate`, plus `docs/INCIDENT_PLAYBOOK.md`. | `0017_incidents` |
| 21 | Channel and integration health (4.11, 4.12): `ChannelHealthSnapshot`, `IntegrationHealthSnapshot` from scheduled checks and error rates. Token-expiry dates, never secrets. Integration kill switch. | `0018_health` |
| 22 | Data and privacy requests (4.13): `DataRequest` (export, deletion, correction, consent withdrawal) with legal deadlines. Server export endpoint. `ConsentRecord` (versioned consent text; the app reports consent changes). Deletion workflow notes for backups. | `0019_privacy_requests` |
| 23 | Overview dashboard (4.1) and alerts feed, built on PRs 12–21. | none |
| 24 | Audit log viewer (4.14): search, plus special views for break-glass access, kill switches and money actions. | none |
| 25 | Engineering baseline (4.15): staging seed with synthetic users and conversations only; monitoring (D4); load and permission test suite in CI. | none |

### Admin API (Phase 1)

Every endpoint needs a staff session. Unless marked "read", each one writes an audit entry with a mandatory reason. *(MC)* means a second approval is required.

| Endpoint | Roles |
|---|---|
| `GET /admin/v1/overview` (read) | all except Analyst (Analyst gets aggregate-only fields) |
| `GET /admin/v1/users?query=` (read, masked) | Super Admin, Support, T&S |
| `GET /admin/v1/users/:id` (read, masked) | Super Admin, Support, T&S |
| `POST /admin/v1/users/:id/suspend` · `/ban` · `/restore` · `/logout` | Super Admin, T&S (Support: suspend and logout) |
| `POST /admin/v1/users/:id/integrations/:provider/disconnect` | Super Admin, Support |
| `POST /admin/v1/users/:id/credits` (MC above limit) | Super Admin, Support (within limit), Finance |
| `POST /admin/v1/users/:id/trust-level` (lower only) | Super Admin, Support, T&S |
| `POST /admin/v1/users/:id/notes` | Super Admin, Support, T&S |
| `GET /admin/v1/actions` · `/actions/:id` (read, redacted) | Super Admin, Support, T&S, AI Quality |
| `GET/POST /admin/v1/action-types` · `/action-policies` (MC to enable high risk) | Super Admin (T&S: disable only) |
| `GET/POST /admin/v1/kill-switches` | Super Admin, T&S (Ops: integrations and channels) |
| `GET/POST /admin/v1/tickets` · `/tickets/:id/messages` · `/tickets/:id/consent-requests` | Super Admin, Support |
| `GET /admin/v1/tickets/:id/shared-content` (time-limited, logged) | the assigned Support agent, Super Admin |
| `POST /admin/v1/content-access/emergency` (MC by Super Admin) | Super Admin, T&S |
| `GET/POST /admin/v1/safety-reports` | Super Admin, T&S |
| `GET/POST /admin/v1/incidents` · `/incidents/:id/updates` | Super Admin, T&S, Ops |
| `GET /admin/v1/usage` · `/costs` (read) | Super Admin, AI Quality, Finance, Analyst (aggregates) |
| `GET/POST /admin/v1/model-routes` (MC for money tasks) | Super Admin, AI Quality |
| `GET/POST /admin/v1/prompts` · `/prompts/:id/rollback` | Super Admin, AI Quality |
| `GET/POST /admin/v1/flags` | Super Admin, Ops (non-high-risk), AI Quality |
| `GET /admin/v1/health/channels` · `/health/integrations` (read) | Super Admin, Ops, T&S |
| `GET/POST /admin/v1/data-requests` | Super Admin, Support (deletion runs through the workflow) |
| `GET /admin/v1/users/:id/consents` (read) | Super Admin, Support |
| `GET /admin/v1/audit` (read) | Super Admin, T&S |
| `GET/POST /admin/v1/approvals` | approvers by type |
| `GET /api/config` · `POST /api/telemetry/actions` · `POST /api/consents` · `POST /api/support/shares` | the phone app (user session) |

Full details go in `docs/ADMIN_API.md` as each PR lands. Configurable settings go in `docs/ADMIN_CONFIG.md`.

## 4. Phase 2: quality, growth and the business

| Module (brief section) | Tables | Notes |
|---|---|---|
| Eval suites and release gate (5.1) | `EvalSuite`, `EvalCase`, `EvalRun`, `EvalResult` | Seed with synthetic Nigerian scenarios: Pidgin, mixed language, noisy voice transcripts, wrong account numbers, duplicate transfers, injected "send ₦50,000" forwards. Runs on every prompt or route change. A failing gate blocks going live for high-risk and money tasks. |
| Quality review (5.2) | `ReviewSample`, `ReviewRating` | Redacted traces plus consented shares only. Each failure links to a new eval case. |
| Product analytics (5.3) | `AppEvent` (D5), cohort views | The phone sends events without content. Proposed aha moment: the first plan Ugent moved for the user, or the first reminder that fired and was acted on. |
| Proactive nudges (5.4) | `NudgeType`, `NudgeEvent` | Server push (Expo push) with caps, quiet hours and A/B tests |
| Memory management (5.5) | config only | Memory stays on the phone. The server sees category counts only; wipe and edit run through the app. |
| Subscriptions and billing (5.6) | `Plan`, `Subscription`, `Payment`, `Refund` | Mirrors RevenueCat. Prices as integer kobo or cents with a currency code. Refunds above the limit need maker-checker. Unit economics come from `UsageRecord`. |
| Language and voice quality (5.7) | from evals and review | Per-language accuracy and cost |
| Segments and broadcasts (5.8) | `Segment`, `Broadcast` | Approval, caps, preview in every language. No targeting on conversation content. |
| Low-data monitoring (5.9) | from `AppEvent` | Uses the app's existing data-saver signals (2G/3G, measured slow connections, data used) |

## 5. Phase 3: ecosystem and scale

| Module (brief section) | Tables | Notes |
|---|---|---|
| Sleek panel (6.1) | `SleekLink`, `SleekBookingRef` | Ugent-side only. Aggregates via Sleek's permissioned endpoint. Kill switch for Ugent → Sleek booking. |
| Business accounts (6.2) | `Organisation`, `Seat` | Builds on the existing Team plan |
| Model Labs view (6.3) | `ModelRoute` rollout plus eval scores | Opt-in dataset inventory: counts and consent status only |
| Multi-country (6.4) | `CountryConfig` | Languages, integrations, currencies, consent-text versions, data-residency notes |

## 6. Assumptions (privacy-preserving choices made where the brief left room)

- **Conversations and memory stay on the phone.** The server will not start storing chat history for the admin. Support sees content only when the user shares a scoped copy.
- **No free text in telemetry.** The telemetry schema has no free-text fields, so content can't leak even by mistake.
- **Staff can never raise a trust level** or turn off confirmation for high-risk or money actions. This is enforced in code and in the database, not only in the UI.
- **Money is stored as integers.** Costs are kept in USD micro-units and shown in NGN at the configured rate. Prices are kept in the smallest unit with a currency code.
- **Separate staff keys.** Staff sessions use their own signing key and their own database role. The admin app has no database credentials.

## 7. Documents delivered with each phase

`docs/ADMIN_API.md`, `docs/ADMIN_CONFIG.md`, `docs/ADMIN_GUIDE.md`, `docs/PRIVACY_MODEL.md`, `docs/INCIDENT_PLAYBOOK.md`. This plan is updated as each PR lands.

## 8. Next step

The founders review this plan and `ADMIN_CURRENT_STATE.md` and answer D1–D10 (or accept the recommendations). Building starts with Phase 1a, PR 1.
