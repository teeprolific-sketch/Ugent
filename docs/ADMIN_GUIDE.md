# Ugent admin console: staff guide

The admin console is where Ugent staff help users, pause things that are going wrong and keep track of every change.
It never shows anyone's chats, memory, notes or habits: those live only on the user's phone.

## Signing in

Every staff member has their **own access key**, which looks like `ugk_ab3k9xq2_…` (45 characters).

- A Super Admin creates it for you. It is shown to them **once**; they give it to you privately.
- Paste it on the sign-in page. Your key decides your role, so it decides what you see and can do.
- Never share it, paste it into chat or email, or save it in a shared document. If you think someone else has seen it,
  tell a Super Admin straight away so they can revoke it.
- Sessions end after 12 hours, or after 30 minutes without use. Eight wrong keys from one address in 15 minutes
  locks that address out for a while.

## Roles

| Role | Can |
| --- | --- |
| Super Admin | Everything, including staff, access keys and approvals. |
| Support | Tickets, user accounts (suspend, sign out, disconnect, lower trust, notes), privacy requests. Sees masked names and contacts only. |
| AI Quality | Activity and AI usage. No accounts. |
| Trust & Safety | Suspend and ban accounts, lower trust, pause actions and integrations, incidents, audit log. |
| Integrations & Ops | Pause integrations (Google, WhatsApp Business, cloud chat), incidents. |
| Finance | AI usage and cost, model prices and the naira rate. No users or activity. |
| Growth | Home page numbers only. |
| Analyst | Home page numbers and AI usage, read only. |

The server checks the role on every request. The console only hides buttons a role can't use.

## The screens

- **Home**: whether anything needs you, with an Open button for each item, today's numbers in plain words, and shortcuts for your role.
- **Users**: search by name or user ID. Open someone to see their account, trust level, what is connected and recent activity, and to act.
- **Support**: tickets from the app. Phone numbers, emails, card numbers and codes are removed before you see them.
- **Agent controls**: pause any action type (for example "Send a WhatsApp or SMS") or integration for everyone within a minute.
  Money actions (pay a bill, buy airtime, send money) stay off until one Super Admin asks and a different one approves.
- **Activity**: what Ugent suggested and did, and whether it worked. Types and outcomes only, never what anyone wrote.
- **Privacy requests**: copies of data and deletions, due within 30 days.
- **Incidents**: open one when something is broken for many people; keep the timeline; record what users were told; resolve.
- **Approvals**: changes that need a second person.
- **AI usage & cost**: cloud AI requests, tokens and cost in dollars and naira. Finance sets prices here.
- **Staff & access keys**: add people, change roles, issue and revoke keys, disable accounts.
- **Audit log**: every change, who made it, when, why, and what it was before and after. Nobody can edit or delete it.

## Rules everyone follows

1. **Every change needs a reason.** Write a real one ("Mass messaging, 290 contacts in 2 days"), not "test".
2. **Pausing beats guessing.** If an action may be hurting people, pause it, then investigate. Turning it back on takes one click.
3. **Nobody can make Ugent do more for a user than they chose.** Staff can lower a trust level, never raise it, and can't remove the confirmations people see on their phone.
4. **Don't copy user details out of the console** into chat, email or documents.
5. **Use the smallest role** that lets someone do their job.

## Adding staff and keys (Super Admin)

In the console: **Staff & access keys → Add staff member**. Choose the role and how long the key lasts (90 days is recommended).
Copy the key from the next screen and give it to the person privately (in person, or through a password manager share).

To replace a key (lost laptop, leaked key): **New key** for that person, give them the new key, then **Revoke** the old one.
Revoking signs out anyone using that key on their next click.

When someone leaves: **Disable** them. Their keys stop working at once.

Ugent always keeps at least one Super Admin, and you can't disable yourself.

### The very first Super Admin

The first key is made on the server, because there is no one to sign in yet:

```bash
npm run admin:create-staff -w @ugent/api -- --name "Ope Adeyemi" --role super
```

It prints the key once. Run it again with `--role` set to any role to add more people without the console.

## The demo

`npm run build:demo -w @ugent/admin` makes `apps/admin/dist-demo/index.html`: the same console with made-up data, a pretend
server that follows the same rules, and one demo key per role on the sign-in page. Nothing in it touches real users.
