// ============================================================================
// VEBOSSO EMS — Message Buttons (member home / manager dashboard)
// "Message Boss" opens the private chat with the owner (unread count on the
// button); "Message Team" posts to the whole company's News feed.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T, appSoftShadow } from '../constants/theme';
import { countMyUnread } from '../lib/chat';
import { postToTeam } from '../lib/employeeRecords';
import { useAuthStore } from '../store/authStore';
import { AnimatedPressable } from './AnimatedPressable';
import { ChatSheet } from './ChatPanel';
import { MessageComposeSheet } from './MessageComposeSheet';

export function MessageButtons({ onMessage }: { onMessage: (message: string) => void }) {
  const profile = useAuthStore((s) => s.profile);
  const [open, setOpen] = useState<'boss' | 'team' | null>(null);
  const [unread, setUnread] = useState(0);
  const profileId = profile?.id;

  // Re-count on focus and whenever the chat closes.
  useFocusEffect(
    useCallback(() => {
      if (!profileId || open === 'boss') return;
      let active = true;
      countMyUnread(profileId).then((n) => active && setUnread(n));
      return () => {
        active = false;
      };
    }, [profileId, open])
  );

  if (!profile) return null;

  return (
    <>
      <View style={styles.row}>
        <AnimatedPressable
          scaleTo={0.97}
          style={styles.btn}
          onPress={() => setOpen('boss')}
          accessibilityRole="button"
          accessibilityLabel="Message the boss"
        >
          <View style={[styles.icon, { backgroundColor: T.violetSoft }]}>
            <Feather name="briefcase" size={15} color={T.violet} />
          </View>
          <Text style={styles.label}>Message Boss</Text>
          {unread > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unread}</Text>
            </View>
          ) : null}
        </AnimatedPressable>
        <AnimatedPressable
          scaleTo={0.97}
          style={styles.btn}
          onPress={() => setOpen('team')}
          accessibilityRole="button"
          accessibilityLabel="Message the whole team"
        >
          <View style={[styles.icon, { backgroundColor: T.blueSoft }]}>
            <Feather name="users" size={15} color={T.blue} />
          </View>
          <Text style={styles.label}>Message Team</Text>
        </AnimatedPressable>
      </View>

      {open === 'boss' ? (
        <ChatSheet
          memberId={profile.id}
          title="Chat with the Boss"
          subtitle="Only you and the boss see this"
          onDismiss={() => {
            setUnread(0);
            setOpen(null);
          }}
        />
      ) : null}

      {open === 'team' ? (
        <MessageComposeSheet
          visible
          onDismiss={() => setOpen(null)}
          title="Message the Team"
          subtitle="Everyone sees this in News"
          icon="users"
          placeholder="Write to everyone…"
          sendLabel="Post"
          onSend={async (text) => {
            const res = await postToTeam(profile.id, text);
            if (!res.success) return res.error;
            setOpen(null);
            onMessage('Posted to the team');
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: T.card,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 12,
    ...appSoftShadow,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: T.ink,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: T.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: T.white,
  },
});
