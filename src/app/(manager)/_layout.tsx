// ============================================================================
// VEBOSSO EMS — Manager Tab Layout (Floating Premium Navigation)
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../constants/colors';
import { useWorkStore } from '../../store/workStore';

import { CustomTabBar } from '../../components/CustomTabBar';

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
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    zIndex: 10,
  },
  text: {
    color: Colors.white,
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
  },
});

export default function ManagerLayout() {
  const pendingCount = useWorkStore((s) => s.pendingApprovalsCount);

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
