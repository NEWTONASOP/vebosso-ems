// ============================================================================
// VEBOSSO EMS — Problem reports (069)
// Anyone can send one; owners read them all and mark them fixed. The device and
// app version go in automatically, so "which phone / which update" is never a
// question. Owners get a push when a new one comes in.
// ============================================================================

import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { CloudImage } from '../types/database';
import { parseSupabaseError } from './errors';
import { sendPushNotificationToRole } from './notifications';
import { supabase } from './supabase';

export interface BugReport {
  id: string;
  reported_by: string | null;
  reporter_name: string | null;
  description: string;
  place: string | null;
  screenshots: CloudImage[];
  platform: string | null;
  os_version: string | null;
  device: string | null;
  app_version: string | null;
  update_id: string | null;
  status: 'open' | 'fixed';
  fixed_at: string | null;
  fixed_by_name: string | null;
  created_at: string;
}

type Result<T = undefined> = { success: true; data: T } | { success: false; error: string };
const fail = (e: unknown): { success: false; error: string } => ({ success: false, error: parseSupabaseError(e) });

/** Which phone / browser and which build this is. */
async function deviceInfo() {
  let updateId: string | null = null;
  if (Platform.OS !== 'web') {
    try {
      const Updates = await import('expo-updates');
      updateId = Updates.updateId ?? null;
    } catch {}
  }
  return {
    platform: Platform.OS,
    os_version: String(Platform.Version ?? ''),
    device:
      Platform.OS === 'web'
        ? typeof navigator !== 'undefined'
          ? navigator.userAgent.slice(0, 300)
          : 'web'
        : [Device.manufacturer, Device.modelName].filter(Boolean).join(' ') || null,
    app_version: Constants.expoConfig?.version ?? null,
    update_id: updateId,
  };
}

export async function sendBugReport(input: {
  description: string;
  place: string | null;
  screenshots: CloudImage[];
  senderId: string;
  senderName: string;
}): Promise<Result<BugReport>> {
  const description = input.description.trim().slice(0, 5000);
  if (!description) return { success: false, error: 'Write what went wrong' };
  const { data, error } = await supabase
    .from('bug_reports')
    .insert({
      description,
      place: input.place?.trim().slice(0, 200) || null,
      screenshots: input.screenshots,
      ...(await deviceInfo()),
    })
    .select()
    .single();
  if (error) return fail(error);
  void sendPushNotificationToRole(
    'owner',
    `Problem reported by ${input.senderName.split(' ')[0]} 🐞`,
    description.length > 120 ? `${description.slice(0, 117)}…` : description,
    { type: 'bug_report', bug_report_id: (data as BugReport).id },
    [input.senderId],
  );
  return { success: true, data: data as BugReport };
}

/** Owners: every report. Anyone else: their own. Newest first. */
export async function fetchBugReports(): Promise<Result<BugReport[]>> {
  const { data, error } = await supabase.from('bug_reports').select('*').order('created_at', { ascending: false });
  if (error) return fail(error);
  return { success: true, data: (data || []) as BugReport[] };
}

/** Owner only (RLS). */
export async function setBugStatus(id: string, status: 'open' | 'fixed'): Promise<Result<BugReport>> {
  const { data, error } = await supabase.from('bug_reports').update({ status }).eq('id', id).select().single();
  if (error) return fail(error);
  return { success: true, data: data as BugReport };
}

/** Owner only (RLS). */
export async function deleteBugReport(id: string): Promise<Result> {
  const { error } = await supabase.from('bug_reports').delete().eq('id', id);
  if (error) return fail(error);
  return { success: true, data: undefined };
}
