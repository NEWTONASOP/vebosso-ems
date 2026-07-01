// ============================================================================
// VEBOSSO EMS — Member Tab Layout (Floating Premium Navigation)
// ============================================================================

import React from 'react';
import { Tabs } from 'expo-router';

import { Feather } from '@expo/vector-icons';

import { CustomTabBar } from '../../components/CustomTabBar';

export default function MemberLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <Feather name="home" color={color} size={18} />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color }) => (
            <Feather name="check-square" color={color} size={18} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color }) => (
            <Feather name="calendar" color={color} size={18} />
          ),
        }}
      />
      <Tabs.Screen
        name="announcements"
        options={{
          title: 'News',
          tabBarIcon: ({ color }) => (
            <Feather name="bell" color={color} size={18} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <Feather name="user" color={color} size={18} />
          ),
        }}
      />
    </Tabs>
  );
}
