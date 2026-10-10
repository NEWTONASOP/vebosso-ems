// ============================================================================
// VEBOSSO EMS — Documents, salary and messages to the boss
// Plain data helpers; the screens that use them keep their own local state.
// Who may do what is enforced by RLS + triggers (migration 020) — these only
// shape the calls and send the matching notifications.
// ============================================================================

import { format, parseISO } from 'date-fns';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as IntentLauncher from 'expo-intent-launcher';
import * as WebBrowser from 'expo-web-browser';
import { Image as RNImage, Linking, Platform } from 'react-native';
import { uploadCheckoutPhoto } from '../store/workStore';
import {
  BossMessageWithSender,
  EmployeeDocument,
  SalaryRequest,
  SalarySetting,
  WorkFile,
  DocumentCategory,
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

/**
 * The small preview in lists: a ~160 px JPEG saved next to the photo
 * ("<file>.thumb.jpg"). Lists show this instead of the full photo, which can
 * be megabytes. Supabase's free plan can't resize images itself.
 */
export const thumbPath = (filePath: string) => filePath.replace(/.[^./]+$/, '') + '.thumb.jpg';

async function uploadThumb(filePath: string, localUri: string): Promise<boolean> {
  try {
    const small = await ImageManipulator.manipulateAsync(localUri, [{ resize: { width: 160 } }], {
      compress: 0.5,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    await uploadCheckoutPhoto(thumbPath(filePath), small.uri, 'jpg', 'documents', false, 'image/jpeg');
    return true;
  } catch {
    return false;
  }
}

/**
 * For a photo uploaded before previews existed: make its preview once, from
 * the full photo (`fullUrl` — a signed link). Returns the preview's link.
 * Only works for someone allowed to add to that person's documents.
 */
export async function makeDocumentThumb(filePath: string, fullUrl: string): Promise<string | null> {
  try {
    let local = fullUrl;
    if (Platform.OS !== 'web') {
      const tmp = `${FileSystem.cacheDirectory}doc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      local = (await FileSystem.downloadAsync(fullUrl, tmp)).uri;
    }
    const ok = await uploadThumb(filePath, local);
    if (Platform.OS !== 'web') await FileSystem.deleteAsync(local, { idempotent: true }).catch(() => {});
    if (!ok) return null;
    return (await signDocumentUrls([thumbPath(filePath)]))[thumbPath(filePath)] ?? null;
  } catch {
    return null;
  }
}

/** Photos wider than this are shrunk before upload — still sharp enough to read an ID. */
const MAX_PHOTO_WIDTH = 2000;

/**
 * A big camera photo (often 4–8 MB) shrunk to MAX_PHOTO_WIDTH as a JPEG; it
 * loaded slowly and made the documents list stutter. Smaller ones, and
 * anything that fails, go up as they are.
 */
async function shrinkPhoto(uri: string): Promise<{ uri: string; shrunk: boolean }> {
  try {
    const width = await new Promise<number>((resolve, reject) =>
      RNImage.getSize(uri, (w) => resolve(w), reject),
    );
    if (width <= MAX_PHOTO_WIDTH) return { uri, shrunk: false };
    const small = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: MAX_PHOTO_WIDTH } }], {
      compress: 0.8,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return { uri: small.uri, shrunk: true };
  } catch {
    return { uri, shrunk: false };
  }
}

/** What check-in / check-out may attach. */
export const WORK_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
export const MAX_WORK_FILES = 5;
export const MAX_WORK_FILE_BYTES = 20 * 1024 * 1024;

/** A work file already in storage, waiting for its work log to exist. */
export interface StoredWorkFile {
  path: string;
  name: string;
  mime: string;
}

/** Step 1 of attaching files at check-in / out: put them in the documents bucket. */
export async function storeWorkFiles(userId: string, files: WorkFile[]): Promise<StoredWorkFile[]> {
  const stored: StoredWorkFile[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const rawExt = (f.name.split('.').pop() || '').toLowerCase();
    const ext = EXT_MIME[rawExt] && !EXT_MIME[rawExt].startsWith('image/') ? rawExt : f.mimeType === 'application/pdf' ? 'pdf' : 'docx';
    const mime = f.mimeType && WORK_FILE_TYPES.includes(f.mimeType) ? f.mimeType : EXT_MIME[ext];
    const path = `${userId}/work_${Date.now()}_${i}.${ext}`;
    try {
      await uploadCheckoutPhoto(path, f.uri, ext, 'documents', false, mime);
    } catch (e: any) {
      // Don't leave the earlier ones behind.
      if (stored.length) await supabase.storage.from('documents').remove(stored.map((s) => s.path));
      throw new Error(`Failed to upload "${f.name}": ${e?.message || e}`);
    }
    stored.push({ path, name: f.name.replace(/\.[^.]+$/, '').slice(0, 120) || 'Work file', mime });
  }
  return stored;
}

/** Step 2: list them in the person's Documents under Work, tied to that day's log. */
export async function linkWorkFiles(
  userId: string,
  workLogId: string,
  phase: 'check_in' | 'check_out',
  stored: StoredWorkFile[],
): Promise<void> {
  if (stored.length === 0) return;
  const { error } = await supabase.from('employee_documents').insert(
    stored.map((s) => ({
      user_id: userId,
      uploaded_by: userId,
      name: s.name,
      file_path: s.path,
      mime_type: s.mime,
      category: 'work',
      work_log_id: workLogId,
      work_phase: phase,
    })),
  );
  if (error) throw error;
}

/** Work files attached to one work log (check-in and check-out). */
export async function fetchWorkLogFiles(workLogId: string): Promise<EmployeeDocument[]> {
  const { data } = await supabase
    .from('employee_documents')
    .select('*')
    .eq('work_log_id', workLogId)
    .eq('category', 'work')
    .order('created_at', { ascending: true });
  return (data ?? []) as EmployeeDocument[];
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
  /** 'work' documents need no approval and are readable by managers (059). */
  category?: DocumentCategory;
}): Promise<Result> {
  const { userId, uploaderId, name, uri, fileName, mimeType, category = 'personal' } = params;
  try {
    const source = fileName || uri;
    const rawExt = (source.split('.').pop()?.split('?')[0] || '').toLowerCase();
    let ext = EXT_MIME[rawExt] ? rawExt : mimeType === 'application/pdf' ? 'pdf' : 'jpg';
    let mime = mimeType && Object.values(EXT_MIME).includes(mimeType) ? mimeType : EXT_MIME[ext];
    let fileUri = uri;
    if (mime.startsWith('image/')) {
      const photo = await shrinkPhoto(uri);
      if (photo.shrunk) {
        fileUri = photo.uri;
        ext = 'jpg';
        mime = 'image/jpeg';
      }
    }
    // Work files are named work_… so managers can be allowed to read just those.
    const path = `${userId}/${category === 'work' ? 'work_' : ''}${Date.now()}.${ext}`;

    await uploadCheckoutPhoto(path, fileUri, ext, 'documents', false, mime);
    // Its small preview for lists (best effort — lists fall back to an icon).
    if (mime.startsWith('image/')) await uploadThumb(path, fileUri);

    const { error } = await supabase.from('employee_documents').insert({
      user_id: userId,
      uploaded_by: uploaderId,
      name: name.trim().slice(0, 120),
      file_path: path,
      mime_type: mime,
      category,
    });

    if (error) {
      // Owners can tidy up an orphaned file; for others the insert policy
      // failing means the upload was rejected too, so nothing is left behind.
      await supabase.storage.from('documents').remove([path]);
      return fail(error);
    }

    const docName = name.trim();
    if (category === 'work') {
      // Work files need no approval, so nobody is asked for one.
      if (uploaderId !== userId) {
        sendPushNotification(userId, 'New Document 📄', `"${docName}" was added to your work documents`, {
          type: 'document_uploaded',
          user_id: userId,
        });
      }
    } else if (uploaderId === userId) {
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
    decision === 'approved' ? 'Document Approved ✅' : 'Document needs a change',
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

/** Owner only (RLS). The file stays, so the recycle bin can bring it back (056). */
export async function deleteDocument(doc: EmployeeDocument): Promise<Result> {
  const { error } = await supabase.from('employee_documents').delete().eq('id', doc.id);
  if (error) return fail(error);
  return { success: true, data: undefined };
}

// ============================================================================
// Salary
// ============================================================================

export const salaryMonthLabel = (month: string) => format(parseISO(month), 'MMMM yyyy');

/** The person's monthly salary, or null when the owner hasn't set one. */
export async function fetchMonthlySalary(userId: string): Promise<Result<number | null>> {
  const { data, error } = await supabase
    .from('salary_settings')
    .select('monthly_amount')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return fail(error);
  const row = data as Pick<SalarySetting, 'monthly_amount'> | null;
  return { success: true, data: row ? Number(row.monthly_amount) : null };
}

/** Owner only (RLS). */
export async function setMonthlySalary(userId: string, amount: number, ownerId: string): Promise<Result> {
  const { error } = await supabase
    .from('salary_settings')
    .upsert({ user_id: userId, monthly_amount: amount, updated_by: ownerId }, { onConflict: 'user_id' });
  if (error) return fail(error);
  return { success: true, data: undefined };
}

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

/**
 * Owner only. Tells the person when their salary will be cleared. Works on a
 * request, or records a month nobody asked for yet.
 * @param date "yyyy-MM-dd"
 */
export async function setSalaryExpectedDate(userId: string, month: string, date: string): Promise<Result> {
  const { error } = await supabase
    .from('salary_requests')
    .update({ expected_on: date })
    .eq('user_id', userId)
    .eq('month', month);
  if (error) return fail(error);

  sendPushNotification(
    userId,
    'Salary date 📅',
    `Your ${salaryMonthLabel(month)} salary will be cleared by ${format(parseISO(date), 'd MMM yyyy')}.`,
    { type: 'salary_date', month },
  );
  return { success: true, data: undefined };
}

/**
 * Owner only. Works on a request, or records a month nobody asked for yet.
 * @param amount rupees paid for this month (null if not recorded)
 */
export async function markSalaryPaid(
  userId: string,
  month: string,
  ownerId: string,
  amount: number | null = null,
): Promise<Result> {
  const { error } = await supabase.from('salary_requests').upsert(
    {
      user_id: userId,
      month,
      status: 'paid',
      paid_at: new Date().toISOString(),
      paid_by: ownerId,
      amount,
    },
    { onConflict: 'user_id,month' },
  );

  if (error) return fail(error);

  const rupees = amount !== null ? ` (₹${amount.toLocaleString('en-IN')})` : '';
  sendPushNotification(
    userId,
    'Salary Paid ✅',
    `Your ${salaryMonthLabel(month)} salary${rupees} has been paid. Tap Received once it reaches you.`,
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
