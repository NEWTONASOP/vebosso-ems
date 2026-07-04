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

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  error: null,

  fetchNotifications: async (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const items = (data || []) as DbNotification[];
      const unread = items.filter((n) => !n.read).length;

      set({ notifications: items, unreadCount: unread });
    } catch (err: any) {
      console.error('Error fetching notifications:', err);
      set({ error: err.message || 'Failed to load notifications' });
    } finally {
      set({ isLoading: false });
    }
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
      console.error('Error marking notification as read:', err);
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
      console.error('Error marking all notifications as read:', err);
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
      console.error('Error deleting notification:', err);
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
      console.error('Error clearing notifications:', err);
      set({
        notifications: previousNotifications,
        unreadCount: previousNotifications.filter((n) => !n.read).length,
      });
    }
  },

  setupSubscription: (userId: string, onNewNotification?: () => void) => {
    const channel = supabase
      .channel(`user-notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
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
