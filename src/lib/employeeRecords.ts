// ============================================================================
// VEBOSSO EMS — Documents, salary and messages to the boss
// Plain data helpers; the screens that use them keep their own local state.
// Who may do what is enforced by RLS + triggers (migration 020) — these only
// shape the calls and send the matching notifications.
// ============================================================================

import { format, parseISO } from 'date-fns';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as WebBrowser from 'expo-web-browser';
import { Linking, Platform } from 'react-native';
import { uploadCheckoutPhoto } from '../store/workStore';
import {
  BossMessageWithSender,
  EmployeeDocument,
  SalaryRequest,
} from '../types/database';
import { parseSupabaseError } from './errors';
import { sendPushNotification, sendPushNotificationToRole } from './notifications';
import { supabase } from './supabase';

type Result<T = undefined> = { success: true; data: T } | { success: false; error: string };

const fail = (error: unknown): { success: false; error: string } => ({
  success: false,
  error: parseSupabaseError(error),
});

async function currentUserName(userId: string): Promise<string> {
  const { data } = await supabase.from('profiles').select('full_name').eq('id', userId).single();
  return data?.full_name || 'A team member';
}

// ============================================================================
// Documents
// ============================================================================

export async function fetchDocuments(userId: string): Promise<Result<EmployeeDocument[]>> {
  const { data, error } = await supabase
    .from('employee_documents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return fail(error);
  return { success: true, data: (data || []) as EmployeeDocument[] };
}

/** Signed, short-lived URLs keyed by file path, for showing documents. */
export async function signDocumentUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data } = await supabase.storage.from('documents').createSignedUrls(paths, 3600);
  const out: Record<string, string> = {};
  for (const item of data || []) {
    if (item.path && item.signedUrl) out[item.path] = item.signedUrl;
  }
  return out;
}

const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export type DocumentKind = 'image' | 'pdf' | 'word' | 'other';

export function documentKind(mime: string | null | undefined): DocumentKind {
  if (!mime) return 'image'; // rows from before mime types were stored
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.includes('word')) return 'word';
  return 'other';
}

export async function uploadDocument(params: {
  /** Whose document this is. */
  userId: string;
  /** Who is uploading — the same person, or the owner. */
  uploaderId: string;
  name: string;
  uri: string;
  /** From the picker; for files, the original name tells us the type. */
  fileName?: string | null;
  mimeType?: string | null;
}): Promise<Result> {
  const { userId, uploaderId, name, uri, fileName, mimeType } = params;
  try {
    const source = fileName || uri;
    const rawExt = (source.split('.').pop()?.split('?')[0] || '').toLowerCase();
    const ext = EXT_MIME[rawExt] ? rawExt : mimeType === 'application/pdf' ? 'pdf' : 'jpg';
    const mime = mimeType && Object.values(EXT_MIME).includes(mimeType) ? mimeType : EXT_MIME[ext];
    const path = `${userId}/${Date.now()}.${ext}`;

    await uploadCheckoutPhoto(path, uri, ext, 'documents', false, mime);

    const { error } = await supabase.from('employee_documents').insert({
      user_id: userId,
      uploaded_by: uploaderId,
      name: name.trim().slice(0, 120),
      file_path: path,
      mime_type: mime,
    });

    if (error) {
      // Owners can tidy up an orphaned file; for others the insert policy
      // failing means the upload was rejected too, so nothing is left behind.
      await supabase.storage.from('documents').remove([path]);
      return fail(error);
    }

    const docName = name.trim();
    if (uploaderId === userId) {
      const who = await currentUserName(userId);
      sendPushNotificationToRole(
        'owner',
        'Document to approve 📄',
        `${who} uploaded "${docName}" — waiting for your approval`,
        { type: 'document_uploaded', user_id: userId },
        [userId],
      );
    } else {
      sendPushNotification(
        userId,
        'New Document 📄',
        `"${docName}" was added to your documents`,
        { type: 'document_uploaded', user_id: userId },
      );
    }

    return { success: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

/**
 * Open a PDF / Word document in the phone's own viewer. Android: download to
 * the cache and hand it to whatever app handles the type; iOS: in-app browser
 * (renders both); web: a new tab.
 */
export async function openDocumentFile(doc: EmployeeDocument, signedUrl: string): Promise<Result> {
  try {
    if (Platform.OS === 'web') {
      window.open(signedUrl, '_blank');
      return { success: true, data: undefined };
    }

    if (Platform.OS === 'android') {
      const ext = doc.file_path.split('.').pop() || 'pdf';
      const target = `${FileSystem.cacheDirectory}doc-${doc.id}.${ext}`;
      const { uri } = await FileSystem.downloadAsync(signedUrl, target);
      const contentUri = await FileSystem.getContentUriAsync(uri);
      try {
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
          type: doc.mime_type || EXT_MIME[ext] || '*/*',
        });
      } catch {
        return {
          success: false,
          error:
            documentKind(doc.mime_type) === 'word'
              ? 'No app can open Word files. Install Google Docs or Microsoft Word.'
              : 'No app can open this file. Install a PDF viewer.',
        };
      }
      return { success: true, data: undefined };
    }

    await WebBrowser.openBrowserAsync(signedUrl);
    return { success: true, data: undefined };
  } catch (err) {
    // Last resort: let the system try the link.
    try {
      await Linking.openURL(signedUrl);
      return { success: true, data: undefined };
    } catch {
      return fail(err);
    }
  }
}

/** Owner only (RLS). Approve or reject someone's upload and tell them. */
export async function reviewDocument(
  doc: EmployeeDocument,
  decision: 'approved' | 'rejected',
  ownerId: string,
): Promise<Result> {
  const { error } = await supabase
    .from('employee_documents')
    .update({ status: decision, reviewed_by: ownerId, reviewed_at: new Date().toISOString() })
    .eq('id', doc.id);

  if (error) return fail(error);

  sendPushNotification(
    doc.user_id,
    decision === 'approved' ? 'Document Approved ✅' : 'Document Rejected ❌',
    decision === 'approved'
      ? `"${doc.name}" has been approved.`
      : `"${doc.name}" was not accepted. Please upload it again.`,
    { type: decision === 'approved' ? 'document_approved' : 'document_rejected' },
  );

  return { success: true, data: undefined };
}

/** Pending uploads for one person — for the owner's badge. */
export async function countPendingDocuments(userId: string): Promise<number> {
  const { count } = await supabase
    .from('employee_documents')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'pending');
  return count ?? 0;
}

