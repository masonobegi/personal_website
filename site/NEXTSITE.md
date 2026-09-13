# masonobegi.com — the new CMS site

This folder (`site/`) is a **Next.js + PostgreSQL** rebuild of masonobegi.com where
**every page is editable from a password-protected admin** — no code changes, no
redeploys. It replaces the old static HTML site. Your old site is untouched and
still live until you deliberately cut over (see "Going live" below).

Built by reusing the architecture from the gibbs/Oswego site, with all the
finance/compliance parts removed and a portfolio content model + a Projects
system + a Hobbies gallery added.

---

## What you can edit at `/admin`

Log in at `/admin` with your `ADMIN_PASSWORD`. Tabs:

- **Content** — every page's real info: your name/role/contact, the **cover
  photo** (swap it here), Home, About, **Experience**, **Skills**, Education,
  **Hobbies** (incl. the **LEGO photo gallery** — upload/caption/reorder), the
  **Hire** page (packages, pricing, process, FAQ), Contact, Privacy, Terms,
  search-listing (SEO) text, and analytics IDs.
- **Projects** — add / edit / delete / reorder projects, set a category and an
  optional subsection, upload a cover + a **photo gallery per project**, mark
  Featured, add "In progress" status, live + code links.
- **Pages** — hidden pages not shown in the nav (share the link directly).
- **Library** — write articles / notes (also import from Word/PDF).
- **Landing** — hidden landing/intake pages with optional questionnaires; every
  submission lands in the Inbox.
- **Inbox** — contact-form and landing submissions (CSV export).
- **Backup** — download/restore everything (content, projects, articles, pages,
  landing, submissions, and all uploaded files) as one JSON file.

Only **information** is editable — fonts, colors, and layout are fixed (the //MO
brand), on purpose.

---

## Run it locally

```
cd site
npm install
npm run dev          # http://localhost:3000  (admin password defaults to "changeme")
```

With no database it stores everything in local JSON files under `.data/` — fine
for trying it out. Your real projects are seeded automatically on first run.

---

## Going live — the steps only you can do

The app is developed here but **not deployed**. To make it your live site:

### 1. Add a database on Railway (required for edits to persist)
In your Railway project: **New → Database → PostgreSQL**. Then open the web
service → **Variables → Add Variable Reference** → add `DATABASE_URL` pointing at
the Postgres service. Without this, edits and uploads reset on every redeploy.

### 2. Set the environment variables (Railway → web service → Variables)
| Variable | Required | What it does |
| --- | --- | --- |
| `DATABASE_URL` | **Yes** | Postgres (add as a reference to the DB service, step 1). |
| `ADMIN_PASSWORD` | **Yes** | Your admin login. **Change it from the default.** |
| `ADMIN_SESSION_SECRET` | **Yes** | Signs the login cookie. Any long random string. |
| `NEXT_PUBLIC_SITE_URL` | **Yes** | `https://masonobegi.com` (no trailing slash). |
| `CONTACT_TO_EMAIL` | Recommended | Where contact-form messages are emailed. |
| `RESEND_API_KEY` | Optional | Enables email delivery of form submissions. Without it, submissions are still saved to the Inbox. |
| `CONTACT_FROM_EMAIL` | Optional | Resend sender (needs a verified domain). |
| `NEXT_PUBLIC_GA_ID` | Optional | GA4 ID fallback (you can also set it in Content → Ads). |

Generate a session secret:
```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Point Railway at this folder (the cutover)
Railway → web service → **Settings → Root Directory** → set it to `site`. Railway
will then build and serve **this** app instead of the old static files.
Redeploy. (To roll back at any time, set the Root Directory back to empty and the
old static site returns.)

### 4. Cloudflare
- Add the **`www` → apex redirect** so `www.masonobegi.com` works (a redirect
  rule to `https://masonobegi.com/$1`), and make sure `www` has a DNS record.
- Confirm SSL is **Full (strict)** — same as the gibbs site.

### 5. First login & content pass
Visit `masonobegi.com/admin`, sign in, and skim each Content tab. Everything is
pre-filled with your real info; adjust anything you want. Upload any LEGO photos
you want in **Content → Hobbies**.

### 6. Optional, when you're ready
- Paste your **Calendly/booking link** in **Content → Hire → Booking link** so the
  "Book a call" buttons use it (otherwise they go to /contact).
- Add your **GA4 Measurement ID** in **Content → Ads & Tracking**.
- Submit `masonobegi.com/sitemap.xml` in Google Search Console.
- Take a **Backup** (admin → Backup) once you've made your edits.

---

## Security

Same protections as the gibbs site: the admin password is never stored (only
compared), the session cookie is HMAC-signed with `ADMIN_SESSION_SECRET`, login
attempts are rate-limited with an escalating lockout, every `/admin` API checks
the session, uploads are validated by magic-bytes, and a strict Content-Security-
Policy is set per request. Optional 2FA is available by setting `ADMIN_TOTP_SECRET`.

---

## Notes

- Uploaded photos/videos are stored **in Postgres** and served from `/media/…`,
  so they survive redeploys with no S3 bucket to configure.
- The site keeps working if the database is briefly unreachable — it falls back
  to the shipped default content, which also lets it build on Railway.
- To move the whole thing to its own repo later, this `site/` folder is
  self-contained.
