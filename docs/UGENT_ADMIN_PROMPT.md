# UGENT — Admin Console Build Prompt

Paste this whole file into Claude Code at the root of the Ugent repo (or save it as `docs/UGENT_ADMIN_PROMPT.md` and tell Claude Code to read it). Work through it in phases, not all at once.

## 0. Who you are and how to work

You are the senior engineer building the internal admin console for Ugent, Me AI's personal AI agent built for African realities. Ugent helps users get real things done: drafting, reminding, organising, following up, and taking actions on their behalf through integrations, with user confirmation for anything important. Ugent is currently in beta.

The admin console is how Me AI staff run Ugent safely: support users, watch quality and cost, control what the agent is allowed to do, respond to incidents and abuse, and handle privacy requests. Ugent holds very personal data (messages, money-related actions, routines, contacts, memory), so privacy is the core design constraint of this console.

Before writing any code, do this first:

1. Read the whole Ugent repository. Identify the stack, how conversations and actions are stored, which AI model providers are used and how they're called, which channels Ugent runs on (own app, WhatsApp, SMS, web), existing integrations, auth, billing, logging, and any existing admin or internal tools.
2. Write `docs/ADMIN_CURRENT_STATE.md` covering: what data Ugent stores and where, what already exists for internal tooling, security and privacy risks (secrets in code, staff access to raw conversations, missing audit logs, unencrypted sensitive fields, logs containing user message content), and gaps against this document.
3. Write `docs/ADMIN_IMPLEMENTATION_PLAN.md` mapping every item here to Phase 1, 2 or 3, listing the files/modules, the admin API endpoints, and the database migrations.
4. Stop and show the founders the report and plan before building. Extend the existing stack; don't rewrite.

Working rules:

- Keep the existing stack and code conventions.
- Small, reviewable PRs per module, each with tests for permission checks and critical actions.
- No secrets in code; use environment variables with placeholders in `.env.example`.
- Money amounts (subscriptions, costs) as integers in the smallest currency unit, with a currency code.
- Everything operational (limits, model routing, feature flags, action permissions, notification caps) is configurable from the console and versioned, never hard-coded.
- When a third-party tool is needed (SSO, monitoring, analytics, error tracking), propose 2–3 options with trade-offs and let the founders choose.
- When something is ambiguous, choose the more privacy-preserving and safer option, note the assumption in the PR, and continue.

## 1. Architecture

### 1.1 Separate app, separate API

- The admin console is a separate internal web app. It never connects to the production database directly.
- It talks only to a dedicated Ugent admin API (e.g. `/admin/v1/...`) on the Ugent backend, with its own authentication, server-side role checks on every endpoint, rate limiting, and audit logging.
- The admin API is not reachable from the public user-facing app routes and should be restricted at the network level where possible (IP allowlist / VPN / private networking).

### 1.2 Me AI Console compatibility

Ugent's admin must be able to live inside the future Me AI Console, one internal web app with a product switcher (Ugent, Sleek and future products). Build to these shared conventions so it can move in without a rewrite:

- One staff identity: Me AI staff accounts with single sign-on, mandatory 2FA, and roles assigned per product. A staff member may have a role in Sleek and none in Ugent, or the other way round.
- Shared UI component library and layout (tables, filters, detail panels, confirmation dialogs, reason prompts).
- Shared audit log format: `{id, timestamp, staff_id, product, role, action, target_type, target_id, reason, before, after, ip, user_agent}`.
- Each product keeps its own backend, database and admin API. The console only calls each product's admin API. Ugent data is never queryable from Sleek's admin and vice versa.

If the full Me AI Console isn't being built yet, build Ugent admin as a standalone app that follows these conventions exactly.

## 2. Privacy model (read this before building any screen)

1. Staff cannot read user conversations by default. Default views show metadata and redacted content only: timestamps, intent/category, which tools/actions were invoked, success/failure, latency, model used, cost, and error codes, but not message text, voice notes, contact names, account numbers or memory contents.
2. Break-glass access to content. Viewing actual conversation content, voice notes or memory is only allowed when:
   - the user has reported a problem and granted permission in the app for staff to view a specific conversation or time range (recorded consent with scope and expiry), or
   - there is a documented safety/legal emergency approved by a Super Admin (second approval required), and the staff member has the right role.

   Every content view requires a reason, is time-limited, is scoped to the consented range, and is audit-logged. The user can see in their app that support accessed their conversation, and when.
