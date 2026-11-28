# Ugent incident playbook

An incident is anything broken or unsafe for many people at once. One person's problem is a support ticket.

## How bad is it?

| Severity | Means | Examples | Respond within |
| --- | --- | --- | --- |
| SEV-1 | Ugent is down or unsafe | Messages sent to the wrong people; chat failing for everyone; data shown to the wrong user | 15 minutes, all hands |
| SEV-2 | A main feature is broken | Google Calendar not syncing; cloud replies over 20 s; WhatsApp auto-replies failing | 1 hour |
| SEV-3 | Slower or partly broken | One integration degraded; WhatsApp quality rating dropped | Same working day |

## Steps

1. **Stop the harm first.** In Agent controls, pause the action or integration that is causing it. Every pause needs
   a reason and takes effect within a minute. If the cloud AI is misbehaving, pause *Cloud AI chat*: the phone's own
   assistant keeps answering.
2. **Open an incident** (Incidents → Open an incident). You are the owner until you hand it over in an update.
3. **Keep the timeline.** Add an update whenever something changes: what you found, what you tried, what worked.
4. **Tell users** when they notice (SEV-1 and most SEV-2). Use *Tell users* to record the exact words used in the
   in-app banner or status page. Plain language, no blame, say when the next update is.
5. **Fix, then turn things back on** one at a time, watching Activity for failures.
6. **Resolve** with what fixed it.
7. **Within 5 working days** (SEV-1 and SEV-2): a short write-up of cause, impact (how many people, how long), and
   what changes so it can't happen again.

## Who does what

- **Trust & Safety**: anything involving abuse, wrong recipients or unsafe actions. Can pause any action.
- **Integrations & Ops**: Google, Maps, WhatsApp Business, the cloud AI. Can pause integrations, not actions.
- **Support**: watches tickets for new reports and answers people with the agreed message.
- **Super Admin**: can do all of it, and approves any money-related change.

## Things that are never done during an incident

- Raising anyone's trust level, or switching off the confirmations people see.
- Switching on a money action without the second approval.
- Reading or copying user content to debug. The console doesn't show it; don't ask users to send screenshots of chats.
