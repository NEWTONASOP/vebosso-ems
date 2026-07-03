// ============================================================================
// VEBOSSO EMS — Assign Manager Modal Component
// ============================================================================

import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Modal, Portal, Searchbar, Text } from 'react-native-paper';
import { Colors } from '../constants/colors';
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
            <Feather name="user-plus" size={24} color={Colors.ownerAccent} />
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
          iconColor={Colors.textSecondary}
          placeholderTextColor={Colors.placeholder}
        />

        <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
          {/* Option to remove manager */}
          <AnimatedPressable
            style={[
              styles.managerItem,
              selectedManagerId === null && styles.managerItemSelected,
            ]}
            onPress={() => setSelectedManagerId(null)}
          >
            <View style={[styles.managerAvatar, { backgroundColor: Colors.textTertiary + '15' }]}>
              <Feather name="user-x" size={20} color={Colors.textTertiary} />
            </View>
            <View style={styles.managerInfo}>
              <Text style={styles.managerName}>No Manager</Text>
              <Text style={styles.managerDetails}>Remove manager assignment</Text>
            </View>
            {selectedManagerId === null && (
              <Feather name="check-circle" size={20} color={Colors.success} />
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
              <View style={[styles.managerAvatar, { backgroundColor: Colors.managerAccent + '15' }]}>
                <Text style={[styles.managerAvatarText, { color: Colors.managerAccent }]}>
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
                <Feather name="check-circle" size={20} color={Colors.success} />
              )}
            </AnimatedPressable>
          ))}

          {filteredManagers.length === 0 && searchQuery !== '' && (
            <View style={styles.emptyState}>
              <Feather name="search" size={32} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>No managers found</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.actions}>
          <Button
            mode="outlined"
            onPress={onDismiss}
            style={styles.cancelBtn}
            textColor={Colors.text}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={handleSubmit}
            style={styles.assignBtn}
            buttonColor={Colors.ownerAccent}
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
    backgroundColor: Colors.surface,
    marginHorizontal: 20,
    borderRadius: 24,
    padding: 20,
    maxHeight: '80%',
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
  title: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  searchbar: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 12,
    elevation: 0,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  searchInput: {
    color: Colors.text,
    fontSize: 14,
  },
  listContainer: {
    maxHeight: 300,
    marginBottom: 16,
  },
  managerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  managerItemSelected: {
    backgroundColor: Colors.success + '10',
    borderColor: Colors.success,
  },
  managerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  managerAvatarText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  managerInfo: {
    flex: 1,
  },
  managerName: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  managerDetails: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    borderColor: Colors.border,
    borderRadius: 12,
  },
  assignBtn: {
    flex: 1,
    borderRadius: 12,
  },
});
