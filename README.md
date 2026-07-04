# VEBOSSO EMS — Employee Management System

> A production-quality Employee Management System built for internal workforce management, powered by **Expo SDK 56**, **React Native 0.85**, **TypeScript 6**, and **Supabase**.

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
- 📝 **Day-end Checkout** — Submit end-of-day summary; total hours auto-calculated
- 📋 **Task Management** — Create, assign, track, and complete tasks with notes
- 📢 **Announcements** — Targeted to all, managers, members, or a specific user
- 📅 **Attendance History** — Calendar view of all work logs per user
- 🏖️ **Leave Requests** — Submit, approve, or reject leave requests
- 📊 **Real-time Dashboard** — Live stats via Supabase Realtime subscriptions
- 🔔 **Push Notifications** — Expo Push Service for check-in/task alerts
- 🔒 **Force Logout & Session Management** — Owner can remotely invalidate sessions
- 🔄 **Forced App Updates** — Version gate with minimum version enforcement
- 👥 **Member Management** — Owner can add, edit, delete members, assign managers
- 🌐 **Offline Detection** — Banner shown when network is unavailable

### Technical Highlights
- Supabase Realtime for live work log / task / announcement updates
- Row Level Security (RLS) on all 7 database tables
- 4 Deno Edge Functions for privileged operations
- Zustand v5 global state with typed stores
- Auth session persisted via Expo SQLite
- React Native Reanimated 4 animations
- Inter font (400–800) with Material Design 3 via React Native Paper
- Error Boundary with graceful recovery
- Loading skeleton states and empty state components
- Expo Updates (OTA) + EAS build pipeline

---

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| Expo | ~56.0.12 | App framework (managed workflow) |
| React Native | 0.85.3 | UI framework |
| React | 19.2.3 | UI runtime |
| TypeScript | ~6.0.3 | Type safety |
| Supabase JS | ^2.108.2 | Auth, Database, Realtime, Edge Functions |
| Zustand | ^5.0.14 | Global state management |
| React Native Paper | ^5.15.3 | Material Design 3 components |
| Expo Router | ~56.2.11 | File-based navigation |
| React Native Reanimated | 4.3.1 | Animations |
| date-fns | ^4.4.0 | Date formatting |
| @expo-google-fonts/inter | ^0.4.2 | Typography |
| NetInfo | 12.0.1 | Offline detection |

---

## Prerequisites

- **Node.js** 18+
- **Expo CLI**: `npm install -g expo-cli`
- **EAS CLI** (for builds): `npm install -g eas-cli`
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
supabase/migrations/001_initial_schema.sql      — Tables, indexes, triggers
supabase/migrations/002_rls_policies.sql        — Row Level Security policies
supabase/migrations/003_profile_self_read.sql   — Profile self-read fix
supabase/migrations/003_manager_assignment_updates.sql — Manager assignment support
supabase/migrations/004_app_update_system.sql   — Version control & forced updates
supabase/migrations/005_task_completion_notes.sql — Task completion notes & timestamps
supabase/migrations/006_fix_tasks_assigned_by_cascade.sql — Soft-delete for assigned_by
supabase/migrations/007_security_hardening.sql  — RLS triggers, privilege escalation prevention, constraints
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

### 5. Deploy Edge Functions

```bash
supabase functions deploy create-member
supabase functions deploy admin-update-member
supabase functions deploy force-logout
supabase functions deploy send-push-notification
```

### 6. Run the App

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

---

## OTA Updates (Expo Updates)

The app uses Expo Updates for over-the-air JS bundle updates without a full APK rebuild.

```bash
eas update --branch production --message "Fix: ..."
```

The runtime version policy is `appVersion` — OTA updates are compatible within the same native app version.

---

## Forced App Update System

The app checks `app_settings` on startup for:

| Key | Description |
|---|---|
| `minimum_app_version` | If current version is below this, user is blocked until they update |
| `latest_app_version` | If current version is below this, user sees an optional update prompt |
| `update_message` | Custom message shown on the update screen |
| `apk_download_url` | Direct APK download URL opened when user taps "Update" |

