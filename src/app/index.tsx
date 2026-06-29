// ============================================================================
// VEBOSSO EMS — Entry Redirect
// ============================================================================

import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/authStore';

export default function Index() {
  const { isAuthenticated, profile } = useAuthStore();

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
