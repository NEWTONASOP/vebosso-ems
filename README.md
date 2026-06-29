# VEBOSSO EMS — Employee Management System

A production-quality Employee Management System built with **Expo SDK 56**, **React Native**, **TypeScript**, and **Supabase**.

## Features

### Role-Based Access
- **Owner** — Full access: manage members, approve check-ins, view all data, send announcements, manage sessions
- **Manager** — Team management: approve team check-ins, view team history
- **Member** — Personal: check-in/checkout, view tasks, track history

### Core Flows
- ✅ Check-in with daily plan submission
- ⏳ Approval workflow (Owner/Manager approves or rejects)
- 📝 Day-end checkout with summary report
- 📋 Task management and assignment
- 📢 Announcements system
- 📅 Calendar-based attendance history
- 🔔 Push notifications (Expo Push Service)
- 🔒 Force logout & session management
- 📊 Real-time dashboard with live stats

### Technical Highlights
- Supabase Realtime subscriptions for live updates
- Row Level Security (RLS) for data isolation
- Zustand for global state management
- SQLite-based auth session persistence
- React Native Paper (Material Design 3)
- Reanimated 4 animations (pulse, fade, transitions)
- Loading skeletons and empty states
- Offline detection banner

---

## Quick Start

### Prerequisites
- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- Supabase account: [supabase.com](https://supabase.com)
- EAS CLI (for builds): `npm install -g eas-cli`

### 1. Install Dependencies
```bash
cd "VEBOSSO EMS"
npm install
```

### 2. Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Go to **SQL Editor** and run these files in order:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_rls_policies.sql`
   - `supabase/seed.sql`

### 3. Configure Environment
```bash
cp .env.example .env
```
Edit `.env` and fill in your Supabase credentials:
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Enable Realtime
In Supabase Dashboard → Database → Replication:
- Enable Realtime on: `work_logs`, `tasks`, `announcements`

### 5. Deploy Edge Functions
```bash
supabase functions deploy force-logout
supabase functions deploy create-member
supabase functions deploy send-push-notification
```

### 6. Run the App
```bash
npx expo start
```

### 7. Build Android APK
```bash
# Preview APK (release mode)
eas build --platform android --profile preview

# Development APK (with dev client)
eas build --platform android --profile development
```

---

## Default Owner Account
After running `seed.sql`:
- **Employee ID:** `VB-0001`
- **Password:** `VebossoOwner@2024`

> ⚠️ Change the password immediately after first login!

**Owner login not working?** Run these in Supabase SQL Editor (in order):
1. `supabase/migrations/003_profile_self_read.sql`
2. `supabase/scripts/fix-owner-account.sql`

Then sign in again with `VB-0001` / `VebossoOwner@2024`.

---

## Project Structure
```
├── app.json                    # Expo configuration
├── eas.json                    # EAS Build profiles
├── src/
│   ├── app/
│   │   ├── _layout.tsx         # Root layout (auth guard, theme)
│   │   ├── index.tsx           # Entry redirect
│   │   ├── (auth)/             # Login, password change
│   │   ├── (owner)/            # Owner tabs + settings stack
│   │   ├── (manager)/          # Manager tabs
│   │   └── (member)/           # Member tabs
│   ├── components/             # Shared UI components
│   ├── lib/                    # Supabase client, notifications
│   ├── store/                  # Zustand stores
│   ├── constants/              # Colors, roles
│   └── types/                  # TypeScript types
├── supabase/
│   ├── migrations/             # SQL schema + RLS
│   ├── functions/              # Edge Functions (Deno)
│   └── seed.sql                # Owner account seed
└── assets/                     # Images, icons
```

---

## Tech Stack
| Technology | Purpose |
|---|---|
| Expo SDK 56 | App framework (managed workflow) |
| React Native 0.85 | UI framework |
| TypeScript 6 | Type safety |
| Supabase | Auth, Database, Realtime, Edge Functions |
| Zustand | Global state management |
| React Native Paper | Material Design 3 components |
| Expo Router | File-based navigation |
| React Native Reanimated 4 | Animations |
| date-fns | Date formatting |

---

## Brand Colors
| Color | Hex | Usage |
|---|---|---|
| Dark Navy | `#0A0F1E` | Primary background |
| Electric Blue | `#2563EB` | Accent / actions |
| Success Green | `#10B981` | Approved, active |
| Warning Amber | `#F59E0B` | Pending |
| Error Red | `#EF4444` | Rejected, errors |

---

## License
Private — VEBOSSO © 2024
