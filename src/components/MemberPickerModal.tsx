// ============================================================================
// VEBOSSO EMS — Member Picker Modal Component
// ============================================================================

import React, { useState, useMemo } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Modal, Portal, Text, Searchbar, Avatar, IconButton, Icon } from 'react-native-paper';
import { AppTheme, appShadow, appSoftShadow } from '../constants/theme';
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

function getRoleAvatarColors(role: Profile['role']) {
  switch (role) {
    case 'owner':
      return { bg: AppTheme.coralSoft, text: AppTheme.coral };
    case 'manager':
      return { bg: AppTheme.blueSoft, text: AppTheme.blue };
    default:
      return { bg: AppTheme.greenSoft, text: AppTheme.green };
  }
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
            iconColor={AppTheme.mute}
            size={22}
            onPress={handleDismiss}
            style={styles.closeBtn}
          />
        </View>

        <Searchbar
          placeholder="Search by name, ID, or dept..."
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
          <FlatList
            data={filteredMembers}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Icon source="account-search-outline" size={40} color={AppTheme.mute} />
                <Text style={styles.emptyText}>No members found</Text>
              </View>
            }
            renderItem={({ item }) => {
              const isSelected = selectedMember?.id === item.id;
              const avatarColors = getRoleAvatarColors(item.role);
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
                      isSelected
                        ? styles.selectedAvatar
                        : { backgroundColor: avatarColors.bg },
                    ]}
                    labelStyle={[
                      styles.avatarLabel,
                      isSelected
                        ? styles.selectedAvatarLabel
                        : { color: avatarColors.text },
                    ]}
                  />
                  <View style={styles.info}>
                    <Text style={[styles.name, isSelected && styles.selectedText]}>
                      {item.full_name}
                    </Text>
                    <Text style={styles.details}>
                      {item.employee_id} {item.department ? `• ${item.department}` : ''}
                    </Text>
                  </View>
                  {isSelected ? (
                    <View style={styles.checkIcon}>
                      <Icon source="check" size={18} color={AppTheme.charcoal} />
                    </View>
                  ) : (
                    <Text style={styles.roleLabel}>{ROLE_LABELS[item.role]}</Text>
                  )}
                </AnimatedPressable>
              );
            }}
          />
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: AppTheme.card,
    margin: 20,
    borderRadius: 28,
    padding: 20,
    maxHeight: '80%',
    ...appShadow,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    color: AppTheme.ink,
    letterSpacing: -0.3,
  },
  closeBtn: {
    margin: 0,
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
    minHeight: 48,
    alignSelf: 'center',
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: AppTheme.ink,
  },
  listWrap: {
    backgroundColor: AppTheme.bg,
    borderRadius: 20,
    overflow: 'hidden',
    maxHeight: 400,
  },
  listContent: {
    padding: 8,
    gap: 6,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: AppTheme.card,
    // Shadow on the inner AnimatedPressable view reads as a thick outer box
    // on phones, especially when the selected fill is a soft tint. Keep rows
    // flat; selection is the fill + checkmark.
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: AppTheme.hairline,
  },
  selectedItemContainer: {
    backgroundColor: AppTheme.blueSoft,
    borderColor: 'transparent',
  },
  avatar: {
    marginRight: 12,
  },
  selectedAvatar: {
    backgroundColor: AppTheme.charcoal,
  },
  avatarLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
  },
  selectedAvatarLabel: {
    color: AppTheme.white,
  },
  info: {
    flex: 1,
  },
  name: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: AppTheme.ink,
  },
  selectedText: {
    fontFamily: 'Inter_700Bold',
  },
  details: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: AppTheme.mute,
    marginTop: 2,
  },
  checkIcon: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: AppTheme.card,
  },
  roleLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: AppTheme.mute,
    backgroundColor: AppTheme.soft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    overflow: 'hidden',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: AppTheme.mute,
  },
});
