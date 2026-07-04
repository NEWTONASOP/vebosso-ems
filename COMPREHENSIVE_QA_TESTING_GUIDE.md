# VEBOSSO EMS — COMPREHENSIVE QA TESTING GUIDE
## Code-Accurate, Exhaustive Testing Documentation

**Generated:** Based on complete codebase analysis  
**App Version:** 1.0.0  
**Test Environment:** Development Build (APK)  
**Database:** Supabase PostgreSQL with RLS enabled  
**Realtime:** Enabled on work_logs, tasks, announcements

---

## 📋 TABLE OF CONTENTS

1. [Live Coordination Script](#section-1-live-coordination-script)
2. [Owner Role Checklist](#section-2-owner-role-granular-checklist)
3. [Manager Role Checklist](#section-3-manager-role-granular-checklist)
4. [Member Role Checklist](#section-4-member-role-granular-checklist)

---

# SECTION 1: LIVE COORDINATION SCRIPT

**Test Duration:** ~45-60 minutes  
**Required Devices:** 3 Android devices  
**Testers:** 3 people sitting together  
**Prerequisites:**
- Fresh database with owner account seeded
- All 3 devices connected to the same network
- Push notifications enabled on all devices

## Pre-Test Setup

**Tester 1 (Owner):**
- Login as: `VB-0001` / `VbOwner#Reset2026!`
- Force change password to: `Owner@2026!`

**Tester 2 (Manager) — NOT YET LOGGED IN**  
**Tester 3 (Member) — NOT YET LOGGED IN**

---

## Live Coordination Test Script

| Step | Who | Action | Expected Result |
|------|-----|--------|-----------------|
| **1** | **Owner** | Navigate to Settings → Add New Member | Add Member screen displays with form |
| **2** | **Owner** | Create Manager: Full Name = "QA Manager", Employee ID = "VB-0002", Role = "Manager", Department = "QA Team", Password = "Manager@2026!" → Tap "Create Member" | Success message appears: "Member created successfully! 🎉". Credentials screen shows Employee ID and password in a copyable box |
| **3** | **Owner** | Tap "Copy Credentials" button | Snackbar shows "Credentials copied to clipboard!" |
| **4** | **Owner** | Tap "Add Another Member" | Form resets, Employee ID auto-increments to "VB-0003" |
| **5** | **Owner** | Create Member: Full Name = "QA Member", Employee ID = "VB-0003", Role = "Member", Department = "QA Team", Manager = Select "QA Manager" chip, Password = "Member@2026!" → Tap "Create Member" | Success message and credentials displayed |
| **6** | **Owner** | Tap "Back to Settings" | Returns to Settings screen |
| **7** | **Manager** | On Tester 2's device, open app → Login with: `VB-0002` / `Manager@2026!` | Force Change Password screen appears with emoji 🔐 and message "Your admin has set a temporary password" |
| **8** | **Manager** | Enter New Password: "SecureManager@2026!", Confirm Password: "SecureManager@2026!" → Check password strength shows "Strong" with green bar at 100% → Tap "Set New Password" | Navigates to Manager Dashboard. Top shows "Good morning, QA Manager" with stats showing: Total Team: 1, Active Now: 0, Pending Approvals: 0, On Leave: 0 |
| **9** | **Member** | On Tester 3's device, open app → Login with: `VB-0003` / `Member@2026!` | Force Change Password screen appears |
| **10** | **Member** | Enter New Password: "SecureMember@2026!", Confirm Password: "SecureMember@2026!" → Tap "Set New Password" | Navigates to Member Home screen showing "Not Checked In" status with green "Check In" button |
| **11** | **Member** | Tap "Check In" button | Check-in modal opens with title "Start Your Day" |
| **12** | **Member** | Enter plan: "1. Review QA testing documentation\n2. Execute test cases\n3. Log defects in tracker" (150 chars) → Tap "Submit Check-in" | Modal closes. Home screen updates to show: Status = "Pending Approval" with orange dot, Check-in Time displays current time, Plan text shows entered text. Yellow banner appears: "Waiting for manager approval..." |
| **13** | **Manager** | Check device — Push notification should appear | Notification shows: "Check-in Request — QA Member has checked in and is waiting for approval" |
| **14** | **Owner** | Check device — Push notification should appear | Notification shows: "Check-in Request — QA Member has checked in and is waiting for approval" |
| **15** | **Manager** | Tap notification OR navigate to Approvals tab | Approvals screen shows 1 pending request in "Attendance (1)" tab. Card displays: QA Member (VB-0003), Time: [current time], Plan text, Two buttons: "Assign Task" and "Approve" |
| **16** | **Manager** | Tap "Assign Task" button on the approval card | Assign Task modal opens with title "Assign Task to QA Member", Form shows: Title field, Description field, Due Date picker (optional), "Assign & Approve" button |
| **17** | **Manager** | Enter: Title = "Complete Login Flow Testing", Description = "Test all login scenarios including edge cases", Leave Due Date empty → Tap "Assign & Approve" | Modal closes. Snackbar shows "Approved & task assigned ✅". Approval card disappears from list. Empty state shows "All caught up!" with icon |
| **18** | **Member** | Check device — Push notification should appear twice | 1st notification: "Check-in Approved! ✅ — Your check-in has been approved. Have a productive day!". 2nd notification: "New Task Assigned 📋 — Complete Login Flow Testing" |
| **19** | **Member** | Member Home screen auto-updates (realtime) | Status changes to: "Working" with green dot. Check-in time displayed. Plan text shown. "Check Out" button appears in green. Yellow approval banner disappears |
| **20** | **Member** | Navigate to Tasks tab | Task screen shows 1 task with: Status = "Pending" (grey dot and badge), Title = "Complete Login Flow Testing", Description visible, No due date shown, Progress shows 0/1 completed |
| **21** | **Member** | Tap on the task card | Task expands to show full description. Three status buttons appear: "Pending", "Start Task", "Mark as Done" |
| **22** | **Member** | Tap "Start Task" button | Button becomes "In Progress" with blue styling. Status badge updates to "Running" with blue dot. Snackbar: "Task updated" |
| **23** | **Manager** | Navigate to Dashboard → Check stats | Stats update in real-time: Active Now: 1 (increased from 0) |
| **24** | **Owner** | Navigate to Dashboard → Check stats | Stats update in real-time: Active Members: 1, Total Check-ins Today: 1, Pending Approvals: 0 |
| **25** | **Member** | On task, tap "Mark as Done" button | "Complete Task" modal opens with textarea for "Completion Notes (optional)" and "Complete Task" button |
| **26** | **Member** | Enter completion note: "All test cases passed. No defects found." → Tap "Complete Task" | Modal closes. Task status updates to "Completed" with green checkmark. Status badge shows "Completed" in green. Snackbar: "Task completed! ✅". Progress updates to 1/1 completed with 100% bar |
| **27** | **Member** | Navigate to Home → Tap "Check Out" button | Check-out modal opens with title "End Your Day", Textarea for "Day Summary" (max 3000 chars), "Submit Check-out" button |
| **28** | **Member** | Enter summary: "Successfully completed login flow testing. Documented 15 test cases covering positive and negative scenarios. All tests passed without issues." → Tap "Submit Check-out" | Modal closes. Home screen updates: Status = "Pending Checkout" with orange dot, Check-out time displays, Day report text shown, Total Hours calculated (e.g., "7.5h" if 7.5 hours elapsed), Banner: "Waiting for checkout approval..." |
| **29** | **Manager** | Check device — Push notification appears | Notification: "Checkout Request — QA Member has checked out and is waiting for approval" |
| **30** | **Manager** | Navigate to Approvals → Check Attendance tab | Shows 1 pending checkout request. Card displays: QA Member, Check-in time, Check-out time, Total Hours, Day Report text, "Approve" and "Reject" buttons |
| **31** | **Manager** | Tap "Approve" button | Snackbar: "Approved ✅". Card disappears. Empty state returns |
| **32** | **Member** | Check device — Push notification appears | Notification: "Checkout Approved! 🎉 — Your checkout and day report have been approved. Great work!" |
| **33** | **Member** | Member Home screen auto-updates | Status: "Done" with green checkmark, Total hours displayed, Check-in and Check-out buttons disabled/hidden, Green success banner: "Day completed!" |
| **34** | **Owner** | Navigate to Team → Tap on "QA Member" card | Context menu appears with 3 options: "Assign Task", "Assign Manager", "Manage Profile" |
| **35** | **Owner** | Tap "Manage Profile" | Navigates to Member Detail screen showing: Profile avatar with initials "QM", Full name, Employee ID, Role badge, Department, Manager assignment, Active status indicator, Two action cards: "Update Password" and "Delete Member" |
| **36** | **Member** | Navigate to Announcements tab | Shows empty state: "No Announcements — You'll see company announcements here" with bullhorn icon |
| **37** | **Owner** | Navigate to Settings → Announcements | Announcements screen with "New" button in header |
| **38** | **Owner** | Tap "+ New" button | Form appears: Title field, Message textarea, Target Audience segmented control with "Everyone", "Managers", "Members", "Send Announcement" button |
| **39** | **Owner** | Enter: Title = "Welcome to VEBOSSO EMS", Message = "Welcome to our new Employee Management System! Please check in daily and complete your assigned tasks on time.", Target = "Everyone" → Tap "Send Announcement" | Snackbar: "Announcement sent! 📢". Form collapses. Announcement appears in list below with timestamp and "Everyone" badge |
| **40** | **Member** | Check device — Push notification appears | Notification: "New Announcement: Welcome to VEBOSSO EMS — Welcome to our new Employee Management System!..." |
| **41** | **Member** | Announcements screen auto-updates (realtime) | Announcement card appears showing: Title, Body text, Creator info "VB-0001 Owner", Timestamp, Purple "All" badge |
| **42** | **Manager** | Navigate to Announcements | Announcement visible with same details |
| **43** | **Member** | Navigate to Profile → Tap "My Leaves" | Leaves screen shows empty state: "No Leave Requests — You haven't requested any leaves yet" with "Apply for Leave" button |
| **44** | **Member** | Tap "Apply" button in header | Leave Request modal opens with: Date picker (future dates only), Reason textarea (max 500 chars), "Submit Request" button |
| **45** | **Member** | Select tomorrow's date, Enter reason: "Personal medical appointment" → Tap "Submit Request" | Modal closes. Snackbar: "Leave request submitted successfully! ✈️". Leave card appears with: Date, Reason, Status badge "Pending" (orange), No reviewer shown yet |
| **46** | **Manager** | Navigate to Approvals → Tap "Leaves" tab | Tab shows: "Leaves (1)". One leave request card displays: QA Member (VB-0003), Date: [tomorrow], Reason: "Personal medical appointment", Status: Pending, "Approve" and "Reject" buttons |
| **47** | **Manager** | Tap "Approve" button | Snackbar: "Leave request approved ✅". Card updates: Status badge changes to "Approved" (green), Reviewed by "QA Manager" shown, Reviewed timestamp displayed, Action buttons hidden |
| **48** | **Member** | Leaves screen auto-updates (realtime) | Leave card updates: Status badge = "Approved" (green), Reviewed by "VB-0002 Manager" shown, Reviewed timestamp visible |
| **49** | **Owner** | Navigate to History tab | Attendance History screen with "Select a member" button |
| **50** | **Owner** | Tap "Select a member" → Select "QA Member" | Modal closes. Calendar for current month displays with: Today's date has green border with emerald background and green "7.5h" indicator, Legend at bottom shows: Working (green), Pending Approval (orange), Pending Checkout (orange), Done (green), Rejected (red) |
| **51** | **Owner** | Tap on today's date in calendar | Work Log Detail modal opens showing: Date, Status badge "Done", Check-in Time, Check-in Plan text, Check-out Time, Day Report text, Total Hours: 7.5h, Task section showing 1 completed task with title, completion note, "Close" button at bottom |
| **52** | **Owner** | Navigate to Settings → Session Management | Active Sessions screen shows 3 sessions: Owner session, Manager session, Member session. Each card shows: Full name, Employee ID, Device info "Mobile App", "Active 2 minutes ago" timestamp, Green "Active" badge with dot, Red "Logout" button |
| **53** | **Owner** | Tap "Logout" button on Member's session | Alert confirms: "Are you sure you want to force logout QA Member?" → Tap "Force Logout" |
| **54** | **Owner** | Confirm logout | Snackbar: "QA Member has been logged out." Session card disappears from list |
| **55** | **Member** | Device immediately signs out | App navigates to Login screen automatically. No error message shown, clean logout |
| **56** | **Member** | Login again with: `VB-0003` / `SecureMember@2026!` | Successfully logs in to Member Home. All previous data intact (work logs, tasks, leaves preserved) |
| **57** | **Owner** | Navigate to Settings → Check "Require Checkout Approval" toggle | Toggle is currently OFF (grey) |
| **58** | **Owner** | Tap toggle to enable | Toggle turns green/blue. No snackbar (setting saved silently) |
| **59** | **All** | Pull down on any screen to refresh | Loading spinner appears at top. Data refreshes. All screens show updated real-time data |
| **60** | **Manager** | Force-close the app (swipe away from recents) → Reopen app | Auto-logs in without showing login screen (session persisted). Lands on Manager Dashboard. All data synced |

**END OF LIVE COORDINATION TEST**

---

# SECTION 2: OWNER ROLE GRANULAR CHECKLIST

## 2.1 Authentication & Session

### Login Flow
- [ ] Can login with Employee ID `VB-0001` (without "VB-" prefix)
- [ ] Can login with Employee ID `0001` (auto-adds VB- prefix)
- [ ] Can login with Employee ID `OWNER` (special mapping)
- [ ] Login form shows "VB-" prefix automatically in Employee ID field
- [ ] Password field has eye icon toggle for show/hide
- [ ] Login button shows spinner when authenticating
- [ ] Login button disabled while loading
- [ ] Error shown when Employee ID empty
- [ ] Error shown when password empty
- [ ] Error message: "Invalid Employee ID or password. Please try again." for wrong credentials
- [ ] Error message: "Your account is not yet activated. Contact your admin." for unconfirmed email
- [ ] Error message: "Your account has been deactivated. Contact your admin." when `is_active = false`
- [ ] Error message: "Network error. Please check your connection and try again." when offline

### Force Change Password (First Login)
- [ ] Redirected to Force Change Password screen on first login (`must_change_password = true`)
- [ ] Screen shows emoji 🔐
- [ ] Title: "Change Your Password"
- [ ] Subtitle: "Your admin has set a temporary password. Please create a new secure password to continue."
- [ ] New Password field with eye icon toggle
- [ ] Confirm Password field with eye icon toggle
- [ ] Password strength bar displays: Weak (red, 25%), Fair (orange, 50%), Good (blue, 75%), Strong (green, 100%)
- [ ] Strength calculated based on: length ≥8, uppercase, number, special char
- [ ] Password requirements checklist shows 4 items with checkmarks that turn green when met:
  - [ ] At least 8 characters
  - [ ] At least one uppercase letter
  - [ ] At least one number
  - [ ] At least one special character
- [ ] Error: "Password must be at least 8 characters" if < 8 chars
- [ ] Error: "Passwords do not match" if fields don't match
- [ ] Error: "Please choose a stronger password" if strength < 50%
- [ ] "Set New Password" button disabled until all criteria met
- [ ] Successfully navigates to Owner Dashboard after password change
- [ ] `must_change_password` flag set to `false` in database after change

### Voluntary Password Change
- [ ] Navigate to Settings → Change Password
- [ ] Circular back button with arrow-left icon
- [ ] Screen title "Change Password"
- [ ] Same password validation as forced change
- [ ] Success snackbar: "Password changed successfully! ✓"
- [ ] Auto-navigates back to Settings after 1.5 seconds
- [ ] Can cancel and return to Settings

### Session Persistence
- [ ] After login, closing and reopening app auto-logs in (no login screen)
- [ ] Session survives app force-close (swipe from recents)
- [ ] Session survives device restart
- [ ] Lands on Owner Dashboard after auto-login

### Logout
- [ ] Settings → Sign Out button exists (red styling)
- [ ] Tapping shows alert: "Are you sure you want to sign out?"
- [ ] Alert has Cancel and Sign Out (destructive style)
- [ ] Sign Out navigates to Login screen
- [ ] All local session data cleared
- [ ] Reopening app shows Login screen (not auto-login)

---

## 2.2 Dashboard

### Header & Profile
- [ ] Header shows: "Good morning [Name]" if before 12 PM
- [ ] Header shows: "Good afternoon [Name]" if 12 PM - 5 PM
- [ ] Header shows: "Good evening [Name]" if after 5 PM
- [ ] Avatar circle with initials (2 letters, uppercase)
- [ ] Avatar has violet background (#8B5CF6)
- [ ] Employee ID shown below name
- [ ] Current date displayed (format: "Day, Month Date")

### Stats Cards
- [ ] 4 stat cards displayed:
  1. **Total Members** (violet icon: users)
  2. **Active Members** (green icon: activity)
  3. **Pending Approvals** (orange icon: clock)
  4. **On Leave Today** (blue icon: calendar)
- [ ] Each card shows numeric value and label
- [ ] Stat cards have white background with shadow
- [ ] Stats update in real-time when data changes
- [ ] Tap on "Pending Approvals" card navigates to Approvals tab
- [ ] Tap on "On Leave Today" card navigates to Approvals → Leaves tab

### Quick Actions
- [ ] 4 quick action cards displayed:
  1. **View Team** (violet) → Navigate to Team tab
  2. **Manage Approvals** (orange) → Navigate to Approvals tab
  3. **View History** (blue) → Navigate to History tab
  4. **Settings** (grey) → Navigate to Settings
- [ ] Each quick action has icon, title, subtitle
- [ ] Cards animate on press (scale 0.98, opacity 0.7)
- [ ] Cards have rounded corners (24px) and shadow

### Pull to Refresh
- [ ] Pull down gesture shows spinner
- [ ] Stats reload from database
- [ ] Spinner color matches accent (black)

---

## 2.3 Team Management

### Team Screen
- [ ] Header shows "Team"
- [ ] Subtitle shows count: "X members"
- [ ] Search bar with placeholder "Search by name or ID..."
- [ ] Search icon color: grey
- [ ] Search background: light grey with 1px border
- [ ] Horizontal filter pills:
  - [ ] "All" pill selected by default
  - [ ] "Managers" pill shows count
  - [ ] "Members" pill shows count
  - [ ] Department pills (dynamically generated from team member departments)
- [ ] Selected pill has blue background and blue text
- [ ] Unselected pills have white background and grey text
- [ ] Tapping pill filters list immediately
- [ ] Filtered count updates in real-time

### Member Card
- [ ] Card shows: Avatar with initials, Full name, Employee ID, Role badge, Department (if exists), Right chevron icon
- [ ] Role badge colors:
  - Owner: Violet background
  - Manager: Blue background
  - Member: Grey background
- [ ] Tapping card shows context menu with 3 options:
  1. **Assign Task** (clipboard icon)
  2. **Assign Manager** (supervisor icon)
  3. **Manage Profile** (account-cog icon)
- [ ] Context menu positions near tapped card
- [ ] Context menu has white background with shadow

### Search Functionality
- [ ] Typing in search filters list in real-time
- [ ] Matches against: full_name (case-insensitive), employee_id (case-insensitive)
- [ ] Shows empty state if no matches: "No members found — Try a different search term"
- [ ] Clearing search shows all members again

### Assign Task Modal (from Team)
- [ ] Modal title: "Assign Task to [Member Name]"
- [ ] Fields:
  - [ ] Title (required, max 200 chars)
  - [ ] Description (optional, textarea, max 1000 chars)
  - [ ] Due Date (optional, date picker)
- [ ] "Assign & Approve" button at bottom (black with white text)
- [ ] Button disabled while loading
- [ ] Button shows spinner when submitting
- [ ] Cancel button (grey text)
- [ ] Success snackbar: "Task assigned to [Name] ✅"
- [ ] Modal auto-closes on success
- [ ] Push notification sent to assigned member
- [ ] Task appears in member's Tasks screen immediately (realtime)

### Assign Manager Modal
- [ ] Modal title: "Assign Manager to [Member Name]"
- [ ] Subtitle shows current manager or "No manager assigned"
- [ ] List of all managers (role = 'manager') displayed as selectable cards
- [ ] Each manager card shows: Avatar, Name, Employee ID, Role badge
- [ ] Selected manager has blue border and checkmark
- [ ] "None" option to remove manager assignment
- [ ] "Assign" button at bottom
- [ ] Cancel button
- [ ] Success snackbar: "Manager assigned to [Name] ✅" or "Manager removed from [Name]"
- [ ] Team list refreshes after assignment
- [ ] Database `manager_id` field updated

### Pull to Refresh
- [ ] Pull down reloads team members from database
- [ ] Loading spinner shown at top
- [ ] Filter and search state preserved during refresh

---

## 2.4 Approvals Management

### Approvals Screen
- [ ] Header: "Approvals"
- [ ] Two tabs: "Attendance" and "Leaves"
- [ ] Tab shows count: "Attendance (X)" and "Leaves (Y)"
- [ ] Active tab has white background with shadow
- [ ] Inactive tab has light grey background

### Attendance Tab — Pending Check-ins
- [ ] Lists all pending check-in approvals (`status = 'pending_approval'`)
- [ ] Lists all pending check-out approvals (`status = 'pending_checkout'`)
- [ ] Sorted by `check_in_time` descending (newest first)
- [ ] Each card shows:
  - [ ] Member avatar with initials
  - [ ] Full name and Employee ID
  - [ ] Check-in time (format: "9:30 AM")
  - [ ] Check-in plan text (if check-in approval)
  - [ ] Check-out time and Day Report (if checkout approval)
  - [ ] Total hours (if checkout approval)
  - [ ] Status badge: "Pending Approval" (orange) or "Pending Checkout" (orange)
- [ ] Two action buttons: "Assign Task" and "Approve" (for check-in)
- [ ] Two action buttons: "Approve" and "Reject" (for check-out)

### Assign Task & Approve (Check-in)
- [ ] Tapping "Assign Task" opens modal
- [ ] Modal pre-fills assigned member
- [ ] Entering task details and tapping "Assign & Approve" does two actions:
  1. Approves check-in (status → 'working')
  2. Creates task linked to work_log_id
- [ ] Push notification sent to member: "Check-in Approved! ✅"
- [ ] Push notification sent to member: "New Task Assigned 📋 — [Task Title]"
- [ ] Approval card disappears from list immediately (realtime)
- [ ] Success snackbar: "Approved & task assigned ✅"

### Approve (Check-in without Task)
- [ ] Tapping "Approve" button changes status to 'working'
- [ ] `check_in_approved = true`, `check_in_approved_by = owner.id`, `check_in_approved_at = now()`
- [ ] Push notification sent: "Check-in Approved! ✅ — Your check-in has been approved. Have a productive day!"
- [ ] Card disappears from list
- [ ] Success snackbar: "Approved ✅"

### Reject (Check-in)
- [ ] Tapping "Reject" shows alert: "Reject Request — Are you sure you want to reject this request?"
- [ ] Alert has Cancel and Reject (destructive)
- [ ] Confirming changes status to 'rejected'
- [ ] Rejection reason hardcoded: "Please revise your plan and check in again."
- [ ] Push notification sent: "Check-in Rejected ❌ — [reason]"
- [ ] Card disappears from list
- [ ] Success snackbar: "Check-in rejected"

### Approve (Check-out)
- [ ] Tapping "Approve" on checkout request changes status to 'done'
- [ ] `check_out_approved = true`, `check_out_approved_by = owner.id`
- [ ] Total hours already calculated by database trigger
- [ ] Push notification sent: "Checkout Approved! 🎉 — Your checkout and day report have been approved. Great work!"
- [ ] Card disappears from list
- [ ] Success snackbar: "Approved ✅"

### Reject (Check-out)
- [ ] Tapping "Reject" shows alert: "Reject Request — Are you sure you want to reject this request?"
- [ ] Confirming sets status back to 'working' (not 'rejected')
- [ ] Rejection reason set in database
- [ ] Push notification sent: "Checkout Rejected ❌ — [reason]. Please update your report and check out again."
- [ ] Card disappears from pending list
- [ ] Member can edit day report and re-submit checkout

### Leaves Tab — Pending Leave Requests
- [ ] Lists all leave requests with `status = 'pending'`
- [ ] Sorted by `date` descending
- [ ] Each card shows:
  - [ ] Member avatar, name, Employee ID, department
  - [ ] Leave date (format: "Mon, Jan 15, 2026")
  - [ ] Reason text
  - [ ] Status badge: "Pending" (orange)
  - [ ] "Approve" and "Reject" buttons
- [ ] Approve button has green styling
- [ ] Reject button has red styling
- [ ] Button shows spinner while processing

### Approve Leave
- [ ] Tapping "Approve" sets status to 'approved'
- [ ] Sets `reviewed_by = owner.id`, `reviewed_at = now()`
- [ ] Card updates immediately to show: Status = "Approved" (green), Reviewed by "VB-0001 Owner", Reviewed timestamp
- [ ] Action buttons disappear
- [ ] Success snackbar: "Leave request approved ✅"
- [ ] Stats update: "On Leave Today" increases if date is today

### Reject Leave
- [ ] Tapping "Reject" shows alert: "Reject Leave Request — Are you sure?"
- [ ] Confirming sets status to 'rejected'
- [ ] Sets `reviewed_by = owner.id`, `reviewed_at = now()`
- [ ] Card updates: Status = "Rejected" (red), Reviewed info shown
- [ ] Action buttons disappear
- [ ] Success snackbar: "Leave request rejected ❌"

### Empty States
- [ ] Attendance tab empty: "All caught up! — No pending attendance approvals at the moment." (checkmark icon)
- [ ] Leaves tab empty: "No Pending Leaves — No pending leave requests at the moment." (calendar-check icon)

### Pull to Refresh
- [ ] Both tabs support pull-to-refresh
- [ ] Reloads data from database
- [ ] Tab selection and scroll position preserved

---

## 2.5 Settings & Configuration

### Settings Screen
- [ ] Header: "Settings"
- [ ] Profile card at top with:
  - [ ] Avatar (60x60, violet background)
  - [ ] Full name (bold, 18px)
  - [ ] Role badge: "Owner • VB-0001" with violet dot
- [ ] Three sections with labels (uppercase, 12px, grey):
  1. **TEAM MANAGEMENT**
  2. **APP SETTINGS**
  3. **ACCOUNT**

### Team Management Section
- [ ] **Add New Member** row:
  - [ ] Icon: user-plus (blue)
  - [ ] Title: "Add New Member"
  - [ ] Subtitle: "Create employee accounts"
  - [ ] Right chevron
  - [ ] Tapping navigates to Add Member screen
- [ ] **Announcements** row:
  - [ ] Icon: bell (orange)
  - [ ] Title: "Announcements"
  - [ ] Subtitle: "Send announcements to team"
  - [ ] Tapping navigates to Announcements screen
- [ ] **Session Management** row:
  - [ ] Icon: cpu (violet)
  - [ ] Title: "Session Management"
  - [ ] Subtitle: "View and manage active sessions"
  - [ ] Tapping navigates to Session Management screen

### App Settings Section
- [ ] **Require Checkout Approval** row:
  - [ ] Icon: check-square (grey)
  - [ ] Title: "Require Checkout Approval"
  - [ ] Subtitle: "Members need approval when ending their day"
  - [ ] Toggle switch on right
  - [ ] Toggle color: black when ON, grey when OFF
  - [ ] Tapping toggle updates `app_settings` table: `require_checkout_approval = 'true' | 'false'`
  - [ ] Setting saved immediately (no confirmation)
  - [ ] No snackbar on success
  - [ ] Error snackbar if save fails

### Account Section
- [ ] **Change Password** row:
  - [ ] Icon: lock (orange)
  - [ ] Title: "Change Password"
  - [ ] Subtitle: "Update your password"
  - [ ] Tapping navigates to Change Password screen
- [ ] **Sign Out** row:
  - [ ] Icon: log-out (red background)
  - [ ] Title: "Sign Out" (red text)
  - [ ] Subtitle: "Log out of your account"
  - [ ] Tapping shows alert (described in 2.1)

### App Info Footer
- [ ] App name: "VEBOSSO EMS"
- [ ] Version: "Version 1.0.0" (reads from Constants.expoConfig.version)
- [ ] Centered, grey text, 10-12px

---

## 2.6 Add Member

### Screen Layout
- [ ] Circular back button (arrow-left, white background with shadow)
- [ ] Title: "Add Member" (24px, bold)
- [ ] Form card with white background, rounded 24px corners, shadow

### Form Fields
- [ ] **Full Name** (required)
  - [ ] Label: "Full Name *"
  - [ ] Max length: 100 characters
  - [ ] Outlined input with grey border, black border when focused
  - [ ] Error if empty on submit
- [ ] **Designation**
  - [ ] Label: "Designation (e.g. Designer)"
  - [ ] Max length: 100 characters
  - [ ] Optional field
- [ ] **Role** (Segmented Control)
  - [ ] Label: "ROLE" (uppercase, grey, 12px)
  - [ ] Two options: "Member" and "Manager"
  - [ ] Default: "Member"
  - [ ] Selected option has white background with shadow, black text
  - [ ] Unselected has transparent background, grey text
- [ ] **Assign Manager** (only shown if Role = Member and managers exist)
  - [ ] Label: "Assign Manager (Optional)"
  - [ ] Horizontal scrollable list of manager chips
  - [ ] Each chip shows manager's full name
  - [ ] Tapping chip selects (blue background) or deselects (grey background)
  - [ ] Only one manager can be selected at a time
- [ ] **Employee ID**
  - [ ] Label: "Employee ID"
  - [ ] Auto-generated on mount: "VB-000X" (increments from team count + 2)
  - [ ] Editable if needed
  - [ ] Validates uniqueness on submit
- [ ] **Temporary Password**
  - [ ] Label: "Temporary Password"
  - [ ] Auto-generated 10-char random string (A-Z, a-z, 2-9, @#$!)
  - [ ] Eye icon to show/hide
  - [ ] Editable
  - [ ] Min length: 8 characters

### Create Member Button
- [ ] Black background, white text, 48px height, rounded 24px
- [ ] Icon: user-plus
- [ ] Text: "Create Member"
- [ ] Disabled (grey) while loading
- [ ] Shows spinner when submitting
- [ ] Validates:
  - [ ] Full name not empty
  - [ ] Employee ID not empty
  - [ ] Password ≥ 8 characters
  - [ ] Role is 'manager' or 'member'

### Edge Function Call
- [ ] Calls `supabase.functions.invoke('create-member')` with body:
  ```json
  {
    "full_name": "...",
    "employee_id": "...",
    "role": "manager|member",
    "department": "...",
    "manager_id": "...",
    "password": "..."
  }
  ```
- [ ] Function creates auth user with email: `{employee_id_lowercase_no_dashes}@vebosso.local`
- [ ] Function creates profile row with `must_change_password = true`
- [ ] Function returns credentials object
- [ ] On error, shows error snackbar with parsed message
- [ ] Error: "Employee ID 'VB-XXXX' already exists" if duplicate (409 status)

### Success Screen
- [ ] Shows emoji: 🎉
- [ ] Title: "Member Created!"
- [ ] Subtitle: "Share these credentials with the new member"
- [ ] Credential box with grey background showing:
  - [ ] "Employee ID" label and value (VB-XXXX)
  - [ ] Divider line
  - [ ] "Temporary Password" label and value
- [ ] "Copy Credentials" button (black, white text)
  - [ ] Copies text: "VEBOSSO EMS Credentials\nEmployee ID: VB-XXXX\nPassword: ..."
  - [ ] Snackbar: "Credentials copied to clipboard!"
- [ ] "Add Another Member" button (grey)
  - [ ] Resets form
  - [ ] Increments Employee ID (VB-0004, VB-0005, etc.)
  - [ ] Generates new random password
- [ ] "Back to Settings" text link
  - [ ] Returns to Settings screen

---

## 2.7 Announcements Management

### Screen Layout
- [ ] Circular back button (arrow-left)
- [ ] Title: "Announcements" (24px, bold)
- [ ] "+ New" button in header (black background, white text)

### Create Announcement Form (Expandable)
- [ ] Tapping "+ New" expands form below header
- [ ] Button changes to "× Cancel" with grey styling
- [ ] Form fields:
  - [ ] **Title** (required, max 200 chars)
  - [ ] **Message** (required, textarea, max 2000 chars, multiline, 3 rows)
  - [ ] **Target Audience** (segmented control)
    - Options: "Everyone", "Managers", "Members"
    - Default: "Everyone"
- [ ] "Send Announcement" button (black, 48px height)
- [ ] Validates title and message not empty

### Send Announcement
- [ ] Calls `workStore.createAnnouncement()`
- [ ] Inserts row into `announcements` table with:
  - `created_by = owner.id`
  - `target_role = 'all' | 'manager' | 'member'`
- [ ] Push notifications sent to all targeted users (excluding creator)
- [ ] Success snackbar: "Announcement sent! 📢"
- [ ] Form collapses
- [ ] List below updates immediately (realtime)

### Announcements List
- [ ] Shows all announcements created by owner
- [ ] Sorted by `created_at` descending
- [ ] Each card shows:
  - [ ] Title (bold, 16px)
  - [ ] Body text (grey, 13px)
  - [ ] Creator badge: "VB-0001 Owner" (violet)
  - [ ] Target audience badge:
    - "All" (purple background)
    - "Managers" (blue background)
    - "Members" (grey background)
  - [ ] Timestamp (grey, 11px, "2 hours ago" format)
- [ ] Cards have white background, rounded 20px, shadow
- [ ] No edit/delete functionality (create-only)

### Empty State
- [ ] Icon: bullhorn-outline
- [ ] Title: "No Announcements"
- [ ] Subtitle: "Create your first announcement to get started"

---

## 2.8 Session Management

### Screen Layout
- [ ] Circular back button (arrow-left)
- [ ] Title: "Active Sessions" (24px, bold)
- [ ] Loading skeleton shown while fetching

### Active Sessions List
- [ ] Fetches from `sessions` table where `is_active = true`
- [ ] Sorted by `last_active` descending
- [ ] Each session card shows:
  - [ ] Member name (bold, 16px)
  - [ ] Employee ID + Device info (e.g., "VB-0002 • Mobile App")
  - [ ] Last active timestamp (e.g., "Active 5 minutes ago" using date-fns formatDistanceToNow)
  - [ ] Green "Active" badge with dot
  - [ ] Red "Logout" button

### Force Logout
- [ ] Tapping "Logout" shows alert: "Force Logout — Are you sure you want to force logout [Name]?"
- [ ] Alert has Cancel and Force Logout (destructive)
- [ ] Confirming calls edge function: `supabase.functions.invoke('force-logout')`
- [ ] Request body: `{ user_id: "...", session_id: "..." }`
- [ ] Function calls `adminClient.auth.admin.signOut(user_id)`
- [ ] Function updates `sessions` table: `is_active = false`
- [ ] Success snackbar: "[Name] has been logged out."
- [ ] Session card disappears from list
- [ ] Target user's device signs out immediately (JWT invalidated)
- [ ] Error shown if function fails

### Self-Logout Prevention
- [ ] Owner cannot see their own session in the list (filtered out)
- [ ] Edge function validates: `user_id !== caller.id`
- [ ] Error: "You cannot force logout yourself" if attempted

### Empty State
- [ ] Icon: cellphone
- [ ] Title: "No Active Sessions"
- [ ] Subtitle: "No users are currently logged in"

### Pull to Refresh
- [ ] Reloads sessions from database
- [ ] Spinner shown at top

---

## 2.9 Attendance History

### Screen Layout
- [ ] Header: "Attendance History" (28px, bold)
- [ ] Member picker button: "Select a member" (outlined, blue border)
- [ ] Shows member name if selected

### Member Picker Modal
- [ ] Lists all team members (not just direct reports)
- [ ] Searchable list
- [ ] Each member shows: Avatar, Name, Employee ID, Role badge
- [ ] Tapping member closes modal and loads their history

### Calendar View
- [ ] Shows selected member's name at top
- [ ] Month navigation: < [Month Year] >
- [ ] Left arrow disabled if viewing 6 months ago (minDate)
- [ ] Right arrow disabled if viewing current month (maxMonth)
- [ ] Weekday labels: Su Mo Tu We Th Fr Sa
- [ ] Calendar grid with 7 columns
- [ ] Empty cells for offset (days before 1st of month)

### Day Cells
- [ ] Each day shows date number (14px)
- [ ] Days with work logs have colored background and border:
  - **Pending Approval**: Orange background (#FED7AA), orange border (#F59E0B)
  - **Working**: Emerald background (#A7F3D0), emerald border (#047857)
  - **Pending Checkout**: Orange background, orange border
  - **Done**: Emerald background, emerald border
  - **Rejected**: Red background (#FECACA), red border (#BE123C)
- [ ] Days with work logs show hours below date (e.g., "7.5h" in status color)
- [ ] Today's date has accent border (black) regardless of log status
- [ ] Days without logs have light grey background
- [ ] Tapping day with log opens Work Log Detail modal
- [ ] Tapping day without log does nothing (disabled)

### Work Log Detail Modal
- [ ] Modal title: Date (format: "Monday, Jan 15, 2026")
- [ ] Status badge with color-coded label
- [ ] Section 1: Check-in Details
  - [ ] Check-in Time (format: "9:30 AM")
  - [ ] Check-in Plan (full text, scrollable if long)
- [ ] Section 2: Check-out Details (if exists)
  - [ ] Check-out Time
  - [ ] Day Report (full text)
  - [ ] Total Hours (bold, e.g., "7.5 hours")
- [ ] Section 3: Tasks (if work_log has tasks or assigned for that date)
  - [ ] Task title
  - [ ] Status badge (Pending, Running, Completed)
  - [ ] Due date (if exists)
  - [ ] Completion note (if status = done)
  - [ ] Completed timestamp (if exists)
- [ ] "Close" button at bottom

### Legend
- [ ] Shows below calendar
- [ ] 5 status dots with labels:
  - Pending Approval (orange)
  - Working (green)
  - Pending Checkout (orange)
  - Done (green)
  - Rejected (red)

### Data Fetching
- [ ] Fetches work logs for selected member and month: `fetchWorkHistory(userId, startDate, endDate)`
- [ ] Date range: startOfMonth to endOfMonth
- [ ] Re-fetches when month changes
- [ ] Re-fetches when different member selected
- [ ] Loading spinner shown during fetch

### Empty State (No Member Selected)
- [ ] Icon: calendar-month-outline
- [ ] Title: "Select a Member"
- [ ] Subtitle: "Choose a team member to view their attendance history"

---

## 2.10 Member Detail Screen (Manage Profile)

### Navigation
- [ ] Access via: Team → Tap member → Context menu → "Manage Profile"
- [ ] URL pattern: `/(owner)/member/[id]`
- [ ] Circular back button in header

### Profile Section
- [ ] Large avatar (80x80) with initials
- [ ] Avatar has role-colored background (violet for owner, blue for manager, grey for member)
- [ ] Full name (24px, bold)
- [ ] Employee ID (e.g., "VB-0003")
- [ ] Role badge with color and text
- [ ] Department (if exists)
- [ ] Manager assignment (if exists): "Reports to [Manager Name]" or "No manager assigned"
- [ ] Active status: Green dot + "Active" text or Red dot + "Inactive" text

### Action Cards
- [ ] **Update Password** card:
  - [ ] Icon: lock (orange)
  - [ ] Title: "Update Password"
  - [ ] Subtitle: "Reset this member's password"
  - [ ] Tapping opens Update Password modal
- [ ] **Delete Member** card:
  - [ ] Icon: trash (red)
  - [ ] Title: "Delete Member"
  - [ ] Subtitle: "Permanently remove this member"
  - [ ] Tapping shows confirmation alert

### Update Password Modal
- [ ] Modal title: "Update Password for [Name]"
- [ ] New Password field (min 8 chars)
- [ ] Confirm Password field
- [ ] Show/hide eye icon
- [ ] Password strength indicator (same as force-change-password)
- [ ] Password requirements checklist
- [ ] "Update Password" button (black)
- [ ] Validates:
  - [ ] Min 8 characters
  - [ ] Passwords match
  - [ ] Strength ≥ 50%
- [ ] Calls edge function: `admin-update-member` with `action: 'update-password'`
- [ ] Success snackbar: "Password updated successfully"
- [ ] Modal closes
- [ ] Member's `must_change_password` NOT set (they keep current login)

### Delete Member Confirmation
- [ ] Alert title: "Delete Member"
- [ ] Alert message: "Are you sure you want to delete [Name]? This action cannot be undone. All their work logs, tasks, and data will be permanently deleted."
- [ ] Buttons: Cancel, Delete (destructive red)
- [ ] Confirming calls edge function: `admin-update-member` with `action: 'delete-member'`
- [ ] Function steps:
  1. Nullify `assigned_by` on tasks assigned BY this user (preserves tasks for other members)
  2. Delete auth user (cascades to profiles, which cascades to work_logs, sessions, tasks[assigned_to], announcements, leave_requests)
- [ ] Success snackbar: "Member deleted successfully"
- [ ] Navigates back to Team screen
- [ ] Team list auto-refreshes (member removed)
- [ ] Error shown if deletion fails

### RLS Validation
- [ ] Only owner can access this screen
- [ ] Manager or member attempting to access gets 403 error
- [ ] Owner cannot delete themselves (edge function validates)

---

## 2.11 Navigation & Tab Bar

### Bottom Tab Bar
- [ ] 5 tabs visible at bottom:
  1. **Dashboard** (home icon)
  2. **Approvals** (check-circle icon) — shows badge with count if pending > 0
  3. **Team** (users icon)
  4. **History** (calendar icon)
  5. **Settings** (settings icon)
- [ ] Active tab: Black icon and label
- [ ] Inactive tabs: Grey icon and label
- [ ] Tab bar has white background with top shadow
- [ ] Tab bar height: ~80px (includes safe area)
- [ ] Badge on Approvals tab:
  - [ ] Red background
  - [ ] White text
  - [ ] Shows total: `pendingApprovals.length + pendingLeaves.length`
  - [ ] Positioned top-right of icon
  - [ ] Updates in real-time

### Navigation Behavior
- [ ] Tapping tab navigates immediately
- [ ] Screen transitions are smooth (fade)
- [ ] Back button in nested screens (e.g., Add Member, Session Management) returns to previous screen
- [ ] Deep links supported (e.g., `/(owner)/member/[id]`)

---

## 2.12 Realtime Updates

### Work Logs Realtime
- [ ] Subscribed to `work_logs` table changes
- [ ] On INSERT, UPDATE, or DELETE:
  - [ ] Approvals screen auto-refreshes
  - [ ] Dashboard stats auto-update
  - [ ] History calendar reloads
- [ ] Channel ID: `work_logs_changes_[random]`

### Tasks Realtime
- [ ] Subscribed to `tasks` table changes
- [ ] On any change:
  - [ ] Tasks list in member detail refreshes
  - [ ] Work log detail modal tasks section updates

### Announcements Realtime
- [ ] Subscribed to `announcements` table INSERT events
- [ ] On new announcement:
  - [ ] Announcements list auto-updates
  - [ ] Push notification sent if targeted

### Subscription Cleanup
- [ ] All channels unsubscribed when navigating away from Owner screens
- [ ] Channels re-subscribed when returning
- [ ] No memory leaks or duplicate subscriptions

---

## 2.13 Offline & Network Handling

### Offline Detection
- [ ] Uses `@react-native-community/netinfo` to detect connectivity
- [ ] Yellow banner appears at top when offline: "You are offline. Some features may not work."
- [ ] Banner disappears when back online
- [ ] Banner has warning icon (alert-circle)

### Failed Requests
- [ ] Supabase requests that fail due to network show error snackbar
- [ ] Error message: "Network error. Please check your connection and try again."
- [ ] User can retry by pulling to refresh or re-submitting action
- [ ] No data corruption (all writes are atomic via Supabase)

---

## 2.14 App Update System

### Version Check (on App Launch)
- [ ] `_layout.tsx` calls `checkAppVersion()` before rendering
- [ ] Fetches `app_settings` table:
  - `minimum_app_version` (e.g., "1.0.0")
  - `latest_app_version` (e.g., "1.1.0")
  - `update_message` (custom message)
  - `apk_download_url` (direct download link)
- [ ] Compares current app version (from `Constants.expoConfig.version`) with settings

### Forced Update (Below Minimum)
- [ ] If `currentVersion < minimumVersion`:
  - [ ] Shows full-screen Update Required screen
  - [ ] Emoji: 📱
  - [ ] Title: "Update Required"
  - [ ] Message: (from `update_message` or default)
  - [ ] "Update Now" button (green, solid)
  - [ ] Tapping button opens `apk_download_url` in browser
  - [ ] User CANNOT dismiss or bypass (no back button, no cancel)
  - [ ] App unusable until updated
- [ ] If fetch fails, app continues (graceful degradation)

### Optional Update (Below Latest)
- [ ] If `minimumVersion <= currentVersion < latestVersion`:
  - [ ] Shows dismissible modal
  - [ ] Title: "New Version Available"
  - [ ] Message: "Version X.X.X is available. Update now for the best experience."
  - [ ] Two buttons: "Update" (green) and "Later" (grey)
  - [ ] "Update" opens download URL
  - [ ] "Later" dismisses modal, user can continue using app
  - [ ] Modal re-appears on next app restart

### Up-to-Date
- [ ] If `currentVersion >= latestVersion`:
  - [ ] No update prompt shown
  - [ ] App starts normally

---

## 2.15 Push Notifications

### Notification Permissions
- [ ] On first app launch, requests permission for push notifications
- [ ] Permission dialog shown by Expo Notifications
- [ ] If granted, `expo_push_token` saved to user's profile
- [ ] If denied, push notifications won't work (no error shown to user)

### Notification Triggers (Owner Receives)
- [ ] **Check-in Request**: When any member submits check-in
- [ ] **Checkout Request**: When any member submits checkout (if checkout approval enabled)
- [ ] **Announcements**: When announcement is targeted to owner (should not receive own announcements)

### Notification Content
- [ ] Each notification has:
  - [ ] Title (e.g., "Check-in Request")
  - [ ] Body (e.g., "QA Member has checked in and is waiting for approval")
  - [ ] Data payload (e.g., `{ type: 'check_in_request', work_log_id: '...' }`)
- [ ] Notification appears in system tray
- [ ] Tapping notification opens app

### Notification Handling
- [ ] App in foreground: Notification shown as in-app banner
- [ ] App in background: Notification shown in system tray
- [ ] App closed: Notification wakes app, deep link navigates to relevant screen

---

## 2.16 Edge Cases & Error States

### Database RLS Violations
- [ ] Attempting to read/write data without proper role shows: "You don't have permission to perform this action"
- [ ] Attempting to modify `role`, `is_active`, or `employee_id` on own profile triggers:
  - Database trigger error: "SECURITY: You are not allowed to change your own role"
- [ ] Attempting to approve own work log as member triggers:
  - Database trigger error: "SECURITY: Members cannot approve their own check-in"

### Duplicate Employee IDs
- [ ] Creating member with existing Employee ID shows: "Employee ID 'VB-XXXX' already exists"
- [ ] Error code: 409 Conflict
- [ ] Form remains open, user can correct

### Max Character Limits
- [ ] Check-in plan: 2000 chars max (enforced by database constraint)
- [ ] Day report: 3000 chars max (enforced by database constraint)
- [ ] Announcement title: 200 chars max (enforced by database constraint)
- [ ] Announcement body: 2000 chars max (enforced by database constraint)
- [ ] Task title: 200 chars max
- [ ] Task description: 1000 chars max
- [ ] Exceeding limit shows error: "Text exceeds maximum length"

### Empty States Across All Screens
- [ ] Team: "No members found — Add members in Settings"
- [ ] Approvals (Attendance): "All caught up! — No pending attendance approvals"
- [ ] Approvals (Leaves): "No Pending Leaves — No pending leave requests"
- [ ] Announcements: "No Announcements — Create your first announcement"
- [ ] Sessions: "No Active Sessions — No users are currently logged in"
- [ ] History (no member selected): "Select a Member — Choose a team member to view history"
- [ ] History (member selected, no logs): Calendar shows empty days

### Concurrent Approvals
- [ ] Two owners approve same check-in simultaneously:
  - [ ] First approval succeeds
  - [ ] Second approval fails gracefully (work log already approved)
  - [ ] Second owner's screen auto-refreshes, card disappears
- [ ] No data corruption or duplicate approvals

### Session Expiry
- [ ] JWT token expires after 1 hour (Supabase default)
- [ ] Auto-refresh token before expiry
- [ ] If refresh fails (e.g., user deleted), sign out and show login screen
- [ ] Error message: "Your session has expired. Please sign in again."

---

# SECTION 3: MANAGER ROLE GRANULAR CHECKLIST

## 3.1 Authentication & Session

### Login Flow
- [ ] Can login with Manager Employee ID (e.g., `VB-0002` or `0002`)
- [ ] Same login validation as Owner (see 2.1)
- [ ] Force change password on first login
- [ ] Password validation same as Owner
- [ ] Navigates to Manager Dashboard after successful login
- [ ] Session persistence works (auto-login on app relaunch)

### Voluntary Password Change
- [ ] Settings → Change Password
- [ ] Same flow as Owner (see 2.1)

### Logout
- [ ] Settings → Sign Out
- [ ] Same confirmation alert as Owner
- [ ] Navigates to Login screen

---

## 3.2 Dashboard

### Header & Profile
- [ ] Header shows: "Good [morning/afternoon/evening], [Manager Name]"
- [ ] Avatar with initials (blue background for manager role)
- [ ] Employee ID shown
- [ ] Current date displayed

### Stats Cards (Team-Specific)
- [ ] 4 stat cards showing only manager's team data:
  1. **Total Team**: Count of members where `manager_id = current_manager.id`
  2. **Active Now**: Count of team members with `status = 'working'` today
  3. **Pending Approvals**: Count of team's pending check-ins/checkouts
  4. **On Leave Today**: Count of team's approved leaves for today
- [ ] Stats update in real-time
- [ ] Tap "Pending Approvals" navigates to Approvals tab
- [ ] Tap "On Leave Today" navigates to Approvals → Leaves tab

### Quick Actions
- [ ] 4 quick action cards:
  1. **My Team** (blue) → Navigate to My Team tab
  2. **Approvals** (orange) → Navigate to Approvals tab
  3. **Track Tasks** (violet) → Navigate to Tasks screen
  4. **History** (green) → Navigate to History tab
- [ ] Cards have blue accent color (manager theme)

### Pull to Refresh
- [ ] Reloads dashboard stats
- [ ] Spinner color: blue (manager accent)

---

## 3.3 My Team

### Screen Layout
- [ ] Header: "My Team"
- [ ] Subtitle: "X members" (count of assigned team)
- [ ] Search bar with placeholder "Search..."

### Team List
- [ ] Shows only members where `manager_id = current_manager.id`
- [ ] Each card shows: Avatar, Name, Employee ID, Role badge, Department
- [ ] Tapping card opens context menu with 2 options:
  1. **Assign Task** (clipboard icon)
  2. **View Details** (account icon)
- [ ] Manager CANNOT:
  - Assign/remove managers
  - Delete members
  - Update passwords
  - Access Member Detail screen

### Search
- [ ] Searches by full_name and employee_id (case-insensitive)
- [ ] Real-time filtering
- [ ] Empty state: "No Team Members — No members are assigned to your team yet"

### Assign Task (from My Team)
- [ ] Opens Assign Task modal (same as Owner)
- [ ] Pre-fills assigned member
- [ ] Creates task with `assigned_by = manager.id`
- [ ] Push notification sent to member
- [ ] Task appears in member's Tasks screen

### Pull to Refresh
- [ ] Reloads team members from database
- [ ] Filtered list preserved

---

## 3.4 Approvals (Manager)

### Tabs
- [ ] Two tabs: "Attendance" and "Leaves"
- [ ] Shows counts for team-specific pending items
- [ ] Only shows approvals for manager's assigned team (where `manager_id = current_manager.id`)

### Attendance Tab
- [ ] Lists pending check-ins/checkouts for team members only
- [ ] Same card layout as Owner (see 2.4)
- [ ] Can approve or reject check-ins
- [ ] Can assign tasks and approve
- [ ] Can approve or reject checkouts
- [ ] Push notifications sent to affected members
- [ ] Approvals update:
  - `check_in_approved_by = manager.id`
  - `check_out_approved_by = manager.id`

### Leaves Tab
- [ ] Lists pending leave requests for team members only
- [ ] Can approve or reject leaves
- [ ] Same functionality as Owner (see 2.4)
- [ ] Reviews set: `reviewed_by = manager.id`

### Manager's Own Approvals
- [ ] Manager's own check-ins/leaves NOT shown in this screen
- [ ] Manager cannot approve their own submissions
- [ ] Manager's requests appear in Owner's Approvals screen

### Empty States
- [ ] Same as Owner (see 2.4)

### Pull to Refresh
- [ ] Reloads team approvals
- [ ] Tab selection preserved

---

## 3.5 Tasks (Manager — Track Team Tasks)

### Screen Layout
- [ ] Circular back button (returns to Dashboard)
- [ ] Title: "Track Team Tasks"
- [ ] Subtitle: "X/Y completed"
- [ ] Shows tasks assigned BY manager to their team

### Task Filters
- [ ] Filter pills: "All", "Pending", "Running", "Done"
- [ ] Shows count for each filter
- [ ] Selected pill has blue background
- [ ] Filters tasks in real-time

### Progress Card
- [ ] Shows: "Team Task Progress"
- [ ] Completion percentage: (done / total) * 100
- [ ] Progress bar filled to percentage (blue color)
- [ ] Only shown if total > 0

### Task Cards
- [ ] Each task shows:
  - [ ] Status icon in colored circle (clock/play/check)
  - [ ] Task title (bold, 15px)
  - [ ] Task description (grey, 13px)
  - [ ] Status badge: "Pending", "Running", or "Completed"
  - [ ] Assignee info: Avatar + Name + Employee ID
  - [ ] Due date (if exists): "Due Jan 15"
- [ ] Badge colors:
  - Pending: Grey
  - Running: Blue
  - Completed: Green
- [ ] Tapping task opens Task Detail Modal

### Task Detail Modal
- [ ] Shows full task details:
  - [ ] Title (bold, 18px)
  - [ ] Status badge
  - [ ] Assigned to: Avatar, Name, Employee ID
  - [ ] Description (full text, scrollable)
  - [ ] Due date (if exists)
  - [ ] Completion note (if status = done)
  - [ ] Completed timestamp (if exists)
- [ ] "Reassign" button at bottom (blue)
- [ ] "Close" button

### Reassign Task
- [ ] Tapping "Reassign" opens Member Picker Modal
- [ ] Shows list of team members (manager's assigned team only)
- [ ] Each member shows: Avatar, Name, Employee ID, Role badge
- [ ] Tapping member reassigns task:
  - [ ] Updates `assigned_to` in database
  - [ ] Calls `workStore.reassignTask(taskId, newAssigneeId, managerId)`
  - [ ] Push notifications sent:
    - New assignee: "Task Reassigned to You 📋 — [Task Title]"
    - Previous assignee: "Task Reassigned — '[Task Title]' has been reassigned to [New Name]"
  - [ ] Success snackbar: "Task reassigned successfully"
  - [ ] Modal closes
  - [ ] Task list refreshes

### Empty States
- [ ] All: "No Tasks Found — You haven't assigned any tasks to your team yet."
- [ ] Filtered: "No tasks in this category"

### Pull to Refresh
- [ ] Reloads tasks from database
- [ ] Filter selection preserved

---

## 3.6 History (Manager — Team Attendance)

### Screen Layout
- [ ] Same calendar view as Owner (see 2.9)
- [ ] "Select a member" picker button
- [ ] Month navigation: < [Month Year] >

### Member Picker
- [ ] Shows only manager's assigned team members
- [ ] Manager CANNOT view Owner's history
- [ ] Manager CANNOT view other managers' history
- [ ] Manager CAN view own history

### Calendar & Work Log Detail
- [ ] Same functionality as Owner (see 2.9)
- [ ] Day cells colored by status
- [ ] Tapping day opens Work Log Detail modal
- [ ] Shows check-in, checkout, hours, tasks

### Data Scope
- [ ] Only fetches work logs for manager's team or self
- [ ] RLS enforces: `user_id = manager.id OR is_manager_of(user_id)`

---

## 3.7 Settings (Manager)

### Screen Layout
- [ ] Profile card shows:
  - [ ] Avatar (blue background)
  - [ ] Full name
  - [ ] Role badge: "Manager • VB-XXXX" with blue dot
- [ ] Two sections: **ACCOUNT** only
- [ ] NO Team Management section (managers cannot create members)

### Account Section
- [ ] **Change Password** row (same as Owner)
- [ ] **Sign Out** row (same as Owner)

### App Info
- [ ] App name and version shown at bottom

### Leaves Screen
- [ ] Navigate via: Profile icon → My Leaves
- [ ] Shows manager's own leave requests only
- [ ] Same functionality as Member leaves (see 4.6)
- [ ] Manager CANNOT approve own leaves
- [ ] Manager's leaves approved by Owner

---

## 3.8 Navigation & Tab Bar

### Bottom Tab Bar
- [ ] 5 tabs:
  1. **Dashboard** (home icon)
  2. **Approvals** (check-circle icon) — badge with pending count
  3. **My Team** (users icon)
  4. **History** (calendar icon)
  5. **Settings** (settings icon)
- [ ] Badge on Approvals tab shows: team pending check-ins + team pending leaves
- [ ] Active tab: Blue icon (manager accent)
- [ ] Tab bar has white background with shadow

---

## 3.9 Realtime Updates (Manager)

### Work Logs Realtime
- [ ] Subscribed to team members' work_logs changes
- [ ] Channel: `work_logs_changes_[random]`
- [ ] On INSERT/UPDATE:
  - [ ] Approvals screen auto-refreshes
  - [ ] Dashboard stats update
  - [ ] History reloads

### Tasks Realtime
- [ ] Subscribed to tasks where `assigned_by = manager.id`
- [ ] On status change:
  - [ ] Tasks screen auto-updates
  - [ ] Task counts recalculate

### Announcements Realtime
- [ ] Subscribed to INSERT events for announcements where:
  - `target_role IN ('all', 'manager')`
  - OR `target_user_id = manager.id`

---

## 3.10 Push Notifications (Manager)

### Notifications Received
- [ ] **Check-in Request**: From team members
- [ ] **Checkout Request**: From team members (if checkout approval enabled)
- [ ] **Leave Request**: From team members
- [ ] **Announcements**: Targeted to managers or self
- [ ] **Task Status Change**: When team member updates task status (optional, not implemented)

### Notifications Sent
- [ ] **Check-in Approved**: To team member
- [ ] **Check-in Rejected**: To team member
- [ ] **Checkout Approved**: To team member
- [ ] **Checkout Rejected**: To team member
- [ ] **Task Assigned**: To team member
- [ ] **Task Reassigned**: To new and old assignees
- [ ] **Leave Approved**: To team member
- [ ] **Leave Rejected**: To team member
- [ ] **Announcement**: If manager creates announcement (to targeted audience)

---

## 3.11 Restrictions & Permissions

### Cannot Do (vs Owner)
- [ ] Cannot create new members
- [ ] Cannot delete members
- [ ] Cannot update member passwords
- [ ] Cannot force logout users
- [ ] Cannot view session management
- [ ] Cannot assign/remove managers
- [ ] Cannot approve own check-ins or leaves
- [ ] Cannot view Owner's data
- [ ] Cannot view other managers' data (unless cross-team task assignment)
- [ ] Cannot modify app settings (e.g., require checkout approval toggle)
- [ ] Cannot access Owner routes (RLS blocks at database level)

### Can Do
- [ ] View and manage assigned team members
- [ ] Approve/reject team check-ins and checkouts
- [ ] Approve/reject team leave requests
- [ ] Assign tasks to team members
- [ ] Reassign tasks within team
- [ ] View team attendance history
- [ ] Create announcements (for team or all)
- [ ] Submit own check-ins, checkouts, tasks, leaves (treated as member for self)
- [ ] Change own password

---

# SECTION 4: MEMBER ROLE GRANULAR CHECKLIST

## 4.1 Authentication & Session

### Login Flow
- [ ] Can login with Member Employee ID (e.g., `VB-0003` or `0003`)
- [ ] Same login validation as Owner (see 2.1)
- [ ] Force change password on first login
- [ ] Password validation same as Owner
- [ ] Navigates to Member Home after successful login
- [ ] Session persistence works

### Voluntary Password Change
- [ ] Profile → Change Password
- [ ] Same flow as Owner (see 2.1)

### Logout
- [ ] Profile → Sign Out
- [ ] Same confirmation and behavior

---

## 4.2 Home Screen

### Header
- [ ] Shows: "Good [morning/afternoon/evening]"
- [ ] Avatar with initials (grey/green background for member role)
- [ ] Full name
- [ ] Employee ID
- [ ] Current date

### Status Card (Central)
- [ ] Large card showing current work status
- [ ] 5 possible states:

#### State 1: Not Checked In
- [ ] Status badge: "Not Checked In" (grey)
- [ ] Icon: clock-outline
- [ ] Message: "Start your day by checking in"
- [ ] Green "Check In" button (48px height, rounded 24px)
- [ ] No other info shown

#### State 2: Pending Approval
- [ ] Status badge: "Pending Approval" (orange with dot)
- [ ] Icon: clock-alert
- [ ] Check-in time shown (e.g., "9:30 AM")
- [ ] Check-in plan text shown (scrollable if long)
- [ ] Yellow banner: "Waiting for manager approval..."
- [ ] No action buttons (must wait)

#### State 3: Working (Approved)
- [ ] Status badge: "Working" (green with dot)
- [ ] Icon: checkbox-marked-circle
- [ ] Check-in time shown
- [ ] Check-in plan text shown
- [ ] Approval info: "Approved by [Manager Name]" (small, grey)
- [ ] Green "Check Out" button

#### State 4: Pending Checkout
- [ ] Status badge: "Pending Checkout" (orange with dot)
- [ ] Icon: clock-alert
- [ ] Check-in time and plan shown
- [ ] Check-out time shown
- [ ] Day report text shown
- [ ] Total hours shown (bold, e.g., "7.5 hours")
- [ ] Orange banner: "Waiting for checkout approval..."
- [ ] No action buttons

#### State 5: Done (Day Complete)
- [ ] Status badge: "Done" (green with checkmark)
- [ ] Icon: check-circle
- [ ] Check-in and check-out times shown
- [ ] Total hours shown (large, bold)
- [ ] Green success banner: "Day completed! Great work!"
- [ ] No action buttons
- [ ] Next day: State resets to "Not Checked In"

### Check In Button
- [ ] Tapping opens Check-in Modal
- [ ] Modal title: "Start Your Day"
- [ ] Subtitle: "Tell us what you'll be working on today"
- [ ] Textarea for "Today's Plan" (max 2000 chars)
- [ ] Character count shown (e.g., "150/2000")
- [ ] "Submit Check-in" button (green, 48px height)
- [ ] Validates plan not empty
- [ ] On submit:
  - [ ] Creates work_log with `status = 'pending_approval'`
  - [ ] `check_in_time = now()`
  - [ ] `check_in_plan = entered text`
  - [ ] Push notification sent to manager and owner
  - [ ] Modal closes
  - [ ] Home screen updates to "Pending Approval" state
  - [ ] Success snackbar: "Check-in submitted! 🚀"

### Check Out Button
- [ ] Only shown when status = 'working'
- [ ] Tapping opens Check-out Modal
- [ ] Modal title: "End Your Day"
- [ ] Subtitle: "Summarize what you accomplished today"
- [ ] Textarea for "Day Summary" (max 3000 chars)
- [ ] Character count shown
- [ ] "Submit Check-out" button (green)
- [ ] Validates summary not empty
- [ ] On submit:
  - [ ] Updates work_log: `check_out_time = now()`, `day_report = summary`
  - [ ] If `require_checkout_approval = true`: status → 'pending_checkout'
  - [ ] If `require_checkout_approval = false`: status → 'done'
  - [ ] Total hours auto-calculated by database trigger
  - [ ] Push notification sent to manager/owner if approval required
  - [ ] Modal closes
  - [ ] Home screen updates to appropriate state
  - [ ] Success snackbar: "Check-out submitted! ✅" or "Day complete! ✅"

### Today's Tasks Summary
- [ ] Below status card, shows "Today's Tasks" section
- [ ] Displays count: "X of Y completed"
- [ ] If tasks exist, shows progress bar (green filled to completion %)
- [ ] "View All" link navigates to Tasks tab
- [ ] Shows up to 3 tasks with title and status icon
- [ ] Tapping task navigates to Tasks tab

### Pull to Refresh
- [ ] Reloads today's work log and tasks
- [ ] Spinner color: green (member accent)

---

## 4.3 Tasks Screen

### Header
- [ ] Title: "Tasks"
- [ ] Subtitle: "X/Y completed today"

### Progress Card
- [ ] Shows: "Completion Rate"
- [ ] Percentage: (done / total) * 100
- [ ] Progress bar (green)
- [ ] Only shown if total > 0

### Task Filters
- [ ] Filter pills: "All", "Pending", "Running", "Done"
- [ ] Shows count for each
- [ ] Selected pill has green background
- [ ] Filters in real-time

### Task List
- [ ] Shows tasks where `assigned_to = member.id`
- [ ] Includes tasks for today (due_date = today OR work_log_id = today's log)
- [ ] Each card shows:
  - [ ] Status icon in colored circle
  - [ ] Task title
  - [ ] Task description (truncated)
  - [ ] Status badge
  - [ ] Due date (if exists)
  - [ ] Assigned by: "[Manager Name]"
- [ ] Cards grouped in single white container with dividers

### Task Card Actions
- [ ] Tapping card expands to show:
  - [ ] Full description
  - [ ] Three action buttons: "Pending", "Start Task", "Mark as Done"
- [ ] Initial status = "Pending": Only "Start Task" button active
- [ ] Tapping "Start Task":
  - [ ] Updates task: `status = 'in_progress'`
  - [ ] Button changes to "In Progress" (blue)
  - [ ] Status badge updates to "Running" (blue)
  - [ ] Snackbar: "Task updated"
- [ ] Tapping "Mark as Done":
  - [ ] Opens "Complete Task" modal
  - [ ] Textarea for "Completion Notes (optional)" (max 500 chars)
  - [ ] "Complete Task" button
  - [ ] On submit:
    - [ ] Updates task: `status = 'done'`, `completion_note = notes`, `completed_at = now()`
    - [ ] Modal closes
    - [ ] Status badge updates to "Completed" (green)
    - [ ] Snackbar: "Task completed! ✅"
    - [ ] Progress bar updates

### Empty States
- [ ] All: "No Tasks Found — No tasks assigned yet"
- [ ] Filtered: "No tasks in this category"

### Pull to Refresh
- [ ] Reloads tasks from database

---

## 4.4 History (Member — My Attendance)

### Screen Layout
- [ ] Header: "My History"
- [ ] Month navigation: < [Month Year] >
- [ ] Left arrow disabled if 6 months ago
- [ ] Right arrow disabled if current month

### Calendar View
- [ ] Shows member's own work logs only
- [ ] Same day cell styling as Owner (see 2.9)
- [ ] Colored by status (green for done, orange for pending, etc.)
- [ ] Hours shown on days with logs
- [ ] Today has accent border
- [ ] Tapping day opens Work Log Detail modal

### Work Log Detail Modal
- [ ] Same as Owner's (see 2.9)
- [ ] Shows: Date, Status, Check-in/out times, Plan, Report, Hours, Tasks

### Legend
- [ ] Shows 5 status colors with labels

---

## 4.5 Announcements

### Screen Layout
- [ ] Header: "Announcements"
- [ ] Subtitle: "X announcement(s)"
- [ ] List of announcement cards

### Announcement Card
- [ ] Shows: Title (bold), Body text, Creator name and role badge, Target badge (All/Managers/Members), Timestamp
- [ ] Cards have white background, rounded corners, shadow
- [ ] Cards sorted by `created_at` descending
- [ ] Only shows announcements where:
  - `target_role IN ('all', 'member')`
  - OR `target_user_id = member.id`

### Realtime Updates
- [ ] New announcements appear automatically
- [ ] Push notification received for new announcements

### Empty State
- [ ] Icon: bullhorn-outline
- [ ] Title: "No Announcements"
- [ ] Subtitle: "You'll see company announcements here"

### Pull to Refresh
- [ ] Reloads announcements from database

---

## 4.6 Leaves (Member — My Leave Requests)

### Screen Layout
- [ ] Circular back button (returns to Home or Profile)
- [ ] Title: "My Leaves"
- [ ] "+ Apply" button in header (green)

### Leave Request List
- [ ] Shows member's own leave requests only (`user_id = member.id`)
- [ ] Sorted by `date` descending
- [ ] Each card shows:
  - [ ] Date (format: "Mon, Jan 15, 2026")
  - [ ] Reason text
  - [ ] Status badge: "Pending" (orange), "Approved" (green), or "Rejected" (red)
  - [ ] Reviewed by (if reviewed): "[Manager Name]" or "[Owner Name]"
  - [ ] Reviewed timestamp (if reviewed)
- [ ] Cards have white background, rounded corners, shadow

### Apply for Leave
- [ ] Tapping "+ Apply" opens Leave Request Modal
- [ ] Modal title: "Request Leave"
- [ ] Date picker (only future dates selectable)
- [ ] Past dates disabled
- [ ] Today's date is selectable
- [ ] Reason textarea (required, max 500 chars)
- [ ] "Submit Request" button (green)
- [ ] Validates:
  - [ ] Date selected
  - [ ] Reason not empty
- [ ] On submit:
  - [ ] Creates leave_request with `status = 'pending'`
  - [ ] Push notification sent to manager (if assigned) and owner
  - [ ] Modal closes
  - [ ] Leave card appears in list
  - [ ] Success snackbar: "Leave request submitted successfully! ✈️"

### Leave Status Updates
- [ ] When manager/owner approves:
  - [ ] Card updates immediately (realtime)
  - [ ] Status badge → "Approved" (green)
  - [ ] Reviewed by and timestamp shown
  - [ ] Push notification received: "Leave Approved ✅ — Your leave request for [Date] has been approved"
- [ ] When manager/owner rejects:
  - [ ] Status badge → "Rejected" (red)
  - [ ] Reviewed by and timestamp shown
  - [ ] Push notification received: "Leave Rejected ❌ — Your leave request for [Date] has been rejected"

### Empty State
- [ ] Icon: calendar-blank
- [ ] Title: "No Leave Requests"
- [ ] Subtitle: "You haven't requested any leaves yet"
- [ ] "Apply for Leave" button navigates to Apply flow

### Pull to Refresh
- [ ] Reloads leave requests from database

---

## 4.7 Profile

### Screen Layout
- [ ] Header: "Profile"
- [ ] Large avatar (80x80) with initials
- [ ] Avatar has green/grey background (member role)
- [ ] Full name (24px, bold)
- [ ] Employee ID
- [ ] Role badge: "Member"
- [ ] Department (if exists)
- [ ] Manager: "Reports to [Manager Name]" or "No manager assigned"

### Info Cards
- [ ] **Personal Information** card:
  - [ ] Full name
  - [ ] Employee ID
  - [ ] Department
  - [ ] Manager (if assigned)
  - [ ] Join date (created_at formatted as "Joined on Jan 1, 2026")
- [ ] **Change Password** card:
  - [ ] Icon: lock (orange)
  - [ ] Tapping navigates to Change Password screen

### My Leaves Button
- [ ] Green button: "My Leaves"
- [ ] Navigates to Leaves screen (see 4.6)

### Sign Out Button
- [ ] Red text button at bottom
- [ ] Shows confirmation alert
- [ ] Signs out and navigates to Login

---

## 4.8 Navigation & Tab Bar

### Bottom Tab Bar
- [ ] 5 tabs:
  1. **Home** (home icon)
  2. **Tasks** (clipboard icon)
  3. **History** (calendar icon)
  4. **Announcements** (bullhorn icon)
  5. **Profile** (account icon)
- [ ] Active tab: Green icon (member accent)
- [ ] Tab bar has white background with shadow
- [ ] No badges on tabs (members don't have approval counts)

---

## 4.9 Realtime Updates (Member)

### Work Logs Realtime
- [ ] Subscribed to own work_logs changes
- [ ] On UPDATE (approval):
  - [ ] Home screen auto-updates status
  - [ ] Banner changes (pending → approved)
  - [ ] Push notification received
- [ ] Channel: `work_logs_changes_[random]`

### Tasks Realtime
- [ ] Subscribed to tasks where `assigned_to = member.id`
- [ ] On INSERT (new task):
  - [ ] Tasks screen auto-updates
  - [ ] Task count increases
  - [ ] Push notification received
- [ ] On UPDATE (status change by manager):
  - [ ] Task list refreshes
- [ ] On DELETE or REASSIGN:
  - [ ] Task disappears from list

### Announcements Realtime
- [ ] Subscribed to INSERT events for:
  - `target_role IN ('all', 'member')`
  - OR `target_user_id = member.id`
- [ ] New announcements appear automatically
- [ ] Push notification received

---

## 4.10 Push Notifications (Member)

### Notifications Received
- [ ] **Check-in Approved**: From manager/owner approval
- [ ] **Check-in Rejected**: With rejection reason
- [ ] **Checkout Approved**: Day complete confirmation
- [ ] **Checkout Rejected**: With reason to revise
- [ ] **Task Assigned**: New task from manager/owner
- [ ] **Task Reassigned**: When task is reassigned to another member
- [ ] **Leave Approved**: Leave request approved
- [ ] **Leave Rejected**: Leave request rejected
- [ ] **Announcements**: Targeted to members or self

### Notification Content
- [ ] Each has title, body, and data payload
- [ ] Tapping notification opens app to relevant screen (if possible)

---

## 4.11 Restrictions & Permissions

### Cannot Do
- [ ] Cannot create members
- [ ] Cannot delete members
- [ ] Cannot approve any check-ins or leaves (own or others')
- [ ] Cannot force logout anyone
- [ ] Cannot view session management
- [ ] Cannot assign managers
- [ ] Cannot view other members' data (except via announcements)
- [ ] Cannot create announcements
- [ ] Cannot modify app settings
- [ ] Cannot approve own check-ins/checkouts/leaves
- [ ] Cannot access Owner or Manager routes (RLS blocks)

### Can Do
- [ ] Check in and check out daily
- [ ] View and update own tasks
- [ ] View own attendance history
- [ ] Submit leave requests
- [ ] View announcements
- [ ] Change own password
- [ ] View own profile

---

## 4.12 Edge Cases & Validation

### Duplicate Check-in Prevention
- [ ] Database constraint: `UNIQUE(user_id, date)`
- [ ] Attempting to check in twice on same day shows error: "You have already checked in today"
- [ ] Error shown as snackbar
- [ ] Modal closes

### Check-in Rejected Flow
- [ ] After rejection, status badge shows "Rejected" (red)
- [ ] Rejection reason displayed in banner
- [ ] "Check In Again" button appears
- [ ] Tapping button opens check-in modal
- [ ] Re-submitting creates new work_log (or updates existing with new status)

### Checkout Without Check-in
- [ ] Checkout button only shown if status = 'working'
- [ ] If user tries to access checkout without approved check-in (via deep link or bug):
  - [ ] Error: "You must check in first"

### Task Without Work Log
- [ ] Tasks can be assigned without work_log_id (standalone tasks)
- [ ] Tasks with `due_date = today` OR `work_log_id = today's log` shown in list
- [ ] Tasks without due date shown as "No due date"

### Multiple Check-outs (if Approval Disabled)
- [ ] If `require_checkout_approval = false`:
  - [ ] Check-out immediately sets status to 'done'
  - [ ] No "Pending Checkout" state
  - [ ] User cannot check out again same day

### Offline Check-in/Check-out
- [ ] If offline, Supabase request fails
- [ ] Error snackbar: "Network error. Please check your connection and try again."
- [ ] Modal remains open
- [ ] User can retry after reconnecting

---

## 4.13 UI/UX Details

### Text Field Character Limits
- [ ] Check-in Plan: 2000 chars (enforced in UI and DB)
- [ ] Day Report: 3000 chars
- [ ] Leave Reason: 500 chars
- [ ] Task Completion Note: 500 chars
- [ ] Character counter shown below field
- [ ] Counter turns red when approaching limit

### Date Pickers
- [ ] Leave request date picker: Future dates only, calendar style
- [ ] Task due date picker (for manager/owner): Future dates only

### Empty States
- [ ] All empty states have:
  - [ ] Icon (grey, 48px)
  - [ ] Title (bold, 18px)
  - [ ] Subtitle (grey, 14px)
  - [ ] Optional action button
- [ ] Centered in screen

### Loading States
- [ ] Skeleton screens shown while loading:
  - [ ] Home: Skeleton status card
  - [ ] Tasks: 3 skeleton task cards
  - [ ] History: Skeleton calendar
  - [ ] Announcements: 3 skeleton cards
- [ ] Skeletons have shimmer animation

### Error States
- [ ] Inline error component shown when fetch fails:
  - [ ] Red background
  - [ ] Error icon
  - [ ] Error message
  - [ ] "Retry" button
- [ ] Tapping retry re-fetches data

### Animations
- [ ] Page transitions: Fade in (200ms)
- [ ] Cards: Scale 0.98 and opacity 0.7 on press
- [ ] Modals: Slide up from bottom
- [ ] Status changes: Smooth color transitions
- [ ] Pull-to-refresh: Spinner rotates

---

## 4.14 Accessibility & Responsive Design

### Text Sizing
- [ ] All text respects system font size settings
- [ ] Minimum touch target: 44x44 points (iOS) / 48x48 dp (Android)
- [ ] All buttons and taps have adequate size

### Color Contrast
- [ ] Text on background meets WCAG AA standards:
  - [ ] Dark text (#1C1C1E) on light background (#F2F2F7): 12:1
  - [ ] White text (#FFFFFF) on black buttons (#000000): 21:1
- [ ] Status colors have distinct hues for color-blind users:
  - Success: Green + Checkmark icon
  - Warning: Orange + Clock icon
  - Error: Red + X icon
  - Info: Blue + Info icon

### Keyboard Navigation
- [ ] Forms navigate via Tab key (web)
- [ ] Return key submits forms or moves to next field
- [ ] ESC key closes modals

### Screen Readers (VoiceOver/TalkBack)
- [ ] All icons have accessible labels
- [ ] Status changes announced
- [ ] Form errors announced
- [ ] Buttons have descriptive labels (not just "Button")

### Responsive Layout
- [ ] All screens support:
  - [ ] Portrait mode (primary)
  - [ ] Landscape mode (usable, not optimized)
- [ ] Cards max width: 600px (centered on tablets)
- [ ] Touch targets scale appropriately
- [ ] Text wraps on smaller screens

---

# APPENDIX A: Test Data Setup

## Creating Test Accounts

### Owner Account (Seeded)
```
Employee ID: VB-0001
Password: VbOwner#Reset2026! (must change on first login)
Role: Owner
```

### Manager Account (Created by Owner)
```
Full Name: QA Manager
Employee ID: VB-0002
Password: Manager@2026! (temporary)
Role: Manager
Department: QA Team
```

### Member Accounts (Created by Owner)
```
Member 1:
  Full Name: QA Member
  Employee ID: VB-0003
  Password: Member@2026!
  Role: Member
  Manager: QA Manager (VB-0002)
  Department: QA Team

Member 2:
  Full Name: Test Engineer
  Employee ID: VB-0004
  Password: Test@2026!
  Role: Member
  Manager: QA Manager (VB-0002)
  Department: QA Team
```

---

# APPENDIX B: Database Query Tests

## Manual RLS Validation Queries

### Test Owner Access
```sql
-- As Owner (VB-0001)
SELECT * FROM profiles; -- Should return all profiles
SELECT * FROM work_logs; -- Should return all work logs
SELECT * FROM tasks; -- Should return all tasks
```

### Test Manager Access
```sql
-- As Manager (VB-0002)
SELECT * FROM profiles; -- Should return only self + assigned team
SELECT * FROM work_logs WHERE user_id = '[member_id]'; -- Should return team logs only
SELECT * FROM tasks WHERE assigned_to = '[member_id]'; -- Should return team tasks
```

### Test Member Access
```sql
-- As Member (VB-0003)
SELECT * FROM profiles WHERE id = auth.uid(); -- Should return only self
SELECT * FROM work_logs WHERE user_id = auth.uid(); -- Should return only own logs
SELECT * FROM tasks WHERE assigned_to = auth.uid(); -- Should return only own tasks
```

### Test Security Triggers
```sql
-- Attempt privilege escalation (should fail)
UPDATE profiles SET role = 'owner' WHERE id = '[member_id]'; 
-- Expected error: "SECURITY: You are not allowed to change your own role"

-- Attempt self-approval (should fail)
UPDATE work_logs SET check_in_approved = true WHERE user_id = '[member_id]';
-- Expected error: "SECURITY: Members cannot approve their own check-in"
```

---

# APPENDIX C: Edge Function Testing

## Test Create Member
```bash
curl -X POST https://[project].supabase.co/functions/v1/create-member \
  -H "Authorization: Bearer [owner_jwt]" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Test User",
    "employee_id": "VB-0099",
    "role": "member",
    "department": "Testing",
    "manager_id": "[manager_uuid]",
    "password": "Test@2026!"
  }'
```

**Expected Response (201):**
```json
{
  "success": true,
  "member": {
    "id": "[uuid]",
    "full_name": "Test User",
    "employee_id": "VB-0099",
    "role": "member",
    "department": "Testing",
    "email": "vb0099@vebosso.local"
  },
  "credentials": {
    "employee_id": "VB-0099",
    "password": "Test@2026!"
  }
}
```

**Error Cases:**
- 401: Missing/invalid JWT
- 403: Caller is not owner
- 400: Validation errors (missing fields, password < 8 chars)
- 409: Duplicate employee_id
- 500: Server error

## Test Force Logout
```bash
curl -X POST https://[project].supabase.co/functions/v1/force-logout \
  -H "Authorization: Bearer [owner_jwt]" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "[member_uuid]",
    "session_id": "[session_uuid]"
  }'
```

**Expected Response (200):**
```json
{
  "success": true,
  "message": "User has been logged out"
}
```

**Error Cases:**
- 400: user_id is caller's own ID ("You cannot force logout yourself")
- 400: Missing user_id
- 403: Caller is not owner

## Test Admin Update Member
```bash
# Update Password
curl -X POST https://[project].supabase.co/functions/v1/admin-update-member \
  -H "Authorization: Bearer [owner_jwt]" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "update-password",
    "user_id": "[member_uuid]",
    "password": "NewPassword@2026!"
  }'

# Delete Member
curl -X POST https://[project].supabase.co/functions/v1/admin-update-member \
  -H "Authorization: Bearer [owner_jwt]" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "delete-member",
    "user_id": "[member_uuid]"
  }'
```

---

# APPENDIX D: Common Test Scenarios

## Scenario 1: Complete Daily Workflow
1. Member logs in
2. Member checks in with plan
3. Manager receives notification
4. Manager approves check-in
5. Member receives approval notification
6. Member updates task to "In Progress"
7. Member completes task with note
8. Member checks out with day summary
9. Manager receives checkout notification
10. Manager approves checkout
11. Member receives approval notification
12. Dashboard stats update across all roles

## Scenario 2: Leave Request Workflow
1. Member submits leave request for tomorrow
2. Manager receives notification
3. Manager reviews and approves
4. Member receives approval notification
5. Dashboard "On Leave Today" increases tomorrow
6. Member cannot check in on approved leave date (test this)

## Scenario 3: Task Reassignment
1. Owner assigns task to Member A
2. Member A starts task
3. Manager reassigns task to Member B
4. Member A receives notification (task removed)
5. Member B receives notification (new task)
6. Both members' task lists update in real-time

## Scenario 4: Force Logout
1. Owner views active sessions
2. Owner force-logs out Member
3. Member's device signs out immediately
4. Member logs back in
5. New session appears in session list
6. All previous data intact

## Scenario 5: Rejection & Re-submission
1. Member checks in
2. Manager rejects with reason
3. Member receives rejection notification
4. Member sees rejection reason on home screen
5. Member clicks "Check In Again"
6. Member submits new plan
7. Manager approves
8. Workflow continues normally

---

# APPENDIX E: Performance Benchmarks

## Expected Load Times
- [ ] App launch (cold start): < 2 seconds
- [ ] Login: < 1 second
- [ ] Dashboard load: < 1 second
- [ ] Team list (100 members): < 2 seconds
- [ ] History calendar: < 1 second
- [ ] Real-time update latency: < 500ms

## Network Requirements
- [ ] Minimum bandwidth: 1 Mbps
- [ ] Works on 3G/4G/5G/WiFi
- [ ] Graceful degradation on slow networks (loading indicators)

## Database Query Performance
- [ ] Profile lookup: < 100ms
- [ ] Work log fetch (1 month): < 500ms
- [ ] Task list (50 tasks): < 300ms
- [ ] RLS policy evaluation overhead: < 50ms

---

# APPENDIX F: Security Checklist

## Authentication Security
- [ ] Passwords must be ≥ 8 characters
- [ ] Passwords hashed with bcrypt (Supabase default)
- [ ] JWT tokens expire after 1 hour
- [ ] Refresh tokens rotate automatically
- [ ] Force password change enforced on first login
- [ ] No password visible in logs or error messages

## Authorization Security
- [ ] RLS policies enabled on all tables
- [ ] Role-based access strictly enforced
- [ ] No bypassing RLS via service key in client code
- [ ] Edge functions validate caller role
- [ ] Database triggers prevent privilege escalation
- [ ] Database triggers prevent self-approval

## Data Security
- [ ] All API requests over HTTPS
- [ ] No sensitive data in URL parameters
- [ ] JWT tokens stored securely (Expo SecureStore)
- [ ] Push tokens stored in database (not sensitive)
- [ ] Passwords never stored in plain text
- [ ] Passwords never logged

## Input Validation
- [ ] All text inputs have max length constraints
- [ ] SQL injection impossible (parameterized queries via Supabase)
- [ ] XSS prevented (React Native renders text as text, not HTML)
- [ ] Employee IDs validated format: VB-XXXX

---

# APPENDIX G: Known Limitations

1. **No Offline Support**: App requires internet connection for all operations
2. **No Edit History**: Work logs, tasks, and leaves cannot be edited after submission (by design)
3. **No Multi-language**: English only
4. **No Dark Mode**: Light mode only
5. **No File Attachments**: Tasks and announcements do not support file uploads
6. **No Bulk Actions**: Cannot approve/reject multiple items at once
7. **No Export**: Cannot export attendance history or reports to CSV/PDF
8. **No Advanced Filtering**: History calendar cannot filter by status or department
9. **No Task Comments**: No discussion thread on tasks
10. **No Notifications Settings**: Cannot disable specific notification types

---

# APPENDIX H: Browser/Platform Support

## Supported Platforms
- [ ] Android 6.0+ (API 23+)
- [ ] iOS 13.0+ (iPhone 6s and newer)

## NOT Supported
- [ ] Web (Expo Router web not configured)
- [ ] Desktop (Windows/Mac/Linux)
- [ ] iPad (will run but UI not optimized)

---

**END OF COMPREHENSIVE QA TESTING GUIDE**

---

## Document Metadata

- **Author:** AI QA Lead Agent
- **Generated:** July 4, 2026
- **Codebase Scan Date:** Complete as of v1.0.0
- **Total Test Items:** 850+
- **Estimated Test Time:** 8-12 hours for full coverage
- **Last Updated:** Based on complete analysis of src/, supabase/, and database schema

