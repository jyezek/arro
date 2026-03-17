import { Tabs } from 'expo-router'
import { View, StyleSheet } from 'react-native'
import { Colors, wm, orangeAlpha } from '@/constants/Colors'

// Minimal geometric tab indicators — no emojis
function TabIndicator({ active }: { active: boolean }) {
  return (
    <View style={[styles.indicator, active && styles.indicatorActive]} />
  )
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.tabLabel,
        tabBarActiveTintColor: Colors.orange,
        tabBarInactiveTintColor: wm(0.3),
        tabBarIconStyle: styles.tabIconStyle,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Feed',
          tabBarIcon: ({ focused }) => <TabIndicator active={focused} />,
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Jobs',
          tabBarIcon: ({ focused }) => <TabIndicator active={focused} />,
        }}
      />
      <Tabs.Screen
        name="interview"
        options={{
          title: 'Interview',
          tabBarIcon: ({ focused }) => <TabIndicator active={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIndicator active={focused} />,
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.dark,
    borderTopWidth: 1,
    borderTopColor: wm(0.06),
    height: 72,
    paddingBottom: 8,
    paddingTop: 4,
  },
  tabIconStyle: {
    height: 6,
  },
  indicator: {
    width: 18,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'transparent',
    marginBottom: 2,
  },
  indicatorActive: {
    backgroundColor: Colors.orange,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.01,
    marginTop: 2,
  },
})
