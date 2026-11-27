# CLAUDE.md — VEBOSSO EMS

Internal app for VEBOSSO (events: bills, accounts, leads, venues) and its team (attendance, tasks, leave).
Expo SDK 56 · React Native 0.85 · TypeScript · Supabase. Android APK + web (Vercel). See README.md for setup and releases.

## Hard rules

- **Never commit, push, publish an OTA, build, or run a workflow without an explicit "yes" in that moment.**
  A push to `main` ships to production by itself: a version bump in `app.json` builds an APK and bumps
  `latest_version`, any other push publishes an OTA, and the web deploys to Vercel.
- **Never touch the Supabase database without asking first, not even a read-only query.** It is the live
  company database. Write migrations as files; the user runs them (or approves running a specific one).
- **Everything is on free plans** (Supabase, Expo, Vercel, Firebase, GitHub Actions). Don't propose paid
  features. APKs are built in GitHub Actions, not EAS Build, on purpose.
- Don't change things that weren't asked for. Small, surgical edits that match the existing style.

## Verifying a change

- `npx tsc --noEmit -p .` must pass. For pure logic (parsers, layout, date maths), a quick Node test is fine.
- **No mock app / Playwright screenshot runs.** The user tests on their phone. Say clearly what was only
  type-checked and what to check on the device.
- Trigger/RLS logic can be tested in PGlite locally; never against the real database.

## Shipping: OTA or APK?

- `runtimeVersion` policy is `appVersion`: an OTA reaches only phones on the **same** app version.
- JS/TS-only change → OTA is possible. Native change (anything in `modules/`, `plugins/`, `app.json`
  plugins or permissions, a new native package) → needs a version bump and a new APK.
- The user prefers big batches as an APK. When something needs a migration, say so, and say it must be run
  **before** the app code that needs it goes out.

## Database / migrations

- Files in `supabase/migrations/`, numbered in order (latest is `079_bill_printed.sql`; next is `080_…`).
  Never edit a migration that has already been run — add a new one.
- Access is enforced in the database: RLS through `access_ok`, `access_list_ok` and `has_feature`
  (access rules, 062–068). A UI check alone is never enough.
- When a function or trigger is redefined in a new migration, the new file must contain the **whole**
  function, including what earlier migrations added (e.g. `bills_before_write`).
- Keep `src/types/database.ts` in step with new columns, and make the app cope with an unmigrated
  database where reasonable (e.g. fall back if a new column is missing).

## Code conventions

- Each file starts with a `// ====` banner saying in plain words what it is for. Comments explain *why*,
  in plain language, not what the code obviously does.
- Roles: `owner`, `manager`, `member`. Owner-only things check `profile.role === 'owner'`
  (`useAuthStore`). Managers and members reuse the owner's screens through re-exports
  (`src/app/(member)/bills/index.tsx` → `(owner)/bills/index`), so a change in an owner screen
  usually reaches everyone with access. Guard owner-only parts explicitly.
- Use the existing building blocks:
  - `AppTheme` / `screenChrome` / `appSoftShadow` from `src/constants/theme.ts`
  - `SheetFrame` for bottom sheets
  - `Alert` from `src/lib/alert.ts`, not React Native's (web)
  - `SmoothTextInput` for search boxes (keeps focus while results change on Android)
- Brands: VEBOSSO and Navgrah (`src/lib/billBrands.ts`). Bill kinds: estimate, client, package.
- React Native Paper menus on wide web screens: screens get padding through `sceneStyle`
  (`useDesktopSceneStyle`), never through page CSS, or menus open off-screen.
- On Windows, multi-line edits with quotes break bash heredocs; write a small Python patch script in the
  scratchpad instead, asserting each replaced string occurs exactly once.

## Working with the user

- They test on an Android phone and on the web, often with Metro running. Remind them to reload
  (`r`, or `npx expo start -c`) when a change won't show.
- UI taste: clean and restrained. Avoid gimmicky "AI-looking" touches (coloured side stripes, heavy bands,
  emoji). Don't add rows or space to compact cards. Short, plain labels.
- Ask before choosing between real alternatives (where to store something, DB vs device); otherwise
  pick the sensible default and say what was chosen.
- When reporting, say what changed, where, what was verified, and that nothing is committed.
