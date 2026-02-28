import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const NAV_ITEMS = [
  { id: 'my-bids', label: 'My Bets', path: 'Bids', IconSet: MaterialCommunityIcons, iconName: 'gavel' },
  { id: 'bank', label: 'Bank', path: 'Bank', IconSet: Ionicons, iconName: 'business-outline' },
  { id: 'home', label: 'Home', path: 'Home', isCenter: true, IconSet: Ionicons, iconName: 'home-outline' },
  { id: 'funds', label: 'Funds', path: 'Funds', IconSet: Ionicons, iconName: 'wallet-outline' },
  { id: 'support', label: 'Support', path: 'Support', IconSet: Ionicons, iconName: 'headset-outline' },
];

export default function BottomNavbar() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();

  // We're inside Main; active screen is in nested state or params
  const activeNested = route.name === 'Main'
    ? (route.state?.routes?.[route.state?.index]?.name ?? route.params?.screen)
    : route.name;
  const isActive = (path) => activeNested === path;

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: 6 + insets.bottom,
          paddingLeft: Math.max(12, insets.left),
          paddingRight: Math.max(12, insets.right),
        },
      ]}
    >
      <View style={styles.absoluteBg} />
      <View style={styles.navInner}>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.path);
          const isCenter = item.isCenter;

          if (isCenter) {
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => navigation.navigate('Main', { screen: item.path })}
                style={styles.centerBtn}
                activeOpacity={0.9}
              >
                <View
                  style={[
                    styles.centerCircle,
                    active ? styles.centerCircleActive : styles.centerCircleInactive,
                  ]}
                >
                  <item.IconSet
                    name={item.iconName}
                    size={24}
                    color={active ? '#fff' : '#9ca3af'}
                  />
                </View>
                <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => navigation.navigate('Main', { screen: item.path })}
              style={styles.navBtn}
              activeOpacity={0.9}
            >
              <View style={styles.navItemInner}>
                <View style={styles.iconWrap}>
                  <item.IconSet
                    name={item.iconName}
                    size={24}
                    color={active ? '#1B3150' : '#9ca3af'}
                  />
                </View>
                <View style={styles.dotWrap}>
                  {active && <View style={styles.dot} />}
                </View>
                <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
              </View>
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
    paddingTop: 4,
  },
  absoluteBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff',
  },
  navInner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#d1d5db',
    paddingHorizontal: 4,
    paddingVertical: 6,
    minHeight: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  navBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    minWidth: 56,
  },
  navItemInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotWrap: {
    height: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    marginBottom: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1B3150',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  label: { fontSize: 10, fontWeight: '700', color: '#4b5563', marginTop: 1 },
  labelActive: { color: '#1B3150' },
  centerBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -24,
  },
  centerCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerCircleInactive: {
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: '#d1d5db',
  },
  centerCircleActive: {
    backgroundColor: '#1B3150',
    borderColor: '#1B3150',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
});
