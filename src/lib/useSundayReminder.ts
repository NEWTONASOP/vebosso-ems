// ============================================================================
// VEBOSSO EMS — Sunday check-in reminder setting
// The 11:30 AM "time to check in" reminder goes out every day; each person
// can turn it off for Sundays (profiles.sunday_checkin_reminder, default on).
// ============================================================================

import { useState } from 'react';
import { useAuthStore } from '../store/authStore';

export function useSundayReminder() {
  const profile = useAuthStore((s) => s.profile);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const [saving, setSaving] = useState(false);

  // Profiles loaded before the column existed read as on (the default).
  const enabled = profile?.sunday_checkin_reminder !== false;

  const setEnabled = async (value: boolean): Promise<string | null> => {
    setSaving(true);
    const res = await updateProfile({ sunday_checkin_reminder: value });
    setSaving(false);
    return res.success ? null : res.error || 'Could not save the setting';
  };

  return { enabled, saving, setEnabled };
}
