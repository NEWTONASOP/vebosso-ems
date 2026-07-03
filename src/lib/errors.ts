// ============================================================================
// VEBOSSO EMS — Centralized Error Handling Utilities
// ============================================================================

import type { PostgrestError } from '@supabase/supabase-js';

// ─── AppError ────────────────────────────────────────────────────────────────

/**
 * Structured application error with a code, message, and recoverability flag.
 * Use this  when you need to carry extra context beyond a plain string.
 */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    /** Whether the user can retry the action to recover */
    public readonly recoverable: boolean = true
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// ─── Supabase / PostgREST error parser ───────────────────────────────────────

/**
 * Converts a raw Supabase/PostgREST error into a user-friendly string.
 * Falls back to the raw message if no specific mapping is found.
 */
export function parseSupabaseError(
  error: PostgrestError | Error | unknown
): string {
  if (!error) return 'An unexpected error occurred.';

  // PostgREST error object (from supabase-js)
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const pgError = error as PostgrestError;

    switch (pgError.code) {
      // Unique constraint violation
      case '23505':
        return 'This record already exists. Please use a different value.';
      // Foreign key violation
      case '23503':
        return 'This action references a record that does not exist.';
      // Not-null constraint
      case '23502':
        return 'A required field is missing.';
      // Row Level Security policy violation
      case '42501':
        return 'You do not have permission to perform this action.';
      // No rows returned (treated as "not found")
      case 'PGRST116':
        return 'The requested record was not found.';
      // JWT expired
      case 'PGRST301':
        return 'Your session has expired. Please sign in again.';
      // Column does not exist / bad request
      case '42703':
        return 'Invalid data format. Please contact support.';
      default:
        // Fall through to message
        break;
    }

    if (pgError.message) {
      return friendlyMessage(pgError.message);
    }
  }

  if (error instanceof Error) {
    return friendlyMessage(error.message);
  }

  return 'An unexpected error occurred.';
}

// ─── Edge Function error parser ───────────────────────────────────────────────

/**
 * Unwraps an error returned by `supabase.functions.invoke()`.
 *
 * When an Edge Function returns a non-2xx response, supabase-js puts the
 * raw response body in `error.context`. This helper digs out the `error`
 * field from that body so the caller gets a clean string.
 */
export function parseFunctionError(error: unknown): string {
  if (!error) return 'An unexpected error occurred.';

  // supabase FunctionsHttpError / FunctionsRelayError
  if (typeof error === 'object' && error !== null) {
    // Try to read `error.context` (the raw fetch Response)
    const maybeContext = (error as Record<string, unknown>).context;
    if (maybeContext && typeof maybeContext === 'object') {
      const body = (maybeContext as Record<string, unknown>).body;
      if (typeof body === 'string') {
        try {
          const parsed = JSON.parse(body);
          if (parsed?.error) return String(parsed.error);
        } catch {
          // Not JSON, continue
        }
      }
    }

    // Try `.message` directly
    const msg = (error as Record<string, unknown>).message;
    if (typeof msg === 'string' && msg) {
      return friendlyMessage(msg);
    }
  }

  if (error instanceof Error) {
    return friendlyMessage(error.message);
  }

  return 'An unexpected error occurred.';
}

// ─── Standard result type ─────────────────────────────────────────────────────

/** Standard result type used by all store actions. */
export interface ActionResult {
  success: boolean;
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Maps common low-level error strings to user-friendly messages. */
function friendlyMessage(raw: string): string {
  const lower = raw.toLowerCase();

  if (lower.includes('network') || lower.includes('fetch') || lower.includes('failed to fetch')) {
    return 'Network error. Please check your connection and try again.';
  }
  if (lower.includes('timeout')) {
    return 'The request timed out. Please try again.';
  }
  if (lower.includes('jwt') || lower.includes('expired') || lower.includes('invalid token')) {
    return 'Your session has expired. Please sign in again.';
  }
  if (lower.includes('permission') || lower.includes('not authorized') || lower.includes('forbidden')) {
    return 'You do not have permission to perform this action.';
  }
  if (lower.includes('duplicate') || lower.includes('already exists') || lower.includes('unique')) {
    return 'This record already exists. Please use a different value.';
  }

  // Return the raw message as-is for anything else (already readable)
  return raw;
}
