// ============================================================================
// VEBOSSO EMS — Manager Tab Layout (Floating Premium Navigation)
// ============================================================================

import React from 'react';
import { Tabs } from 'expo-router';
import { Colors } from '../../constants/colors';
import { useWorkStore } from '../../store/workStore';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';

function TabBarBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <View style={badgeStyles.container}>
      <Text style={badgeStyles.text}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: '#FF3B30', // System Red badge
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    zIndex: 10,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
  },
});

export default function ManagerLayout() {
  const pendingCount = useWorkStore((s) => s.pendingApprovalsCount);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: Platform.OS === 'ios' ? 28 : 16,
          left: 16,
          right: 16,
          backgroundColor: 'rgba(255, 255, 255, 0.96)', // Translucent White
          borderRadius: 24,
          height: 60,
          borderTopWidth: 0, // Remove native top line
          borderWidth: 1,
          borderColor: 'rgba(0, 0, 0, 0.04)',
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.05,
          shadowRadius: 18,
          elevation: 5,
        },
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
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => (
            <Feather name="grid" color={color} size={18} />
          ),
        }}
      />
      <Tabs.Screen
        name="my-team"
        options={{
          title: 'My Team',
          tabBarIcon: ({ color }) => (
            <Feather name="users" color={color} size={18} />
          ),
        }}
      />
      <Tabs.Screen
        name="approvals"
        options={{
          title: 'Approvals',
          tabBarIcon: ({ color }) => (
            <View style={styles.iconWrapper}>
              <Feather name="check-circle" color={color} size={18} />
              <TabBarBadge count={pendingCount} />
            </View>
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
        name="my-work"
        options={{
          title: 'My Work',
          tabBarIcon: ({ color }) => (
            <Feather name="briefcase" color={color} size={18} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrapper: {
    position: 'relative',
  },
});
