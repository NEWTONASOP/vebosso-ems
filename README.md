# VEBOSSO EMS

> The internal app VEBOSSO runs the business on: attendance, tasks and leave for the team, plus bills, accounts, leads and venues for the events side. Built with **Expo SDK 56**, **React Native 0.85**, **TypeScript 6** and **Supabase**. It ships as an Android APK and as a web app.

Current version: **2.1.0** (Android package `com.vebosso.ems`).

---

## Roles and access

| Role | What they get |
|---|---|
| **Owner** | Everything: the team, approvals, every feature, access rules, sessions, recycle bin, bug reports, event alarms |
| **Manager** | Their team's approvals, tasks and history, plus whichever features the owner gives them |
| **Member** | Check-in and check-out, their own tasks, leave and history, plus whichever features the owner gives them |

Bills, Accounts, Leads and Venues are **features**. The owner turns each one on per person and can narrow it with **access rules** (062–068): what someone can view, add, edit or delete, which brand or city they see, and whose records. Row Level Security enforces this in the database through `access_ok`, `access_list_ok` and `has_feature`, not just in the UI.

---

## Features

### Team
- **Check-in / check-out** with a work plan, photos and an end-of-day report; owner or manager approves, sends back or rejects
- **Day timeline** of check-in, breaks, remarks and attachments per person (`work_log_events`, 075)
- **Attendance history** calendar, owner backfill for a missed day, check-in and checkout reminders (pg_cron)
- **Tasks**: assigned and self-made, with comments, review and completion notes
- **Leave requests** with date ranges
- **Departments**, employee details and documents, salary, owner notes, chat with the owner
- **Location tracking** between check-in and check-out only (see below)
- **Owner inbox** on Home: waiting approvals, remarks and attached files. Deactivated people sit in a small link at the bottom.

### Bills (`(owner)/bills`)
- Two brands, **VEBOSSO** and **Navgrah**, each with its own letterhead and settings. The list opens on Navgrah.
- Three kinds:
  - **Estimates** (`E-` numbers), which convert into client bills
  - **Client bills**, pending or completed
  - **Packages** (`P-` numbers, 077), which are never completed or converted
- Drafts save as you type. Trash can be restored, and every edit is logged (038).
- **Printed mark** (079) on estimates and client bills: *Not printed*, *Printed*, or *Changed, print again* after an edit
- PDF share and one-step WhatsApp send (`modules/whatsapp-share`). Photos go into automatic collages, up to 4 per page (`src/lib/photoLayout.ts`). Videos are stored on Cloudinary.
- Inside a bill, **‹ Previous / Next ›** step through the list in its current filter, search and sort
- **Event alarms** (Android, owners only, see below)

### Accounts
- Ledgers per account, private per person (036), with receipts, Excel import/export and PDF statements
- **Categories** on entries (076), filterable inside one account or across all accounts
- Search; the export follows the period, category and search shown

### Leads (Navgrah)
- Leads grouped by banquet, with several phone numbers, voice remarks and Excel import
- One **Remark** label per lead (078), shown as sections inside each banquet. Long-press a label to remove it. The free-text box is **Notes**.

### Venues
- Venues by city and brand, with contacts, photos and proof. Shared or private per person.
- **Bulk import** from Excel or CSV (`src/lib/venuesFile.ts`)

### App-wide
- Push notifications (Expo on Android, Web Push on the web) and an in-app notification log
- Over-the-air updates plus an in-app APK updater
- Recycle bin, in-app bug reports, offline banner, force logout

---

## Event alarms

A local native module, [`modules/bill-alarm`](modules/bill-alarm), rings the phone like a clock alarm for **pending client bills**, on **owners' phones only**:

- **When:** 2 days and 1 day before the function date, at **11:32 AM**
- **Ringing:** the alarm sound plays for up to 1 minute with a full-screen page and no snooze. A quiet notification stays behind, and tapping it opens the bill.
- **Kept up to date:** the phone's alarms are replaced with the current list whenever the app opens, comes back to the front, or Bills loads ([`src/lib/billAlarms.ts`](src/lib/billAlarms.ts)). A changed date, a completed bill or a trashed bill moves or drops its alarms.
- **Restored** after a restart, an app update or a time change (boot receiver). Signing out clears them.
- **Permissions:** the alarms need notifications, "Alarms & reminders" and full-screen alerts. The app asks at most once a day, chaining through whatever is missing. **Settings → Event alarms** shows the status and has a 1-minute test.

