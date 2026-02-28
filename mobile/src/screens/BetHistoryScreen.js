import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { getBetHistory, getMarkets, getRatesCurrent } from '../api/bets';

const BOTTOM_NAV_HEIGHT = 88;
const PAGE_SIZE = 10;

const formatTxnTime = (iso) => {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    const date = d.toLocaleDateString('en-GB').replace(/\//g, '-');
    const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${date} ${time}`;
  } catch {
    return '-';
  }
};

const sumDigits = (str) => [...String(str)].reduce((acc, c) => acc + (Number(c) || 0), 0);
const lastDigit = (str) => sumDigits(str) % 10;
const normalizeMarketName = (s) => (s || '').toString().trim().toLowerCase();

const inferBetKind = (betNumberRaw) => {
  const s = (betNumberRaw ?? '').toString().trim();
  if (!s) return 'unknown';
  if (s.includes('-')) {
    const [a, b] = s.split('-').map((x) => (x || '').trim());
    if (/^\d{3}$/.test(a) && /^\d{3}$/.test(b)) return 'full-sangam';
    if (/^\d{3}$/.test(a) && /^\d$/.test(b)) return 'half-sangam-open';
    if (/^\d$/.test(a) && /^\d{3}$/.test(b)) return 'half-sangam-close';
    return 'unknown';
  }
  if (/^\d$/.test(s)) return 'digit';
  if (/^\d{2}$/.test(s)) return 'jodi';
  if (/^\d{3}$/.test(s)) return 'panna';
  return 'unknown';
};

const DEFAULT_RATES = { single: 10, jodi: 100, singlePatti: 150, doublePatti: 300, triplePatti: 1000, halfSangam: 5000, fullSangam: 10000 };
const rateNum = (val, def) => (Number.isFinite(Number(val)) && Number(val) >= 0 ? Number(val) : def);

const getPayoutMultiplier = (kind, betNumberRaw, ratesMap) => {
  const r = ratesMap && typeof ratesMap === 'object' ? ratesMap : DEFAULT_RATES;
  if (kind === 'digit') return rateNum(r.single, DEFAULT_RATES.single);
  if (kind === 'jodi') return rateNum(r.jodi, DEFAULT_RATES.jodi);
  if (kind === 'half-sangam-open' || kind === 'half-sangam-close') return rateNum(r.halfSangam, DEFAULT_RATES.halfSangam);
  if (kind === 'full-sangam') return rateNum(r.fullSangam, DEFAULT_RATES.fullSangam);
  if (kind === 'panna') {
    const s = (betNumberRaw ?? '').toString().trim();
    if (/^\d{3}$/.test(s)) {
      const a = s[0], b = s[1], c = s[2];
      const allSame = a === b && b === c;
      const twoSame = a === b || b === c || a === c;
      if (allSame) return rateNum(r.triplePatti, DEFAULT_RATES.triplePatti);
      if (twoSame) return rateNum(r.doublePatti, DEFAULT_RATES.doublePatti);
      return rateNum(r.singlePatti, DEFAULT_RATES.singlePatti);
    }
  }
  return 0;
};

const evaluateBet = ({ market, betNumberRaw, amount, session, ratesMap }) => {
  const opening = market?.openingNumber && /^\d{3}$/.test(String(market.openingNumber)) ? String(market.openingNumber) : null;
  const closing = market?.closingNumber && /^\d{3}$/.test(String(market.closingNumber)) ? String(market.closingNumber) : null;
  const openDigit = opening ? String(lastDigit(opening)) : null;
  const closeDigit = closing ? String(lastDigit(closing)) : null;
  const jodi = openDigit != null && closeDigit != null ? `${openDigit}${closeDigit}` : null;
  const betNumber = (betNumberRaw ?? '').toString().trim();
  const kind = inferBetKind(betNumber);
  const sess = (session || '').toString().trim().toUpperCase();
  const declared =
    kind === 'digit'
      ? (sess === 'OPEN' ? !!openDigit : sess === 'CLOSE' ? !!closeDigit : !!(openDigit && closeDigit))
      : kind === 'panna'
        ? (sess === 'OPEN' ? !!opening : sess === 'CLOSE' ? !!closing : !!(opening && closing))
        : kind === 'jodi'
          ? !!jodi
          : kind === 'half-sangam-open'
            ? !!(opening && openDigit)
            : kind === 'half-sangam-close' || kind === 'full-sangam'
              ? !!(opening && closing)
              : false;
  if (!declared) return { state: 'pending', kind, payout: 0 };
  let won = false;
  if (kind === 'digit') {
    if (sess === 'OPEN') won = betNumber === openDigit;
    else if (sess === 'CLOSE') won = betNumber === closeDigit;
    else won = betNumber === openDigit || betNumber === closeDigit;
  } else if (kind === 'jodi') won = betNumber === jodi;
  else if (kind === 'panna') {
    if (sess === 'OPEN') won = betNumber === opening;
    else if (sess === 'CLOSE') won = betNumber === closing;
    else won = betNumber === opening || betNumber === closing;
  } else if (kind === 'full-sangam') won = betNumber === `${opening}-${closing}`;
  else if (kind === 'half-sangam-open') won = betNumber === `${opening}-${openDigit}`;
  else if (kind === 'half-sangam-close') won = betNumber === `${openDigit}-${closing}`;
  if (!won) return { state: 'lost', kind, payout: 0 };
  const mul = getPayoutMultiplier(kind, betNumber, ratesMap);
  const payout = mul > 0 ? (Number(amount) || 0) * mul : 0;
  return { state: 'won', kind, payout };
};

export default function BetHistoryScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [rawList, setRawList] = useState([]);
  const [markets, setMarkets] = useState([]);
  const [ratesMap, setRatesMap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedSessions, setSelectedSessions] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedMarkets, setSelectedMarkets] = useState([]);
  const [draftSessions, setDraftSessions] = useState([]);
  const [draftStatuses, setDraftStatuses] = useState([]);
  const [draftMarkets, setDraftMarkets] = useState([]);
  const [page, setPage] = useState(1);

  const userId = user?._id || user?.id || null;

  const loadHistory = useCallback(async () => {
    if (!userId) {
      setRawList([]);
      setMarkets([]);
      setRatesMap(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [historyRes, marketsRes, ratesRes] = await Promise.all([
        getBetHistory(),
        getMarkets(),
        getRatesCurrent(),
      ]);
      if (historyRes.success && Array.isArray(historyRes.data)) setRawList(historyRes.data);
      else setRawList([]);
      if (marketsRes.success && Array.isArray(marketsRes.data)) setMarkets(marketsRes.data);
      else setMarkets([]);
      if (ratesRes?.success && ratesRes?.data) setRatesMap(ratesRes.data);
      else setRatesMap(null);
    } catch {
      setRawList([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  const betTypeToLabel = (t) => {
    const s = (t || '').toString().toLowerCase();
    if (s === 'single') return 'Single Ank';
    if (s === 'jodi') return 'Jodi';
    if (s === 'panna' || s === 'pana') return 'Pana';
    if (s === 'half-sangam') return 'Half Sangam';
    if (s === 'full-sangam') return 'Full Sangam';
    return t || 'Bet';
  };

  const flat = useMemo(() => {
    const list = Array.isArray(rawList) ? rawList : [];
    return list.map((bet) => {
      const marketId = bet?.marketId;
      const marketName = typeof marketId === 'object' ? (marketId?.marketName || '') : (marketId || '');
      const marketTitle = (marketName || 'MARKET').toString().trim();
      const betOn = (bet?.betOn || 'open').toString().toLowerCase();
      const session = betOn === 'close' ? 'CLOSE' : 'OPEN';
      return {
        x: bet,
        r: bet,
        idx: bet?._id,
        session,
        marketTitle,
        points: Number(bet?.amount || 0) || 0,
        gameType: betTypeToLabel(bet?.betType),
        betNumber: (bet?.betNumber != null && bet?.betNumber !== '') ? String(bet.betNumber) : '-',
        createdAt: bet?.createdAt,
      };
    });
  }, [rawList]);

  const marketByName = useMemo(() => {
    const map = new Map();
    (markets || []).forEach((m) => {
      const k = normalizeMarketName(m?.marketName || m?.gameName || '');
      if (k) map.set(k, m);
    });
    return map;
  }, [markets]);

  const enriched = useMemo(() => {
    return flat.map((row) => {
      const market = marketByName.get(normalizeMarketName(row.marketTitle));
      const computed = evaluateBet({
        market,
        betNumberRaw: row.betNumber === '-' ? '' : row.betNumber,
        amount: row.points,
        session: row.session,
        ratesMap,
      });
      return { ...row, verdict: computed };
    });
  }, [flat, marketByName, ratesMap]);

  const marketOptions = useMemo(() => {
    const names = [...new Set(enriched.map((row) => normalizeMarketName(row.marketTitle)).filter(Boolean))];
    names.sort((a, b) => a.localeCompare(b));
    return names.map((key) => ({ key, label: key.toUpperCase() }));
  }, [enriched]);

  const filtered = useMemo(() => {
    return enriched.filter((row) => {
      if (selectedSessions.length > 0 && !selectedSessions.includes(row.session)) return false;
      if (selectedMarkets.length > 0 && !selectedMarkets.includes(normalizeMarketName(row.marketTitle))) return false;
      if (selectedStatuses.length > 0) {
        const st = row.verdict.state === 'won' ? 'Win' : row.verdict.state === 'lost' ? 'Loose' : 'Pending';
        if (!selectedStatuses.includes(st)) return false;
      }
      return true;
    });
  }, [enriched, selectedSessions, selectedMarkets, selectedStatuses]);

  useEffect(() => {
    setPage(1);
  }, [selectedSessions, selectedStatuses, selectedMarkets, enriched.length]);

  const totalPages = Math.max(1, Math.ceil((filtered?.length || 0) / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const paged = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return (filtered || []).slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);
  const hasPagination = (filtered?.length || 0) > PAGE_SIZE;
  const contentBottomPadding = hasPagination ? 24 + 56 + BOTTOM_NAV_HEIGHT + insets.bottom : 24 + BOTTOM_NAV_HEIGHT + insets.bottom;

  useEffect(() => {
    if (!isFilterOpen) return;
    setDraftSessions(selectedSessions);
    setDraftStatuses(selectedStatuses);
    setDraftMarkets(selectedMarkets);
  }, [isFilterOpen, selectedSessions, selectedStatuses, selectedMarkets]);

  const toggleDraft = (arr, value, setArr) => {
    setArr((prev) => (prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]));
  };

  const applyFilter = () => {
    setSelectedSessions(draftSessions);
    setSelectedStatuses(draftStatuses);
    setSelectedMarkets(draftMarkets);
    setPage(1);
    setIsFilterOpen(false);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={24} color="#1f2937" />
          </TouchableOpacity>
          <Text style={styles.title}>Bet History</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1B3150" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={24} color="#1f2937" />
          </TouchableOpacity>
          <Text style={styles.title}>Bet History</Text>
        </View>
        <TouchableOpacity onPress={() => setIsFilterOpen(true)} style={styles.filterBtn} activeOpacity={0.8}>
          <Text style={styles.filterText}>Filter By</Text>
          <Ionicons name="filter" size={22} color="#1B3150" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: contentBottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {!userId ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Please login to see your bet history.</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No bets found.</Text>
          </View>
        ) : (
          paged.map((row) => {
            const { x, r, idx, session, marketTitle, points, gameType, betNumber, verdict } = row;
            const statusText =
              verdict.state === 'won'
                ? `Congratulations, You Won ${verdict.payout ? `₹${Number(verdict.payout).toLocaleString('en-IN')}` : ''}`
                : verdict.state === 'lost'
                  ? 'Better Luck Next time'
                  : 'Bet Placed';
            const statusStyle = verdict.state === 'won' ? styles.statusWon : verdict.state === 'lost' ? styles.statusLost : styles.statusText;
            return (
              <View key={`${x?.id}-${r?.id ?? idx}`} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardHeaderText}>
                    {marketTitle.toUpperCase()} {session ? `(${session})` : ''}
                  </Text>
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.tableRow}>
                    <Text style={styles.tableLabel}>Game Type</Text>
                    <Text style={styles.tableLabel}>Pana</Text>
                    <Text style={styles.tableLabel}>Points</Text>
                  </View>
                  <View style={styles.tableRow}>
                    <Text style={styles.tableValue}>{gameType}</Text>
                    <Text style={styles.tableValueBold}>{betNumber}</Text>
                    <Text style={styles.tableValueBold}>{points}</Text>
                  </View>
                </View>
                <View style={styles.divider} />
                <View style={styles.txnRow}>
                  <Text style={styles.txnText}>
                    Transaction: <Text style={styles.txnTime}>{formatTxnTime(x?.createdAt)}</Text>
                  </Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.statusRow}>
                  <Text style={statusStyle}>{statusText}</Text>
                </View>
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

      <Modal visible={isFilterOpen} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setIsFilterOpen(false)}>
          <Pressable style={styles.filterModal} onPress={(e) => e.stopPropagation()}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>Filter Type</Text>
            </View>
            <ScrollView style={styles.filterScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.filterSectionTitle}>By Game Type</Text>
              <View style={styles.filterRow}>
                {['OPEN', 'CLOSE'].map((s) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => toggleDraft(draftSessions, s, setDraftSessions)}
                    style={[styles.filterChip, draftSessions.includes(s) && styles.filterChipActive]}
                  >
                    <Text style={[styles.filterChipText, draftSessions.includes(s) && styles.filterChipTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.filterDivider} />
              <Text style={styles.filterSectionTitle}>By Winning Status</Text>
              <View style={styles.filterRow}>
                {['Win', 'Loose', 'Pending'].map((s) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => toggleDraft(draftStatuses, s, setDraftStatuses)}
                    style={[styles.filterChip, draftStatuses.includes(s) && styles.filterChipActive]}
                  >
                    <Text style={[styles.filterChipText, draftStatuses.includes(s) && styles.filterChipTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.filterDivider} />
              <Text style={styles.filterSectionTitle}>By Games</Text>
              {marketOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => toggleDraft(draftMarkets, opt.key, setDraftMarkets)}
                  style={[styles.filterMarketRow, draftMarkets.includes(opt.key) && styles.filterMarketRowActive]}
                >
                  <Text style={styles.filterMarketText}>{opt.label}</Text>
                  {draftMarkets.includes(opt.key) && <Ionicons name="checkmark-circle" size={22} color="#1B3150" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.filterActions}>
              <TouchableOpacity onPress={() => setIsFilterOpen(false)} style={styles.filterCancelBtn} activeOpacity={0.9}>
                <Text style={styles.filterCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={applyFilter} style={styles.filterApplyBtn} activeOpacity={0.9}>
                <Text style={styles.filterApplyText}>Filter</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', minWidth: 0, flex: 1 },
  backBtn: { padding: 8, marginRight: 4 },
  title: { fontSize: 20, fontWeight: '700', color: '#1f2937' },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterText: { fontSize: 14, fontWeight: '600', color: '#1B3150' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingTop: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14, color: '#6b7280' },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#d1d5db',
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  emptyText: { fontSize: 14, color: '#6b7280' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#d1d5db',
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    backgroundColor: '#f9fafb',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
  },
  cardHeaderText: { fontSize: 14, fontWeight: '800', color: '#1B3150', textAlign: 'center', letterSpacing: 0.5 },
  cardBody: { paddingHorizontal: 16, paddingVertical: 12 },
  tableRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  tableLabel: { fontSize: 12, fontWeight: '700', color: '#1B3150' },
  tableValue: { fontSize: 14, fontWeight: '600', color: '#374151' },
  tableValueBold: { fontSize: 14, fontWeight: '800', color: '#1f2937' },
  divider: { height: 1, backgroundColor: '#e5e7eb', marginHorizontal: 16 },
  txnRow: { paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  txnText: { fontSize: 12, color: '#6b7280' },
  txnTime: { fontWeight: '600', color: '#1f2937' },
  statusRow: { paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  statusText: { fontSize: 14, fontWeight: '600', color: '#16a34a' },
  statusWon: { fontSize: 14, fontWeight: '600', color: '#16a34a' },
  statusLost: { fontSize: 14, fontWeight: '600', color: '#dc2626' },
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  filterModal: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    maxHeight: '80%',
  },
  filterModalHeader: { backgroundColor: '#1B3150', paddingVertical: 16, alignItems: 'center' },
  filterModalTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  filterScroll: { maxHeight: 320, paddingHorizontal: 20, paddingTop: 16 },
  filterSectionTitle: { fontSize: 16, fontWeight: '700', color: '#1B3150', marginBottom: 12 },
  filterRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  filterChip: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  filterChipActive: { borderColor: '#1B3150', backgroundColor: '#f0f4f8' },
  filterChipText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  filterChipTextActive: { color: '#1B3150' },
  filterDivider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 12 },
  filterMarketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    padding: 14,
    marginBottom: 8,
  },
  filterMarketRowActive: { borderColor: '#1B3150' },
  filterMarketText: { fontSize: 13, fontWeight: '600', color: '#1f2937' },
  filterActions: { flexDirection: 'row', gap: 16, padding: 20, paddingTop: 12 },
  filterCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  filterCancelText: { fontSize: 16, fontWeight: '700', color: '#374151' },
  filterApplyBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: '#1B3150',
    alignItems: 'center',
  },
  filterApplyText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
