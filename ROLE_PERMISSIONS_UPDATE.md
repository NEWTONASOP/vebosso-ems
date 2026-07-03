# Role Permissions Update - VEBOSSO EMS

## Overview
This document outlines the changes made to implement proper role-based access control (RBAC) for Owner, Manager, and Member roles.

---

## Changes Summary

### 1. **Manager Permissions - RESTRICTED**

#### ❌ REMOVED Capabilities:
- **Team Attendance History**: Managers can NO LONGER view team members' attendance history
- **Team Overview Stats**: Managers can NO LONGER see team statistics (total members, active now, on leave, etc.)

#### ✅ KEPT Capabilities:
- **Own Attendance**: Managers can view their own attendance history (just like a member)
- **Approve/Reject Check-ins**: Managers can still approve or reject team member day start requests
- **Task Assignment**: Managers can still assign tasks to their assigned team members
- **View Team List**: Managers can view their assigned team members in "My Team" section

---

### 2. **Owner Permissions - ENHANCED**

#### ✅ NEW Capabilities:
- **Assign Managers**: Owners can now assign managers to team members
- **Remove Manager Assignment**: Owners can remove manager assignments
- **Full Profile Access**: Owners can view and edit any member or manager profile

#### ✅ EXISTING Capabilities (Unchanged):
- **View All Attendance**: Owners can view any member's attendance history
- **Company Stats**: Owners can see company-wide statistics
- **Approve/Reject**: Owners can approve/reject any check-in
- **Task Assignment**: Owners can assign tasks to anyone
- **Full Control**: Owners have complete control over the system

---

## Files Modified

### Frontend Changes

#### 1. **Manager Dashboard** (`src/app/(manager)/dashboard.tsx`)
**Changes:**
- Removed team overview stats display
- Removed `fetchStats()` call
- Added focused "Pending Approvals" count card
- Simplified dashboard to show only approval-related information

**Before:**
```typescript
// Displayed: Total Members, Active Now, On Leave, Pending Approvals
<View style={styles.statsGrid}>
  <StatCard icon="users" value={stats.totalMembers.toString()} />
  <StatCard icon="check-circle" value={stats.activeNow.toString()} />
  <StatCard icon="sun" value={stats.onLeaveToday.toString()} />
  <StatCard icon="clock" value={stats.pendingApprovals.toString()} />
</View>
```

**After:**
```typescript
// Only displays pending approvals count
<View style={styles.approvalCountCard}>
  <Feather name="clock" size={24} color={Colors.managerAccent} />
  <Text>{pendingApprovals.length}</Text>
  <Text>Pending Approvals</Text>
</View>
```

#### 2. **Manager History** (`src/app/(manager)/history.tsx`)
**Changes:**
- Removed team member selector dropdown
- Removed `fetchTeamMembers()` call
- Changed to display only manager's own attendance
- Updated title from "Team History" to "My History"

**Before:**
```typescript
// Could select and view any team member's history
<Menu>
  {teamMembers.map((m) => (
    <Menu.Item title={m.full_name} onPress={() => setSelectedMember(m)} />
  ))}
</Menu>
```

**After:**
```typescript
// Displays only own attendance
const loadHistory = async () => {
  if (!profile?.id) return;
  const logs = await fetchWorkHistory(profile.id, start, end);
  setWorkLogs(logs);
};
```

#### 3. **Owner Team Screen** (`src/app/(owner)/team.tsx`)
**Changes:**
- Added context menu on member card press
- Integrated `AssignManagerModal` component
- Added "Assign Manager" option in context menu
- Added manager assignment handler with backend update
- Enhanced member interaction with multiple options

**New Features:**
```typescript
// Context menu with options
<Menu>
  <Menu.Item title="Assign Task" />
  <Menu.Item title="Assign Manager" />  // NEW
</Menu>

// Manager assignment handler
const handleAssignManager = async (managerId: string | null) => {
  await supabase
    .from('profiles')
    .update({ manager_id: managerId })
    .eq('id', selectedMember.id);
};
```

