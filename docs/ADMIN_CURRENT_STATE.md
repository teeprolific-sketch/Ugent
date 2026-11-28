# Ugent admin console: current state

Status: written before any admin code, as asked in Section 0 of `UGENT_ADMIN_PROMPT.md`.
Scope: everything in this repository on branch `claude/sharp-pascal-wkn54t` as of 28 November 2026.

## 1. Summary

- **There is no internal tooling at all today.** There are no staff accounts, admin API, audit log, feature flags or remote config. Every operational value (model, prompt, plan limits, prices) is hard-coded.
- **The most private data never reaches the server.** Chat history, Ugent's memory (notes, people, phone numbers, places), habit logs and the user's privacy settings live only on the phone. The server receives a chat turn only to forward it to the model, and it neither stores nor logs it.
- **Actions run on the phone, after the user confirms.** The server sees the actions the cloud model *proposes*. It never learns whether the user confirmed them, ran them or undid them. Nothing records an action today.
- **The server holds less, but some of it is sensitive and stored in plain text:**
  - Google OAuth tokens
  - WhatsApp Business customers' phone numbers and message text
  - support messages and contact details
  - task and plan titles and locations
  - each install's sign-in secret
- **Priority risks to fix before building screens on top:**
  - the plain-text sign-in secrets and tokens
  - 365-day sessions that can't be revoked
  - no rate limiting
  - error logs that can contain user data

## 2. Stack

| Part | What it is |
|---|---|
| Monorepo | npm workspaces: `apps/mobile`, `apps/api`, `packages/core` |
| Phone app (`apps/mobile`) | Expo SDK 58 / React Native 0.88, expo-router, zustand state persisted to AsyncStorage (on the phone), expo-secure-store for the session token. Also builds for the web. |
| Backend (`apps/api`) | Next.js 16 route handlers under `/api/*`, Drizzle ORM + postgres-js on PostgreSQL, zod validation, `jose` HS256 JWTs. `server.mjs` serves it with gzip. |
| Shared (`packages/core`) | TypeScript shared by app and server: on-device agent (`respond()`), planner, zod schemas (`ActionSchema`, `ChatRequest`, `SyncRequest`), i18n for 6 languages, scam check, insights. |
| Migrations | `apps/api/drizzle/0000_init.sql`, `0001_teams_integrations.sql` (drizzle-kit) |
| Tests | `packages/core/src/core.test.ts` (unit, node:test). `apps/api/scripts/smoke.mjs`: 22 end-to-end checks against a running API. No component tests. |
| Note | `apps/api/AGENTS.md`: this Next.js version has breaking changes; read `node_modules/next/dist/docs/` before writing Next.js code. |

## 3. AI models and how they are called

- **One provider, one model:** Anthropic Claude, `claude-opus-5-5`, hard-coded in `apps/api/src/lib/claude.ts` (`const MODEL`).
- **Call shape:** `client.beta.messages.create` with structured JSON output (reply, draft, proposed actions) and server-side model fallback.
- **System prompt and tool descriptions:** one string constant `SYSTEM` in `lib/claude.ts`. It has no version and no change history.
- **What is sent to the model per turn:**
  - the message and the last 10 turns of history
  - today's and tomorrow's tasks and plans
  - the user's name, best time of day and work type
  - the `about` block: notes, people's names, places and weekly routines, all from the phone
- **What is kept:** nothing, apart from a daily counter (`users.chat_day`, `users.chat_count`).
- **Not recorded:** tokens, cost and latency per call. There is no cost tracking or budget.
- **Fallback:** if there's no API key, the daily allowance is used up (`CHAT_LIMIT` in `lib/plan.ts`: free 10, pro 300, team 300), or the call fails, the server answers with the same rule-based on-device agent from `packages/core`. Chat never fails, but the fallback isn't logged as a metric.
- **The server checks every proposed action** against the user's own data. For example, `move_event` must reference one of the user's own events, and lengths are capped. That check is the natural place to enforce kill switches server-side.

## 4. Channels

