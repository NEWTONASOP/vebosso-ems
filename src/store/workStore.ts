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
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import {
  AnnouncementWithCreator,
  AppSetting,
  LeaveRequestWithProfile,
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
  /** Map of userId → today's live status snapshot */
  memberLiveStatus: Record<string, {
    status: WorkLogStatus | 'offline' | 'on_leave';
    checkInTime: string | null;
    checkInPlan: string | null;
    pendingTaskCount: number;
  }>;

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
  
  // Leave requests state
  leaveRequests: LeaveRequestWithProfile[];
  pendingLeavesCount: number;
  isLoadingLeaves: boolean;
  leavesError: string | null;

  // Realtime channels
  channels: RealtimeChannel[];

  // Actions — Member
  checkIn: (plan: string) => Promise<{ success: boolean; error?: string }>;
  checkOut: (report: string, photoUris?: string[]) => Promise<{ success: boolean; error?: string }>;
  fetchTodayLog: (userId: string) => Promise<{ success: boolean; error?: string }>;
  fetchTodayTasks: (userId: string) => Promise<{ success: boolean; error?: string }>;
  updateTaskStatus: (taskId: string, status: 'pending' | 'in_progress' | 'done', completionNote?: string) => Promise<{ success: boolean; error?: string }>;

  // Actions — Owner/Manager
  fetchPendingApprovals: (managerId?: string) => Promise<{ success: boolean; error?: string }>;
  approveCheckIn: (workLogId: string, approverId: string, tasks?: TaskInsert[]) => Promise<{ success: boolean; error?: string }>;
  rejectCheckIn: (workLogId: string, approverId: string, reason: string) => Promise<{ success: boolean; error?: string }>;
  fetchTeamMembers: (managerId?: string) => Promise<{ success: boolean; error?: string }>;
  fetchStats: (managerId?: string) => Promise<{ success: boolean; error?: string }>;
  addTask: (task: TaskInsert) => Promise<{ success: boolean; error?: string }>;
  reassignTask: (taskId: string, newAssigneeId: string, assignerId: string) => Promise<{ success: boolean; error?: string }>;

  // Actions — Announcements
  fetchAnnouncements: (role: string, userId: string) => Promise<{ success: boolean; error?: string }>;
  createAnnouncement: (announcement: { title: string; body: string; target_role?: string; target_user_id?: string; created_by: string }) => Promise<{ success: boolean; error?: string }>;

  // Actions — Settings
  fetchSettings: () => Promise<{ success: boolean; error?: string }>;
  updateSetting: (key: string, value: string) => Promise<{ success: boolean; error?: string }>;

  // Actions — Work History
  fetchWorkHistory: (userId: string, startDate?: string, endDate?: string) => Promise<{ data: WorkLog[], success: boolean; error?: string }>;

  // Actions — Leave Requests
  fetchLeaveRequests: (role: string, userId: string) => Promise<{ success: boolean; error?: string }>;
  submitLeaveRequest: (date: string, reason: string, userId: string) => Promise<{ success: boolean; error?: string }>;
  approveLeaveRequest: (leaveId: string, approverId: string) => Promise<{ success: boolean; error?: string }>;
  rejectLeaveRequest: (leaveId: string, approverId: string) => Promise<{ success: boolean; error?: string }>;

  // Realtime
  subscribeToRealtime: (userId: string, role: string, managerId?: string) => void;
  unsubscribeFromRealtime: () => void;

  // General
  reset: () => void;
}

