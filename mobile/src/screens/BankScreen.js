import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getBalance, getMyWalletTransactions } from '../api/bets';
import { useAuth } from '../context/AuthContext';

const BOTTOM_NAV_HEIGHT = 88;
const PAGE_SIZE = 10;

const formatMoney = (v) => (Number.isFinite(Number(v)) ? Number(v).toFixed(2) : '0.00');
const formatINR = (v) => `₹${formatMoney(v)}`;

const formatTime = (iso) => {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    const date = d.toLocaleDateString('en-GB').replace(/\//g, '-');
    const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${date} ${String(time).toUpperCase()}`;
  } catch {
    return '-';
  }
};

const humanBetType = (betType) => {
  const t = (betType || '').toString().toLowerCase();
  if (t === 'single') return 'Single Ank';
  if (t === 'jodi') return 'Digit';
  if (t === 'panna') return 'Panna';
  if (t === 'half-sangam') return 'Half Sangam';
  if (t === 'full-sangam') return 'Full Sangam';
  return '-';
};

const inferSession = (betType) => {
  const t = (betType || '').toString().toLowerCase();
  if (t === 'single' || t === 'panna') return 'open';
  if (t) return 'close';
  return '-';
};

const parseDesc = (desc) => {
  const s = (desc || '').toString().trim();
  if (!s) return null;
  const win = s.match(/^Win\s*–\s*(.+?)\s*\((.+)\)\s*$/i);
  if (win) {
    const marketName = (win[1] || '').trim();
    const inner = (win[2] || '').trim();
    const parts = inner.split(/\s+/);
    const kindRaw = (parts[0] || '').trim();
    const number = parts.slice(1).join(' ').trim();
    const kind =
      kindRaw.toLowerCase() === 'single'
        ? 'Single Ank'
        : kindRaw.toLowerCase() === 'jodi'
          ? 'Digit'
          : kindRaw.toLowerCase() === 'panna'
            ? 'Panna'
            : inner.toLowerCase().includes('half')
              ? 'Half Sangam'
              : inner.toLowerCase().includes('full')
                ? 'Full Sangam'
                : inner;
    const betType =
      kindRaw.toLowerCase() === 'single'
        ? 'single'
        : kindRaw.toLowerCase() === 'jodi'
          ? 'jodi'
          : kindRaw.toLowerCase() === 'panna'
            ? 'panna'
            : inner.toLowerCase().includes('half')
              ? 'half-sangam'
              : inner.toLowerCase().includes('full')
                ? 'full-sangam'
                : '';
    return {
      bidPlay: number || '-',
      game: marketName || '-',
      type: kind || '-',
      market: inferSession(betType) || '-',
    };
  }
  const placed = s.match(/^Bet\s*placed\s*–\s*(.+?)\s*\((\d+)\s*bet/i);
  if (placed) {
    const marketName = (placed[1] || '').trim();
    const count = Number(placed[2] || 0) || 0;
    return {
      bidPlay: count > 1 ? `${count} Bets` : '1 Bet',
      game: marketName || '-',
      type: 'Bet Placed',
      market: '-',
    };
  }
  return { bidPlay: '-', game: '-', type: '-', market: '-', raw: s };
};

export default function BankScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [balance, setBalance] = useState(0);
  const [balanceOk, setBalanceOk] = useState(false);
  const [txs, setTxs] = useState([]);
  const [page, setPage] = useState(1);

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

  const computed = useMemo(() => {
    let running = Number(balance) || 0;
    return (txs || []).map((tx) => {
      const amt = Number(tx?.amount || 0) || 0;
      const type = (tx?.type || '').toString().toLowerCase();
      const currentBalance = balanceOk ? running : null;
      const previousBalance = balanceOk
        ? (type === 'debit' ? currentBalance + amt : currentBalance - amt)
        : null;
      const transactionAmount = type === 'debit' ? -amt : amt;
      if (balanceOk) running = previousBalance;
      return {
        id: tx?._id || tx?.id || `${tx?.createdAt || ''}-${type}-${amt}`,
        type: type === 'credit' ? 'Credit' : 'Debit',
        amount: amt,
        time: formatTime(tx?.createdAt),
        description: (tx?.description || '').toString(),
        bet: tx?.bet || null,
        previousBalance,
        transactionAmount,
        currentBalance,
      };
    });
  }, [txs, balance, balanceOk]);

  const totalPages = Math.max(1, Math.ceil((computed.length || 0) / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const visible = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return computed.slice(start, start + PAGE_SIZE);
  }, [computed, currentPage]);
  const hasPagination = computed.length > PAGE_SIZE;
  const contentBottomPadding = hasPagination ? 24 + 56 + BOTTOM_NAV_HEIGHT + insets.bottom : 24 + BOTTOM_NAV_HEIGHT + insets.bottom;

  useEffect(() => {
    setPage(1);
  }, [computed.length]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.title}>Transaction History</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: contentBottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {!isLoggedIn ? (
          <View style={styles.card}>
            <Text style={styles.cardText}>Please login to see your transaction history.</Text>
          </View>
        ) : loading ? (
          <View style={styles.card}>
            <ActivityIndicator color="#1B3150" />
            <Text style={styles.cardText}>Loading...</Text>
          </View>
        ) : error ? (
          <View style={[styles.card, styles.cardError]}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : visible.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardText}>No transactions found.</Text>
          </View>
        ) : (
          visible.map((tx) => {
            const betTypeRaw = tx?.bet?.betType || '';
            const betNumber = (tx?.bet?.betNumber || '').toString().trim();
            const marketName = (tx?.bet?.marketName || '').toString().trim();
            const parsed = parseDesc(tx.description);
            const bidPlay = betNumber || parsed?.bidPlay || '-';
            const game = marketName || parsed?.game || '-';
            const typeLabel = humanBetType(betTypeRaw) || parsed?.type || '-';
            const marketLabel = inferSession(betTypeRaw) || parsed?.market || '-';

            return (
              <View key={tx.id} style={styles.txCard}>
                <View style={styles.txTop}>
                  <Text style={[styles.txType, tx.type === 'Credit' ? styles.credit : styles.debit]}>
                    {tx.type} {formatINR(tx.amount)}
                  </Text>
                  <Text style={styles.txTime}>{tx.time}</Text>
                </View>
                <View style={styles.txGrid}>
                  <View style={styles.txGridItem}>
                    <Text style={styles.txGridLabel}>Bid Play</Text>
                    <Text style={styles.txGridValue}>{bidPlay}</Text>
                  </View>
                  <View style={styles.txGridItem}>
                    <Text style={styles.txGridLabel}>Game</Text>
                    <Text style={styles.txGridValue} numberOfLines={2}>{(game || '-').toUpperCase()}</Text>
                  </View>
                  <View style={styles.txGridItem}>
                    <Text style={styles.txGridLabel}>Type</Text>
                    <Text style={styles.txGridValue}>{typeLabel}</Text>
                  </View>
                  <View style={styles.txGridItem}>
                    <Text style={styles.txGridLabel}>Market</Text>
                    <Text style={styles.txGridValue}>{marketLabel}</Text>
                  </View>
                </View>
                <View style={styles.txDivider} />
                <View style={styles.txGrid}>
                  <View style={styles.txGridItem}>
                    <Text style={styles.txGridLabelSmall}>Previous Balance</Text>
                    <Text style={styles.txGridValue}>
                      {tx.previousBalance == null ? '—' : formatINR(tx.previousBalance)}
                    </Text>
                  </View>
                  <View style={styles.txGridItem}>
                    <Text style={styles.txGridLabelSmall}>Transaction Amount</Text>
                    <Text style={[styles.txGridValue, tx.transactionAmount >= 0 ? styles.credit : styles.debit]}>
                      {tx.transactionAmount >= 0 ? '+' : '-'}{formatINR(Math.abs(tx.transactionAmount))}
                    </Text>
                  </View>
                </View>
                {tx.currentBalance != null ? (
                  <View style={styles.txCurrent}>
                    <Text style={styles.txCurrentText}>Current Balance : {formatMoney(tx.currentBalance)} ₹</Text>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>

      {hasPagination && (
        <View style={[styles.pagination, { bottom: BOTTOM_NAV_HEIGHT + insets.bottom + 12 }]}>
          <TouchableOpacity
            onPress={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            style={[styles.pagBtn, currentPage <= 1 && styles.pagBtnDisabled]}
          >
            <Text style={styles.pagBtnText}>‹ PREV</Text>
          </TouchableOpacity>
          <View style={styles.pageNum}>
            <Text style={styles.pageNumText}>{currentPage}</Text>
          </View>
          <TouchableOpacity
            onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            style={[styles.pagBtn, currentPage >= totalPages && styles.pagBtnDisabled]}
          >
            <Text style={styles.pagBtnText}>NEXT ›</Text>
          </TouchableOpacity>
        </View>
      )}
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
  title: { fontSize: 20, fontWeight: '600', color: '#1B3150' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingTop: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    padding: 24,
    alignItems: 'center',
  },
  cardError: { borderColor: '#fca5a5', backgroundColor: '#fef2f2' },
  cardText: { color: '#6b7280', marginTop: 8, fontSize: 14 },
  errorText: { color: '#dc2626', fontSize: 14 },
  txCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    padding: 16,
    marginBottom: 12,
  },
  txTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  txType: { fontSize: 14, fontWeight: '600' },
  credit: { color: '#16a34a' },
  debit: { color: '#dc2626' },
  txTime: { fontSize: 12, color: '#6b7280' },
  txGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16, gap: 16 },
  txGridItem: { flex: 1, minWidth: '45%' },
  txGridLabel: { fontSize: 12, fontWeight: '800', color: '#1B3150', marginBottom: 4 },
  txGridLabelSmall: { fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 4 },
  txGridValue: { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  txDivider: { height: 1, backgroundColor: '#f3f4f6', marginVertical: 12 },
  txCurrent: { borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 12, alignItems: 'center' },
  txCurrentText: { fontSize: 16, fontWeight: '800', color: '#1B3150' },
  pagination: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    paddingVertical: 10,
    paddingHorizontal: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  pagBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  pagBtnDisabled: { opacity: 0.4 },
  pagBtnText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  pageNum: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1B3150',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageNumText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
