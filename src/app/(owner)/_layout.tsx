// ============================================================================
// VEBOSSO EMS — Owner Tab Layout (Floating Premium Navigation)
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { CustomTabBar, useDesktopSceneStyle } from '../../components/CustomTabBar';
import { NavgrahLogo } from '../../components/NavgrahLogo';
import { SIDEBAR_WIDTH } from '../../constants/theme';
import { useResponsive } from '../../lib/responsive';
import { askForMissingAlarmPermissions, syncBillAlarms } from '../../lib/billAlarms';
import { useAuthStore } from '../../store/authStore';

export default function OwnerLayout() {
  const { isDesktop } = useResponsive();
  const desktopScene = useDesktopSceneStyle();
  const role = useAuthStore((s) => s.profile?.role);

  // Event alarms (Android): set when the app opens and whenever it comes back;
  // an owner whose phone still has to allow something is told (once a day).
  useEffect(() => {
    if (!role) return;
    const sync = () =>
      void syncBillAlarms(role).then(() => (role === 'owner' ? askForMissingAlarmPermissions() : undefined));
    sync();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') sync();
    });
    return () => sub.remove();
  }, [role]);

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: desktopScene,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Feather name="grid" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="venues"
        options={{
          title: 'Venues',
          tabBarIcon: ({ color, size }) => (
            <Feather name="map-pin" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="bills"
        options={{
          title: 'Bills',
          tabBarIcon: ({ color, size }) => (
            <Feather name="file-text" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="leads"
        options={{
          title: 'Leads',
          tabBarIcon: ({ color, size }) => <NavgrahLogo size={size} color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          title: 'Accounts',
          tabBarIcon: ({ color, size }) => (
            <Feather name="book-open" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Feather name="settings" color={color} size={size} />
          ),
        }}
      />
      {/* Approvals moved to the Dashboard's "Needs you now"; kept for links. */}
      <Tabs.Screen
        name="approvals"
        options={{
          href: null,
        }}
      />
      {/* Attendance history now lives in each member's sheet; kept for links. */}
      <Tabs.Screen
        name="history"
        options={{
          href: null,
        }}
      />
      {/* Team moved to the Dashboard; kept for Add Member and deep links. */}
      <Tabs.Screen
        name="team"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="member/[id]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