Because it is native code, the alarm module needs a new APK; an OTA update alone does not add it.

---

## Location tracking

Owners and managers see where a member is now and their trail for the day.

- **Recording:** only between check-in and check-out, with a fix every 3 minutes or every 100 m. Fixes are queued offline.
- **Permission gate:** members need notifications and "Allow all the time" location before they can use the app ([`PermissionGate.tsx`](src/components/PermissionGate.tsx)).
- **Maps:** Leaflet on OpenStreetMap inside a WebView, so there's no Google Maps key or billing.
- **Trail analysis:** [`locationTrail.ts`](src/lib/locationTrail.ts) works out stops (80 m, 8 minutes), distance, and drops fixes worse than 150 m.

---

## Tech stack

| Technology | Version | Purpose |
|---|---|---|
| Expo / Expo Router | ~56.0.12 / ~56.2.11 | App framework, file-based routes |
| React Native / React | 0.85.3 / 19.2.3 | UI |
| TypeScript | ~6.0.3 | Types |
| Supabase JS | ^2.108.2 | Auth, Postgres, Realtime, Storage, Edge Functions |
| Zustand | ^5.0.14 | State (auth, work, notifications, tab bar) |
| React Native Paper | ^5.15.3 | Material 3 components |
| Reanimated | 4.3.1 | Animations |
| expo-notifications, expo-updates | ~56 | Push, OTA |
| expo-location, react-native-webview | ~56.0.25, 13.16.1 | Tracking and maps |
| expo-print, expo-sharing | ~56 | Bill and statement PDFs |
| SheetJS (`xlsx`) | 0.20.3 | Excel/CSV import and export |
| date-fns | ^4.4.0 | Dates |

Local native modules live in [`modules/`](modules): `bill-alarm` and `whatsapp-share`. Config plugins live in [`plugins/`](plugins): APK installer, backup override and WhatsApp package queries.

---

## Quick start

```bash
npm install
cp .env.example .env     # fill in the three values below
npx expo start           # press r to reload, or start with -c to clear the cache
```

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_PROJECT_ID=your-expo-project-id
```

Expo Go can't load the native modules (alarms, WhatsApp send). Use a development build (`npm run build:dev`) to test those.

---

## Database

Run every file in [`supabase/migrations/`](supabase/migrations) **in numeric order** in the Supabase SQL Editor (001 → 079; a few numbers have two files, so run both). Then run `supabase/seed.sql` for the owner account.

| Range | What it adds |
|---|---|
| 001–018 | Core schema, RLS, version control, notifications, checkout/check-in photos, backfills, force logout, cron reminders, security fixes |
| 019, 028 | Location tracking and its integrity checks |
| 020–023, 045, 049, 059–061 | Documents, salary, chat, profile photos, employee details, work documents, owner notes |
| 024, 029, 033, 040, 043, 051–052, 065, 074 | Venues, cities, contacts, sharing, photos, brands |
| 025–026, 036, 039, 041, 044, 076 | Expenses, accounts, receipts, pay dates, categories |
| 027, 030–031, 038, 058, 064, 070–071, 077, 079 | Bills, access, brands, edit log, videos, PDFs, captions, packages, printed mark |
| 042, 046–047, 050, 054, 078 | Navgrah leads, numbers, voice remarks, remark labels |
| 062–068 | Access rules |
| 032, 037, 048, 053, 055–057, 069, 072–073, 075 | Check-in reminders, task review, remarks, leave ranges, recycle bin, web push, bug reports, self tasks, work-log events |

The migrations add the live-updating tables to the Realtime publication themselves: work logs, tasks, announcements, notifications, locations, documents, expenses, venues and leads. If live updates don't arrive, check **Database → Replication**.

Storage buckets (for example `checkouts`) are private and created by their migrations with their own policies.

### Edge functions

```bash
supabase functions deploy create-member
supabase functions deploy admin-update-member
supabase functions deploy force-logout
supabase functions deploy send-push-notification
supabase functions deploy send-checkout-reminders --no-verify-jwt
supabase functions deploy send-checkin-reminders --no-verify-jwt
```

Function secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` for Web Push (`_shared/webPush.ts`). `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided by Supabase.

### Default owner

`seed.sql` creates employee ID `VB-0001` with password `VbOwner#Reset2026!`. The app forces a password change on first login.

---

## Releases: APK, OTA and web