const uploadCheckoutPhoto = async (path: string, uri: string, ext: string) => {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    let iframe: HTMLIFrameElement | null = null;
    try {
      // 1. Get binary data using parent window's fetch to support blob: URLs on web
      let arrayBuffer: ArrayBuffer;
      let contentType = 'image/jpeg';

      if (uri.startsWith('data:image')) {
        const base64Data = uri.split(',')[1];
        contentType = uri.split(';')[0].split(':')[1] || 'image/jpeg';
        const binaryString = atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let j = 0; j < len; j++) {
          bytes[j] = binaryString.charCodeAt(j);
        }
        arrayBuffer = bytes.buffer;
      } else {
        const response = await fetch(uri);
        const blob = await response.blob();
        arrayBuffer = await blob.arrayBuffer();
        contentType = blob.type || 'image/jpeg';
      }

      // 2. Retrieve native window objects from clean iframe to bypass RN Web polyfills
      iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
      const NativeBlob = (iframe.contentWindow as any).Blob;
      const NativeFormData = (iframe.contentWindow as any).FormData;

      if (NativeBlob && NativeFormData) {
        // 3. Create a native Blob and native FormData
        const nativeBlob = new NativeBlob([arrayBuffer], { type: contentType });
        const formData = new NativeFormData();
        formData.append('file', nativeBlob, `photo.${ext}`);

        // 4. Upload the FormData directly
        const { data, error } = await supabase.storage
          .from('checkouts')
          .upload(path, formData);

        if (error) throw error;
        return data;
      }
    } catch (e) {
      console.warn('Web native upload failed, trying fallback:', e);
    } finally {
      if (iframe && iframe.parentNode) {
        document.body.removeChild(iframe);
      }
    }
  }

  // Fallback / Native Mobile Path
  let body: ArrayBuffer;
  const extLower = ext.toLowerCase();
  let contentType = extLower === 'png' ? 'image/png' : extLower === 'webp' ? 'image/webp' : extLower === 'gif' ? 'image/gif' : 'image/jpeg';

  if (uri.startsWith('data:image')) {
    const base64Data = uri.split(',')[1];
    contentType = uri.split(';')[0].split(':')[1] || contentType;
    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let j = 0; j < len; j++) {
      bytes[j] = binaryString.charCodeAt(j);
    }
    body = bytes.buffer;
  } else {
    // Read local file as base64 using expo-file-system and convert to ArrayBuffer
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let j = 0; j < len; j++) {
      bytes[j] = binaryString.charCodeAt(j);
    }
    body = bytes.buffer;
  }

  const { data, error } = await supabase.storage
    .from('checkouts')
    .upload(path, body, {
      contentType,
      upsert: true,
    });

  if (error) throw error;
  return data;
};

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
  memberLiveStatus: {},
  announcements: [],
  isLoadingAnnouncements: false,
  errorAnnouncements: null,
  settings: {},
  errorSettings: null,
  stats: { totalMembers: 0, activeNow: 0, onLeaveToday: 0, pendingApprovals: 0 },
  statsError: null,
  channels: [],

  // Leaves initial state
  leaveRequests: [],
  pendingLeavesCount: 0,
  isLoadingLeaves: false,
  leavesError: null,

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

      await Promise.all(
        (owners || [])
          .filter((owner) => owner.id !== profile?.manager_id && owner.id !== user.id)
          .map((owner) =>
            sendPushNotification(
              owner.id,
              'Check-in Request',
              `${profile?.full_name} has checked in and is waiting for approval`,
              { type: 'check_in_request', work_log_id: data.id }
            )
          )
      );

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to check in.' };
    }
  },

  checkOut: async (report: string, photoUris?: string[]) => {
    try {
      const todayLog = get().todayLog;
      if (!todayLog) return { success: false, error: 'No active check-in found' };

      const settings = get().settings;
      const requireCheckoutApproval = settings['require_checkout_approval'] === 'true';
      const newStatus: WorkLogStatus = requireCheckoutApproval ? 'pending_checkout' : 'done';

      // 1. Upload checkout photos to Supabase Storage if any
      const uploadedPaths: string[] = [];
      if (photoUris && photoUris.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: 'Authentication required' };

        for (let i = 0; i < photoUris.length; i++) {
          const uri = photoUris[i];
          const ext = uri.split('.').pop()?.split('?')[0] || 'jpg';
          const path = `${user.id}/${Date.now()}_${i}.${ext}`;

          try {
            await uploadCheckoutPhoto(path, uri, ext);
          } catch (uploadError: any) {
            console.error('Failed to upload image:', uploadError);
            throw new Error(`Failed to upload photo ${i + 1}: ${uploadError.message || uploadError}`);
          }

          uploadedPaths.push(path);
        }
      }

      // 2. Save log update to DB
      const { data, error } = await supabase
        .from('work_logs')
        .update({
          check_out_time: new Date().toISOString(),
          day_report: report,
          status: newStatus,
          check_out_photos: uploadedPaths.length > 0 ? uploadedPaths : null,
        })
        .eq('id', todayLog.id)
        .select()
        .single();

      if (error) return { success: false, error: error.message };

      set({ todayLog: data as WorkLog });

      // Always notify manager and owners on checkout — message differs based on whether approval is needed
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, manager_id')
          .eq('id', todayLog.user_id)
          .single();

        if (profile) {
          const title = requireCheckoutApproval ? 'Checkout Request' : 'Checked Out';
          const body = requireCheckoutApproval
            ? `${profile.full_name} has checked out and is waiting for approval`
            : `${profile.full_name} has checked out for the day`;
          const notifType = requireCheckoutApproval ? 'checkout_request' : 'checkout_done';

          if (profile.manager_id) {
            sendPushNotification(
              profile.manager_id,
              title,
              body,
              { type: notifType, work_log_id: data.id }
            );
          }

          const { data: owners } = await supabase
            .from('profiles')
            .select('id')
            .eq('role', 'owner');

          await Promise.all(
            (owners || [])
              .filter((owner) => owner.id !== profile.manager_id && owner.id !== todayLog.user_id)
              .map((owner) =>
                sendPushNotification(
                  owner.id,
                  title,
                  body,
                  { type: notifType, work_log_id: data.id }
                )
              )
          );
        }
      } catch (notifErr) {
        if (__DEV__) console.warn('Failed to send checkout notifications:', notifErr);
      }

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

  updateTaskStatus: async (taskId: string, status, completionNote?: string) => {
    try {
      const updateData: any = { status };
      
      // If marking as done, also save completion note and timestamp
      if (status === 'done') {
        updateData.completion_note = completionNote || null;
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId);

      if (error) return { success: false, error: error.message };

      // Notify task creator/assigner when task is completed
      if (status === 'done') {
        try {
          const { data: task } = await supabase
            .from('tasks')
            .select('assigned_by, title, profiles!tasks_assigned_to_fkey(full_name)')
            .eq('id', taskId)
            .single();

          if (task?.assigned_by) {
            const assigneeName = (task as any).profiles?.full_name || 'A team member';
            sendPushNotification(
              task.assigned_by,
              'Task Completed ✅',
              `${assigneeName} completed: "${task.title}"`,
              { type: 'task_completed', task_id: taskId }
            );
          }
        } catch (notifErr) {
          if (__DEV__) console.warn('Failed to send task completion notification:', notifErr);
        }
      }

      set((state) => ({
        todayTasks: state.todayTasks.map((t) =>
          t.id === taskId ? { ...t, ...updateData } : t
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

      const members = (data as Profile[]) || [];

      // Fetch today's work logs + pending task counts in parallel
      const today = format(new Date(), 'yyyy-MM-dd');
      const memberIds = members.map((m) => m.id);

      const [logsRes, tasksRes, leavesRes] = await Promise.all([
        memberIds.length > 0
          ? supabase
              .from('work_logs')
              .select('user_id, status, check_in_time, check_in_plan')
              .eq('date', today)
              .in('user_id', memberIds)
          : Promise.resolve({ data: [], error: null }),
        memberIds.length > 0
          ? supabase
              .from('tasks')
              .select('assigned_to, status')
              .in('assigned_to', memberIds)
              .eq('status', 'pending')
          : Promise.resolve({ data: [], error: null }),
        memberIds.length > 0
          ? supabase
              .from('leave_requests')
              .select('user_id')
              .eq('date', today)
              .eq('status', 'approved')
              .in('user_id', memberIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      // Build lookup maps
      const logMap: Record<string, any> = {};
      for (const log of (logsRes.data || [])) logMap[log.user_id] = log;

      const taskCountMap: Record<string, number> = {};
      for (const task of (tasksRes.data || [])) {
        taskCountMap[task.assigned_to] = (taskCountMap[task.assigned_to] || 0) + 1;
      }

      const onLeaveSet = new Set((leavesRes.data || []).map((l: any) => l.user_id));

      // Build memberLiveStatus map
      const liveStatus: Record<string, any> = {};
      for (const m of members) {
        const log = logMap[m.id];
        liveStatus[m.id] = {
          status: onLeaveSet.has(m.id) ? 'on_leave' : (log?.status ?? 'offline'),
          checkInTime: log?.check_in_time ?? null,
          checkInPlan: log?.check_in_plan ?? null,
          pendingTaskCount: taskCountMap[m.id] ?? 0,
        };
      }

      set({ teamMembers: members, memberLiveStatus: liveStatus, isLoadingTeam: false, errorTeam: null, teamError: null });
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

  reassignTask: async (taskId: string, newAssigneeId: string, assignerId: string) => {
    try {
      // Fetch the task and new assignee details
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select('title, assigned_to')
        .eq('id', taskId)
        .single();

      if (taskError) return { success: false, error: taskError.message };

      const { data: newAssignee, error: assigneeError } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', newAssigneeId)
        .single();

      if (assigneeError) return { success: false, error: assigneeError.message };

      // Update the task
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ assigned_to: newAssigneeId })
        .eq('id', taskId);

      if (updateError) return { success: false, error: updateError.message };

      // Send notification to new assignee
      sendPushNotification(
        newAssigneeId,
        'Task Reassigned to You 📋',
        task.title,
        { type: 'task_reassigned', task_id: taskId }
      );

      // Optionally notify the previous assignee
      if (task.assigned_to && task.assigned_to !== newAssigneeId) {
        sendPushNotification(
          task.assigned_to,
          'Task Reassigned',
          `"${task.title}" has been reassigned to ${newAssignee.full_name}`,
          { type: 'task_unassigned', task_id: taskId }
        );
      }

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

      // Dispatch notifications to the target audience asynchronously
      try {
        const { target_role, target_user_id, title, body, created_by } = announcement;
        
        let query = supabase
          .from('profiles')
          .select('id')
          .eq('is_active', true)
          .neq('id', created_by); // always exclude the creator
          
        if (target_user_id) {
          query = query.eq('id', target_user_id);
        } else if (target_role) {
          query = query.eq('role', target_role);
        }
        
        const { data: users } = await query;
        await Promise.all(
          (users || []).map((u) =>
            sendPushNotification(
              u.id,
              `New Announcement: ${title}`,
              body,
              { type: 'announcement' }
            )
          )
        );
      } catch (notifErr) {
        if (__DEV__) console.warn('Failed to send announcement notifications:', notifErr);
      }

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

  // ============================================================================
  // LEAVE REQUESTS ACTIONS
  // ============================================================================

  fetchLeaveRequests: async (role: string, userId: string) => {
    try {
      set({ isLoadingLeaves: true, leavesError: null });

      let query = supabase
        .from('leave_requests')
        .select(`
          *,
          profiles!leave_requests_user_id_fkey (
            full_name,
            employee_id,
            role,
            department
          )
        `);

      if (role === 'owner') {
        // Owners see all leave requests
        query = query.order('date', { ascending: false });
      } else if (role === 'manager') {
        // Managers see their own and their team's requests
        const { data: teamMembers } = await supabase
          .from('profiles')
          .select('id')
          .eq('manager_id', userId);

        const teamIds = teamMembers ? teamMembers.map((t) => t.id) : [];
        query = query
          .or(`user_id.eq.${userId},user_id.in.(${teamIds.join(',') || userId})`)
          .order('date', { ascending: false });
      } else {
        // Members only see their own requests
        query = query
          .eq('user_id', userId)
          .order('date', { ascending: false });
      }

      const { data, error } = await query;

      if (error) {
        set({ leavesError: error.message, isLoadingLeaves: false });
        return { success: false, error: error.message };
      }

      // Count pending leaves that the current user is eligible to review
      let pendingCount = 0;
      if (role === 'owner') {
        // Owners count all pending requests
        pendingCount = data ? data.filter((l) => l.status === 'pending').length : 0;
      } else if (role === 'manager') {
        // Managers count pending requests from their team only (not self)
        const { data: teamMembers } = await supabase
          .from('profiles')
          .select('id')
          .eq('manager_id', userId);
        const teamIds = teamMembers ? teamMembers.map((t) => t.id) : [];
        pendingCount = data
          ? data.filter((l) => l.status === 'pending' && l.user_id !== userId && teamIds.includes(l.user_id)).length
          : 0;
      }

      set({
        leaveRequests: (data || []) as unknown as LeaveRequestWithProfile[],
        pendingLeavesCount: pendingCount,
        isLoadingLeaves: false,
      });

      return { success: true };
    } catch (err: any) {
      set({ leavesError: err.message, isLoadingLeaves: false });
      return { success: false, error: err.message };
    }
  },

  submitLeaveRequest: async (date: string, reason: string, userId: string) => {
    try {
      set({ isLoadingLeaves: true, leavesError: null });

      const { data, error } = await supabase
        .from('leave_requests')
        .insert({
          user_id: userId,
          date,
          reason,
          status: 'pending',
        })
        .select()
        .single();

      if (error) {
        set({ isLoadingLeaves: false });
        return { success: false, error: error.message };
      }

      // Get user profile details for notification
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, manager_id, role')
        .eq('id', userId)
        .single();

      // If user has a manager, notify manager
      if (profile?.manager_id) {
        sendPushNotification(
          profile.manager_id,
          'Leave Request',
          `${profile.full_name} has requested leave for ${date}`,
          { type: 'leave_request', leave_id: data.id }
        );
      }

      // Notify owners (excluding the requester and their manager who was already notified)
      const { data: owners } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'owner');

      await Promise.all(
        (owners || [])
          .filter((owner) => owner.id !== userId && owner.id !== profile?.manager_id)
          .map((owner) =>
            sendPushNotification(
              owner.id,
              'Leave Request',
              `${profile?.full_name} has requested leave for ${date}`,
              { type: 'leave_request', leave_id: data.id }
            )
          )
      );

      // Refresh list
      const currentRole = profile?.role || 'member';
      await get().fetchLeaveRequests(currentRole, userId);

      return { success: true };
    } catch (err: any) {
      set({ leavesError: err.message, isLoadingLeaves: false });
      return { success: false, error: err.message };
    }
  },

  approveLeaveRequest: async (leaveId: string, approverId: string) => {
    try {
      set({ isLoadingLeaves: true, leavesError: null });

      const { data, error } = await supabase
        .from('leave_requests')
        .update({
          status: 'approved',
          reviewed_by: approverId,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', leaveId)
        .select('user_id, date')
        .single();

      if (error) {
        set({ isLoadingLeaves: false });
        return { success: false, error: error.message };
      }

      // Notify user
      if (data) {
        sendPushNotification(
          data.user_id,
          'Leave Approved! 🎉',
          `Your leave request for ${data.date} has been approved.`,
          { type: 'leave_approved', leave_id: leaveId }
        );
      }

      // Get current user role to refresh correctly
      const { data: approverProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', approverId)
        .single();

      await get().fetchLeaveRequests(approverProfile?.role || 'owner', approverId);

      return { success: true };
    } catch (err: any) {
      set({ leavesError: err.message, isLoadingLeaves: false });
      return { success: false, error: err.message };
    }
  },

  rejectLeaveRequest: async (leaveId: string, approverId: string) => {
    try {
      set({ isLoadingLeaves: true, leavesError: null });

      const { data, error } = await supabase
        .from('leave_requests')
        .update({
          status: 'rejected',
          reviewed_by: approverId,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', leaveId)
        .select('user_id, date')
        .single();

      if (error) {
        set({ isLoadingLeaves: false });
        return { success: false, error: error.message };
      }

      // Notify user
      if (data) {
        sendPushNotification(
          data.user_id,
          'Leave Rejected ❌',
          `Your leave request for ${data.date} was rejected.`,
          { type: 'leave_rejected', leave_id: leaveId }
        );
      }

      // Get current user role to refresh correctly
      const { data: approverProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', approverId)
        .single();

      await get().fetchLeaveRequests(approverProfile?.role || 'owner', approverId);

      return { success: true };
    } catch (err: any) {
      set({ leavesError: err.message, isLoadingLeaves: false });
      return { success: false, error: err.message };
    }
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
      leaveRequests: [],
      pendingLeavesCount: 0,
      isLoadingLeaves: false,
      leavesError: null,
    });
  },
}));
