// ============================================================================
// VEBOSSO EMS — Work Store (Zustand)
// ============================================================================
 
// The Supabase client is typed as SupabaseClient<any> to avoid codegen requirement.
// Our own types (WorkLog, Task, etc.) are still enforced at the interface level.

import { RealtimeChannel } from '@supabase/supabase-js';
import { format } from 'date-fns';
import { create } from 'zustand';
import { sendPushNotification } from '../lib/notifications';
import { supabase } from '../lib/supabase';
import { parseSupabaseError } from '../lib/errors';
import {
    AnnouncementWithCreator,
    AppSetting,
    Profile,
    Task,
    TaskInsert,
    WorkLog,
    WorkLogStatus,
    WorkLogWithProfile
} from '../types/database';

interface WorkState {
  // Today's work state
  todayLog: WorkLog | null;
  todayTasks: Task[];
  isLoadingToday: boolean;
  errorToday: string | null;
  /** Alias for errorToday */
  todayError: string | null;

  // Approvals
  pendingApprovals: WorkLogWithProfile[];
  pendingApprovalsCount: number;
  isLoadingApprovals: boolean;
  errorApprovals: string | null;
  /** Alias for errorApprovals */
  approvalsError: string | null;

  // Team data (for owner/manager)
  teamMembers: Profile[];
  isLoadingTeam: boolean;
  errorTeam: string | null;
  /** Alias for errorTeam */
  teamError: string | null;

  // Announcements
  announcements: AnnouncementWithCreator[];
  isLoadingAnnouncements: boolean;
  errorAnnouncements: string | null;

  // App settings
  settings: Record<string, string>;
  errorSettings: string | null;

  // Stats
  stats: {
    totalMembers: number;
    activeNow: number;
    onLeaveToday: number;
    pendingApprovals: number;
  };
  statsError: string | null;

  // Realtime channels
  channels: RealtimeChannel[];

  // Actions — Member
  checkIn: (plan: string) => Promise<{ success: boolean; error?: string }>;
  checkOut: (report: string) => Promise<{ success: boolean; error?: string }>;
  fetchTodayLog: (userId: string) => Promise<{ success: boolean; error?: string }>;
  fetchTodayTasks: (userId: string) => Promise<{ success: boolean; error?: string }>;
  updateTaskStatus: (taskId: string, status: 'pending' | 'in_progress' | 'done') => Promise<{ success: boolean; error?: string }>;

  // Actions — Owner/Manager
  fetchPendingApprovals: (managerId?: string) => Promise<{ success: boolean; error?: string }>;
  approveCheckIn: (workLogId: string, approverId: string, tasks?: TaskInsert[]) => Promise<{ success: boolean; error?: string }>;
  rejectCheckIn: (workLogId: string, approverId: string, reason: string) => Promise<{ success: boolean; error?: string }>;
  fetchTeamMembers: (managerId?: string) => Promise<{ success: boolean; error?: string }>;
  fetchStats: (managerId?: string) => Promise<{ success: boolean; error?: string }>;
  addTask: (task: TaskInsert) => Promise<{ success: boolean; error?: string }>;

  // Actions — Announcements
  fetchAnnouncements: (role: string, userId: string) => Promise<{ success: boolean; error?: string }>;
  createAnnouncement: (announcement: { title: string; body: string; target_role?: string; target_user_id?: string; created_by: string }) => Promise<{ success: boolean; error?: string }>;

  // Actions — Settings
  fetchSettings: () => Promise<{ success: boolean; error?: string }>;
  updateSetting: (key: string, value: string) => Promise<{ success: boolean; error?: string }>;

  // Actions — Work History
  fetchWorkHistory: (userId: string, startDate?: string, endDate?: string) => Promise<{ data: WorkLog[], success: boolean; error?: string }>;

  // Realtime
  subscribeToRealtime: (userId: string, role: string, managerId?: string) => void;
  unsubscribeFromRealtime: () => void;

  // General
  reset: () => void;
}

