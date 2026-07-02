// ============================================================================
// VEBOSSO EMS — Member Picker Modal Component
// ============================================================================

import React, { useState, useMemo } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Modal, Portal, Text, Searchbar, Avatar, IconButton, Divider, Icon } from 'react-native-paper';
import { Colors } from '../constants/colors';
import { Profile } from '../types/database';
import { ROLE_LABELS } from '../constants/roles';
import { AnimatedPressable } from './AnimatedPressable';

interface MemberPickerModalProps {
  visible: boolean;
  onDismiss: () => void;
  members: Profile[];
  selectedMember: Profile | null;
  onSelectMember: (member: Profile) => void;
}

export function MemberPickerModal({
  visible,
  onDismiss,
  members,
  selectedMember,
  onSelectMember,
}: MemberPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const handleDismiss = () => {
    setSearchQuery('');
    onDismiss();
  };

  const handleSelectMember = (item: Profile) => {
    setSearchQuery('');
    onSelectMember(item);
  };

  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const query = searchQuery.toLowerCase();
    return members.filter(
      (m) =>
        m.full_name.toLowerCase().includes(query) ||
        m.employee_id.toLowerCase().includes(query) ||
        (m.department && m.department.toLowerCase().includes(query))
    );
  }, [members, searchQuery]);

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={handleDismiss}
        contentContainerStyle={styles.container}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Select Team Member</Text>
          <IconButton
            icon="close"
            iconColor={Colors.textSecondary}
            size={22}
            onPress={handleDismiss}
          />
        </View>

        <Searchbar
          placeholder="Search by name, ID, or dept..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
          iconColor={Colors.textSecondary}
          placeholderTextColor={Colors.placeholder}
          theme={{ colors: { onSurface: Colors.text, elevation: { level3: Colors.inputBackground } } }}
        />

        <FlatList
          data={filteredMembers}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          style={styles.list}
          ItemSeparatorComponent={() => <Divider style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon source="account-search-outline" size={40} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>No members found</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isSelected = selectedMember?.id === item.id;
            return (
              <AnimatedPressable
                style={[
                  styles.itemContainer,
                  isSelected && styles.selectedItemContainer,
                ]}
                onPress={() => {
                  handleSelectMember(item);
                }}
              >
                <Avatar.Text
                  size={40}
                  label={item.full_name.substring(0, 2).toUpperCase()}
                  style={[
                    styles.avatar,
                    isSelected ? styles.selectedAvatar : styles.defaultAvatar
                  ]}
                  labelStyle={[
                    styles.avatarLabel,
                    isSelected ? styles.selectedAvatarLabel : styles.defaultAvatarLabel
                  ]}
                />
                <View style={styles.info}>
                  <Text style={[styles.name, isSelected && styles.selectedText]}>{item.full_name}</Text>
                  <Text style={styles.details}>
                    {item.employee_id} {item.department ? `• ${item.department}` : ''}
                  </Text>
                </View>
                {isSelected ? (
                  <View style={styles.checkIcon}>
                    <Icon source="check" size={20} color={Colors.ownerAccent} />
                  </View>
                ) : (
                  <Text style={styles.roleLabel}>{ROLE_LABELS[item.role]}</Text>
                )}
              </AnimatedPressable>
            );
          }}
        />
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    margin: 20,
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadowHeavy,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  searchbar: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 12,
    elevation: 0,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
    height: 48,
  },
  searchInput: {
    minHeight: 48,
    alignSelf: 'center',
  },
  list: {
    marginTop: 8,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  selectedItemContainer: {
    backgroundColor: Colors.accentSubtle,
  },
  avatar: {
    marginRight: 12,
  },
  defaultAvatar: {
    backgroundColor: Colors.surfaceLight,
  },
  selectedAvatar: {
    backgroundColor: Colors.ownerAccent,
  },
  avatarLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  defaultAvatarLabel: {
    color: Colors.textSecondary,
  },
  selectedAvatarLabel: {
    color: Colors.white,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  selectedText: {
    fontWeight: '700',
  },
  details: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  checkIcon: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 24,
    height: 24,
  },
  roleLabel: {
    fontSize: 11,
    color: Colors.textTertiary,
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  separator: {
    backgroundColor: Colors.divider,
    height: StyleSheet.hairlineWidth,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
});