#### 4. **NEW Component: AssignManagerModal** (`src/components/AssignManagerModal.tsx`)
**Purpose:** Allow owners to assign or remove managers from team members

**Features:**
- Search functionality to find managers
- Visual selection with checkmarks
- Option to remove manager assignment
- Loading states during assignment
- Clean, modern UI matching app design

**Props:**
```typescript
interface AssignManagerModalProps {
  visible: boolean;
  onDismiss: () => void;
  targetMember: Profile | null;
  managers: Profile[];
  onAssign: (managerId: string | null) => Promise<void>;
  isLoading?: boolean;
}
```

---

### Backend Changes

#### 5. **NEW Migration** (`supabase/migrations/003_manager_assignment_updates.sql`)
**Purpose:** Support manager assignment functionality

**Changes:**
- Added index on `manager_id` for better query performance
- Added constraint to prevent self-assignment as manager
- Added `get_manager_name()` helper function
- Added documentation comments

**Key SQL:**
```sql
-- Prevent self-assignment
ALTER TABLE public.profiles 
ADD CONSTRAINT chk_not_self_manager 
CHECK (manager_id IS NULL OR manager_id != id);

-- Helper function to get manager name
CREATE FUNCTION public.get_manager_name(user_id UUID)
RETURNS TEXT AS $$
  SELECT full_name FROM public.profiles 
  WHERE id = (SELECT manager_id FROM public.profiles WHERE id = user_id);
$$ LANGUAGE sql;
```

---

## Database Schema

### Profiles Table Structure
```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  full_name TEXT NOT NULL,
  employee_id TEXT UNIQUE NOT NULL,
  role TEXT CHECK (role IN ('owner', 'manager', 'member')),
  department TEXT,
  manager_id UUID REFERENCES public.profiles(id), -- References assigned manager
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Row Level Security (RLS) Policies

#### Profiles Access:
- **Owner**: Full access (SELECT, INSERT, UPDATE, DELETE)
- **Manager**: 
  - SELECT: Own profile + assigned team members
  - UPDATE: Own profile only
- **Member**: 
  - SELECT: Own profile only
  - UPDATE: Own profile only

#### Work Logs Access:
- **Owner**: Full access
- **Manager**: 
  - SELECT: Own + team members
  - UPDATE: Own + team members (for approvals)
  - INSERT: Own only
- **Member**:
  - SELECT: Own only
  - INSERT: Own only
  - UPDATE: Own only

---

## User Flows

### 1. Owner Assigns Manager to Member

```
1. Owner navigates to Team screen
2. Owner taps on a member card
3. Context menu appears with options
4. Owner selects "Assign Manager"
5. Modal opens showing list of managers
6. Owner searches/selects a manager
7. Owner taps "Assign"
8. Backend updates member's manager_id
9. Success message shown
10. Team list refreshes with updated data
```

### 2. Manager Views Own Attendance

```
1. Manager navigates to History screen
2. Screen automatically loads manager's own attendance
3. Manager sees calendar with their attendance records
4. Manager can navigate between months
5. Manager can tap on days to view details
```

### 3. Manager Approves Check-in

```
1. Manager navigates to Dashboard or Approvals
2. Manager sees pending check-in requests from team
3. Manager reviews check-in plan
4. Manager taps "Approve" or "Reject"
5. Backend updates work log status
6. Member receives push notification
7. Approval list refreshes
```

---

## Testing Checklist

### Manager Role Tests:
- [ ] Manager CANNOT see team overview stats on dashboard
- [ ] Manager CAN see pending approvals count
- [ ] Manager CANNOT view team member attendance history
- [ ] Manager CAN view own attendance history
- [ ] Manager CAN approve/reject team check-ins
- [ ] Manager CAN assign tasks to team members
- [ ] Manager CAN view team member list in "My Team"
- [ ] Manager CANNOT modify team member profiles

### Owner Role Tests:
- [ ] Owner CAN see company-wide stats on dashboard
- [ ] Owner CAN view any member's attendance history
- [ ] Owner CAN assign managers to members
- [ ] Owner CAN remove manager assignments
- [ ] Owner CAN approve/reject any check-in
- [ ] Owner CAN assign tasks to anyone
- [ ] Owner CAN view and edit any profile
- [ ] Owner CAN see all team members with filters

### Database Tests:
- [ ] Cannot assign member as their own manager
- [ ] Manager_id constraint enforces valid references
- [ ] RLS policies correctly restrict manager access
- [ ] RLS policies allow owner full access
- [ ] Index on manager_id improves query performance

---

## Migration Instructions

### 1. Apply Database Migration
```bash
# If using Supabase CLI
supabase db push

