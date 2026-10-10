// ============================================================================
// VEBOSSO EMS — Notification Store (Zustand)
// ============================================================================

import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { DbNotification } from '../types/database';

interface NotificationState {
  notifications: DbNotification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  fetchNotifications: (userId: string) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: (userId: string) => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  clearAllNotifications: (userId: string) => Promise<void>;
  setupSubscription: (userId: string, onNewNotification?: () => void) => () => void;
}

/** The list shows the newest of these; older ones are never downloaded. */
const PAGE = 50;
/** Screens that open together (bell, list, dashboard) share one request. */
let inFlight: Promise<void> | null = null;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  error: null,

  fetchNotifications: async (userId: string) => {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      set({ isLoading: true, error: null });
      try {
        const [list, unread] = await Promise.all([
          supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(PAGE),
          // Counted by the database, so the badge is right beyond the newest PAGE.
          supabase
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('read', false),
        ]);

        if (list.error) throw list.error;

        const items = (list.data || []) as DbNotification[];
        set({
          notifications: items,
          unreadCount: unread.count ?? items.filter((n) => !n.read).length,
        });
      } catch (err: any) {
        if (__DEV__) console.error('Error fetching notifications:', err);
        set({ error: err.message || 'Failed to load notifications' });
      } finally {
        set({ isLoading: false });
        inFlight = null;
      }
    })();
    return inFlight;
  },

  markAsRead: async (notificationId: string) => {
    const previousNotifications = get().notifications;
    const updated = previousNotifications.map((n) =>
      n.id === notificationId ? { ...n, read: true } : n
    );
    const unread = updated.filter((n) => !n.read).length;
    set({ notifications: updated, unreadCount: unread });

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true } as any)
        .eq('id', notificationId);

      if (error) throw error;
    } catch (err) {
      if (__DEV__) console.error('Error marking notification as read:', err);
      set({
        notifications: previousNotifications,
        unreadCount: previousNotifications.filter((n) => !n.read).length,
      });
    }
  },

  markAllAsRead: async (userId: string) => {
    const previousNotifications = get().notifications;
    const updated = previousNotifications.map((n) => ({ ...n, read: true }));
    set({ notifications: updated, unreadCount: 0 });

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true } as any)
        .eq('user_id', userId)
        .eq('read', false);

      if (error) throw error;
    } catch (err) {
      if (__DEV__) console.error('Error marking all notifications as read:', err);
      set({
        notifications: previousNotifications,
        unreadCount: previousNotifications.filter((n) => !n.read).length,
      });
    }
  },

  deleteNotification: async (notificationId: string) => {
    const previousNotifications = get().notifications;
    const updated = previousNotifications.filter((n) => n.id !== notificationId);
    const unread = updated.filter((n) => !n.read).length;
    set({ notifications: updated, unreadCount: unread });

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;
    } catch (err) {
      if (__DEV__) console.error('Error deleting notification:', err);
      set({
        notifications: previousNotifications,
        unreadCount: previousNotifications.filter((n) => !n.read).length,
      });
    }
  },

  clearAllNotifications: async (userId: string) => {
    const previousNotifications = get().notifications;
    set({ notifications: [], unreadCount: 0 });

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;
    } catch (err) {
      if (__DEV__) console.error('Error clearing notifications:', err);
      set({
        notifications: previousNotifications,
        unreadCount: previousNotifications.filter((n) => !n.read).length,
      });
    }
  },

  setupSubscription: (userId: string, onNewNotification?: () => void) => {
    const channelId = Math.random().toString(36).substring(7);
    const channel = supabase
      .channel(`user-notifications-${userId}-${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          // A read flag flipping is already applied on screen; only new or removed notifications need a fresh list.
          if (payload.eventType === 'UPDATE') return;
          await get().fetchNotifications(userId);
          if (payload.eventType === 'INSERT' && onNewNotification) {
            onNewNotification();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
}));
