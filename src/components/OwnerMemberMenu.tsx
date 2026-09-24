// ============================================================================
// VEBOSSO EMS — Owner Member Menu
// The sheet an owner gets when tapping a team member, plus the sheets it opens
// (documents, tasks, salary, assign manager). Closing one of those returns to
// the member sheet. Shared by the Dashboard and Team screens.
// ============================================================================

import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { countPendingDocuments } from '../lib/employeeRecords';
import { parseSupabaseError } from '../lib/errors';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useWorkStore } from '../store/workStore';
import { Profile } from '../types/database';
import { AssignManagerModal } from './AssignManagerModal';
import { DocumentsSheet } from './DocumentsSheet';
import { ExpensesSheet } from './ExpensesSheet';
import { MemberActionsModal } from './MemberActionsModal';
import { MemberTasksSheet } from './MemberTasksSheet';
import { SalarySheet } from './SalarySheet';

interface OwnerMemberMenuProps {
  /** The tapped member; null keeps everything closed. */
  member: Profile | null;
  onClose: () => void;
  /** Result text for the host screen's snackbar. */
  onMessage: (message: string) => void;
}

type Sheet = 'actions' | 'documents' | 'tasks' | 'salary' | 'expenses' | 'manager';

export function OwnerMemberMenu({ member, onClose, onMessage }: OwnerMemberMenuProps) {
  const router = useRouter();
  const { profile } = useAuthStore();
  const teamMembers = useWorkStore((s) => s.teamMembers);
  const memberLiveStatus = useWorkStore((s) => s.memberLiveStatus);
  const fetchTeamMembers = useWorkStore((s) => s.fetchTeamMembers);

  const [sheet, setSheet] = useState<Sheet>('actions');
  const [isAssigningManager, setIsAssigningManager] = useState(false);
  const [pendingDocs, setPendingDocs] = useState(0);

  // Re-count whenever the member sheet is (re)shown — e.g. after reviewing.
  const memberId = member?.id;
  useEffect(() => {
    if (!memberId || sheet !== 'actions') return;
    let active = true;
    countPendingDocuments(memberId).then((n) => active && setPendingDocs(n));
    return () => {
      active = false;
    };
  }, [memberId, sheet]);

  // Every new member opens on the actions sheet.
  const [lastMemberId, setLastMemberId] = useState<string | null>(null);
  if ((member?.id ?? null) !== lastMemberId) {
    setLastMemberId(member?.id ?? null);
    setSheet('actions');
  }

  if (!member) return null;

  const live = memberLiveStatus[member.id];
  const backToMenu = () => setSheet('actions');
  const managers = teamMembers.filter((m) => m.role === 'manager');

  const handleAssignManager = async (managerId: string | null) => {
    setIsAssigningManager(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ manager_id: managerId })
        .eq('id', member.id);

      if (error) throw error;

      // Send notification to employee about manager assignment
      if (managerId) {
        const { data: managerProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', managerId)
          .single();

        if (managerProfile) {
          const { sendPushNotification } = await import('../lib/notifications');
          sendPushNotification(
            member.id,
            'Manager Assigned',
            `${managerProfile.full_name} is now your manager`,
            { type: 'manager_assigned', manager_id: managerId }
          );
        }
      }

      onMessage(
        managerId
          ? `Manager assigned to ${member.full_name}`
          : `Manager removed from ${member.full_name}`
      );
      setSheet('actions');
      await fetchTeamMembers();
    } catch (error) {
      onMessage(parseSupabaseError(error));
    } finally {
      setIsAssigningManager(false);
    }
  };

  return (
    <>
      <MemberActionsModal
        visible={sheet === 'actions'}
        member={member}
        onDismiss={onClose}
        onOpenDocuments={() => setSheet('documents')}
        pendingDocsCount={pendingDocs}
        onOpenTasks={() => setSheet('tasks')}
        onOpenSalary={() => setSheet('salary')}
        onOpenExpenses={() => setSheet('expenses')}
        onAssignManager={() => setSheet('manager')}
        onManageProfile={() => {
          onClose();
          router.push(`/(owner)/member/${member.id}` as any);
        }}
        currentStatus={live?.status ?? 'offline'}
        checkInTime={live?.checkInTime}
        checkOutTime={live?.checkOutTime}
        checkInPlan={live?.checkInPlan}
        dayReport={live?.dayReport}
        pendingTaskCount={live?.pendingTaskCount ?? 0}
        inProgressTaskCount={live?.inProgressTaskCount ?? 0}
        doneTaskCount={live?.doneTaskCount ?? 0}
        activeTasks={live?.activeTasks ?? []}
      />

      {profile?.id ? (
        <>
          {sheet === 'documents' ? (
          <DocumentsSheet
            visible
            onDismiss={backToMenu}
            userId={member.id}
            userName={member.full_name}
            currentUserId={profile.id}
            canManage
          />
          ) : null}
          {sheet === 'tasks' ? (
          <MemberTasksSheet
            visible
            onDismiss={backToMenu}
            memberId={member.id}
            memberName={member.full_name}
            assignerId={profile.id}
            onMessage={onMessage}
          />
          ) : null}
          {sheet === 'salary' ? (
          <SalarySheet
            visible
            onDismiss={backToMenu}
            userId={member.id}
            userName={member.full_name}
            mode="owner"
            ownerId={profile.id}
          />
          ) : null}
          {sheet === 'expenses' ? (
          <ExpensesSheet
            onDismiss={backToMenu}
            userId={member.id}
            userName={member.full_name}
            mode="owner"
            ownerId={profile.id}
          />
          ) : null}
        </>
      ) : null}

      {sheet === 'manager' ? (
        <AssignManagerModal
          visible
          onDismiss={backToMenu}
          targetMember={member}
          managers={managers}
          onAssign={handleAssignManager}
          isLoading={isAssigningManager}
        />
      ) : null}
    </>
  );
}
