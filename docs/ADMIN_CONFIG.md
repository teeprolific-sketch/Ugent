# Ugent admin: configuration and deployment

## The two parts

| Part | What it is | Where it runs |
| --- | --- | --- |
| Admin API | `/admin/v1/*` routes inside `apps/api` | Same server as the user API, ideally on its own hostname |
| Admin console | `apps/admin`, a static web page (HTML, CSS, one script) | Any static host, behind your access gate |

The console has no database access and no secrets. Everything it does goes through the admin API with the staff member's session.

## Admin API settings (`apps/api/.env.local`)

| Variable | Needed | What it does |
| --- | --- | --- |
| `STAFF_AUTH_SECRET` | Yes | Signs staff sessions. Long random string (`openssl rand -base64 48`), different from `AUTH_SECRET`. **Without it the admin API does not exist** (every `/admin/*` request gets 404). |
| `ADMIN_API_HOST` | Recommended | e.g. `admin-api.ugent.app`. The admin API answers only on this hostname, and this hostname answers nothing else. |
| `ADMIN_IP_ALLOWLIST` | Recommended | Comma-separated addresses (office, VPN or zero-trust proxy). Other addresses get 404. |
| `ADMIN_ALLOWED_ORIGINS` | Yes, for the console | Where the console is served from, e.g. `https://admin.ugent.app`. Browsers on other sites are refused. |

Then run the migrations (`npm run db:migrate -w @ugent/api`) and create the first Super Admin (see `ADMIN_GUIDE.md`).

## Building the console

```bash
ADMIN_API_URL=https://admin-api.ugent.app npm run build -w @ugent/admin
```

Upload `apps/admin/dist/` (three files) to the static host. If `ADMIN_API_URL` is left empty, the console calls the
same address it is served from.

Recommended: put both `admin.ugent.app` and `admin-api.ugent.app` behind Cloudflare Access (or a VPN), so only staff
devices can even load them. Staff still need their access key and the right role.

## Settings changed from the console

These are stored as versions in `config_versions` (each change is a new row with who and why) or in their own tables, and
take effect within a minute:

| Setting | Changed by | Stored in |
| --- | --- | --- |
| Kill switches (actions, integrations, cloud chat) | Trust & Safety, Ops (integrations only), Super Admin | `kill_switches` |
| Money action types switched on | Super Admin request plus a second Super Admin's approval | `approval_requests`, `enabled_action_types` |
| Model prices (USD per million tokens) | Finance, Super Admin | `config_versions` key `model_prices`, micro-dollars |
| Naira per US dollar | Finance, Super Admin | `config_versions` key `ngn_per_usd` |

## What the phone receives

`GET /api/config` returns the user's policy: switched-off actions and integrations, whether cloud chat is on, their trust
level and account status. The app fetches it on open, when it returns to the foreground and in background refreshes,
keeps the last copy, and applies it to everything, including the offline assistant.
