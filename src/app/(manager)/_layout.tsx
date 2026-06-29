import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Icon } from 'react-native-paper';
import { Colors } from '../../constants/colors';
import { useWorkStore } from '../../store/workStore';

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
    backgroundColor: Colors.badge,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    zIndex: 10,
  },
  text: { color: Colors.white, fontSize: 10, fontWeight: '700' },
});

export default function ManagerLayout() {
  const pendingCount = useWorkStore((s) => s.pendingApprovalsCount);

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
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <Icon source="view-dashboard-outline" color={color as string} size={22} />,
        }}
      />
      <Tabs.Screen
        name="my-team"
        options={{
          title: 'My Team',
          tabBarIcon: ({ color }) => <Icon source="account-group-outline" color={color as string} size={22} />,
        }}
      />
      <Tabs.Screen
        name="approvals"
        options={{
          title: 'Approvals',
          tabBarIcon: ({ color }) => (
            <View>
              <Icon source="checkbox-marked-circle-outline" color={color as string} size={22} />
              <TabBarBadge count={pendingCount} />
            </View>
          ),
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
        name="my-work"
        options={{
          title: 'My Work',
          tabBarIcon: ({ color }) => <Icon source="briefcase-outline" color={color as string} size={22} />,
        }}
      />
    </Tabs>
  );
}