| Channel | How it works today | Notes for admin |
|---|---|---|
| Own app (iOS, Android, web) | Main channel. Chat, Live voice (speech on the phone), plans, tasks. | Only channel for chat. |
| WhatsApp (personal) | Ugent opens WhatsApp with a message ready; **the user presses send**. | Runs entirely on the phone; the server never sees it. |
| SMS and calls | Same: the phone's SMS or dialler opens with everything filled in; the user sends or calls. | No server-side SMS provider exists. |
| WhatsApp Business (Meta Cloud API) | A user links a business number. Customer messages arrive at `/api/webhooks/whatsapp` (signature-checked). While the user is in Focus mode with auto-reply on, **the server replies on the user's behalf with no per-message confirmation**. | The only place the server acts for a user. Needs a kill switch, rate limits and quality monitoring. |
| Push notifications | Local only (scheduled on the phone). No server push. | Broadcasts and server-sent nudges don't exist yet. |
| Support | "Report a problem" form in the app → `POST /api/support` → `support_requests` table. Optional WhatsApp and email links in Help (outside Ugent). | No inbox, no SLA, no replies. |

## 5. Integrations

| Integration | Where | Data held |
|---|---|---|
| Google Calendar, Gmail, Google Tasks (read-only OAuth) | `lib/google.ts`, `/api/integrations/google/*` | `connections`: account email, **access and refresh tokens in plain text**, scopes, expiry |
| Google Maps (travel times) | `lib/maps.ts`, `/api/maps/eta` | Server API key only; no user data kept |
| WhatsApp Business | `lib/whatsapp.ts` | `wa_business`, `wa_inbox` (see section 6) |
| RevenueCat (App Store, Google Play) | `/api/webhooks/revenuecat` (timing-safe shared secret) | `users.plan`, `users.plan_expires_at`. No payment history, prices or refunds |
| Sleek, Domestica I, Afrika I, ID'd | Not live. The app saves requests locally; the server keeps a waitlist. | `waitlist` (user, product) |

There are no money integrations: no banks, bill payment, airtime or transfers. Those action types in the admin plan are future types, registered as disabled.

## 6. What data is stored, and where

### On the server (PostgreSQL)

| Table | Personal data | Protection today | Risk |
|---|---|---|---|
| `users` | name, language, rhythm, work type, plan, team, **`device_id`** | Plain text | **High.** `device_id` is the install's sign-in secret: `POST /api/auth/device` with it returns a session for that account. A database leak lets anyone sign in as anyone. |
| `tasks`, `events` | Titles (can be very personal), dates, **locations** | Plain text | Medium. Needed for sync; admins should only see counts. |
| `teams` | Team name, invite code | Plain text | Low |
| `connections` | Google account email, **OAuth access and refresh tokens** | Plain text | **High.** A leak gives read access to users' Gmail and Calendar. |
| `wa_business` | Business number, auto-reply text | Plain text | Medium |
| `wa_inbox` | **Third parties' phone numbers and message text** | Plain text, **kept forever** | **High.** Personal data of people who never agreed to Ugent; no retention limit. |
| `waitlist` | User and product | Plain text | Low |
| `support_requests` | **Free-text message, contact phone or email** | Plain text | Medium-high. Free text may include anything. |

The database relies on the host's disk encryption. There is no field-level encryption.

### Only on the phone (never stored on the server)

- Chat history: turned off by the "Remember my chats" setting.
- Ugent's memory: notes, people (with phone numbers once found), places, routines.
- Habit, energy, focus and reschedule logs.
- Ecosystem requests, notes, quick captures.
- The privacy settings that work as consent today: *Learn from me*, *Remember my chats*, *Smarter answers when online* (cloud chat), *Ask before taking actions*.

The app's "Copy all my data" exports this on the phone. `DELETE /api/me` deletes the account and all server rows in one transaction.

## 7. Existing internal tooling

None. The only "admin" concept is the **team admin** role, which belongs to the customer's Team workspace (`teams`, `users.team_role`). It has nothing to do with Me AI staff and must stay separate.

## 8. Security and privacy risks found

