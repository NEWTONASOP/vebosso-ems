import React from 'react';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Icon } from 'react-native-paper';
import { Colors } from '../../constants/colors';

export default function MemberLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.tabBar,
          borderTopColor: Colors.tabBarBorder,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 10,
          paddingTop: 6,
          ...Platform.select({
            ios: {
              shadowColor: Colors.shadow.shadowColor,
              shadowOffset: { width: 0, height: -3 },
              shadowOpacity: 0.03,
              shadowRadius: 6,
            },
            android: {
              elevation: 8,
            },
          }),
        },
        tabBarActiveTintColor: Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Icon source="home-outline" color={color as string} size={22} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color }) => <Icon source="clipboard-text-outline" color={color as string} size={22} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color }) => <Icon source="calendar-month-outline" color={color as string} size={22} />,
        }}
      />
      <Tabs.Screen
        name="announcements"
        options={{
          title: 'News',
          tabBarIcon: ({ color }) => <Icon source="bullhorn-outline" color={color as string} size={22} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <Icon source="account-circle-outline" color={color as string} size={22} />,
        }}
      />
    </Tabs>
  );
}
