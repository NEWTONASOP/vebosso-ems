// ============================================================================
// VEBOSSO EMS — Loading Skeleton Component (static bones — no per-line animation)
// ============================================================================

import { StyleSheet, View, ViewStyle } from 'react-native';
import { Colors } from '../constants/colors';

interface BoneProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

/** Static placeholder block — lightweight, no Reanimated loops. */
function Bone({ width = '100%', height = 16, borderRadius = 8, style }: BoneProps) {
  return (
    <View
      style={[
        {
          width: width as ViewStyle['width'],
          height,
          borderRadius,
          backgroundColor: Colors.skeleton,
        },
        style,
      ]}
    />
  );
}

export function MemberCardSkeleton() {
  return (
    <View style={styles.memberCard}>
      <View style={styles.memberTopRow}>
        <Bone width={40} height={40} borderRadius={20} />
        <View style={styles.memberInfo}>
          <Bone width="72%" height={15} borderRadius={6} />
          <Bone width="48%" height={12} borderRadius={6} style={{ marginTop: 6 }} />
          <View style={styles.memberStatusRow}>
            <Bone width={88} height={22} borderRadius={10} />
            <Bone width={64} height={22} borderRadius={8} />
          </View>
        </View>
      </View>
    </View>
  );
}

export function ApprovalCardSkeleton() {
  return (
    <View style={styles.approvalCard}>
      <View style={styles.memberTopRow}>
        <Bone width={44} height={44} borderRadius={22} />
        <View style={styles.memberInfo}>
          <Bone width="65%" height={15} borderRadius={6} />
          <Bone width="35%" height={12} borderRadius={6} style={{ marginTop: 6 }} />
        </View>
        <Bone width={72} height={24} borderRadius={10} />
      </View>
      <View style={styles.approvalTimeRow}>
        <Bone width="46%" height={40} borderRadius={12} />
        <Bone width="46%" height={40} borderRadius={12} />
      </View>
      <Bone width="100%" height={56} borderRadius={12} style={{ marginTop: 12 }} />
      <View style={styles.approvalActions}>
        <Bone width="48%" height={40} borderRadius={12} />
        <Bone width="48%" height={40} borderRadius={12} />
      </View>
    </View>
  );
}

export function TaskRowSkeleton() {
  return (
    <View style={styles.taskRow}>
      <Bone width={36} height={36} borderRadius={10} />
      <View style={styles.taskRowText}>
        <Bone width="70%" height={14} borderRadius={6} />
        <Bone width="45%" height={11} borderRadius={6} style={{ marginTop: 6 }} />
      </View>
      <Bone width={72} height={32} borderRadius={10} />
    </View>
  );
}

export function StatusCardSkeleton() {
  return (
    <View style={styles.statusCard}>
      <Bone width={64} height={64} borderRadius={32} />
      <Bone width="55%" height={12} borderRadius={6} style={{ marginTop: 14 }} />
      <Bone width="40%" height={28} borderRadius={8} style={{ marginTop: 8 }} />
      <View style={styles.statusDetails}>
        <Bone width="100%" height={38} borderRadius={10} />
        <Bone width="100%" height={38} borderRadius={10} style={{ marginTop: 8 }} />
      </View>
      <Bone width="100%" height={44} borderRadius={14} style={{ marginTop: 16 }} />
    </View>
  );
}

/** @deprecated Use variant-specific skeletons. Kept for compatibility — static bones only. */
export function CardSkeleton() {
  return <MemberCardSkeleton />;
}

export type ListSkeletonVariant = 'member' | 'approval' | 'task-row' | 'card';

export function ListSkeleton({
  count = 5,
  variant = 'card',
}: {
  count?: number;
  variant?: ListSkeletonVariant;
}) {
  const renderItem = () => {
    switch (variant) {
      case 'member':
        return <MemberCardSkeleton />;
      case 'approval':
        return <ApprovalCardSkeleton />;
      case 'task-row':
        return <TaskRowSkeleton />;
      default:
        return <CardSkeleton />;
    }
  };

  return (
    <View>
      {Array.from({ length: count }, (_, i) => (
        <View key={i}>{renderItem()}</View>
      ))}
    </View>
  );
}

export function StatsSkeleton() {
  return (
    <View style={styles.statsGrid}>
      <View style={styles.statsRowPair}>
        <StatCardSkeleton />
        <StatCardSkeleton />
      </View>
      <View style={styles.statsRowPair}>
        <StatCardSkeleton />
        <StatCardSkeleton />
      </View>
    </View>
  );
}

function StatCardSkeleton() {
  return (
    <View style={styles.statCard}>
      <Bone width={36} height={36} borderRadius={10} />
      <View style={styles.statCardText}>
        <Bone width="50%" height={18} borderRadius={6} />
        <Bone width="70%" height={11} borderRadius={6} style={{ marginTop: 6 }} />
      </View>
    </View>
  );
}

export function ProfileSkeleton() {
  return (
    <View style={styles.profileSkeleton}>
      <Bone width={80} height={80} borderRadius={40} />
      <Bone width="50%" height={18} borderRadius={6} style={{ marginTop: 12 }} />
      <Bone width="30%" height={14} borderRadius={6} style={{ marginTop: 8 }} />
      <Bone width="40%" height={14} borderRadius={6} style={{ marginTop: 4 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  memberCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow,
  },
  memberTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  memberInfo: {
    flex: 1,
    minWidth: 0,
  },
  memberStatusRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  approvalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow,
  },
  approvalTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  approvalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 4,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  taskRowText: {
    flex: 1,
    minWidth: 0,
  },
  statusCard: {
    backgroundColor: Colors.surface,
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadowHeavy,
  },
  statusDetails: {
    width: '100%',
    marginTop: 16,
  },
  statsGrid: {
    gap: 12,
  },
  statsRowPair: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow,
  },
  statCardText: {
    flex: 1,
    marginLeft: 10,
  },
  profileSkeleton: {
    alignItems: 'center',
    paddingVertical: 24,
  },
});
