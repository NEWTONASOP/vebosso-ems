// ============================================================================
// VEBOSSO EMS — Member Tab Layout (Floating Premium Navigation)
// ============================================================================

import React from 'react';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Colors } from '../../constants/colors';
import { Feather } from '@expo/vector-icons';

import { BlurView } from 'expo-blur';

export default function MemberLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: Platform.OS === 'ios' ? 28 : 16,
          left: 16,
          right: 16,
          backgroundColor: 'transparent',
          borderRadius: 24,
          height: 60,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.2)',
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.05,
          shadowRadius: 18,
          elevation: 5,
        },
        tabBarBackground: () => (
          <BlurView 
            tint="light" 
            intensity={60} 
            style={{ flex: 1, borderRadius: 24, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.7)' }} 
          />
        ),
        tabBarActiveTintColor: '#000000', // Solid black active state
        tabBarInactiveTintColor: '#AEAEB2', // iOS Muted Gray
        tabBarLabelStyle: {
          fontFamily: 'Inter_600SemiBold',
          fontSize: 10,
          marginTop: -4,
          marginBottom: 4,
        },
        tabBarIconStyle: {
          marginTop: 4,
        },
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
