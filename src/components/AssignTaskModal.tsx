// ============================================================================
// VEBOSSO EMS — Assign Task Modal
// A task is just a message to the person — no title/description split and
// no due date. The message is stored as the task title.
// ============================================================================

import { AppTheme } from '../constants/theme';
import { Profile } from '../types/database';
import { MessageComposeSheet } from './MessageComposeSheet';

interface AssignTaskModalProps {
  visible: boolean;
  onDismiss: () => void;
  /** Called as (message, null, null) — kept in this shape for existing callers. */
  onSubmit: (title: string, description: string | null, dueDate: string | null) => Promise<void>;
  targetMember: Profile | null;
  isLoading?: boolean;
}

export function AssignTaskModal({ visible, onDismiss, onSubmit, targetMember }: AssignTaskModalProps) {
  const firstName = targetMember?.full_name.split(' ')[0] || 'team member';

  return (
    <MessageComposeSheet
      visible={visible}
      onDismiss={onDismiss}
      title="Give a task"
      subtitle={`To ${targetMember?.full_name ?? firstName}`}
      icon="clipboard"
      iconColor={AppTheme.charcoal}
      iconBg={AppTheme.soft}
      placeholder={`What should ${firstName} do?`}
      sendLabel="Give task"
      onSend={async (message) => {
        try {
          await onSubmit(message, null, null);
          onDismiss();
        } catch {
          return 'Failed to assign task';
        }
      }}
    />
  );
}