3. Redaction pipeline. Before anything reaches admin logs or dashboards, redact phone numbers, account numbers, card numbers, emails, addresses, identity numbers, OTPs, passwords and contact names. Application logs must never contain raw message content or secrets.
4. Minimise and expire. Admin-visible traces and logs follow retention policies set in config (e.g. detailed traces kept for a short period, aggregates kept longer).
5. Comply with Nigeria's Data Protection Act: consent records, purpose limitation, data minimisation, encryption at rest for sensitive fields, user data export and deletion within required timelines, and breach response procedures.
6. Evaluation and training data: user content may only enter test suites or training datasets with explicit opt-in consent, after redaction/anonymisation, tracked per user with the ability to withdraw.

## 3. Roles and permissions (least privilege)

- Super Admin (founders): everything, including roles, config, kill switches, break-glass approvals.
- Support Agent: user lookup (masked), account status, subscription status, redacted action history, ticket handling, consented conversation view only for their assigned tickets. Can issue credits/refunds up to a configured limit.
- AI Quality / Evals Engineer: evaluation suites and results, prompt and model versions, redacted traces, consented/anonymised examples, model routing config (changes require approval if flagged high-risk).
- Trust & Safety: abuse and prompt-injection reports, suspicious activity queue, account suspension/ban, action-type kill switches (shared with Super Admin), incident management.
- Integrations / Ops Engineer: integration health, channel health (WhatsApp, SMS, push), provider status, error tracking, queue health, feature flags (non-high-risk).
- Finance: subscriptions, billing, refunds (maker-checker above a limit), revenue, cost reports. No conversation access of any kind.
- Growth / Marketing: aggregate funnels, retention, campaigns and broadcast notifications (with caps). No individual user content.
- Read-only Analyst / Investor view: aggregate dashboards only.

Rules:

- Permissions checked server-side on every admin API call.
- Maker-checker (second approval) for: refunds/credits above a limit, break-glass content access, enabling high-risk action types, changing model routing for money-related tasks, bulk user actions, deleting any data outside the standard deletion workflow.
- Mandatory reason field for all sensitive actions.
- Session timeouts and re-authentication for sensitive actions.

## 4. PHASE 1 — Run Ugent safely (build first)

### 4.1 Overview dashboard

- Live status: active users today, messages/requests per hour, action success rate, error rate, average latency, model provider status, channel status (app, WhatsApp, SMS), queue backlogs.
- Today's AI cost vs budget, and cost per active user.
- Open incidents, open abuse/injection reports, open support tickets, pending data requests.
- Alerts feed (cost spike, error spike, provider outage, channel suspension risk, unusual action volume).

### 4.2 User management

- Search by user ID, phone (masked results), or email; profile shows: signup date, channel(s), language, plan, status, consent settings, connected integrations (names only), last active, counts of conversations and actions, support history.
- Actions: suspend, ban, restore, force logout, reset integrations (disconnect), apply credit (within role limit), add internal note. All with reasons and audit log.
- Show the user's action permission level (see 4.4) and allow support to lower it (never raise it without the user's own action in the app).

### 4.3 Action log (redacted)

Every action Ugent takes or proposes is recorded as an ActionEvent: `{id, user_id, conversation_id, action_type, integration, risk_level, status (proposed / confirmed_by_user / executed / failed / undone / blocked), required_confirmation (bool), confirmed_at, executed_at, undo_available, error_code, model_used, cost, latency, redacted_summary}`.

- Admin views: filter by action type, status, risk level, integration, time; drill into a single action's lifecycle (redacted).
- Highlight: actions executed without confirmation (should only be low-risk types), failed actions, undone actions, blocked actions.

### 4.4 Action control centre (agent permissions and kill switches)

This is one of the most important modules.

