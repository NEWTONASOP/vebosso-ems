# VEBOSSO EMS — Employee Management System

> A production-quality Employee Management System built for internal workforce management, powered by **Expo SDK 56**, **React Native 0.85**, **TypeScript 6**, and **Supabase**.

---

## Documentation

| Document | Audience | Purpose |
|---|---|---|
| **[CLIENT_GUIDE.md](./CLIENT_GUIDE.md)** | Client / end users | APK install, login, daily use, roles, troubleshooting |
| **README.md** (this file) | Developers | Setup, database, builds, architecture |

---

## Client Delivery (APK Only)

When handing off to the client **without source code**, ship a folder like:

```
VEBOSSO_EMS_Delivery_v1.2.7/
├── vebosso-ems-v1.2.7.apk
├── CLIENT_GUIDE.md
└── Owner_Login.txt          ← optional; share credentials out-of-band instead
```

### Pre-delivery checklist

1. **Build production APK** — `npm run build:prod` or trigger the GitHub Actions workflow (see [Building the App](#building-the-app))
2. **Verify backend is live** — Supabase migrations applied, edge functions deployed, Realtime enabled
3. **Confirm owner account** — `seed.sql` run (or existing owner); password changed or ready for forced change on first login
4. **Set update URLs in Supabase** — `app_settings` keys `latest_version` and `download_url` (updated automatically by CI on release)
5. **Test on a real Android device** — login, check-in, approval, checkout with photo, push notification
6. **Rename APK** — e.g. `vebosso-ems-v1.2.7.apk` to match `app.json` version
7. **Send CLIENT_GUIDE.md** with the APK — do **not** include `.env`, keystore, or service role keys

### What the client gets vs. what stays with you

| Include with client | Keep internal |
|---|---|
| Signed release APK | Source code (unless contracted) |
| CLIENT_GUIDE.md | `.env`, Supabase service role key |
| Owner login (secure channel) | Android keystore / signing secrets |
| Support contact | `google-services.json`, Firebase console |

---

## What Is This App?

VEBOSSO EMS is a mobile-first internal tool that lets a company manage employee attendance, tasks, leave, and announcements — all with a role-based access model. Employees check in daily with a work plan, get approved by their manager or owner, complete tasks, and check out with an end-of-day report.

---

## Role-Based Access

| Role | Capabilities |
|---|---|
| **Owner** | Full access: create/delete members, force-logout, manage sessions, announcements, approve all check-ins, assign managers, view all history |
| **Manager** | Approve team check-ins/check-outs, assign tasks, view team history, create announcements for team |
| **Member** | Check-in with daily plan, view & update tasks, check-out with report, view own history, request leave |

---

## Features

### Core Workflows
- ✅ **Daily Check-in** — Submit a work plan; waits for Owner/Manager approval
- ⏳ **Approval Workflow** — Approve or reject check-ins and check-outs with rejection reasons
- 📝 **Day-end Checkout** — Submit end-of-day summary with photo evidence; total hours auto-calculated
- 📸 **Checkout Photos** — Attach photos at checkout, stored in a private Supabase Storage bucket
- 📋 **Task Management** — Create, assign, track, and complete tasks with notes
- 📢 **Announcements** — Targeted to all, managers, members, or a specific user
- 📅 **Attendance History** — Calendar view of all work logs per user
- 🕗 **Attendance Backfill** — Owner grants a one-time permission for a user to log a missed day
- 🏖️ **Leave Requests** — Submit, approve, or reject leave requests
- 📊 **Real-time Dashboard** — Live stats via Supabase Realtime subscriptions
- 🔔 **Push + In-App Notifications** — Expo Push Service plus a persisted in-app notification center (bell + log)
- 🔒 **Force Logout & Session Management** — Owner can remotely invalidate sessions (edge function + DB RPC)
- 🔄 **In-App APK Updates** — Optional update prompt with in-app download and install
- 👥 **Member Management** — Owner can add, edit, delete members, assign managers
- 🌐 **Offline Detection** — Banner shown when network is unavailable

### Technical Highlights
- Supabase Realtime for live work log / task / announcement / notification updates
- Row Level Security (RLS) on all 9 database tables + Storage bucket policies
- 4 Deno Edge Functions for privileged operations
- Zustand v5 global state with typed stores (auth, work, notifications)
- Auth session persisted via Expo SQLite
- React Native Reanimated 4 animations
- Inter font (400–800) with Material Design 3 via React Native Paper
- Error Boundary with graceful recovery
- Loading skeleton states and empty state components
- Expo Updates (OTA) + EAS build pipeline + GitHub Actions production APK workflow
- Storage cleanup trigger — checkout photos deleted automatically when a profile is removed

---

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| Expo | ~56.0.12 | App framework (managed workflow) |
| React Native | 0.85.3 | UI framework |
| React | 19.2.3 | UI runtime |
| TypeScript | ~6.0.3 | Type safety |
| Supabase JS | ^2.108.2 | Auth, Database, Realtime, Storage, Edge Functions |
| Zustand | ^5.0.14 | Global state management |
| React Native Paper | ^5.15.3 | Material Design 3 components |
| Expo Router | ~56.2.11 | File-based navigation (typed routes) |
| React Native Reanimated | 4.3.1 | Animations |
| Expo Notifications | ~56.0.18 | Push + in-app notifications |
| Expo Image Picker | ~56.0.20 | Checkout photo capture |
| Expo Updates | ~56.0.19 | Over-the-air updates |
| date-fns | ^4.4.0 | Date formatting |
| @expo-google-fonts/inter | ^0.4.2 | Typography |
| NetInfo | 12.0.1 | Offline detection |

> Current app version: **1.2.7** (bundle `com.vebosso.ems`, min Android SDK 29).

---

## Prerequisites

- **Node.js** 18+ (20 recommended for CI parity)
- **EAS CLI** (for builds): `npm install -g eas-cli`
- **Supabase CLI** (for edge functions): `npm install -g supabase`
- **Supabase account**: [supabase.com](https://supabase.com)

---

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your Supabase project credentials:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
EXPO_PUBLIC_PROJECT_ID=your-expo-project-id
```

### 3. Set Up the Database

Run the following migrations **in order** in your Supabase SQL Editor:

```
supabase/migrations/001_initial_schema.sql               — Tables, indexes, triggers
supabase/migrations/002_rls_policies.sql                 — Row Level Security policies
supabase/migrations/003_add_version_control.sql          — Version control columns
supabase/migrations/003_profile_self_read.sql            — Profile self-read fix
supabase/migrations/003_manager_assignment_updates.sql   — Manager assignment support
supabase/migrations/004_app_update_system.sql            — Version control & forced updates
supabase/migrations/005_task_completion_notes.sql        — Task completion notes & timestamps
supabase/migrations/006_fix_tasks_assigned_by_cascade.sql — Soft-delete for assigned_by
supabase/migrations/007_security_hardening.sql           — RLS triggers, privilege escalation prevention, constraints
supabase/migrations/008_fix_total_hours_security.sql     — Secure total-hours computation trigger
supabase/migrations/009_notifications.sql                — In-app notifications table + realtime
supabase/migrations/010_add_checkout_photos.sql          — Checkout photos column + private storage bucket
supabase/migrations/011_attendance_backfills.sql         — Backfill permissions table + insert trigger
supabase/migrations/011_force_logout_rpc.sql             — force_logout_user() DB function
supabase/migrations/012_storage_cleanup_trigger.sql      — Delete checkout photos when a profile is deleted
```

Then run the seed to create the owner account:

```
supabase/seed.sql
```

### 4. Enable Realtime

In Supabase Dashboard → **Database → Replication**, enable Realtime on:
- `work_logs`
- `tasks`
- `announcements`
- `notifications`

> `notifications` is added to the `supabase_realtime` publication automatically by `009_notifications.sql`.

### 5. Storage Bucket

Migration `010_add_checkout_photos.sql` creates a **private** `checkouts` storage bucket (10 MB limit, image MIME types only) with RLS policies so a user can upload to their own folder and owners/managers can read. No manual setup is required — just confirm the bucket exists in **Storage** after running the migration.

### 6. Deploy Edge Functions

```bash
supabase functions deploy create-member
supabase functions deploy admin-update-member
supabase functions deploy force-logout
supabase functions deploy send-push-notification
```

### 7. Run the App

```bash
npx expo start
```

---

## Default Owner Account

After running `seed.sql`, the owner account is created with:

| Field | Value |
|---|---|
| Employee ID | `VB-0001` |
| Password | `VbOwner#Reset2026!` |

> ⚠️ **The app will force a password change on first login** (`must_change_password = true` is set). Change to a strong personal password immediately.

---

## Building the App

EAS is configured with three build profiles:

| Profile | Type | Notes |
|---|---|---|
| `development` | APK (debug) | Includes dev client, internal distribution |
| `preview` | APK (release) | Internal distribution, no dev client |
| `production` | APK (release) | Production channel, internal distribution |

```bash
# Development build (with dev client)
npm run build:dev
# or
eas build --platform android --profile development

# Preview APK (release, no dev client)
eas build --platform android --profile preview

# Production APK
npm run build:prod
# or
eas build --platform android --profile production
```

App version is sourced from EAS remote (`appVersionSource: remote`). Update version in the EAS dashboard before building.

### GitHub Actions (automated production builds)

Pushing a version bump to `app.json` on `main` triggers [`.github/workflows/build-production.yml`](.github/workflows/build-production.yml), which:

1. Runs `expo prebuild` and builds a signed release APK (arm64-v8a)
2. Publishes a GitHub Release with the APK attached
3. Updates Supabase `app_settings` (`latest_version`, `download_url`) automatically

You can also trigger the workflow manually via **Actions → Build Production APK → Run workflow**.

Required GitHub repository secrets: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_PROJECT_ID`, `GOOGLE_SERVICES_JSON`, `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY`.

---

## OTA Updates (Expo Updates)

The app uses Expo Updates for over-the-air JS bundle updates without a full APK rebuild.

```bash
eas update --branch production --message "Fix: ..."
```

The runtime version policy is `appVersion` — OTA updates are compatible within the same native app version.

---

## In-App APK Update System

After login, `UpdateChecker` compares the installed version against Supabase `app_settings`:

| Key | Description |
|---|---|
| `latest_version` | If the installed version is below this, users see an **optional** update prompt |
| `download_url` | Direct APK URL used for in-app download/install or browser fallback |

Set these in Supabase Dashboard → Table Editor → `app_settings`, or let the [GitHub Actions release workflow](.github/workflows/build-production.yml) update them automatically when a new APK is published.

The app downloads the APK, then opens the Android package installer (`REQUEST_INSTALL_PACKAGES` permission). Users may need to allow **Install unknown apps** for VEBOSSO EMS in Settings.

> Legacy keys from older migrations (`minimum_app_version`, `latest_app_version`, `apk_download_url`) are not read by the current app code — use `latest_version` and `download_url`.

---

## Edge Functions

| Function | Method | Auth Required | Description |
|---|---|---|---|
| `create-member` | POST | Owner JWT | Create a new auth user + profile row |
| `admin-update-member` | POST | Owner JWT | Update password or delete a member |
| `force-logout` | POST | Owner JWT | Remotely sign out a user and invalidate sessions |
| `send-push-notification` | POST | Owner JWT | Send Expo push notification to one or all users |

---

## Database Schema

| Table | Purpose |
|---|---|
| `profiles` | Employee data, roles, manager assignments |
| `work_logs` | Daily check-in/check-out records with approval state + `check_out_photos` |
| `tasks` | Task assignments with status and completion notes |
| `announcements` | Broadcasts targeted by role or individual user |
| `leave_requests` | Leave submissions with approval workflow |
| `notifications` | Per-user in-app notification feed (read/unread) |
| `backfill_permissions` | One-time owner-granted permission to log a missed attendance day |
| `sessions` | Active session tracking for force-logout |
| `app_settings` | Global config including version control settings |

RLS is enabled on all tables. Policies are defined by role (`owner`, `manager`, `member`) with helper functions `is_owner()`, `get_user_role()`, and `is_manager_of(uuid)`. The private `checkouts` Storage bucket has its own RLS policies. A `SECURITY DEFINER` RPC `force_logout_user(uuid)` clears a target user's Supabase Auth sessions and refresh tokens. Migration `012` adds a `BEFORE DELETE` trigger on `profiles` that removes the deleted user's checkout photos from Storage.

---

## Project Structure

```
├── app.json                          # Expo config (v1.2.7, bundle: com.vebosso.ems)
├── eas.json                          # EAS build profiles
├── .env.example                      # Environment variable template
├── plugins/withApkInstaller.js       # Expo config plugin for in-app APK install
├── .github/workflows/
│   └── build-production.yml          # CI: signed APK build + GitHub Release + Supabase version sync
├── src/
│   ├── app/
│   │   ├── _layout.tsx               # Root layout — auth guard, theme, version check
│   │   ├── index.tsx                 # Entry redirect
│   │   ├── (auth)/
│   │   │   ├── login.tsx             # Employee ID + password login
│   │   │   ├── change-password.tsx   # Voluntary password change
│   │   │   └── force-change-password.tsx  # Forced on first login
│   │   ├── (owner)/
│   │   │   ├── dashboard.tsx         # Live stats, team overview
│   │   │   ├── approvals.tsx         # Pending check-in/out approvals
│   │   │   ├── tasks.tsx             # All tasks across company
│   │   │   ├── history.tsx           # Company-wide attendance history
│   │   │   ├── notifications.tsx     # In-app notification log
│   │   │   ├── member/[id].tsx       # Member detail + admin actions
│   │   │   ├── team/
│   │   │   │   ├── index.tsx         # Full team member list
│   │   │   │   └── add-member.tsx    # Create new member form
│   │   │   └── settings/
│   │   │       ├── index.tsx         # App settings screen
│   │   │       ├── announcements.tsx # Create/manage announcements
│   │   │       └── session-management.tsx # Force-logout sessions
│   │   ├── (manager)/
│   │   │   ├── dashboard.tsx         # Team stats, pending approvals
│   │   │   ├── approvals.tsx         # Team check-in/out & leave approvals
│   │   │   ├── tasks.tsx             # Team task management
│   │   │   ├── my-team.tsx           # Manager's assigned team
│   │   │   ├── history.tsx           # Team attendance history
│   │   │   ├── notifications.tsx     # In-app notification log
│   │   │   ├── settings.tsx          # Manager profile & password
│   │   │   └── leaves.tsx            # Manager's own leave request history & application
│   │   └── (member)/
│   │       ├── home.tsx              # Check-in/checkout + today's status
│   │       ├── tasks.tsx             # My tasks list
│   │       ├── history.tsx           # My attendance calendar
│   │       ├── announcements.tsx     # Announcements feed
│   │       ├── notifications.tsx     # In-app notification log
│   │       ├── profile.tsx           # My profile & password change
│   │       └── leaves.tsx            # My leave request history & application
│   ├── components/                   # Shared UI (CheckInModal, CheckOutModal, UpdateChecker,
│   │                                 #   NotificationBell, BackfillModal, LeaveCard, etc.)
│   ├── lib/
│   │   ├── supabase.ts               # Supabase client init
│   │   ├── notifications.ts          # Expo push notification helpers
│   │   ├── versionCheck.ts           # App version gate logic
│   │   ├── errors.ts                 # Typed error handling
│   │   └── alert.ts                  # Cross-platform alert utility
│   ├── store/
│   │   ├── authStore.ts              # Auth state, sign in/out, profile
│   │   ├── workStore.ts              # Work logs, tasks, approvals, announcements
│   │   └── notificationStore.ts      # In-app notifications state
│   ├── constants/                    # Colors, roles
│   ├── types/                        # TypeScript types (database, app)
│   └── theme/                        # Theme config
├── supabase/
│   ├── migrations/                   # 15 ordered SQL migrations
│   ├── functions/                    # 4 Deno edge functions
│   ├── scripts/                      # Helper SQL scripts (e.g. fix-owner-account.sql)
│   └── seed.sql                      # Owner account seed
└── assets/                           # Icons, splash, images
```

---

## Brand Colors

| Name | Hex | Usage |
|---|---|---|
| Light Gray | `#F2F2F7` | Main App background (iOS System Gray 6) |
| Pure White | `#FFFFFF` | Element & card surfaces |
| Solid Black | `#000000` | Primary Accent / Button styling |
| Success Emerald | `#047857` | Approved status, Done, Member Accent |
| Warning Amber | `#B45309` | Pending states, Leaves Accent |
| Error Red | `#BE123C` | Rejected status, Errors |
| Info Blue | `#2563EB` | Announcements, Manager Accent |

---

## Troubleshooting

**Owner login not working after seed?**
Run in order in Supabase SQL Editor:
1. `supabase/migrations/003_profile_self_read.sql`
2. `supabase/scripts/fix-owner-account.sql`

Then sign in with `VB-0001` / `VbOwner#Reset2026!`.

**Push notifications not arriving?**
- Ensure `EXPO_PUBLIC_PROJECT_ID` is set in `.env`
- Ensure the `send-push-notification` edge function is deployed
- Physical device required (push doesn't work on simulator)

**Build fails with missing google-services.json?**
- Add your Firebase `google-services.json` to the project root (required by `app.json` for Android FCM)

---

## License

Private — VEBOSSO © 2026.
