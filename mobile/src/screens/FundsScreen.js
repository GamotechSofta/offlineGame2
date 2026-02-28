import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const BOTTOM_NAV_HEIGHT = 88;

const SCREEN_MAP = {
  'add-fund': 'AddFund',
  'withdraw-fund': 'WithdrawFund',
  'bank-detail': 'BankDetail',
  'add-fund-history': 'AddFundHistory',
  'withdraw-fund-history': 'WithdrawFundHistory',
};

const ITEMS = [
  { key: 'add-fund', title: 'Add Fund', subtitle: 'You can add fund to your wallet', color: '#1B3150' },
  { key: 'withdraw-fund', title: 'Withdraw Fund', subtitle: 'You can withdraw winnings', color: '#ef4444' },
  { key: 'bank-detail', title: 'Bank Detail', subtitle: 'Add your bank detail for withdrawals', color: '#3b82f6' },
  { key: 'add-fund-history', title: 'Add Fund History', subtitle: 'You can check your add point history', color: '#1e3a8a' },
  { key: 'withdraw-fund-history', title: 'Withdraw Fund History', subtitle: 'You can check your Withdraw point history', color: '#f59e0b' },
];

export default function FundsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const tabParam = route?.params?.tab;
  const contentBottomPadding = 24 + BOTTOM_NAV_HEIGHT + insets.bottom;

  const handleItemPress = (key) => {
    const screen = SCREEN_MAP[key];
    if (screen) navigation.navigate('Main', { screen });
    else navigation.navigate('Main', { screen: 'Funds' });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.title}>Funds</Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: contentBottomPadding }]} showsVerticalScrollIndicator={false}>
        {ITEMS.map((item) => (
          <TouchableOpacity
            key={item.key}
            onPress={() => handleItemPress(item.key)}
            style={[styles.item, tabParam === item.key && styles.itemActive]}
            activeOpacity={0.9}
          >
            <View style={[styles.iconWrap, { backgroundColor: item.color }]}>
              <Text style={styles.iconText}>₹</Text>
            </View>
            <View style={styles.itemText}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#1B3150" />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  backBtn: { padding: 8, marginRight: 8 },
  backIcon: { fontSize: 22, color: '#1f2937' },
  title: { fontSize: 20, fontWeight: '700', color: '#1f2937' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingTop: 16 },
  item: { flexDirection: 'row', alignItems: 'center', padding: 16, marginBottom: 12, backgroundColor: '#fff', borderRadius: 20, borderWidth: 2, borderColor: '#e5e7eb' },
  itemActive: { borderColor: '#1B3150', backgroundColor: '#f9fafb' },
  iconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  iconText: { fontSize: 20, fontWeight: '800', color: '#fff' },
  itemText: { flex: 1, minWidth: 0 },
  itemTitle: { fontSize: 16, fontWeight: '600', color: '#1f2937' },
  itemSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },
});
