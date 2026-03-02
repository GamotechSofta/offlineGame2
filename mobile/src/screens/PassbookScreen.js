import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSetInnerNavRef } from '../navigation/InnerStackNavContext';
import { useAuth } from '../context/AuthContext';
import { getBalance, getMyWalletTransactions } from '../api/bets';
import { SkeletonBox, SkeletonRow } from '../components/Skeleton';

const formatDate = (dateStr) => {
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '-';
  }
};

const formatTime = (dateStr) => {
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return '-';
  }
};

const formatAmount = (amount) => {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '0.00';
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function PassbookScreen() {
  useSetInnerNavRef();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all' | 'credit' | 'debit'

  const fetchData = useCallback(async (isRefresh = false) => {
    const uid = user?._id || user?.id;
    if (!uid) {
      setTransactions([]);
      setBalance(null);
      setLoading(false);
      return;
    }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [txRes, balRes] = await Promise.all([
        getMyWalletTransactions(500),
        getBalance(),
      ]);
      const list = Array.isArray(txRes?.data) ? txRes.data : Array.isArray(txRes?.transactions) ? txRes.transactions : [];
      setTransactions(list);
      if (balRes?.success && balRes.data?.balance != null) setBalance(balRes.data.balance);
      else setBalance(null);
    } catch {
      setTransactions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?._id, user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const filtered = useMemo(() => {
    if (filter === 'all') return transactions;
    return transactions.filter((t) => t.type === filter);
  }, [transactions, filter]);

  const stats = useMemo(() => {
    let totalCredit = 0;
    let totalDebit = 0;
    let creditCount = 0;
    let debitCount = 0;
    transactions.forEach((t) => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'credit') {
        totalCredit += amt;
        creditCount++;
      } else {
        totalDebit += amt;
        debitCount++;
      }
    });
    return { totalCredit, totalDebit, creditCount, debitCount };
  }, [transactions]);

  const grouped = useMemo(() => {
    const map = new Map();
    filtered.forEach((t) => {
      const key = formatDate(t.createdAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const filters = [
    { key: 'all', label: 'All', count: transactions.length },
    { key: 'credit', label: 'Credited', count: stats.creditCount },
    { key: 'debit', label: 'Withdrawn', count: stats.debitCount },
  ];

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={24} color="#1f2937" />
          </TouchableOpacity>
          <Text style={styles.title}>Passbook</Text>
        </View>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Please sign in to view passbook.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.title}>Passbook</Text>
        <TouchableOpacity
          onPress={() => fetchData(true)}
          disabled={refreshing}
          style={styles.refreshBtn}
          activeOpacity={0.8}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color="#1B3150" />
          ) : (
            <Ionicons name="refresh" size={24} color="#1f2937" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} colors={['#1B3150']} />
        }
      >
        {/* Balance card */}
        <View style={styles.balanceCard}>
          {loading ? (
            <>
              <SkeletonBox width={120} height={12} style={{ marginBottom: 8 }} />
              <SkeletonBox width={140} height={28} style={{ marginBottom: 16 }} />
              <View style={styles.statsRow}>
                <SkeletonBox width="48%" height={60} borderRadius={12} />
                <SkeletonBox width="48%" height={60} borderRadius={12} />
              </View>
            </>
          ) : (
            <>
              <Text style={styles.balanceLabel}>Current Balance</Text>
              <Text style={styles.balanceValue}>
                ₹{balance !== null ? formatAmount(balance) : '---'}
              </Text>
              <View style={styles.statsRow}>
                <View style={styles.statBoxCredit}>
                  <Text style={styles.statLabelCredit}>Credited</Text>
                  <Text style={styles.statValueCredit}>₹{formatAmount(stats.totalCredit)}</Text>
                </View>
                <View style={styles.statBoxDebit}>
                  <Text style={styles.statLabelDebit}>Withdrawn</Text>
                  <Text style={styles.statValueDebit}>₹{formatAmount(stats.totalDebit)}</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Filter tabs */}
        <View style={styles.filterRow}>
          {filters.map((f) => {
            const active = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[styles.filterChip, active && styles.filterChipActive]}
                activeOpacity={0.9}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{f.label}</Text>
                <View style={[styles.filterCount, active && styles.filterCountActive]}>
                  <Text style={[styles.filterCountText, active && styles.filterCountTextActive]}>{f.count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Transaction list */}
        <Text style={styles.sectionTitle}>Transaction History</Text>
        {loading ? (
          <View style={styles.listCard}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <SkeletonRow key={i} hasIcon={true} />
            ))}
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="document-text-outline" size={48} color="#9ca3af" />
            <Text style={styles.emptyText}>No transactions found</Text>
            <Text style={styles.emptySubtext}>
              {filter === 'all'
                ? 'Your transaction history will appear here'
                : `No ${filter === 'credit' ? 'credit' : 'withdrawal'} transactions yet`}
            </Text>
          </View>
        ) : (
          <View style={styles.listCard}>
            {grouped.map(([date, txs]) => (
              <View key={date}>
                <View style={styles.dateHeader}>
                  <Text style={styles.dateHeaderText}>{date}</Text>
                </View>
                {txs.map((tx, idx) => {
                  const isCredit = tx.type === 'credit';
                  return (
                    <View key={tx._id || idx} style={styles.txRow}>
                      <View style={[styles.txIcon, isCredit ? styles.txIconCredit : styles.txIconDebit]}>
                        <Ionicons
                          name={isCredit ? 'arrow-down' : 'arrow-up'}
                          size={20}
                          color={isCredit ? '#059669' : '#dc2626'}
                        />
                      </View>
                      <View style={styles.txInfo}>
                        <Text style={styles.txDesc} numberOfLines={1}>
                          {tx.description || (isCredit ? 'Amount Credited' : 'Amount Withdrawn')}
                        </Text>
                        <Text style={styles.txTime}>{formatTime(tx.createdAt)}</Text>
                      </View>
                      <View style={styles.txAmountWrap}>
                        <Text style={[styles.txAmount, isCredit ? styles.txAmountCredit : styles.txAmountDebit]}>
                          {isCredit ? '+' : '-'}₹{formatAmount(tx.amount)}
                        </Text>
                        <Text style={[styles.txType, isCredit ? styles.txTypeCredit : styles.txTypeDebit]}>
                          {isCredit ? 'Credit' : 'Debit'}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backBtn: { padding: 8, marginRight: 4 },
  title: { flex: 1, fontSize: 20, fontWeight: '700', color: '#1f2937' },
  refreshBtn: { padding: 8, minWidth: 40, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  balanceCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    padding: 20,
    marginBottom: 16,
  },
  balanceLabel: { fontSize: 12, color: '#6b7280', fontWeight: '600', marginBottom: 4, textTransform: 'uppercase' },
  balanceValue: { fontSize: 28, fontWeight: '800', color: '#1B3150', marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statBoxCredit: {
    flex: 1,
    backgroundColor: '#ecfdf5',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#a7f3d0',
    padding: 12,
  },
  statBoxDebit: {
    flex: 1,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fecaca',
    padding: 12,
  },
  statLabelCredit: { fontSize: 10, color: '#059669', fontWeight: '700', marginBottom: 4, textTransform: 'uppercase' },
  statLabelDebit: { fontSize: 10, color: '#dc2626', fontWeight: '700', marginBottom: 4, textTransform: 'uppercase' },
  statValueCredit: { fontSize: 16, fontWeight: '700', color: '#059669' },
  statValueDebit: { fontSize: 16, fontWeight: '700', color: '#dc2626' },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  filterChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  filterChipActive: { borderColor: '#1B3150', backgroundColor: '#f0f4f8' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  filterChipTextActive: { color: '#1B3150' },
  filterCount: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  filterCountActive: { backgroundColor: '#1B3150' },
  filterCountText: { fontSize: 11, fontWeight: '700', color: '#4b5563' },
  filterCountTextActive: { color: '#fff' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 12, textTransform: 'uppercase' },
  listCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  dateHeader: { backgroundColor: '#f9fafb', paddingHorizontal: 16, paddingVertical: 8 },
  dateHeaderText: { fontSize: 11, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase' },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  txIconCredit: { backgroundColor: '#d1fae5', borderWidth: 2, borderColor: '#a7f3d0' },
  txIconDebit: { backgroundColor: '#fee2e2', borderWidth: 2, borderColor: '#fecaca' },
  txInfo: { flex: 1, minWidth: 0 },
  txDesc: { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  txTime: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  txAmountWrap: { alignItems: 'flex-end' },
  txAmount: { fontSize: 14, fontWeight: '700' },
  txAmountCredit: { color: '#059669' },
  txAmountDebit: { color: '#dc2626' },
  txType: { fontSize: 10, fontWeight: '600', marginTop: 2, textTransform: 'uppercase' },
  txTypeCredit: { color: '#059669' },
  txTypeDebit: { color: '#dc2626' },
  centered: { padding: 24, alignItems: 'center', justifyContent: 'center' },
  emptyBox: { alignItems: 'center', padding: 32 },
  emptyText: { fontSize: 14, fontWeight: '600', color: '#6b7280', marginTop: 12 },
  emptySubtext: { fontSize: 12, color: '#9ca3af', marginTop: 4, textAlign: 'center' },
});