Set these in Supabase Dashboard → Table Editor → `app_settings`.

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
| `work_logs` | Daily check-in/check-out records with approval state |
| `tasks` | Task assignments with status and completion notes |
| `announcements` | Broadcasts targeted by role or individual user |
| `leave_requests` | Leave submissions with approval workflow |
| `sessions` | Active session tracking for force-logout |
| `app_settings` | Global config including version control settings |

RLS is enabled on all tables. Policies are defined by role (`owner`, `manager`, `member`) with helper functions `is_owner()`, `get_user_role()`, and `is_manager_of(uuid)`.

---

## Project Structure

```
├── app.json                          # Expo config (v1.1, bundle: com.vebosso.ems)
├── eas.json                          # EAS build profiles
├── .env.example                      # Environment variable template
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
│   │   │   ├── team.tsx              # Full team member list
│   │   │   ├── history.tsx           # Company-wide attendance history
│   │   │   ├── member/[id].tsx       # Member detail + admin actions
│   │   │   └── settings/
│   │   │       ├── index.tsx         # App settings screen
│   │   │       ├── add-member.tsx    # Create new member form
│   │   │       ├── announcements.tsx # Create/manage announcements
│   │   │       └── session-management.tsx # Force-logout sessions
│   │   ├── (manager)/
│   │   │   ├── dashboard.tsx         # Team stats, pending approvals
│   │   │   ├── approvals.tsx         # Team check-in/out approvals
│   │   │   ├── tasks.tsx             # Team task management
│   │   │   ├── my-team.tsx           # Manager's assigned team
│   │   │   ├── history.tsx           # Team attendance history
│   │   │   └── settings.tsx          # Manager profile & password
│   │   └── (member)/
│   │       ├── home.tsx              # Check-in/checkout + today's status
│   │       ├── tasks.tsx             # My tasks list
│   │       ├── history.tsx           # My attendance calendar
│   │       ├── announcements.tsx     # Announcements feed
│   │       └── profile.tsx           # My profile & password change
│   ├── components/                   # 22 shared UI components
│   ├── lib/
│   │   ├── supabase.ts               # Supabase client init
│   │   ├── notifications.ts          # Expo push notification helpers
│   │   ├── versionCheck.ts           # App version gate logic
│   │   ├── errors.ts                 # Typed error handling
│   │   └── alert.ts                  # Cross-platform alert utility
│   ├── store/
│   │   ├── authStore.ts              # Auth state, sign in/out, profile
│   │   └── workStore.ts              # Work logs, tasks, approvals, announcements
│   ├── constants/                    # Colors, roles
│   ├── types/                        # TypeScript types (database, app)
│   └── theme/                        # Theme config
├── supabase/
│   ├── migrations/                   # 6 ordered SQL migrations
│   ├── functions/                    # 4 Deno edge functions
│   ├── scripts/                      # Helper SQL scripts
│   └── seed.sql                      # Owner account seed
└── assets/                           # Icons, splash, images
```

---

## Brand Colors

| Name | Hex | Usage |
|---|---|---|
| Dark Navy | `#0A0F1E` | Primary background |
| Electric Blue | `#2563EB` | Accent, actions, notifications |
| Success Green | `#10B981` | Approved, active, working |
| Warning Amber | `#F59E0B` | Pending states |
| Error Red | `#EF4444` | Rejected, errors, danger |

---

## Troubleshooting

**Owner login not working after seed?**
Run in order in Supabase SQL Editor:
1. `supabase/migrations/003_profile_self_read.sql`
2. `supabase/scripts/fix-owner-account.sql`

Then sign in with `VB-0001` / `VEBOSSO`.

**Push notifications not arriving?**
- Ensure `EXPO_PUBLIC_PROJECT_ID` is set in `.env`
- Ensure the `send-push-notification` edge function is deployed
- Physical device required (push doesn't work on simulator)

**Build fails with missing google-services.json?**
- Add your Firebase `google-services.json` to the project root (required by `app.json` for Android FCM)

---

## License

Private — VEBOSSO © 2026.
