// ============================================================================
// VEBOSSO EMS — Assign Manager Modal Component
// ============================================================================

import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Modal, Portal, Searchbar, Text } from 'react-native-paper';
import { AppTheme, appShadow, appSoftShadow } from '../constants/theme';
import { Profile } from '../types/database';
import { AnimatedPressable } from './AnimatedPressable';

interface AssignManagerModalProps {
  visible: boolean;
  onDismiss: () => void;
  targetMember: Profile | null;
  managers: Profile[];
  onAssign: (managerId: string | null) => Promise<void>;
  isLoading?: boolean;
}

export function AssignManagerModal({
  visible,
  onDismiss,
  targetMember,
  managers,
  onAssign,
  isLoading = false,
}: AssignManagerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);

  React.useEffect(() => {
    if (visible && targetMember) {
      setSelectedManagerId(targetMember.manager_id || null);
      setSearchQuery('');
    }
  }, [visible, targetMember]);

  const handleSubmit = async () => {
    await onAssign(selectedManagerId);
  };

  const filteredManagers = managers
    .filter((m) => !targetMember || m.id !== targetMember.id)
    .filter((m) =>
      searchQuery === '' ||
      m.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.employee_id.toLowerCase().includes(searchQuery.toLowerCase())
    );

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modal}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerIcon}>
              <Feather name="user-plus" size={20} color={AppTheme.charcoal} />
            </View>
            <Text style={styles.title}>Assign Manager</Text>
          </View>
          <Text style={styles.subtitle}>
            {targetMember?.full_name} ({targetMember?.employee_id})
          </Text>
        </View>

        <Searchbar
          placeholder="Search managers..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
          iconColor={AppTheme.mute}
          placeholderTextColor={AppTheme.mute}
          theme={{
            colors: {
              onSurface: AppTheme.ink,
              elevation: { level3: AppTheme.card },
            },
          }}
        />

        <View style={styles.listWrap}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
            <AnimatedPressable
              style={[
                styles.managerItem,
                selectedManagerId === null && styles.managerItemSelected,
              ]}
              onPress={() => setSelectedManagerId(null)}
            >
              <View style={[styles.managerAvatar, styles.noManagerAvatar]}>
                <Feather name="user-x" size={18} color={AppTheme.mute} />
              </View>
              <View style={styles.managerInfo}>
                <Text style={styles.managerName}>No Manager</Text>
                <Text style={styles.managerDetails}>Remove manager assignment</Text>
              </View>
              {selectedManagerId === null && (
                <Feather name="check-circle" size={20} color={AppTheme.charcoal} />
              )}
            </AnimatedPressable>

            {filteredManagers.map((manager) => (
              <AnimatedPressable
                key={manager.id}
                style={[
                  styles.managerItem,
                  selectedManagerId === manager.id && styles.managerItemSelected,
                ]}
                onPress={() => setSelectedManagerId(manager.id)}
              >
                <View style={[styles.managerAvatar, styles.managerAvatarTint]}>
                  <Text style={styles.managerAvatarText}>
                    {manager.full_name.substring(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.managerInfo}>
                  <Text style={styles.managerName}>{manager.full_name}</Text>
                  <Text style={styles.managerDetails}>
                    {manager.employee_id} {manager.department ? `• ${manager.department}` : ''}
                  </Text>
                </View>
                {selectedManagerId === manager.id && (
                  <Feather name="check-circle" size={20} color={AppTheme.charcoal} />
                )}
              </AnimatedPressable>
            ))}

            {filteredManagers.length === 0 && searchQuery !== '' && (
              <View style={styles.emptyState}>
                <Feather name="search" size={32} color={AppTheme.mute} />
                <Text style={styles.emptyText}>No managers found</Text>
              </View>
            )}
          </ScrollView>
        </View>

        <View style={styles.actions}>
          <Button
            mode="contained"
            onPress={onDismiss}
            style={styles.cancelBtn}
            buttonColor={AppTheme.soft2}
            textColor={AppTheme.inkSoft}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={handleSubmit}
            style={styles.assignBtn}
            buttonColor={AppTheme.charcoal}
            textColor={AppTheme.white}
            loading={isLoading}
            disabled={isLoading}
          >
            Assign
          </Button>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    backgroundColor: AppTheme.card,
    marginHorizontal: 20,
    borderRadius: 28,
    padding: 20,
    maxHeight: '80%',
    ...appShadow,
  },
  header: {
    marginBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AppTheme.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    color: AppTheme.ink,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: AppTheme.mute,
  },
  searchbar: {
    backgroundColor: AppTheme.card,
    borderRadius: 16,
    borderWidth: 0,
    marginBottom: 12,
    height: 48,
    ...appSoftShadow,
  },
  searchInput: {
    color: AppTheme.ink,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    minHeight: 48,
    alignSelf: 'center',
  },
  listWrap: {
    backgroundColor: AppTheme.bg,
    borderRadius: 20,
    overflow: 'hidden',
    maxHeight: 300,
    marginBottom: 16,
  },
  listContent: {
    padding: 8,
    gap: 6,
  },
  managerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    backgroundColor: AppTheme.card,
    ...appSoftShadow,
  },
  managerItemSelected: {
    backgroundColor: AppTheme.blueSoft,
  },
  managerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  noManagerAvatar: {
    backgroundColor: AppTheme.soft,
  },
  managerAvatarTint: {
    backgroundColor: AppTheme.violetSoft,
  },
  managerAvatarText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: AppTheme.violet,
  },
  managerInfo: {
    flex: 1,
  },
  managerName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: AppTheme.ink,
  },
  managerDetails: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: AppTheme.mute,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: AppTheme.mute,
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 24,
    ...appSoftShadow,
  },
  assignBtn: {
    flex: 1,
    borderRadius: 24,
    ...appSoftShadow,
  },
});
