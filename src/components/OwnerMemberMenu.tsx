// ============================================================================
// VEBOSSO EMS — Owner Member Menu
// The sheet an owner gets when tapping a team member. Tasks by Boss,
// Messages, Employee details, Salary, Travel expenses, Documents and Assign Manager open as
// dialogs on top, with the member sheet still open underneath.
// Shared by the Dashboard and Team screens.
// ============================================================================

import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Feature, FEATURES, fetchFeatureAccess, setFeatureAccess } from '../lib/featureAccess';
import { countUnreadFrom } from '../lib/chat';
import { countPendingDocuments } from '../lib/employeeRecords';
import { parseSupabaseError } from '../lib/errors';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useWorkStore } from '../store/workStore';
import { Profile } from '../types/database';
import { AssignManagerModal } from './AssignManagerModal';
import { ChatSheet } from './ChatPanel';
import { DocumentsSheet } from './DocumentsSheet';
import { EmployeeDetailsSheet } from './EmployeeDetailsSheet';
import { ExpensesSheet } from './ExpensesSheet';
import { MemberActionsModal, MemberDialog } from './MemberActionsModal';
import { MemberTasksSheet } from './MemberTasksSheet';
import { SalarySheet } from './SalarySheet';

interface OwnerMemberMenuProps {
  /** The tapped member; null keeps everything closed. */
  member: Profile | null;
  onClose: () => void;
  /** Result text for the host screen's snackbar. */
  onMessage: (message: string) => void;
  /** Dialog to open with the sheet, e.g. 'chat' from the inbox. */
  initialDialog?: MemberDialog | null;
}


export function OwnerMemberMenu({ member, onClose, onMessage, initialDialog = null }: OwnerMemberMenuProps) {
  const router = useRouter();
  const { profile } = useAuthStore();
  const teamMembers = useWorkStore((s) => s.teamMembers);
  const memberLiveStatus = useWorkStore((s) => s.memberLiveStatus);
  const fetchTeamMembers = useWorkStore((s) => s.fetchTeamMembers);

  const [dialog, setDialog] = useState<MemberDialog | null>(initialDialog);
  const [assigning, setAssigning] = useState(false);
  const [isAssigningManager, setIsAssigningManager] = useState(false);
  const [pendingDocs, setPendingDocs] = useState(0);
  const [unreadChat, setUnreadChat] = useState(0);
  const [access, setAccess] = useState<Record<Feature, boolean> | null>(null);

  // Re-count when a dropdown opens or closes — e.g. after reviewing documents
  // or reading the chat.
  const memberId = member?.id;
  useEffect(() => {
    if (!memberId) return;
    let active = true;
    countPendingDocuments(memberId).then((n) => active && setPendingDocs(n));
    countUnreadFrom(memberId).then((n) => active && setUnreadChat(n));
    return () => {
      active = false;
    };
  }, [memberId, dialog]);

  useEffect(() => {
    if (!memberId) return;
    let active = true;
    fetchFeatureAccess(memberId).then((a) => active && setAccess(a));
    return () => {
      active = false;
    };
  }, [memberId]);

  // Every new member opens with the requested dropdown (usually none).
  const [lastMemberId, setLastMemberId] = useState<string | null>(null);
  if ((member?.id ?? null) !== lastMemberId) {
    setLastMemberId(member?.id ?? null);
    setDialog(initialDialog);
    setAssigning(false);
    setAccess(null);
  }

  if (!member) return null;

  const live = memberLiveStatus[member.id];
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
      setAssigning(false);
      await fetchTeamMembers();
    } catch (error) {
      onMessage(parseSupabaseError(error));
    } finally {
      setIsAssigningManager(false);
    }
  };

  const toggleAccess = async (feature: Feature, grant: boolean) => {
    if (!profile?.id) return;
    if (access?.[feature] === grant) return; // already in that state (double tap)
    const label = FEATURES.find((f) => f.key === feature)?.label ?? feature;
    setAccess((a) => (a ? { ...a, [feature]: grant } : a));
    const res = await setFeatureAccess(member.id, feature, grant, profile.id);
    if (!res.success) {
      setAccess((a) => (a ? { ...a, [feature]: !grant } : a));
      return onMessage(res.error);
    }
    onMessage(grant ? `${member.full_name} can now use ${label}` : `${label} removed for ${member.full_name}`);
  };

  return (
    <>
      <MemberActionsModal
        visible
        member={member}
        onDismiss={onClose}
        pendingDocsCount={pendingDocs}
        onOpenDialog={setDialog}
        unreadChatCount={dialog === 'chat' ? 0 : unreadChat}
        onAssignManager={() => setAssigning(true)}
        access={access}
        onToggleAccess={(feature, grant) => void toggleAccess(feature, grant)}
        onManageProfile={() => {
          onClose();
          router.push(`/(owner)/member/${member.id}` as any);
        }}
        pendingTaskCount={live?.pendingTaskCount ?? 0}
        inProgressTaskCount={live?.inProgressTaskCount ?? 0}
        doneTaskCount={live?.doneTaskCount ?? 0}
      />

      {dialog === 'tasks' && profile?.id ? (
        <MemberTasksSheet
          visible
          onDismiss={() => setDialog(null)}
          memberId={member.id}
          memberName={member.full_name}
          assignerId={profile.id}
          onMessage={onMessage}
        />
      ) : null}

      {dialog === 'details' && profile?.id ? (
        <EmployeeDetailsSheet
          onDismiss={() => setDialog(null)}
          userId={member.id}
          userName={member.full_name}
          mode="owner"
          onMessage={onMessage}
        />
      ) : null}

      {dialog === 'salary' && profile?.id ? (
        <SalarySheet
          visible
          onDismiss={() => setDialog(null)}
          userId={member.id}
          userName={member.full_name}
          mode="owner"
          ownerId={profile.id}
        />
      ) : null}

      {dialog === 'expenses' && profile?.id ? (
        <ExpensesSheet
          onDismiss={() => setDialog(null)}
          userId={member.id}
          userName={member.full_name}
          mode="owner"
          ownerId={profile.id}
        />
      ) : null}

      {dialog === 'documents' && profile?.id ? (
        <DocumentsSheet
          visible
          onDismiss={() => setDialog(null)}
          userId={member.id}
          userName={member.full_name}
          currentUserId={profile.id}
          canManage
        />
      ) : null}

      {dialog === 'chat' ? (
        <ChatSheet
          memberId={member.id}
          title={`Chat with ${member.full_name.split(' ')[0]}`}
          subtitle="Only you and them see this"
          onDismiss={() => setDialog(null)}
        />
      ) : null}

      {assigning ? (
        <AssignManagerModal
          visible
          onDismiss={() => setAssigning(false)}
          targetMember={member}
          managers={managers}
          onAssign={handleAssignManager}
          isLoading={isAssigningManager}
        />
      ) : null}
    </>
  );
}