/** Owner only (RLS). */
export async function renameDocument(id: string, name: string): Promise<Result> {
  const { error } = await supabase
    .from('employee_documents')
    .update({ name: name.trim().slice(0, 120) })
    .eq('id', id);
  if (error) return fail(error);
  return { success: true, data: undefined };
}

/** Owner only (RLS). Removes the file and the row. */
export async function deleteDocument(doc: EmployeeDocument): Promise<Result> {
  const { error } = await supabase.from('employee_documents').delete().eq('id', doc.id);
  if (error) return fail(error);
  await supabase.storage.from('documents').remove([doc.file_path]);
  return { success: true, data: undefined };
}

// ============================================================================
// Salary
// ============================================================================

export const salaryMonthLabel = (month: string) => format(parseISO(month), 'MMMM yyyy');

export async function fetchSalaryRequests(userId: string): Promise<Result<SalaryRequest[]>> {
  const { data, error } = await supabase
    .from('salary_requests')
    .select('*')
    .eq('user_id', userId)
    .order('month', { ascending: false });

  if (error) return fail(error);
  return { success: true, data: (data || []) as SalaryRequest[] };
}

/**
 * Ask the owner for a month's salary. Asking again for a month that is still
 * waiting sends a reminder instead of failing.
 */
export async function requestSalary(userId: string, month: string): Promise<Result> {
  const { data: existing, error: readError } = await supabase
    .from('salary_requests')
    .select('id, status')
    .eq('user_id', userId)
    .eq('month', month)
    .maybeSingle();

  if (readError) return fail(readError);

  if (existing && existing.status !== 'requested') {
    return {
      success: false,
      error: `Salary for ${salaryMonthLabel(month)} is already marked ${existing.status}.`,
    };
  }

  const { error } = existing
    ? await supabase.from('salary_requests').update({ status: 'requested' }).eq('id', existing.id)
    : await supabase.from('salary_requests').insert({ user_id: userId, month, status: 'requested' });

  if (error) return fail(error);

  const who = await currentUserName(userId);
  sendPushNotificationToRole(
    'owner',
    existing ? 'Salary Reminder 💰' : 'Salary Request 💰',
    `${who} is asking for the ${salaryMonthLabel(month)} salary`,
    { type: 'salary_request', user_id: userId },
    [userId],
  );

  return { success: true, data: undefined };
}