# Or run the SQL file directly in Supabase Dashboard
# Navigate to SQL Editor and run:
# supabase/migrations/003_manager_assignment_updates.sql
```

### 2. Deploy Frontend Changes
```bash
# Install dependencies (if new packages added)
npm install

# Run the app
npm run start

# Or for production build
npm run build
```

### 3. Test User Flows
1. Log in as Owner and test manager assignment
2. Log in as Manager and verify restricted access
3. Log in as Member and verify normal functionality

---

## API Endpoints Used

### Supabase Queries:

#### Update Manager Assignment (Owner only):
```typescript
await supabase
  .from('profiles')
  .update({ manager_id: managerId })
  .eq('id', memberId);
```

#### Fetch Team Members (Manager - filtered):
```typescript
await supabase
  .from('profiles')
  .select('*')
  .eq('manager_id', managerId)
  .eq('is_active', true);
```

#### Fetch All Members (Owner):
```typescript
await supabase
  .from('profiles')
  .select('*')
  .eq('is_active', true)
  .order('full_name');
```

---

## Security Considerations

1. **RLS Enforcement**: All database operations are protected by Row Level Security policies
2. **Manager Assignment**: Only owners can modify the `manager_id` field
3. **Self-Assignment Prevention**: Database constraint prevents users from being their own manager
4. **Profile Updates**: Managers and members can only update their own profiles
5. **Attendance Privacy**: Managers cannot view team attendance history, only approvals

---

## Future Enhancements

### Potential Features:
1. **Manager Dashboard Analytics**: Limited stats like "My team's average attendance this week"
2. **Bulk Manager Assignment**: Assign multiple members to a manager at once
3. **Manager Hierarchy**: Support for manager chains (manager of managers)
4. **Audit Logs**: Track who assigned/changed manager assignments
5. **Manager Performance Metrics**: Show approval response time, team satisfaction

---

## Support & Troubleshooting

### Common Issues:

#### Manager still seeing team stats:
- Clear app cache and restart
- Verify database migration applied
- Check if user role is correctly set to 'manager'

#### Cannot assign manager:
- Verify logged in as owner
- Check if target user is active
- Ensure manager user has role='manager'

#### RLS policy errors:
- Verify migration 003 applied successfully
- Check Supabase logs for policy violations
- Ensure user authentication is valid

---

## Rollback Instructions

If issues occur, rollback by:

1. **Revert frontend files:**
```bash
git checkout HEAD~1 -- src/app/(manager)/dashboard.tsx
git checkout HEAD~1 -- src/app/(manager)/history.tsx
git checkout HEAD~1 -- src/app/(owner)/team.tsx
git checkout HEAD~1 -- src/components/AssignManagerModal.tsx
```

2. **Rollback database migration:**
```sql
-- Remove constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS chk_not_self_manager;

-- Remove function
DROP FUNCTION IF EXISTS public.get_manager_name(UUID);
```

---

## Changelog

### Version 2.1.0 (Current)
- ✅ Restricted manager access to team history
- ✅ Removed team stats from manager dashboard
- ✅ Added manager assignment for owners
- ✅ Created AssignManagerModal component
- ✅ Added database constraints and indexes
- ✅ Updated RLS policies documentation

### Version 2.0.0 (Previous)
- Initial role-based access control
- Manager, Owner, Member roles implemented
- Approval system created

---

**Last Updated:** 2026-07-03  
**Author:** VEBOSSO EMS Development Team  
**Status:** ✅ Implemented & Ready for Testing
