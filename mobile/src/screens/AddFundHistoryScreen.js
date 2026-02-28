import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getMyDeposits } from '../api/funds';

const BOTTOM_NAV_HEIGHT = 88;

export default function AddFundHistoryScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const loadDeposits = useCallback(async () => {
    setLoading(true);
    const res = await getMyDeposits();
    if (res.success && Array.isArray(res.data)) setDeposits(res.data);
    else setDeposits([]);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { loadDeposits(); }, [loadDeposits]));

  const filtered = filter === 'all' ? deposits : deposits.filter((d) => d.status === filter);
  const stats = {
    total: deposits.length,
    pending: deposits.filter((d) => d.status === 'pending').length,
    approved: deposits.filter((d) => d.status === 'approved').length,
    rejected: deposits.filter((d) => d.status === 'rejected').length,
  };
  const contentBottomPadding = 24 + BOTTOM_NAV_HEIGHT + insets.bottom;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.title}>Add Fund History</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: contentBottomPadding }]} showsVerticalScrollIndicator={false}>
        <View style={styles.statsRow}>
          <TouchableOpacity onPress={() => setFilter('all')} style={[styles.statCard, filter === 'all' && styles.statCardActive]} activeOpacity={0.9}>
            <Text style={[styles.statNum, filter === 'all' && styles.statNumActive]}>{stats.total}</Text>
            <Text style={[styles.statLabel, filter === 'all' && styles.statLabelActive]}>Total</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setFilter('pending')} style={[styles.statCard, filter === 'pending' && styles.statCardPending]} activeOpacity={0.9}>
            <Text style={styles.statNumGray}>{stats.pending}</Text>
            <Text style={styles.statLabelGray}>Pending</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setFilter('approved')} style={[styles.statCard, filter === 'approved' && styles.statCardApproved]} activeOpacity={0.9}>
            <Text style={styles.statNumGreen}>{stats.approved}</Text>
            <Text style={styles.statLabelGray}>Approved</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setFilter('rejected')} style={[styles.statCard, filter === 'rejected' && styles.statCardRejected]} activeOpacity={0.9}>
            <Text style={styles.statNumRed}>{stats.rejected}</Text>
            <Text style={styles.statLabelGray}>Rejected</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.emptyCard}><ActivityIndicator color="#1B3150" /><Text style={styles.emptySubtext}>Loading history...</Text></View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="document-text-outline" size={64} color="#9ca3af" />
            <Text style={styles.emptyTitle}>No deposit history found</Text>
          </View>
        ) : (
          filtered.map((d) => (
            <View key={d._id} style={styles.itemCard}>
              <View style={styles.itemRow}>
                <Text style={styles.itemAmount}>₹{Number(d.amount || 0).toLocaleString('en-IN')}</Text>
                <View style={[styles.statusBadge, d.status === 'approved' && styles.statusApproved, d.status === 'rejected' && styles.statusRejected]}>
                  <Text style={[styles.statusText, d.status === 'approved' && styles.statusTextGreen, d.status === 'rejected' && styles.statusTextRed]}>{d.status || 'pending'}</Text>
                </View>
              </View>
              <Text style={styles.itemDate}>{d.createdAt ? new Date(d.createdAt).toLocaleString('en-IN') : '-'}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  backBtn: { padding: 8, marginRight: 4 },
  title: { fontSize: 20, fontWeight: '700', color: '#1f2937' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: { flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 2, borderColor: '#e5e7eb', backgroundColor: '#fff', alignItems: 'center' },
  statCardActive: { backgroundColor: '#1B3150', borderColor: '#1B3150' },
  statCardPending: { borderColor: '#d1d5db', backgroundColor: '#f9fafb' },
  statCardApproved: { borderColor: '#86efac' },
  statCardRejected: { borderColor: '#fca5a5' },
  statNum: { fontSize: 18, fontWeight: '700', color: '#1f2937' },
  statNumActive: { color: '#fff' },
  statNumGray: { fontSize: 18, fontWeight: '700', color: '#6b7280' },
  statNumGreen: { fontSize: 18, fontWeight: '700', color: '#16a34a' },
  statNumRed: { fontSize: 18, fontWeight: '700', color: '#dc2626' },
  statLabel: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  statLabelActive: { color: 'rgba(255,255,255,0.9)' },
  statLabelGray: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  emptyCard: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 2, borderColor: '#e5e7eb', padding: 32, alignItems: 'center' },
  emptyTitle: { fontSize: 16, color: '#6b7280', marginTop: 16 },
  emptySubtext: { fontSize: 14, color: '#6b7280', marginTop: 8 },
  itemCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 2, borderColor: '#e5e7eb', padding: 16, marginBottom: 10 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemAmount: { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#d1d5db' },
  statusApproved: { backgroundColor: '#dcfce7', borderColor: '#86efac' },
  statusRejected: { backgroundColor: '#fef2f2', borderColor: '#fca5a5' },
  statusText: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  statusTextGreen: { color: '#16a34a' },
  statusTextRed: { color: '#dc2626' },
  itemDate: { fontSize: 12, color: '#6b7280', marginTop: 8 },
});
