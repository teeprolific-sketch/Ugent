# Ugent privacy model for staff tools

The rule: **staff can run Ugent without reading what people say to it.** When in doubt, the console shows less.

## What never leaves the phone

Chats, memory ("remember that…"), notes, habits, the people someone calls or messages and the places they go.
The admin API has no endpoint that returns them, so no role can see them.

## What the server keeps, and what staff see of it

| Data | On the server | What staff see |
| --- | --- | --- |
| Account | Name, language, plan, platform, status, trust level, last seen | Short name ("Adaeze O."), never the full name |
| Plans and tasks | Synced for backup | Counts only |
| Connections | Google tokens (encrypted at rest by the provider), WhatsApp Business number | Which services are connected; numbers masked (`+234 803 ••• ••67`) |
| Support tickets | The message the user chose to send | Redacted: phone numbers, emails, card and account numbers, codes, PINs, passwords and the user's own name removed |
| Agent activity | Action type, outcome, error code, timing, model | Exactly that, with a fixed summary ("Reschedule (traffic) · 2 plans"). Never message text, names or numbers |
| Phone telemetry | Action type, fixed status, error code from a short list | Same. The server rejects any extra field, so free text can't arrive |
| AI usage | Tokens, model, latency, cost | Totals and per-model figures |
| Audit log | Who, when, why, before and after | Super Admin and Trust & Safety |

## Logs

Server logs carry a request ID and the error type, never request bodies, tokens, SQL values or user content.

## Access and accountability

- One personal access key per staff member, stored only as a fingerprint, revocable, expiring.
- Least privilege: 8 roles. Finance, Growth and Analyst never see individual users.
- Every change needs a written reason and is recorded in the same database transaction as the change.
- The audit log is append-only: the database refuses updates and deletes, for everyone.
- Staff can lower a user's trust level but never raise it, and can't remove the confirmations people see before calls,
  messages or payments.
- Money actions need two different Super Admins.

## People's rights (Nigeria Data Protection Act 2023)

- **Copy of their data**: in the app, Settings → Privacy and memory → Copy all my data (from the phone), and
  `GET /api/me/export` for what the server holds.
- **Deletion**: in the app (Delete my account and data), or logged by Support. Deletion removes the account and
  everything it owns; activity totals are kept without the user ID.
- Requests made outside the app are logged in **Privacy requests** and answered within 30 days.

## Not built yet

Break-glass access to content a user explicitly shares with support, field-level encryption, automatic retention
deletion. Until they exist, staff simply cannot see content.
