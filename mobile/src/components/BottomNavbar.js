import React, { useContext, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigationState } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { InnerStackNavContext } from '../navigation/InnerStackNavContext';
import { navigationRef } from '../navigation/navigationRef';
import { hapticLight } from '../utils/haptics';

const TAP_DEBOUNCE_MS = 120;

const NAV_ITEMS = [
  { id: 'my-bids', label: 'My Bets', path: 'BetHistory', IconSet: MaterialCommunityIcons, iconName: 'gavel', iconActive: 'gavel' },
  { id: 'bank', label: 'Bank', path: 'Bank', IconSet: Ionicons, iconName: 'business-outline', iconActive: 'business' },
  { id: 'home', label: 'Home', path: 'Home', IconSet: Ionicons, iconName: 'home-outline', iconActive: 'home' },
  { id: 'funds', label: 'Funds', path: 'Funds', IconSet: Ionicons, iconName: 'wallet-outline', iconActive: 'wallet' },
  { id: 'support', label: 'Support', path: 'Support', IconSet: Ionicons, iconName: 'headset-outline', iconActive: 'headset' },
];

export default function BottomNavbar() {
  const insets = useSafeAreaInsets();
  const innerNavRef = useContext(InnerStackNavContext);
  const lastTapRef = useRef(0);

  const activeNested = useNavigationState((state) => {
    const mainRoute = state?.routes?.[state?.index];
    if (mainRoute?.name === 'Main' && mainRoute?.state) {
      const inner = mainRoute.state;
      const name = inner?.routes?.[inner?.index ?? 0]?.name;
      return name ?? 'Home';
    }
    return 'Home';
  });
  const isActive = (path) => activeNested === path;

  const navigateTo = (path) => {
    const now = Date.now();
    if (now - lastTapRef.current < TAP_DEBOUNCE_MS) return;
    lastTapRef.current = now;
    if (innerNavRef?.current) {
      innerNavRef.current.navigate(path);
    } else if (navigationRef?.isReady?.()) {
      navigationRef.navigate('Main', { screen: path });
    }
    hapticLight();
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: 8 + insets.bottom,
          paddingLeft: Math.max(12, insets.left),
          paddingRight: Math.max(12, insets.right),
        },
      ]}
    >
      <View style={styles.navBar}>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.path);
          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => navigateTo(item.path)}
              style={[styles.barItem, active && styles.barItemActive]}
              activeOpacity={0.7}
            >
              <item.IconSet
                name={item.iconActive && active ? item.iconActive : item.iconName}
                size={24}
                color={active ? '#1B3150' : '#9ca3af'}
              />
              <Text style={[styles.barLabel, active && styles.barLabelActive]}>{item.label}</Text>
              {active && <View style={styles.activeIndicator} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 8,
  },
  barItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  barItemActive: {},
  barLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9ca3af',
    marginTop: 4,
  },
  barLabelActive: {
    color: '#1B3150',
    fontWeight: '700',
  },
  activeIndicator: {
    position: 'absolute',
    top: 0,
    left: '50%',
    marginLeft: -12,
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#1B3150',
  },
});