- Action registry: list of every action type Ugent can perform (e.g. draft message, send message, set reminder, create calendar entry, draft complaint to bank, pay bill, buy airtime/data, book a Sleek artisan, contact a vendor), each with:
  - risk level (low / medium / high),
  - whether user confirmation is required (high-risk always requires it; this cannot be turned off in config),
  - per-user and global rate limits (e.g. max sends per hour, max money actions per day, max amount per action),
  - allowed channels,
  - enabled/disabled status globally and per user segment.
- Kill switches: instantly disable an action type, an integration, a channel, or a model globally or for a segment, with a reason. Show the blast radius before confirming ("this will affect X active users").
- User trust levels: users unlock more automation gradually (e.g. Level 0: drafts only; Level 1: low-risk actions auto; Level 2: medium-risk with confirmation; money actions always confirmed). Admin can view and lower levels; thresholds configurable.
- All changes versioned with history and rollback.

### 4.5 Support tickets

- Inbox from in-app reports, WhatsApp support and email, with priority and SLA timers.
- Ticket view shows: user (masked), redacted recent action history, errors linked to the user, subscription state.
- Consent request button: support can ask the user (via the app) for permission to view a specific conversation or time range. Once granted, the consented content becomes viewable for that ticket only, until expiry.
- Canned responses in English and Pidgin (more languages later).
- Escalation to Trust & Safety or engineering.

### 4.6 Trust & safety queue

- Reports from users ("Ugent did something I didn't ask for"), automated detections, and staff.
- Prompt-injection detection: flag cases where content from external sources (messages, emails, web pages, documents) contained instructions that tried to make Ugent take an action, especially if an action was proposed as a result. Show the redacted pattern and the action that was blocked or proposed.
- Abuse detection: users trying to use Ugent for harassment, spam (mass messaging), scams or fraud; unusual volumes of sends or money actions; repeated failed attempts at high-risk actions.
- Actions: block action for user, suspend user, kill-switch the action type, open an incident.

### 4.7 Incidents

- Create incident (severity, affected components, start time), timeline of updates, owner, user-communication status, resolution, post-mortem link.
- `docs/INCIDENT_PLAYBOOK.md` for: model provider outage, WhatsApp/channel suspension, cost runaway, agent misbehaviour (wrong actions), data breach, integration failure. Breach response must follow data protection law notification requirements.

### 4.8 Model usage and cost

- Per model and provider: requests, tokens, cost (stored in USD and shown with NGN equivalent at a configurable rate), latency, error rate.
- Cost per active user (daily, weekly, monthly), by plan and by user segment; top cost drivers by task type.
- Budget alerts (daily and monthly) with automatic actions configurable (e.g. route to cheaper model when budget is near).
- Revenue vs cost per user once billing exists.

### 4.9 Model routing and fallbacks

- Config screen mapping task types (e.g. intent detection, drafting, summarisation, transcription, translation, action planning, money-related actions) to a primary model, fallback models, max tokens, temperature, and timeouts.
- Support Me AI Model Labs models alongside external providers.
- Health checks and automatic fallback when a provider fails; manual "fail over now" button.
- Changes versioned; changes to money-related task routing require second approval and must pass the relevant eval suite first (Phase 2 enforcement).

### 4.10 Prompt and configuration versions

- System prompts, tool descriptions and agent policies stored as versioned config (not scattered in code).
- Each version: author, change note, diff view, linked eval results, status (draft / staged / live / rolled back).
- One-click rollback to the previous live version.
- Feature flags with targeting by percentage, segment, channel, language, or user list.

### 4.11 Channel health

- WhatsApp: messaging limits, quality rating, template status, error rates, any warnings from the platform. Alert early if quality drops (risk of restriction).
- SMS: delivery rates by network, costs.
- Push and in-app: delivery and open rates.
- Backup channel status: confirm users have a fallback contact method if a channel goes down.

### 4.12 Integrations health

- Each integration (banks, telcos, bill payment, payment partners, calendar, email, Sleek): status, success rate, latency, error codes, last incident, credentials expiry dates (never show secrets).
- Disable an integration (kill switch) with reason.

### 4.13 Data and privacy requests

