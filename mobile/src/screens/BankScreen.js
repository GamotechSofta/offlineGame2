import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getBalance, getMyWalletTransactions } from '../api/bets';
import { useAuth } from '../context/AuthContext';

const formatMoney = (v) => (Number.isFinite(Number(v)) ? Number(v).toFixed(2) : '0.00');
const formatINR = (v) => `₹${formatMoney(v)}`;

export default function BankScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [balance, setBalance] = useState(0);
  const [balanceOk, setBalanceOk] = useState(false);
  const [txs, setTxs] = useState([]);

  const isLoggedIn = !!(user?.id || user?._id);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [b, t] = await Promise.all([getBalance(), getMyWalletTransactions(500)]);
        if (!alive) return;
        if (b?.success && b?.data?.balance != null) {
          setBalance(Number(b.data.balance));
          setBalanceOk(true);
        } else setBalanceOk(false);
        if (t?.success && Array.isArray(t?.data)) setTxs(t.data);
        if (!t?.success && t?.message) setError(t.message);
      } catch (e) {
        if (!alive) return;
        setError(e?.message || 'Failed to load');
      } finally {
        if (alive) setLoading(false);
      }
    };
    if (isLoggedIn) load();
    else setLoading(false);
    return () => { alive = false; };
  }, [isLoggedIn]);

  const formatTime = (iso) => {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '-';
      return d.toLocaleDateString('en-GB') + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch { return '-'; }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.8}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Transaction History</Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {!isLoggedIn ? (
          <View style={styles.card}>
            <Text style={styles.cardText}>Please login to see your transaction history.</Text>
          </View>
        ) : loading ? (
          <View style={styles.card}>
            <ActivityIndicator color="#4b5563" />
            <Text style={styles.cardText}>Loading...</Text>
          </View>
        ) : error ? (
          <View style={[styles.card, styles.cardError]}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : txs.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardText}>No transactions found.</Text>
          </View>
        ) : (
          txs.slice(0, 50).map((tx) => (
            <View key={tx._id || tx.id || tx.createdAt} style={styles.txCard}>
              <View style={styles.txRow}>
                <Text style={[styles.txType, tx.type === 'credit' ? styles.credit : styles.debit]}>
                  {tx.type === 'credit' ? 'Credit' : 'Debit'} {formatINR(tx.amount)}
                </Text>
                <Text style={styles.txTime}>{formatTime(tx.createdAt)}</Text>
              </View>
              <Text style={styles.txDesc} numberOfLines={2}>{tx.description || '-'}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#f3f4f6' },
  backBtn: { padding: 8, marginRight: 8 },
  backIcon: { fontSize: 22, color: '#1f2937' },
  title: { fontSize: 20, fontWeight: '600', color: '#1B3150' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  card: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 2, borderColor: '#e5e7eb', padding: 24, alignItems: 'center' },
  cardError: { borderColor: '#fca5a5', backgroundColor: '#fef2f2' },
  cardText: { color: '#6b7280', marginTop: 8 },
  errorText: { color: '#dc2626' },
  txCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 2, borderColor: '#e5e7eb', padding: 16, marginBottom: 12 },
  txRow: { flexDirection: 'row', justifyContent: 'space-between' },
  txType: { fontWeight: '600', fontSize: 14 },
  credit: { color: '#16a34a' },
  debit: { color: '#dc2626' },
  txTime: { fontSize: 12, color: '#6b7280' },
  txDesc: { marginTop: 8, fontSize: 12, color: '#4b5563' },
});
