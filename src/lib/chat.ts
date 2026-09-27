// ============================================================================
// VEBOSSO EMS — Chat between the owner and one person
// Every conversation belongs to the non-owner side (member_id); any owner can
// read and reply. Replaces the one-way "Message Boss" (migration 029).
// ============================================================================

import { ChatMessage } from '../types/database';
import { parseSupabaseError } from './errors';
import { sendPushNotification, sendPushNotificationToRole } from './notifications';
import { supabase } from './supabase';

type Result<T = undefined> = { success: true; data: T } | { success: false; error: string };

const fail = (error: unknown): { success: false; error: string } => ({
  success: false,
  error: parseSupabaseError(error),
});

export const CHAT_MAX = 2000;

/** The latest messages of one conversation, oldest first. */
export async function fetchChat(memberId: string, limit = 200): Promise<Result<ChatMessage[]>> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return fail(error);
  return { success: true, data: ((data || []) as ChatMessage[]).reverse() };
}

/**
 * @param memberId the non-owner side of the conversation
 * @param senderId who is writing — the member themselves, or an owner
 */
export async function sendChatMessage(params: {
  memberId: string;
  senderId: string;
  senderName: string;
  body: string;
}): Promise<Result<ChatMessage>> {
  const { memberId, senderId, senderName, body } = params;
  const text = body.trim().slice(0, CHAT_MAX);
  if (!text) return { success: false, error: 'Write a message first' };

  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ member_id: memberId, sender_id: senderId, body: text })
    .select()
    .single();
  if (error) return fail(error);

  const fromMember = senderId === memberId;
  if (fromMember) {
    sendPushNotificationToRole(
      'owner',
      `Message from ${senderName}`,
      text.slice(0, 300),
      { type: 'chat_message', member_id: memberId },
      [senderId],
    );
  } else {
    sendPushNotification(memberId, `Message from ${senderName}`, text.slice(0, 300), {
      type: 'chat_message',
      member_id: memberId,
    });
  }

  return { success: true, data: data as ChatMessage };
}

/** Marks the other side's messages in this conversation as read. */
export async function markChatRead(memberId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_chat_read', { p_member_id: memberId });
  if (error && __DEV__) console.warn('mark_chat_read failed:', error.message);
}

export type UnreadChat = {
  memberId: string;
  count: number;
  latest: ChatMessage;
  person: { full_name: string; employee_id: string; avatar_url: string | null } | null;
};

/** Owner only (RLS). One entry per person with unread messages, newest first. */
export async function fetchUnreadChats(): Promise<Result<UnreadChat[]>> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*, person:profiles!chat_messages_member_id_fkey(full_name, employee_id, avatar_url)')
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) return fail(error);

  const byMember = new Map<string, UnreadChat>();
  for (const row of (data || []) as (ChatMessage & { person: UnreadChat['person'] })[]) {
    // Only what the person wrote is waiting on the owner.
    if (row.sender_id !== row.member_id) continue;
    const entry = byMember.get(row.member_id);
    if (entry) entry.count += 1;
    else byMember.set(row.member_id, { memberId: row.member_id, count: 1, latest: row, person: row.person });
  }
  return { success: true, data: [...byMember.values()] };
}

/** Owner's badge on one person: their messages not read yet. */
export async function countUnreadFrom(memberId: string): Promise<number> {
  const { count } = await supabase
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('member_id', memberId)
    .eq('sender_id', memberId)
    .is('read_at', null);
  return count ?? 0;
}

/** For the person's own badge: messages from the boss not read yet. */
export async function countMyUnread(memberId: string): Promise<number> {
  const { count } = await supabase
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('member_id', memberId)
    .is('read_at', null)
    .neq('sender_id', memberId);
  return count ?? 0;
}
