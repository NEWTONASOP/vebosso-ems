// ============================================================================
// VEBOSSO EMS — Manager Venues
// ============================================================================

import { VenuesScreen } from '../../components/VenuesScreen';

export default function ManagerVenuesScreen() {
  return <VenuesScreen canManage={false} showBack />;
}
