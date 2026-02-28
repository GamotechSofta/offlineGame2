import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { navigate as rootNavigate } from '../navigation/navigationRef';

const BOTTOM_NAV_HEIGHT = 88;

const ITEMS = [
  {
    title: 'Bet History',
    subtitle: 'You can view your market bet history.',
    color: '#f3b61b',
    screen: 'BetHistory',
    iconName: 'time-outline',
  },
  {
    title: 'Game Results',
    subtitle: 'You can view your market result history.',
    color: '#25d366',
    screen: 'MarketResultHistory',
    iconName: 'stats-chart-outline',
  },
];

export default function BidsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const contentBottomPadding = 24 + BOTTOM_NAV_HEIGHT + insets.bottom;

  // Always navigate via root so Bet History / Game Results open inside Main (never Login)
  const openScreen = (screenName) => {
    rootNavigate('Main', { screen: screenName });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.title}>My Bets</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: contentBottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {ITEMS.map((item) => (
          <TouchableOpacity
            key={item.title}
            onPress={() => openScreen(item.screen)}
            style={styles.card}
            activeOpacity={0.9}
          >
            <View style={styles.cardLeft}>
              <View style={[styles.iconWrap, { backgroundColor: item.color }]}>
                <Ionicons name={item.iconName} size={28} color={item.color === '#f3b61b' ? '#1f2937' : '#fff'} />
              </View>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
              </View>
            </View>
            <View style={styles.arrowWrap}>
              <Ionicons name="chevron-forward" size={22} color="#6b7280" />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backBtn: { padding: 8, marginRight: 4 },
  title: { fontSize: 20, fontWeight: '700', color: '#1f2937' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingTop: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardText: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#1f2937' },
  cardSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  arrowWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
});
