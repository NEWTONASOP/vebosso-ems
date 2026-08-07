// ============================================================================
// VEBOSSO EMS — Member Tab Layout
// ============================================================================

import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { CustomTabBar } from '../../components/CustomTabBar';
import { AppTheme, RoleAccent } from '../../constants/theme';

export default function MemberLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: RoleAccent.member.color,
        tabBarInactiveTintColor: AppTheme.mute,
        sceneStyle: { backgroundColor: AppTheme.bg },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Feather name="home" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color, size }) => (
            <Feather name="check-square" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => (
            <Feather name="calendar" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="announcements"
        options={{
          title: 'News',
          tabBarIcon: ({ color, size }) => (
            <Feather name="bell" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Feather name="user" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="leaves"
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
