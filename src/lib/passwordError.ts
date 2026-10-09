// ============================================================================
// VEBOSSO EMS — "This file needs a password"
// On its own so screens can recognise it without loading the spreadsheet and
// decryption code (that loads only when a file is actually opened).
// ============================================================================

export class PasswordNeededError extends Error {
  /** A password was given, and it was wrong. */
  wrong: boolean;
  constructor(wrong = false) {
    super(wrong ? 'That password didn’t open the file' : 'This file is protected with a password');
    this.wrong = wrong;
  }
}
