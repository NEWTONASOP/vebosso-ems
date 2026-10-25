// ============================================================================
// VEBOSSO EMS — Entry Redirect
// ============================================================================

import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { useShallow } from 'zustand/react/shallow';

export default function Index() {
  const { isAuthenticated, profile } = useAuthStore(useShallow((s) => ({ isAuthenticated: s.isAuthenticated, profile: s.profile })));

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  switch (profile?.role) {
    case 'owner':
      return <Redirect href="/(owner)/dashboard" />;
    case 'manager':
      return <Redirect href="/(manager)/dashboard" />;
    case 'member':
      return <Redirect href="/(member)/home" />;
    default:
      return <Redirect href="/(auth)/login" />;
  }
}