export const useWorkStore = create<WorkState>((set, get) => ({
  // Initial state
  todayLog: null,
  todayTasks: [],
  isLoadingToday: false,
  errorToday: null,
  todayError: null,
  pendingApprovals: [],
  pendingApprovalsCount: 0,
  isLoadingApprovals: false,
  errorApprovals: null,
  approvalsError: null,
  teamMembers: [],
  isLoadingTeam: false,
  errorTeam: null,
  teamError: null,
  announcements: [],
  isLoadingAnnouncements: false,
  errorAnnouncements: null,
  settings: {},
  errorSettings: null,
  stats: { totalMembers: 0, activeNow: 0, onLeaveToday: 0, pendingApprovals: 0 },
  statsError: null,
  channels: [],

  // ============================================================================
  // MEMBER ACTIONS
  // ============================================================================

  checkIn: async (plan: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { success: false, error: 'Not authenticated' };

      const today = format(new Date(), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('work_logs')
        .insert({
          user_id: user.id,
          date: today,
          check_in_time: new Date().toISOString(),
          check_in_plan: plan,
          status: 'pending_approval' as WorkLogStatus,
        })
        .select()
        .single();

      if (error) return { success: false, error: error.message };

      set({ todayLog: data as WorkLog });

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, manager_id')
        .eq('id', user.id)
        .single();

      if (profile?.manager_id) {
        sendPushNotification(
          profile.manager_id,
          'Check-in Request',
          `${profile.full_name} has checked in and is waiting for approval`,
          { type: 'check_in_request', work_log_id: data.id }
        );
      }

      const { data: owners } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'owner');

      owners?.forEach((owner) => {
        if (owner.id !== profile?.manager_id) {
          sendPushNotification(
            owner.id,
            'Check-in Request',
            `${profile?.full_name} has checked in and is waiting for approval`,
            { type: 'check_in_request', work_log_id: data.id }
          );
        }
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to check in.' };
    }
  },

  checkOut: async (report: string) => {
    try {
      const todayLog = get().todayLog;
      if (!todayLog) return { success: false, error: 'No active check-in found' };

      const settings = get().settings;
      const requireCheckoutApproval = settings['require_checkout_approval'] === 'true';
      const newStatus: WorkLogStatus = requireCheckoutApproval ? 'pending_checkout' : 'done';

      const { data, error } = await supabase
        .from('work_logs')
        .update({
          check_out_time: new Date().toISOString(),
          day_report: report,
          status: newStatus,
        })
        .eq('id', todayLog.id)
        .select()
        .single();

      if (error) return { success: false, error: error.message };

      set({ todayLog: data as WorkLog });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to check out.' };
    }
  },

  fetchTodayLog: async (userId: string) => {
    try {
      set({ isLoadingToday: true, errorToday: null, todayError: null });
      const today = format(new Date(), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('work_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .single();

      if (error && error.code !== 'PGRST116') {
        set({ errorToday: error.message, todayError: error.message, isLoadingToday: false });
        return { success: false, error: error.message };
      }

      set({ todayLog: data ? (data as unknown as WorkLog) : null, isLoadingToday: false });
      return { success: true };
    } catch (err: any) {
      set({ errorToday: err.message, todayError: err.message, isLoadingToday: false });
      return { success: false, error: err.message };
    }
  },

  fetchTodayTasks: async (userId: string) => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', userId)
        .or(`due_date.eq.${today},due_date.is.null`)
        .order('created_at', { ascending: false });

      if (error) return { success: false, error: error.message };

      set({ todayTasks: (data as Task[]) || [] });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  updateTaskStatus: async (taskId: string, status) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status })
        .eq('id', taskId);

      if (error) return { success: false, error: error.message };

      set((state) => ({
        todayTasks: state.todayTasks.map((t) =>
          t.id === taskId ? { ...t, status } : t
        ),
      }));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // ============================================================================
  // OWNER/MANAGER ACTIONS
  // ============================================================================

  fetchPendingApprovals: async (managerId?: string) => {
    try {
      set({ isLoadingApprovals: true, errorApprovals: null });

      let query = supabase
        .from('work_logs')
        .select(`
          *,
          profiles!work_logs_user_id_fkey (full_name, employee_id, avatar_url, department, role)
        `)
        .in('status', ['pending_approval', 'pending_checkout'])
        .order('check_in_time', { ascending: false });

      if (managerId) {
        const { data: teamIds } = await supabase
          .from('profiles')
          .select('id')
          .eq('manager_id', managerId);

        if (teamIds && teamIds.length > 0) {
          query = query.in('user_id', teamIds.map((t) => t.id));
        } else {
          set({ pendingApprovals: [], pendingApprovalsCount: 0, isLoadingApprovals: false });
          return { success: true };
        }
      }

      const { data, error } = await query;

      if (error) {
        set({ errorApprovals: error.message, approvalsError: error.message, isLoadingApprovals: false });
        return { success: false, error: error.message };
      }

      const approvals = (data || []) as unknown as WorkLogWithProfile[];
      set({
        pendingApprovals: approvals,
        pendingApprovalsCount: approvals.length,
        isLoadingApprovals: false,
        approvalsError: null,
        errorApprovals: null,
      });
      return { success: true };
    } catch (err: any) {
      set({ errorApprovals: err.message, approvalsError: err.message, isLoadingApprovals: false });
      return { success: false, error: err.message };
    }
  },

  approveCheckIn: async (workLogId: string, approverId: string, tasks?: TaskInsert[]) => {
    try {
      let isCheckout = false;
      const existing = get().pendingApprovals.find((w) => w.id === workLogId);
      if (existing) {
        isCheckout = existing.status === 'pending_checkout';
      } else {
        const { data: wl } = await supabase
          .from('work_logs')
          .select('status')
          .eq('id', workLogId)
          .single();
        if (wl) isCheckout = wl.status === 'pending_checkout';
      }

      const updateData = isCheckout
        ? {
            check_out_approved: true,
            check_out_approved_by: approverId,
            check_out_approved_at: new Date().toISOString(),
            status: 'done' as WorkLogStatus,
          }
        : {
            check_in_approved: true,
            check_in_approved_by: approverId,
            check_in_approved_at: new Date().toISOString(),
            status: 'working' as WorkLogStatus,
          };

      const { data, error } = await supabase
        .from('work_logs')
        .update(updateData)
        .eq('id', workLogId)
        .select('user_id')
        .single();

      if (error) return { success: false, error: error.message };

      if (!isCheckout && tasks && tasks.length > 0) {
        await supabase.from('tasks').insert(tasks.map((t) => ({ ...t, work_log_id: workLogId })));
      }

      if (data) {
        if (isCheckout) {
          sendPushNotification(
            data.user_id,
            'Checkout Approved! 🎉',
            'Your checkout and day report have been approved. Great work!',
            { type: 'check_out_approved', work_log_id: workLogId }
          );
        } else {
          sendPushNotification(
            data.user_id,
            'Check-in Approved! ✅',
            'Your check-in has been approved. Have a productive day!',
            { type: 'check_in_approved', work_log_id: workLogId }
          );
        }
      }

      await get().fetchPendingApprovals();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  rejectCheckIn: async (workLogId: string, approverId: string, reason: string) => {
    try {
      let isCheckout = false;
      const existing = get().pendingApprovals.find((w) => w.id === workLogId);
      if (existing) {
        isCheckout = existing.status === 'pending_checkout';
      } else {
        const { data: wl } = await supabase
          .from('work_logs')
          .select('status')
          .eq('id', workLogId)
          .single();
        if (wl) isCheckout = wl.status === 'pending_checkout';
      }

      const updateData = isCheckout
        ? {
            status: 'working' as WorkLogStatus,
            rejection_reason: reason,
            check_out_approved_by: approverId,
          }
        : {
            status: 'rejected' as WorkLogStatus,
            rejection_reason: reason,
            check_in_approved_by: approverId,
            check_in_approved_at: new Date().toISOString(),
          };

      const { data, error } = await supabase
        .from('work_logs')
        .update(updateData)
        .eq('id', workLogId)
        .select('user_id')
        .single();

      if (error) return { success: false, error: error.message };

      if (data) {
        if (isCheckout) {
          sendPushNotification(
            data.user_id,
            'Checkout Rejected ❌',
            `Your checkout was rejected: ${reason}. Please update your report and check out again.`,
            { type: 'check_out_rejected', work_log_id: workLogId }
          );
        } else {
          sendPushNotification(
            data.user_id,
            'Check-in Rejected ❌',
            `Your check-in was rejected: ${reason}`,
            { type: 'check_in_rejected', work_log_id: workLogId }
          );
        }
      }

      await get().fetchPendingApprovals();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  fetchTeamMembers: async (managerId?: string) => {
    try {
      set({ isLoadingTeam: true, errorTeam: null, teamError: null });

      let query = supabase
        .from('profiles')
        .select('*')
        .eq('is_active', true)
        .neq('role', 'owner')
        .order('full_name');

      if (managerId) query = query.eq('manager_id', managerId);

      const { data, error } = await query;
      if (error) {
        set({ errorTeam: error.message, teamError: error.message, isLoadingTeam: false });
        return { success: false, error: error.message };
      }

      set({ teamMembers: (data as Profile[]) || [], isLoadingTeam: false, errorTeam: null, teamError: null });
      return { success: true };
    } catch (err: any) {
      set({ errorTeam: err.message, teamError: err.message, isLoadingTeam: false });
      return { success: false, error: err.message };
    }
  },

  fetchStats: async (managerId?: string) => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      let memberFilter: string[] | null = null;
      if (managerId) {
        const { data: team } = await supabase.from('profiles').select('id').eq('manager_id', managerId);
        memberFilter = team?.map((t) => t.id) || [];
      }

      const getCount = async (table: string, filterBy: string | null = null) => {
        let q = supabase.from(table).select('id', { count: 'exact', head: true });
        if (memberFilter) q = q.in('user_id', memberFilter);
        return await q;
      };

      const { count: totalMembers } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_active', true).neq('role', 'owner');
      const { count: activeNow } = await supabase.from('work_logs').select('id', { count: 'exact', head: true }).eq('date', today).eq('status', 'working');
      const { count: onLeaveToday } = await supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('date', today).eq('status', 'approved');
      const { count: pendingApprovals } = await supabase.from('work_logs').select('id', { count: 'exact', head: true }).eq('status', 'pending_approval');

      set({
        stats: {
          totalMembers: totalMembers || 0,
          activeNow: activeNow || 0,
          onLeaveToday: onLeaveToday || 0,
          pendingApprovals: pendingApprovals || 0,
        },
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  addTask: async (task: TaskInsert) => {
    try {
      const { error } = await supabase.from('tasks').insert(task);
      if (error) return { success: false, error: error.message };

      sendPushNotification(task.assigned_to, 'New Task Assigned 📋', task.title, { type: 'task_assigned', task_title: task.title });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // ============================================================================
  // ANNOUNCEMENTS
  // ============================================================================

  fetchAnnouncements: async (role: string, userId: string) => {
    try {
      set({ isLoadingAnnouncements: true, errorAnnouncements: null });
      const { data, error } = await supabase
        .from('announcements')
        .select('*, creator:profiles!announcements_created_by_fkey (full_name, role)')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        set({ errorAnnouncements: error.message, isLoadingAnnouncements: false });
        return { success: false, error: error.message };
      }

      set({ announcements: (data || []) as unknown as AnnouncementWithCreator[], isLoadingAnnouncements: false });
      return { success: true };
    } catch (err: any) {
      set({ errorAnnouncements: err.message, isLoadingAnnouncements: false });
      return { success: false, error: err.message };
    }
  },

  createAnnouncement: async (announcement) => {
    try {
      const { error } = await supabase.from('announcements').insert(announcement);
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // ============================================================================
  // SETTINGS
  // ============================================================================

  fetchSettings: async () => {
    try {
      const { data, error } = await supabase.from('app_settings').select('*');
      if (error) return { success: false, error: error.message };

      const settingsMap: Record<string, string> = {};
      (data || []).forEach((s: AppSetting) => settingsMap[s.key] = s.value);
      set({ settings: settingsMap });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  updateSetting: async (key: string, value: string) => {
    try {
      const { error } = await supabase.from('app_settings').update({ value }).eq('key', key);
      if (error) return { success: false, error: error.message };
      set((state) => ({ settings: { ...state.settings, [key]: value } }));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // ============================================================================
  // WORK HISTORY
  // ============================================================================

  fetchWorkHistory: async (userId: string, startDate?: string, endDate?: string) => {
    try {
      let query = supabase.from('work_logs').select('*').eq('user_id', userId).order('date', { ascending: false });
      if (startDate) query = query.gte('date', startDate);
      if (endDate) query = query.lte('date', endDate);

      const { data, error } = await query;
      if (error) return { data: [], success: false, error: error.message };
      return { data: (data || []) as WorkLog[], success: true };
    } catch (err: any) {
      return { data: [], success: false, error: err.message };
    }
  },

  // ============================================================================
  // REALTIME SUBSCRIPTIONS
  // ============================================================================

  subscribeToRealtime: (userId: string, role: string, managerId?: string) => {
    if (get().channels.length > 0) return;
    
    const channels: RealtimeChannel[] = [];
    const channelId = Math.random().toString(36).substring(7);

    const workLogsChannel = supabase
      .channel(`work_logs_changes_${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_logs' }, () => {
        if (role === 'owner') { get().fetchPendingApprovals(); get().fetchStats(); }
        else if (role === 'manager') { get().fetchPendingApprovals(managerId); get().fetchStats(managerId); }
        get().fetchTodayLog(userId);
      })
      .subscribe();

    channels.push(workLogsChannel);
    const tasksChannel = supabase
      .channel(`tasks_changes_${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => get().fetchTodayTasks(userId))
      .subscribe();

    channels.push(tasksChannel);
    const announcementsChannel = supabase
      .channel(`announcements_changes_${channelId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, () => get().fetchAnnouncements(role, userId))
      .subscribe();

    channels.push(announcementsChannel);
    set({ channels });
  },

  unsubscribeFromRealtime: () => {
    get().channels.forEach((c) => supabase.removeChannel(c));
    set({ channels: [] });
  },

  reset: () => {
    get().unsubscribeFromRealtime();
    set({
      todayLog: null,
      todayTasks: [],
      pendingApprovals: [],
      pendingApprovalsCount: 0,
      teamMembers: [],
      announcements: [],
      settings: {},
      stats: { totalMembers: 0, activeNow: 0, onLeaveToday: 0, pendingApprovals: 0 },
      channels: [],
    });
  },
}));