- Queue of user requests: data export, deletion, correction, consent withdrawal.
- Deadlines and status; deletion executes through a defined workflow that removes data across conversations, memory, action logs (keeping only legally required, anonymised records), backups policy noted.
- Consent records viewer per user (what they agreed to, when, which version).

### 4.14 Audit log viewer

- Searchable, filterable, immutable list of all admin actions. Super Admin and Trust & Safety can view; nobody can edit or delete entries.
- Special views: all break-glass accesses, all kill-switch changes, all money-related admin actions.

### 4.15 Engineering baseline for the admin

- Tests for: every permission check (each role can and cannot do the right things), maker-checker flows, break-glass flow and expiry, kill switches, redaction pipeline (unit tests with sample sensitive data), audit log writes in the same transaction as actions.
- Monitoring, structured logs with request IDs (no message content), error tracking, rate limiting on admin auth.
- Staging environment with synthetic users and synthetic conversations only.

## 5. PHASE 2 — Quality, growth and the business

### 5.1 Evaluation suites

- Manage test suites of realistic Nigerian scenarios: mixed-language and Pidgin messages, typos, noisy voice notes (danfo, generator noise), vague requests, angry users, wrong account numbers, duplicate transfers, multi-request messages, and adversarial/prompt-injection cases (e.g. a forwarded message that says "send ₦50,000 to this account").
- Each test case: input, context, expected behaviour (including "should ask for confirmation" or "should refuse"), tags (language, task type, risk level).
- Run suites on demand and automatically on every prompt/model/routing change; show pass rate overall and by tag, and diffs between versions.
- Release gate: a prompt or routing change cannot go live for money-related or high-risk tasks unless the relevant suites pass the configured threshold.
- Sources of test cases: synthetic, staff-written, and opt-in, redacted real examples only.

### 5.2 Quality review

- Sample of redacted traces (and consented content where allowed) for human review with ratings (correct / partially / wrong / unsafe) and failure categories.
- Trends of failure categories over time; link failures to new test cases with one click.

### 5.3 Product analytics

- Funnel: install/signup → onboarding steps → "aha moment" reached (define per the chosen core job, e.g. first successful bank complaint drafted or first reminder that fired and was acted on) → second-day use → week-1 → week-4.
- Week-4 retention, cohort tables by signup week, channel, language and acquisition source.
- Core job metrics: how often the main job is used, success rate, time saved estimates.
- Proactive nudges: sent, opened, acted on, muted; nudge fatigue indicator (users muting or churning after nudges).
- "Would you care if Ugent disappeared?" survey results over time.

### 5.4 Proactive notifications manager

- Define nudge types (renewal reminders, bill due, transfer follow-up, rent reminders, etc.), triggers, templates in each language, channels, and frequency caps per user per day/week.
- Quiet hours; per-user preferences respected.
- A/B testing of wording and timing; results shown in analytics.

### 5.5 Memory management (privacy-first)

- Aggregate view only: memory usage counts, categories, and size distribution. No individual memory content without break-glass/consent.
- Config: what categories Ugent may remember, retention periods, size limits.
- Support tools to process a user's request to view, edit or wipe their memory (executed through the user-facing feature where possible).

### 5.6 Subscriptions and billing

- Plans (free tier, premium, business plans), prices in NGN (and other currencies if needed), entitlements (limits per plan on actions, nudges, integrations, model tiers).
- Subscribers list, MRR, churn, upgrades/downgrades, failed payments, refunds (maker-checker above limit).
- Unit economics view: revenue per user vs AI cost per user per plan; flag plans or segments with negative margins.

### 5.7 Language and voice quality

- Transcription and understanding accuracy by language (English, Pidgin, Yoruba, Igbo, Hausa) and accent, from eval suites and review samples.
- Which model handles each language; cost per language.
- Requests for languages not yet supported (aggregate).

### 5.8 Segments and broadcasts

- Define user segments (by plan, language, channel, activity, core-job usage).
- Broadcast announcements to segments with caps, approval required, and preview in every language. No content from individual conversations may be used to target broadcasts.

### 5.9 Low-data and fallback monitoring