1. **Sign-in secret stored in plain text** (`users.device_id`). Store a hash, and keep using the raw value only as the input to sign-in.
2. **OAuth tokens in plain text** (`connections`). Encrypt them at the field level (AES-256-GCM with a key from env or KMS) and never return them in any API.
3. **Third-party WhatsApp content kept forever in plain text** (`wa_inbox`). Encrypt it, set a retention period (proposed: 30 days), and redact it in any admin view.
4. **Support messages and contacts in plain text** (`support_requests`). Encrypt them; staff see redacted text unless the user consents.
5. **Sessions can't be revoked.** JWTs last 365 days and carry no session version, so "force logout" and suspension are impossible. Add `users.session_version`, check it in `requireUser`, and shorten the lifetime with silent refresh.
6. **No rate limiting anywhere.** This covers `/api/auth/device` (account creation), chat (beyond the daily counter), support, waitlist and WhatsApp auto-replies.
7. **Error logs can contain user data.** `lib/http.ts` logs every unexpected error object, and PostgreSQL errors can include row values ("Failing row contains …"). `integrations/google/callback` logs raw errors. There are no request IDs, no structured logs and no error tracking.
8. **No audit trail** of any change, by users or by staff.
9. **Everything operational is hard-coded:** model, system prompt, chat limits, plan entitlements, WhatsApp auto-reply behaviour. Nothing can be changed or rolled back without a deploy.
10. **No server-side consent records.** Consent toggles exist only on the phone, with no version or timestamp the company can show a regulator.
11. **No data-export endpoint** (only the on-phone copy), and no tracked queue or deadlines for data requests.
12. **Prompt-injection surface.** Pasted messages ("is this a scam?") and, in future, Gmail and WhatsApp content go to the model, which can propose `message` actions with arbitrary text. The user's confirmation is the only defence. There's no detection or metric.
13. **WhatsApp Business auto-reply** sends messages for the user with no rate cap and no way to turn it off globally.
14. **One shared secret** (`AUTH_SECRET`) signs user sessions and OAuth state. Staff sessions must use separate keys.

No secrets are committed. Only `.env.example` files with empty values are tracked.

## 9. Gaps against the admin brief

| Brief section | Today | Gap |
|---|---|---|
| 1.1 Separate admin app and API | Nothing | All new: `apps/admin` plus `/admin/v1` on the backend, restricted by host and IP |
| 1.2 Me AI Console conventions | Nothing | Staff identity, SSO with 2FA, per-product roles, shared audit format, shared UI kit |
| 2 Privacy model | Conversations and memory never leave the phone (a strong start) | Redaction library, consent-based content sharing, break-glass, retention, encryption at rest, export |
| 3 Roles | Customer team roles only | All 8 staff roles, server-side checks, maker-checker, reasons, re-authentication |
| 4.1 Overview | Nothing | Needs usage, error, latency and action telemetry first |
| 4.2 User management | Nothing; suspension impossible | Session revocation, user status column, masked search, notes |
| 4.3 Action log | No action records | Client telemetry (redacted, no content) plus server-recorded proposals |
| 4.4 Action control | Actions fixed in code | Action registry, policy versions, kill switches delivered to the phone by remote config and enforced on the server, trust levels |
| 4.5 Support | A table with no workflow | Tickets, SLAs, canned replies (English, Pidgin), consent requests |
| 4.6 Trust and safety | Nothing | Reports, injection and abuse detection |
| 4.7 Incidents | Nothing | Incident records and a playbook |
| 4.8–4.9 Cost and routing | One hard-coded model, no usage data | Usage records with cost, budgets, route config, fallbacks |
| 4.10 Prompts and flags | Prompt in code | Versioned prompts, feature flags |
| 4.11–4.12 Channel and integration health | Nothing | Health snapshots |
| 4.13 Data requests | Account deletion endpoint only | Request queue, export, deadlines, consent records |
| 4.14–4.15 Audit and engineering baseline | None | Immutable audit log, permission tests, structured logs, error tracking |
| 5 Evals, analytics, nudges, billing, languages | Core unit tests only; RevenueCat plan flag | All new (Phase 2) |
| 6 Sleek, business accounts, Model Labs, countries | Waitlist only | All new (Phase 3) |
