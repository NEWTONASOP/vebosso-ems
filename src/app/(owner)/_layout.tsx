// ============================================================================
// VEBOSSO EMS — Owner Tab Layout (Floating Premium Navigation)
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { CustomTabBar } from '../../components/CustomTabBar';
import { SIDEBAR_WIDTH } from '../../constants/theme';
import { useResponsive } from '../../lib/responsive';

export default function OwnerLayout() {
  const { isDesktop } = useResponsive();

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
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

