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

  // Approvals
  pendingApprovals: WorkLogWithProfile[];
  pendingApprovalsCount: number;
  isLoadingApprovals: boolean;

  // Team data (for owner/manager)
  teamMembers: Profile[];
  isLoadingTeam: boolean;

  // Announcements
  announcements: AnnouncementWithCreator[];
  isLoadingAnnouncements: boolean;

  // App settings
  settings: Record<string, string>;

  // Stats
  stats: {
    totalMembers: number;
    activeNow: number;
    onLeaveToday: number;
    pendingApprovals: number;
  };

  // Realtime channels
  channels: RealtimeChannel[];

  // Actions — Member
  checkIn: (plan: string) => Promise<{ success: boolean; error?: string }>;
  checkOut: (report: string) => Promise<{ success: boolean; error?: string }>;
  fetchTodayLog: (userId: string) => Promise<void>;
  fetchTodayTasks: (userId: string) => Promise<void>;
  updateTaskStatus: (taskId: string, status: 'pending' | 'in_progress' | 'done') => Promise<void>;

  // Actions — Owner/Manager
  fetchPendingApprovals: (managerId?: string) => Promise<void>;
  approveCheckIn: (workLogId: string, approverId: string, tasks?: TaskInsert[]) => Promise<void>;
  rejectCheckIn: (workLogId: string, approverId: string, reason: string) => Promise<void>;
  fetchTeamMembers: (managerId?: string) => Promise<void>;
  fetchStats: (managerId?: string) => Promise<void>;
  addTask: (task: TaskInsert) => Promise<void>;

  // Actions — Announcements
  fetchAnnouncements: (role: string, userId: string) => Promise<void>;
  createAnnouncement: (announcement: { title: string; body: string; target_role?: string; target_user_id?: string; created_by: string }) => Promise<void>;

  // Actions — Settings
  fetchSettings: () => Promise<void>;
  updateSetting: (key: string, value: string) => Promise<void>;

  // Actions — Work History
  fetchWorkHistory: (userId: string, startDate?: string, endDate?: string) => Promise<WorkLog[]>;

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
  pendingApprovals: [],
  pendingApprovalsCount: 0,
  isLoadingApprovals: false,
  teamMembers: [],
  isLoadingTeam: false,
  announcements: [],
  isLoadingAnnouncements: false,
  settings: {},
  stats: { totalMembers: 0, activeNow: 0, onLeaveToday: 0, pendingApprovals: 0 },
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

      if (error) {
        if (error.code === '23505') {
          return { success: false, error: 'You have already checked in today.' };
        }
        return { success: false, error: error.message };
      }

      set({ todayLog: data as WorkLog });

      // Notify manager/owner
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

      // Also notify owner(s)
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
    } catch {
      return { success: false, error: 'Failed to check in. Please try again.' };
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

      if (error) {
        return { success: false, error: error.message };
      }

      set({ todayLog: data as WorkLog });
      return { success: true };
    } catch {
      return { success: false, error: 'Failed to check out. Please try again.' };
    }
  },

  fetchTodayLog: async (userId: string) => {
    try {
      set({ isLoadingToday: true });
      const today = format(new Date(), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('work_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Fetch today log error:', error);
      }

      set({ todayLog: data ? (data as unknown as WorkLog) : null, isLoadingToday: false });
    } catch {
      set({ isLoadingToday: false });
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

      if (error) {
        console.error('Fetch tasks error:', error);
        return;
      }

      set({ todayTasks: (data as Task[]) || [] });
    } catch (error) {
      console.error('Fetch tasks error:', error);
    }
  },

  updateTaskStatus: async (taskId: string, status) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status })
        .eq('id', taskId);

      if (error) throw error;

      // Update local state
      set((state) => ({
        todayTasks: state.todayTasks.map((t) =>
          t.id === taskId ? { ...t, status } : t
        ),
      }));
    } catch (error) {
      console.error('Update task status error:', error);
      throw error;
    }
  },

  // ============================================================================
  // OWNER/MANAGER ACTIONS
  // ============================================================================

  fetchPendingApprovals: async (managerId?: string) => {
    try {
      set({ isLoadingApprovals: true });

      let query = supabase
        .from('work_logs')
        .select(`
          *,
          profiles!work_logs_user_id_fkey (full_name, employee_id, avatar_url, department, role)
        `)
        .in('status', ['pending_approval', 'pending_checkout'])
        .order('check_in_time', { ascending: false });

      // If manager, only fetch team members
      if (managerId) {
        const { data: teamIds } = await supabase
          .from('profiles')
          .select('id')
          .eq('manager_id', managerId);

        if (teamIds) {
          const ids = teamIds.map((t) => t.id);
          ids.push(managerId); // Include self
          query = query.in('user_id', ids);
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error('Fetch approvals error:', error);
        set({ isLoadingApprovals: false });
        return;
      }

      const approvals = (data || []) as unknown as WorkLogWithProfile[];
      set({
        pendingApprovals: approvals,
        pendingApprovalsCount: approvals.length,
        isLoadingApprovals: false,
      });
    } catch {
      set({ isLoadingApprovals: false });
    }
  },

  approveCheckIn: async (workLogId: string, approverId: string, tasks?: TaskInsert[]) => {
    try {
      const { data, error } = await supabase
        .from('work_logs')
        .update({
          check_in_approved: true,
          check_in_approved_by: approverId,
          check_in_approved_at: new Date().toISOString(),
          status: 'working' as WorkLogStatus,
        })
        .eq('id', workLogId)
        .select('user_id')
        .single();

      if (error) throw error;

      // Create tasks if provided
      if (tasks && tasks.length > 0) {
        const tasksWithWorkLog = tasks.map((t) => ({
          ...t,
          work_log_id: workLogId,
        }));
        await supabase.from('tasks').insert(tasksWithWorkLog);
      }

      // Notify member
      if (data) {
        sendPushNotification(
          data.user_id,
          'Check-in Approved! ✅',
          'Your check-in has been approved. Have a productive day!',
          { type: 'check_in_approved', work_log_id: workLogId }
        );
      }

      // Refresh approvals
      await get().fetchPendingApprovals();
    } catch (error) {
      console.error('Approve check-in error:', error);
      throw error;
    }
  },

  rejectCheckIn: async (workLogId: string, approverId: string, reason: string) => {
    try {
      const { data, error } = await supabase
        .from('work_logs')
        .update({
          status: 'rejected' as WorkLogStatus,
          rejection_reason: reason,
          check_in_approved_by: approverId,
          check_in_approved_at: new Date().toISOString(),
        })
        .eq('id', workLogId)
        .select('user_id')
        .single();

      if (error) throw error;

      if (data) {
        sendPushNotification(
          data.user_id,
          'Check-in Rejected ❌',
          `Your check-in was rejected: ${reason}`,
          { type: 'check_in_rejected', work_log_id: workLogId }
        );
      }

      await get().fetchPendingApprovals();
    } catch (error) {
      console.error('Reject check-in error:', error);
      throw error;
    }
  },

  fetchTeamMembers: async (managerId?: string) => {
    try {
      set({ isLoadingTeam: true });

      let query = supabase
        .from('profiles')
        .select('*')
        .eq('is_active', true)
        .order('full_name');

      if (managerId) {
        query = query.eq('manager_id', managerId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Fetch team error:', error);
        set({ isLoadingTeam: false });
        return;
      }

      set({ teamMembers: (data as Profile[]) || [], isLoadingTeam: false });
    } catch {
      set({ isLoadingTeam: false });
    }
  },

  fetchStats: async (managerId?: string) => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');

      // Get team member IDs for filtering
      let memberFilter: string[] | null = null;
      if (managerId) {
        const { data: team } = await supabase
          .from('profiles')
          .select('id')
          .eq('manager_id', managerId);
        memberFilter = team?.map((t) => t.id) || [];
      }

      // Total members
      let membersQuery = supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .neq('role', 'owner');

      if (memberFilter) {
        membersQuery = membersQuery.in('id', memberFilter);
      }
      const { count: totalMembers } = await membersQuery;

      // Active now (status = working)
      let activeQuery = supabase
        .from('work_logs')
        .select('id', { count: 'exact', head: true })
        .eq('date', today)
        .eq('status', 'working');

      if (memberFilter) {
        activeQuery = activeQuery.in('user_id', memberFilter);
      }
      const { count: activeNow } = await activeQuery;

      // On leave today
      let leaveQuery = supabase
        .from('leave_requests')
        .select('id', { count: 'exact', head: true })
        .eq('date', today)
        .eq('status', 'approved');

      if (memberFilter) {
        leaveQuery = leaveQuery.in('user_id', memberFilter);
      }
      const { count: onLeaveToday } = await leaveQuery;

      // Pending approvals
      let approvalsQuery = supabase
        .from('work_logs')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending_approval');

      if (memberFilter) {
        approvalsQuery = approvalsQuery.in('user_id', memberFilter);
      }
      const { count: pendingApprovals } = await approvalsQuery;

      set({
        stats: {
          totalMembers: totalMembers || 0,
          activeNow: activeNow || 0,
          onLeaveToday: onLeaveToday || 0,
          pendingApprovals: pendingApprovals || 0,
        },
      });
    } catch (error) {
      console.error('Fetch stats error:', error);
    }
  },

  addTask: async (task: TaskInsert) => {
    try {
      const { error } = await supabase.from('tasks').insert(task);
      if (error) throw error;

      // Notify assignee
      sendPushNotification(
        task.assigned_to,
        'New Task Assigned 📋',
        task.title,
        { type: 'task_assigned', task_title: task.title }
      );
    } catch (error) {
      console.error('Add task error:', error);
      throw error;
    }
  },

  // ============================================================================
  // ANNOUNCEMENTS
  // ============================================================================

  fetchAnnouncements: async (role: string, userId: string) => {
    try {
      set({ isLoadingAnnouncements: true });

      const { data, error } = await supabase
        .from('announcements')
        .select(`
          *,
          creator:profiles!announcements_created_by_fkey (full_name, role)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Fetch announcements error:', error);
        set({ isLoadingAnnouncements: false });
        return;
      }

      set({
        announcements: (data || []) as unknown as AnnouncementWithCreator[],
        isLoadingAnnouncements: false,
      });
    } catch {
      set({ isLoadingAnnouncements: false });
    }
  },

  createAnnouncement: async (announcement) => {
    try {
      const { error } = await supabase.from('announcements').insert(announcement);
      if (error) throw error;
    } catch (error) {
      console.error('Create announcement error:', error);
      throw error;
    }
  },

  // ============================================================================
  // SETTINGS
  // ============================================================================

  fetchSettings: async () => {
    try {
      const { data, error } = await supabase.from('app_settings').select('*');
      if (error) throw error;

      const settingsMap: Record<string, string> = {};
      (data || []).forEach((s: AppSetting) => {
        settingsMap[s.key] = s.value;
      });

      set({ settings: settingsMap });
    } catch (error) {
      console.error('Fetch settings error:', error);
    }
  },

  updateSetting: async (key: string, value: string) => {
    try {
      const { error } = await supabase
        .from('app_settings')
        .update({ value })
        .eq('key', key);

      if (error) throw error;

      set((state) => ({
        settings: { ...state.settings, [key]: value },
      }));
    } catch (error) {
      console.error('Update setting error:', error);
      throw error;
    }
  },

  // ============================================================================
  // WORK HISTORY
  // ============================================================================

  fetchWorkHistory: async (userId: string, startDate?: string, endDate?: string) => {
    try {
      let query = supabase
        .from('work_logs')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (startDate) query = query.gte('date', startDate);
      if (endDate) query = query.lte('date', endDate);

      const { data, error } = await query;
      if (error) throw error;

      return (data || []) as WorkLog[];
    } catch (error) {
      console.error('Fetch work history error:', error);
      return [];
    }
  },

  // ============================================================================
  // REALTIME SUBSCRIPTIONS
  // ============================================================================

  subscribeToRealtime: (userId: string, role: string, managerId?: string) => {
    // Prevent duplicate subscriptions — if channels already exist, bail out early
    const existingChannels = get().channels;
    if (existingChannels.length > 0) {
      console.log('[Realtime] Already subscribed, skipping duplicate');
      return;
    }
    
    const channels: RealtimeChannel[] = [];
    const channelId = Math.random().toString(36).substring(7);

    // Subscribe to work_logs changes
    const workLogsChannel = supabase
      .channel(`work_logs_changes_${channelId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'work_logs' },
        (payload) => {
          console.log('Work log change:', payload.eventType);

          // Refresh relevant data based on role
          if (role === 'owner') {
            get().fetchPendingApprovals();
            get().fetchStats();
          } else if (role === 'manager') {
            get().fetchPendingApprovals(managerId);
            get().fetchStats(managerId);
          }

          // If it's the user's own log, refresh today's log
          const record = payload.new as WorkLog;
          if (record && record.user_id === userId) {
            get().fetchTodayLog(userId);
          }
        }
      )
      .subscribe();

    channels.push(workLogsChannel);

    // Subscribe to tasks changes
    const tasksChannel = supabase
      .channel(`tasks_changes_${channelId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => {
          const record = payload.new as Task;
          if (record && record.assigned_to === userId) {
            get().fetchTodayTasks(userId);
          }
        }
      )
      .subscribe();

    channels.push(tasksChannel);

    // Subscribe to announcements
    const announcementsChannel = supabase
      .channel(`announcements_changes_${channelId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'announcements' },
        () => {
          get().fetchAnnouncements(role, userId);
        }
      )
      .subscribe();

    channels.push(announcementsChannel);

    set({ channels });
  },

  unsubscribeFromRealtime: () => {
    const { channels } = get();
    channels.forEach((channel) => {
      supabase.removeChannel(channel);
    });
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