- Share of users on low-end devices / low bandwidth (from client telemetry), error rates for those users, SMS fallback usage and delivery for critical reminders.

## 6. PHASE 3 — Ecosystem and scale

### 6.1 Sleek integration panel

- Bookings Ugent created on Sleek: count, conversion (proposed → user confirmed → booked → completed), failures, user satisfaction.
- Account-link status between Ugent and Sleek (counts, revocations), scoped token health.
- Kill switch for Ugent → Sleek booking.
- Ugent admin only sees Ugent-side data about these bookings; job details live in Sleek's admin. Cross-product views only through aggregated, permissioned endpoints.

### 6.2 Partner and business accounts

- Business plans for small companies (e.g. order/message handling): organisations, seats, usage, billing, admin contacts.

### 6.3 Model Labs pipeline view

- Which Me AI models are in production, their eval scores vs external models, cost savings achieved, and rollout status per task type.
- Opt-in dataset inventory (counts, consent status, redaction status). No raw content browsing.

### 6.4 Multi-country readiness

- Config per country: languages, integrations, currencies, legal/consent text versions, data residency notes.

## 7. Data model additions (adapt to repo conventions)

- `StaffUser`, `StaffRole`, `StaffRoleAssignment (staff_id, product, role)`, `StaffSession`.
- `AuditLog` (shared format from 1.2).
- `ApprovalRequest (type, requested_by, approver, status, payload, reason, expires_at)` for maker-checker.
- `ContentAccessGrant (user_id, scope, granted_via: user_consent | emergency, approved_by, ticket_id, starts_at, expires_at, revoked_at)`.
- `ActionType (registry)`, `ActionPolicyVersion`, `KillSwitch (target_type, target_id, scope, reason, set_by, active)`.
- `ActionEvent` (from 4.3).
- `UserTrustLevel (user_id, level, changed_by, reason)`.
- `ModelRoute (task_type, primary, fallbacks, params, version, status)`.
- `PromptVersion (component, content_ref, version, status, author, eval_run_id)`.
- `FeatureFlag (key, targeting, version)`.
- `EvalSuite`, `EvalCase`, `EvalRun`, `EvalResult`.
- `UsageRecord (user_id, model, tokens_in, tokens_out, cost_usd_microunits, task_type, timestamp)`.
- `SupportTicket`, `TicketMessage`.
- `SafetyReport (source, user_id, category, redacted_summary, status, actions_taken)`.
- `Incident`, `IncidentUpdate`.
- `ChannelHealthSnapshot`, `IntegrationHealthSnapshot`.
- `DataRequest (user_id, type, status, due_at, completed_at)`, `ConsentRecord`.
- `NudgeType`, `NudgeEvent`, `Segment`, `Broadcast`.
- `Plan`, `Subscription`, `Invoice/Payment`, `Refund`.

## 8. Explicitly NOT allowed

- Any admin screen that shows raw conversation content, voice notes or memory by default.
- Staff raising a user's trust level or disabling required confirmation for high-risk or money actions.
- Logging raw user messages, secrets, OTPs, card or account numbers anywhere in application or admin logs.
- Direct database access from the admin app.
- Using user content for evals or training without opt-in consent and redaction.
- Silent admin actions: every sensitive action needs a reason and an audit entry.

## 9. Deliverables per phase

- Code with tests (especially permissions, redaction, maker-checker, break-glass, kill switches), migrations, and synthetic seed data.
- `docs/ADMIN_IMPLEMENTATION_PLAN.md` kept up to date.
- `docs/ADMIN_API.md` listing every admin endpoint, required role and audit behaviour.
- `docs/ADMIN_CONFIG.md` listing every configurable setting with defaults.
- `docs/ADMIN_GUIDE.md`: how to handle a support ticket with consent, use a kill switch, roll back a prompt, respond to a prompt-injection report, process a deletion request.
- `docs/PRIVACY_MODEL.md` describing exactly who can see what and how access is granted and logged.
- `docs/INCIDENT_PLAYBOOK.md`.

Start with Section 0: read the repo, write `ADMIN_CURRENT_STATE.md` and `ADMIN_IMPLEMENTATION_PLAN.md`, then stop and wait for approval.