| Workflow | Runs when | Does |
|---|---|---|
| [`build-production.yml`](.github/workflows/build-production.yml) | `app.json` **version** changes on `main` (or manually) | Signed release APK, GitHub Release, updates `latest_version` / `download_url` in `app_settings` |
| [`publish-ota-update.yml`](.github/workflows/publish-ota-update.yml) | Any other push to `main` (not `.md`, `supabase/` or `.github/` only) | Publishes the JS bundle to the `production` channel |
| [`deploy-web.yml`](.github/workflows/deploy-web.yml) | Push to `main` | `expo export -p web` and deploy to Vercel |
| [`build-uat.yml`](.github/workflows/build-uat.yml) | Manual | APK pointed at the UAT Supabase project |

The runtime version policy is `appVersion`, so an OTA reaches only APKs of the **same version**.

- **JS/UI change:** push without bumping the version, and installed 2.1.0 phones update on next launch.
- **Native change** (new module, permission, plugin or SDK): bump `app.json` version, and the APK workflow builds it. Users install it from the in-app update prompt.
- **Database change:** migrations are **not** run by CI. Run them in the SQL Editor, before pushing app code that needs them.

Manual OTA: `npm run update:ota -- --message "what changed"`.

The channel must match in three places: `app.json` → `updates.requestHeaders["expo-channel-name"]`, `eas.json` → `build.production.channel`, and the OTA workflow, all `production`.

**GitHub secrets:**
- **APK:** `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_PROJECT_ID`, `GOOGLE_SERVICES_JSON`, `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY`
- **OTA:** adds `EXPO_TOKEN`
- **Web:** `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
- **UAT:** `EXPO_PUBLIC_SUPABASE_URL_UAT`, `EXPO_PUBLIC_SUPABASE_ANON_KEY_UAT`

### In-app APK updater

After login, `UpdateChecker` compares the installed version with `app_settings.latest_version`. If the installed version is older, it offers to download `download_url` and open the Android installer. The user may need to allow **Install unknown apps**.

---

## Project structure

```
├── app.json, eas.json, vercel.json
├── modules/
│   ├── bill-alarm/          # Event alarms (Kotlin: AlarmManager, full-screen page, boot receiver)
│   └── whatsapp-share/      # Send a file to one WhatsApp chat
├── plugins/                 # Expo config plugins
├── .github/workflows/       # APK, OTA, web, UAT
├── src/
│   ├── app/
│   │   ├── (auth)/          # Login, password change
│   │   ├── (owner)/         # dashboard, approvals, tasks, history, bills/, accounts/,
│   │   │                    #   leads, venues, team/, member/[id], settings/ (announcements,
│   │   │                    #   sessions, recycle bin, bug reports)
│   │   ├── (manager)/       # Team screens + bills/, accounts/, leads, venues
│   │   └── (member)/        # home, tasks, history, leaves + bills/, accounts/, leads, venues
│   ├── components/          # Shared screens and sheets (LeadsScreen, VenuesScreen, Bill*, Account*…)
│   ├── lib/                 # Data and logic: bills, billPdf, billAlarms, photoLayout, accounts,
│   │                        #   accountsFile, leads, venues, accessRules, locationTrail, …
│   ├── store/               # Zustand stores
│   ├── constants/, types/
└── supabase/
    ├── migrations/          # 001–079, run in order
    ├── functions/           # 6 edge functions + _shared/webPush.ts
    ├── scripts/             # Owner fixes, UAT helpers
    └── seed.sql
```

The Bills, Accounts, Leads and Venues screens for managers and members re-export the owner's or the shared component. Access rules decide what each person sees.

---

## Troubleshooting

**Owner can't log in after seeding.** Run `003_profile_self_read.sql`, then `supabase/scripts/fix-owner-account.sql`.

**"Unknown module" or a stale screen in development.** Restart Metro with `npx expo start -c`.

**An OTA change doesn't show on a phone.** Check that the phone's APK version equals `app.json` version, then close and reopen the app twice: the first launch downloads the update and the next one runs it.

**Event alarms don't ring.** Open Settings → Event alarms and allow whatever it lists. Some phones (Xiaomi, Oppo, Vivo) also need battery optimisation turned off for the app.

**Push not arriving.** Check `EXPO_PUBLIC_PROJECT_ID`, that `send-push-notification` is deployed, and that you're on a real device. For the web, set the VAPID secrets.

**Build fails on `google-services.json`.** Put the Firebase file in the project root; CI writes it from `GOOGLE_SERVICES_JSON`.

---

## License

Private — VEBOSSO © 2026.