/** Owner only. Works on a request, or records a month nobody asked for yet. */
export async function markSalaryPaid(userId: string, month: string, ownerId: string): Promise<Result> {
  const { error } = await supabase.from('salary_requests').upsert(
    {
      user_id: userId,
      month,
      status: 'paid',
      paid_at: new Date().toISOString(),
      paid_by: ownerId,
    },
    { onConflict: 'user_id,month' },
  );

  if (error) return fail(error);

  sendPushNotification(
    userId,
    'Salary Paid ✅',
    `Your ${salaryMonthLabel(month)} salary has been paid. Tap Received once it reaches you.`,
    { type: 'salary_paid', month },
  );

  return { success: true, data: undefined };
}

export async function markSalaryReceived(request: SalaryRequest): Promise<Result> {
  const { error } = await supabase
    .from('salary_requests')
    .update({ status: 'received' })
    .eq('id', request.id);

  if (error) return fail(error);

  const who = await currentUserName(request.user_id);
  sendPushNotificationToRole(
    'owner',
    'Salary Received 👍',
    `${who} confirmed receiving the ${salaryMonthLabel(request.month)} salary`,
    { type: 'salary_received', user_id: request.user_id },
    [request.user_id],
  );

  return { success: true, data: undefined };
}

// ============================================================================
// Messages to the boss
// ============================================================================

export async function sendBossMessage(senderId: string, body: string): Promise<Result> {
  const text = body.trim().slice(0, 2000);
  if (!text) return { success: false, error: 'Write a message first' };

  const { error } = await supabase.from('boss_messages').insert({ sender_id: senderId, body: text });
  if (error) return fail(error);

  const who = await currentUserName(senderId);
  sendPushNotificationToRole(
    'owner',
    `Message from ${who}`,
    text.slice(0, 300),
    { type: 'boss_message' },
    [senderId],
  );

  return { success: true, data: undefined };
}

/** Owner only (RLS). */
export async function fetchOpenBossMessages(): Promise<Result<BossMessageWithSender[]>> {
  const { data, error } = await supabase
    .from('boss_messages')
    .select('*, sender:profiles!boss_messages_sender_id_fkey(full_name, employee_id, role)')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return fail(error);
  return { success: true, data: (data || []) as unknown as BossMessageWithSender[] };
}

/** Owner only (RLS). Lets the sender know it was handled. */
export async function markBossMessageDone(message: BossMessageWithSender): Promise<Result> {
  const { error } = await supabase
    .from('boss_messages')
    .update({ status: 'done', done_at: new Date().toISOString() })
    .eq('id', message.id);

  if (error) return fail(error);

  sendPushNotification(
    message.sender_id,
    'Boss saw your message ✅',
    message.body.slice(0, 200),
    { type: 'boss_message_done' },
  );

  return { success: true, data: undefined };
}

// ============================================================================
// Team posts — a member / manager writing to the whole company
// ============================================================================

export async function postToTeam(senderId: string, body: string): Promise<Result> {
  const text = body.trim().slice(0, 2000);
  if (!text) return { success: false, error: 'Write a message first' };

  const { data, error } = await supabase
    .from('announcements')
    .insert({ created_by: senderId, title: 'Team message', body: text, target_role: 'all' })
    .select('id')
    .single();

  if (error) return fail(error);

  // The push function reads the post back and broadcasts it once.
  supabase.functions
    .invoke('send-push-notification', { body: { announcement_id: data.id } })
    .catch((err) => {
      if (__DEV__) console.warn('Team post push failed:', err);
    });

  return { success: true, data: undefined };
}

// ============================================================================
// Owner inbox — everything waiting on the owner, across all people
// ============================================================================

type PersonRef = { full_name: string; employee_id: string; avatar_url: string | null };

export type PendingDocument = EmployeeDocument & { person: PersonRef | null };
export type WaitingSalaryRequest = SalaryRequest & { person: PersonRef | null };

/** Owner only (RLS). Uploads waiting for approval, oldest first. */
export async function fetchAllPendingDocuments(): Promise<Result<PendingDocument[]>> {
  const { data, error } = await supabase
    .from('employee_documents')
    .select('*, person:profiles!employee_documents_user_id_fkey(full_name, employee_id, avatar_url)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) return fail(error);
  return { success: true, data: (data || []) as unknown as PendingDocument[] };
}

/** Owner only (RLS). Salary asks not yet marked paid, oldest first. */
export async function fetchAllSalaryRequests(): Promise<Result<WaitingSalaryRequest[]>> {
  const { data, error } = await supabase
    .from('salary_requests')
    .select('*, person:profiles!salary_requests_user_id_fkey(full_name, employee_id, avatar_url)')
    .eq('status', 'requested')
    .order('requested_at', { ascending: true });

  if (error) return fail(error);
  return { success: true, data: (data || []) as unknown as WaitingSalaryRequest[] };
}
