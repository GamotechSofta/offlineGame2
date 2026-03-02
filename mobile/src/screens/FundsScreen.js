import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const ITEMS = [
  { key: 'add-fund', title: 'Add Fund', subtitle: 'Add fund to your wallet', color: '#1B3150' },
  { key: 'withdraw-fund', title: 'Withdraw Fund', subtitle: 'Withdraw winnings', color: '#ef4444' },
  { key: 'bank-detail', title: 'Bank Detail', subtitle: 'Add bank detail for withdrawals', color: '#3b82f6' },
  { key: 'add-fund-history', title: 'Add Fund History', subtitle: 'Check add point history', color: '#1e3a8a' },
  { key: 'withdraw-fund-history', title: 'Withdraw Fund History', subtitle: 'Check withdraw history', color: '#f59e0b' },
];

export default function FundsScreen({ route }) {
  const navigation = useNavigation();
  const tabParam = route?.params?.tab;
  const [activeKey, setActiveKey] = useState(tabParam || ITEMS[0]?.key);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.8}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Funds</Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {ITEMS.map((item) => (
          <TouchableOpacity
            key={item.key}
            onPress={() => setActiveKey(item.key)}
            style={[styles.item, item.key === activeKey && styles.itemActive]}
            activeOpacity={0.9}
          >
            <View style={[styles.iconWrap, { backgroundColor: item.color }]}>
              <Text style={styles.iconText}>₹</Text>
            </View>
            <View style={styles.itemText}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
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
  scrollContent: { padding: 16, paddingBottom: 100 },
  item: { flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 10, backgroundColor: '#fff', borderRadius: 16, borderWidth: 2, borderColor: '#d1d5db' },
  itemActive: { borderColor: '#1B3150', backgroundColor: '#f9fafb' },
  iconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  iconText: { fontSize: 20, fontWeight: '800', color: '#fff' },
  itemText: { flex: 1 },
  itemTitle: { fontSize: 16, fontWeight: '600', color: '#1f2937' },
  itemSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  arrow: { fontSize: 20, color: '#1B3150' },
});
