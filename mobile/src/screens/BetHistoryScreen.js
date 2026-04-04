import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Clipboard,
  FlatList,
  Platform,
  RefreshControl,
  Pressable,
  useWindowDimensions,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useSetInnerNavRef } from '../navigation/InnerStackNavContext';
import { getBetHistory, getRatesCurrent, getMarkets } from '../api/bets';
import { useRefreshOnMarketReset } from '../hooks/useRefreshOnMarketReset';
import { SkeletonCardGrid } from '../components/Skeleton';
import { hapticLight } from '../utils/haptics';
import FadeInView from '../components/FadeInView';
import AnimatedPressable from '../components/AnimatedPressable';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ─── Theme (light mode) ─── */
const colors = {
  background: '#f3f4f6',
  surface: '#ffffff',
  text: '#1f2937',
  textSecondary: '#6b7280',
  primary: '#1B3150',
  border: '#e5e7eb',
};
const spacing = { 2: 8, 3: 12, 4: 16, 5: 20, 6: 24 };
const borderRadius = { lg: 12, xl: 16, '2xl': 20 };
const fontSize = { xs: 11, sm: 13, base: 15, lg: 17, xl: 20 };

/* Responsive helpers */
const wp = (pct, width) => Math.round((width * pct) / 100);
const hp = (pct, height) => Math.round((height * pct) / 100);
const rs = (size, width) => {
  const scale = width < 360 ? 0.85 : width < 600 ? 1 : Math.min(1.2, 0.8 + width / 1500);
  return Math.round(size * scale);
};

/* ─── Helpers ─── */
const txnDateFormatter = new Intl.DateTimeFormat('en-GB');
const txnTimeFormatter = new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' });

const formatTxnTime = (iso) => {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    const date = txnDateFormatter.format(d).replace(/\//g, '-');
    const time = txnTimeFormatter.format(d);
    return `${date} ${time}`;
  } catch {
    return '-';
  }
};

const formatScheduledDate = (scheduledDate) => {
  if (!scheduledDate) return null;
  try {
    const d = typeof scheduledDate === 'string' ? new Date(scheduledDate) : scheduledDate;
    if (Number.isNaN(d?.getTime())) return null;
    return txnDateFormatter.format(d).replace(/\//g, '/');
  } catch {
    return null;
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

const DEFAULT_RATES = {
  single: 10,
  jodi: 100,
  singlePatti: 150,
  doublePatti: 300,
  triplePatti: 1000,
  halfSangam: 5000,
  fullSangam: 10000,
};
const rateNum = (val, def) => (Number.isFinite(Number(val)) && Number(val) >= 0 ? Number(val) : def);
const getPayoutMultiplier = (kind, betNumberRaw, ratesMap) => {
  const r = ratesMap && typeof ratesMap === 'object' ? ratesMap : DEFAULT_RATES;
  if (kind === 'digit') return rateNum(r.single, DEFAULT_RATES.single);
  if (kind === 'jodi') return rateNum(r.jodi, DEFAULT_RATES.jodi);
  if (kind === 'half-sangam-open' || kind === 'half-sangam-close')
    return rateNum(r.halfSangam, DEFAULT_RATES.halfSangam);
  if (kind === 'full-sangam') return rateNum(r.fullSangam, DEFAULT_RATES.fullSangam);
  if (kind === 'panna') {
    const s = (betNumberRaw ?? '').toString().trim();
    if (/^\d{3}$/.test(s)) {
      const a = s[0],
        b = s[1],
        c = s[2];
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
  const opening =
    market?.openingNumber && /^\d{3}$/.test(String(market.openingNumber))
      ? String(market.openingNumber)
      : null;
  const closing =
    market?.closingNumber && /^\d{3}$/.test(String(market.closingNumber))
      ? String(market.closingNumber)
      : null;
  const openDigit = opening ? String(lastDigit(opening)) : null;
  const closeDigit = closing ? String(lastDigit(closing)) : null;
  const jodi = openDigit != null && closeDigit != null ? `${openDigit}${closeDigit}` : null;
  const betNumber = (betNumberRaw ?? '').toString().trim();
  const kind = inferBetKind(betNumber);
  const sess = (session || '').toString().trim().toUpperCase();
  const declared =
    kind === 'digit'
      ? sess === 'OPEN'
        ? !!openDigit
        : sess === 'CLOSE'
          ? !!closeDigit
          : !!(openDigit && closeDigit)
      : kind === 'panna'
        ? sess === 'OPEN'
          ? !!opening
          : sess === 'CLOSE'
            ? !!closing
            : !!(opening && closing)
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
  } else if (kind === 'jodi') {
    won = betNumber === jodi;
  } else if (kind === 'panna') {
    if (sess === 'OPEN') won = betNumber === opening;
    else if (sess === 'CLOSE') won = betNumber === closing;
    else won = betNumber === opening || betNumber === closing;
  } else if (kind === 'full-sangam') {
    won = betNumber === `${opening}-${closing}`;
  } else if (kind === 'half-sangam-open') {
    won = betNumber === `${opening}-${openDigit}`;
  } else if (kind === 'half-sangam-close') {
    won = betNumber === `${openDigit}-${closing}`;
  }
  if (!won) return { state: 'lost', kind, payout: 0 };
  const mul = getPayoutMultiplier(kind, betNumber, ratesMap);
  const payout = mul > 0 ? (Number(amount) || 0) * mul : 0;
  return { state: 'won', kind, payout };
};

const labelForType = (betType) => {
  const s = String(betType || '').toLowerCase();
  if (s === 'single') return 'Single Ank';
  if (s === 'jodi') return 'Jodi';
  if (s === 'panna') return 'Panna';
  if (s === 'half-sangam' || s === 'half-sangam-open' || s === 'half-sangam-close') return 'Half Sangam';
  if (s === 'full-sangam') return 'Full Sangam';
  if (s === 'chart') return 'Chart Game';
  return betType || 'Bet';
};

const getStatusText = (verdict) => {
  if (verdict?.state === 'won') return 'Win';
  if (verdict?.state === 'lost') return 'Lost';
  if (verdict?.state === 'cancelled') return 'Cancelled';
  return 'Pending';
};

export default function BetHistoryScreen() {
  useSetInnerNavRef();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { user, loadUser } = useAuth();

  const isSmallScreen = width < 360;
  const isTablet = width >= 600;
  const numColumns = isSmallScreen && width < 320 ? 1 : isTablet ? 3 : 2;
  const cardGap = isSmallScreen ? 6 : 8;
  const cardPadding = isSmallScreen ? 8 : 12;
  const listPaddingBottom = 100 + insets.bottom;
  const displayTitle = 'Bet History';
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedSessions, setSelectedSessions] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedMarkets, setSelectedMarkets] = useState([]);
  const [markets, setMarkets] = useState([]);
  const [ratesMap, setRatesMap] = useState(null);
  const [apiBets, setApiBets] = useState([]);
  const [betsLoading, setBetsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copyToast, setCopyToast] = useState('');
  const [betsError, setBetsError] = useState('');

  const [draftSessions, setDraftSessions] = useState([]);
  const [draftStatuses, setDraftStatuses] = useState([]);
  const [draftMarkets, setDraftMarkets] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const userId = user?._id || user?.id || null;

  const fetchMarkets = useCallback(async () => {
    try {
      const result = await getMarkets();
      if (result?.success && Array.isArray(result?.data)) setMarkets(result.data);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchMarkets();
    const id = setInterval(fetchMarkets, 90000); // 90s to avoid rate limiting
    return () => clearInterval(id);
  }, [fetchMarkets]);

  useRefreshOnMarketReset(fetchMarkets);

  useEffect(() => {
    let alive = true;
    getRatesCurrent().then((result) => {
      if (!alive) return;
      if (result?.success && result?.data) setRatesMap(result.data);
    });
    return () => {
      alive = false;
    };
  }, []);

  const fetchBets = useCallback(async () => {
    setBetsError('');
    const result = await getBetHistory();
    if (result?.success && Array.isArray(result?.data)) {
      setApiBets(result.data);
      setBetsError('');
    } else {
      setApiBets([]);
      setBetsError(result?.message || 'Failed to load bet history');
    }
  }, []);

  const onRefreshBets = useCallback(() => {
    setRefreshing(true);
    fetchBets().finally(() => setRefreshing(false));
  }, [fetchBets]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadUser().then(() => {
        if (!alive) return;
        setBetsLoading(true);
        fetchBets().finally(() => {
          if (alive) setBetsLoading(false);
        });
      });
      const id = setInterval(fetchBets, 90000); // 90s to reduce API load
      return () => {
        alive = false;
        clearInterval(id);
      };
    }, [fetchBets, loadUser])
  );

  const flat = useMemo(() => {
    return (apiBets || []).map((bet) => ({
      bet,
      betId: bet._id,
      marketTitle: bet?.marketId?.marketName || bet?.marketId?.name || 'MARKET',
      betNumber: bet.betNumber,
      amount: bet.amount,
      session: (bet.betOn || '').toUpperCase() || 'OPEN',
      betType: bet.betType,
      status: bet.status,
      createdAt: bet.createdAt,
      marketData: bet.marketId,
    }));
  }, [apiBets]);

  const marketByName = useMemo(() => {
    const map = new Map();
    for (const m of markets || []) {
      const key = normalizeMarketName(m?.marketName || m?.gameName);
      if (key) map.set(key, m);
    }
    return map;
  }, [markets]);

  const enriched = useMemo(() => {
    return flat.map((item) => {
      const { bet, betId, marketTitle, betNumber, amount, session, betType, status, createdAt, marketData } =
        item;
      const m = marketByName.get(normalizeMarketName(marketTitle)) || marketData;
      if (status === 'won' || status === 'lost' || status === 'cancelled') {
        const verdict = {
          state: status,
          payout: bet.payout || 0,
          kind: inferBetKind(betNumber),
        };
        return {
          bet,
          betId,
          points: amount,
          session,
          marketTitle,
          betNumber,
          betType,
          status,
          createdAt,
          verdict,
        };
      }
      const computed = evaluateBet({
        market: m,
        betNumberRaw: betNumber,
        amount,
        session,
        ratesMap,
      });
      return {
        bet,
        betId,
        points: amount,
        session,
        marketTitle,
        betNumber,
        betType,
        status,
        createdAt,
        verdict: computed,
      };
    });
  }, [flat, marketByName, ratesMap]);

  const filtered = useMemo(() => {
    return (enriched || []).filter((row) => {
      if (selectedSessions.length > 0 && !selectedSessions.includes(row.session)) return false;
      if (selectedMarkets.length > 0) {
        const k = normalizeMarketName(row.marketTitle);
        if (!selectedMarkets.includes(k)) return false;
      }
      if (selectedStatuses.length > 0) {
        const st =
          row.verdict.state === 'won'
            ? 'Win'
            : row.verdict.state === 'lost'
              ? 'Loose'
              : row.verdict.state === 'cancelled'
                ? 'Cancelled'
                : 'Pending';
        if (!selectedStatuses.includes(st)) return false;
      }
      return true;
    });
  }, [enriched, selectedMarkets, selectedSessions, selectedStatuses]);

  const allBetsNewestFirst = useMemo(() => {
    return [...(filtered || [])].sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );
  }, [filtered]);

  const searchFilteredBets = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) return allBetsNewestFirst;
    return allBetsNewestFirst.filter((row) => {
      const betId = String(row.betId || '').toLowerCase();
      const market = (row.marketTitle || '').toLowerCase();
      const betNum = String(row.betNumber || '').toLowerCase();
      const pts = String(row.points || '').toLowerCase();
      return betId.includes(q) || market.includes(q) || betNum.includes(q) || pts.includes(q);
    });
  }, [allBetsNewestFirst, searchQuery]);

  const marketOptions = useMemo(() => {
    const fromHistory = (enriched || [])
      .map((row) => ({ name: (row?.marketTitle || '').toString().trim() }))
      .filter((x) => x.name);
    const uniqueMap = new Map();
    for (const item of fromHistory) {
      const key = normalizeMarketName(item.name);
      if (!uniqueMap.has(key)) uniqueMap.set(key, item);
    }
    const filteredList = Array.from(uniqueMap.values());
    filteredList.sort((a, b) => a.name.localeCompare(b.name));
    return filteredList.map((item) => ({ label: item.name, key: normalizeMarketName(item.name) }));
  }, [enriched]);

  const getStatusColor = (state) => {
    if (state === 'won') return '#43b36a';
    if (state === 'lost') return '#f87171';
    if (state === 'cancelled') return '#fb923c';
    return '#fbbf24';
  };

  const getBorderColor = (state) => {
    if (state === 'won') return '#43b36a';
    if (state === 'lost') return '#ef4444';
    if (state === 'pending') return '#f59e0b';
    if (state === 'cancelled') return '#fb923c';
    return colors.border;
  };

  const copyBetId = (betId) => {
    Clipboard.setString(String(betId || ''));
    setCopyToast('Bet ID copied');
    setTimeout(() => setCopyToast(''), 2000);
  };

  useEffect(() => {
    if (!isFilterOpen) return;
    setDraftSessions(selectedSessions);
    setDraftStatuses(selectedStatuses);
    setDraftMarkets(selectedMarkets);
  }, [isFilterOpen]);

  const applyFilters = () => {
    hapticLight();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedSessions(draftSessions);
    setSelectedStatuses(draftStatuses);
    setSelectedMarkets(draftMarkets);
    setIsFilterOpen(false);
  };

  const FilterChip = ({ label, active, onPress }) => (
    <AnimatedPressable onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}>
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </AnimatedPressable>
  );

  const cardWidth = numColumns === 1 ? '100%' : `${(100 - (numColumns - 1) * 2) / numColumns}%`;

  const listData = searchFilteredBets;

  const renderItem = useCallback(
    ({ item, index }) => (
      <FadeInView delay={Math.min(index * 30, 150)} duration={300} style={[styles.cardColumn, { width: cardWidth }]}>
        <BetCardKeyed
          row={item}
          idx={index}
          copyBetId={copyBetId}
          labelForType={labelForType}
          getStatusColor={getStatusColor}
          getStatusText={getStatusText}
          getBorderColor={getBorderColor}
          cardPadding={cardPadding}
          isCompact={isSmallScreen}
        />
      </FadeInView>
    ),
    [copyBetId, cardWidth, cardPadding, isSmallScreen]
  );

  const horizontalPad = wp(4, width);
  const dynamicStyles = useMemo(
    () => ({
      container: {
        paddingHorizontal: horizontalPad,
        paddingBottom: insets.bottom,
      },
      header: { paddingHorizontal: horizontalPad },
      title: { fontSize: rs(fontSize.xl, width) },
      filterText: { fontSize: rs(fontSize.sm, width) },
      columnWrapper: { gap: cardGap, marginBottom: cardGap },
      listGrid: { paddingBottom: listPaddingBottom, paddingHorizontal: horizontalPad },
      filterModalCard: {
        width: Math.min(width - 24, 480),
        height: Math.min(height * 0.88, 650),
      },
      copyToast: { bottom: 80 + insets.bottom },
      emptyBox: { marginHorizontal: horizontalPad },
    }),
    [width, height, insets.bottom, cardGap, listPaddingBottom, horizontalPad]
  );

  return (
    <View style={[styles.container, dynamicStyles.container]}>
      {/* Header */}
      <View style={[styles.header, dynamicStyles.header]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.8}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.title, dynamicStyles.title]} numberOfLines={1}>
          {displayTitle}
        </Text>
        <TouchableOpacity
          onPress={() => setIsFilterOpen(true)}
          style={styles.filterBtn}
          activeOpacity={0.8}
        >
          <Text style={[styles.filterText, dynamicStyles.filterText]}>Filter By ▼</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by Bet ID, market, number, amount..."
          placeholderTextColor="#9ca3af"
          returnKeyType="search"
        />
      </View>

      {/* Copy toast */}
      {copyToast ? (
        <View style={[styles.copyToast, dynamicStyles.copyToast]}>
          <Text style={styles.copyToastText}>{copyToast}</Text>
        </View>
      ) : null}

      {/* Filter modal */}
      <Modal visible={isFilterOpen} transparent animationType="fade">
        <View style={styles.filterModalOverlay}>
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)' }]}
            onPress={() => setIsFilterOpen(false)}
          />
          <View style={[styles.filterModalCard, dynamicStyles.filterModalCard]}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalHeaderTitle}>Filter Type</Text>
              <TouchableOpacity
                onPress={() => setIsFilterOpen(false)}
                style={styles.filterModalCloseBtn}
                hitSlop={12}
                activeOpacity={0.8}
              >
                <Text style={styles.filterModalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.filterModalScroll}
              contentContainerStyle={styles.filterModalScrollContent}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.filterSectionTitle}>By Game Type</Text>
              <View style={styles.filterChipRow}>
                {['OPEN', 'CLOSE'].map((s) => (
                  <FilterChip
                    key={s}
                    label={s}
                    active={draftSessions.includes(s)}
                    onPress={() =>
                      setDraftSessions((prev) =>
                        prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
                      )
                    }
                  />
                ))}
              </View>

              <View style={styles.filterDivider} />

              <Text style={styles.filterSectionTitle}>By Winning Status</Text>
              <View style={styles.filterChipRowWrap}>
                {['Win', 'Loose', 'Pending', 'Cancelled'].map((s) => (
                  <FilterChip
                    key={s}
                    label={s}
                    active={draftStatuses.includes(s)}
                    onPress={() =>
                      setDraftStatuses((prev) =>
                        prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
                      )
                    }
                  />
                ))}
              </View>

              {marketOptions.length > 0 && (
                <>
                  <View style={styles.filterDivider} />
                  <Text style={styles.filterSectionTitle}>By Games</Text>
                  <View style={styles.filterMarketList}>
                    {marketOptions.map((m) => {
                      const active = draftMarkets.includes(m.key);
                      return (
                        <TouchableOpacity
                          key={m.key}
                          style={[styles.filterMarketRow, active && styles.filterMarketRowActive]}
                          onPress={() =>
                            setDraftMarkets((prev) =>
                              prev.includes(m.key) ? prev.filter((x) => x !== m.key) : [...prev, m.key]
                            )
                          }
                          activeOpacity={0.7}
                        >
                          <View style={[styles.filterCheckbox, active && styles.filterCheckboxActive]}>
                            {active ? <Text style={styles.filterCheckmark}>✓</Text> : null}
                          </View>
                          <Text style={styles.filterMarketLabel} numberOfLines={1}>
                            {m.label.toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}
            </ScrollView>
            <View style={styles.filterModalFooter}>
              <TouchableOpacity
                onPress={() => setIsFilterOpen(false)}
                style={styles.filterCancelBtn}
                activeOpacity={0.8}
              >
                <Text style={styles.filterCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={applyFilters} style={styles.filterApplyBtn} activeOpacity={0.8}>
                <Text style={styles.filterApplyBtnText}>Filter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bet list - FlatList responsive grid */}
      {betsLoading ? (
        <SkeletonCardGrid count={8} columns={numColumns} width={width} height={height} />
      ) : !userId ? (
        <View style={[styles.emptyBox, dynamicStyles.emptyBox]}>
          <Text style={styles.emptyText}>Please login to see your bet history.</Text>
        </View>
      ) : betsError && listData.length === 0 ? (
        <View style={[styles.emptyBox, dynamicStyles.emptyBox, styles.errorBox]}>
          <Text style={styles.errorText}>
            {betsError.includes('Cannot GET') || betsError.includes('404')
              ? 'Bet history service is updating. Please try again later.'
              : betsError}
          </Text>
          <TouchableOpacity onPress={() => fetchBets()} style={styles.retryBtn} activeOpacity={0.8}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : listData.length === 0 ? (
        <View style={[styles.emptyBox, dynamicStyles.emptyBox]}>
          <Text style={styles.emptyText}>
            {searchQuery.trim() ? 'No bets match your search.' : 'No bets found.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={listData}
          renderItem={renderItem}
          keyExtractor={(item) => item.betId}
          numColumns={numColumns}
          columnWrapperStyle={numColumns > 1 ? [styles.columnWrapper, dynamicStyles.columnWrapper] : undefined}
          contentContainerStyle={[styles.listGrid, dynamicStyles.listGrid]}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={Platform.OS === 'android'}
          maxToRenderPerBatch={8}
          initialNumToRender={10}
          windowSize={5}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefreshBets}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </View>
  );
}

const BetCardKeyed = React.memo(function BetCardKeyed({
  row,
  idx,
  copyBetId,
  labelForType,
  getStatusColor,
  getStatusText,
  getBorderColor,
  cardPadding = 12,
  isCompact = false,
}) {
  const { betId, points, session, betNumber, betType, verdict, createdAt, marketTitle } = row;
  const isScheduled = row.bet?.scheduledDate || row.bet?.isScheduled;
  const scheduledDateStr = formatScheduledDate(row.bet?.scheduledDate);
  const statusColor = getStatusColor(verdict?.state);
  const borderColor = getBorderColor(verdict?.state);

  return (
    <View style={[styles.betCard, { borderColor, padding: cardPadding, minHeight: isCompact ? 150 : 180 }]}>
      {verdict?.state === 'cancelled' && (
        <View style={styles.cancelledOverlay}>
          <Text style={styles.cancelledX}>✕</Text>
        </View>
      )}
      <View style={styles.betCardRow}>
        <Text style={styles.betIdxText}>#{idx + 1}</Text>
        {session ? (
          <View style={styles.sessionBadge}>
            <Text style={styles.sessionBadgeText}>{session}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.betCardRow}>
        <Text style={styles.betLabel}>Bet ID</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={styles.betMono} numberOfLines={1}>
            {String(betId || '').slice(-8)}
          </Text>
          <TouchableOpacity
            onPress={() => copyBetId(betId)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.copyIcon}>⎘</Text>
          </TouchableOpacity>
        </View>
      </View>
      {isScheduled && (
        <View style={styles.scheduledBadge}>
          <Text style={styles.scheduledText}>
            Scheduled{scheduledDateStr ? ` · ${scheduledDateStr}` : ''}
          </Text>
        </View>
      )}
      <Text style={styles.marketName} numberOfLines={1}>
        {(marketTitle || 'MARKET').toUpperCase()}
      </Text>
      <View style={styles.betCardRow}>
        <Text style={styles.betLabel}>Game</Text>
        <Text style={styles.betValue}>{labelForType(betType)}</Text>
      </View>
      <View style={styles.betCardRow}>
        <Text style={styles.betLabel}>Bet</Text>
        <Text style={styles.betValue}>{betNumber != null ? String(betNumber) : '-'}</Text>
      </View>
      <View style={styles.betCardRow}>
        <Text style={styles.betLabel}>Points</Text>
        <Text style={styles.betValue}>{points}</Text>
      </View>
      <View style={styles.betCardRow}>
        <Text style={styles.betLabel}>Status</Text>
        <Text style={[styles.betStatusValue, { color: statusColor }]}>
          {getStatusText(verdict)}
          {verdict?.state === 'won' && verdict?.payout > 0
            ? ` ₹${Number(verdict.payout).toLocaleString('en-IN')}`
            : ''}
        </Text>
      </View>
      <View style={styles.betCardRow}>
        <Text style={styles.betLabel}>Time</Text>
        <Text style={styles.betTimeValue}>{formatTxnTime(createdAt)}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingTop: spacing[3],
    paddingBottom: spacing[3],
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    minWidth: 36,
    minHeight: 36,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { color: colors.text, fontSize: 18, fontWeight: '600' },
  title: { flex: 1, color: colors.text, fontWeight: '700', minWidth: 0 },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  filterText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '600' },
  searchWrap: { paddingHorizontal: spacing[4], paddingVertical: spacing[2], backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  searchInput: { backgroundColor: colors.background, borderWidth: 2, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: colors.text },
  copyToast: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing[4],
    paddingVertical: 10,
    borderRadius: borderRadius.xl,
    zIndex: 100,
  },
  copyToastText: { color: colors.surface, fontWeight: '600', fontSize: fontSize.sm },
  emptyBox: {
    margin: spacing[4],
    borderRadius: borderRadius['2xl'],
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing[6],
    alignItems: 'center',
  },
  emptyText: { color: colors.textSecondary, fontSize: fontSize.base },
  errorBox: { borderColor: '#fca5a5', backgroundColor: '#fef2f2' },
  errorText: { color: '#dc2626', fontSize: fontSize.sm, marginBottom: 12, textAlign: 'center' },
  retryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
  },
  retryBtnText: { color: colors.surface, fontWeight: '600', fontSize: fontSize.sm },
  columnWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardColumn: {},
  listGrid: {},
  betCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    gap: 6,
  },
  betCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  betIdxText: { color: colors.primary, fontSize: 10, fontWeight: '600' },
  sessionBadge: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  sessionBadgeText: { color: colors.primary, fontSize: 9, fontWeight: '700' },
  betLabel: { color: colors.textSecondary, fontSize: 10, flexShrink: 0 },
  betMono: { color: colors.text, fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  copyIcon: { color: colors.textSecondary, fontSize: 12 },
  betValue: { color: colors.text, fontSize: fontSize.xs, fontWeight: '600' },
  betStatusValue: { fontSize: 10, fontWeight: '600' },
  betTimeValue: { color: colors.text, fontSize: 10 },
  marketName: { color: colors.textSecondary, fontSize: 10 },
  scheduledBadge: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  scheduledText: { color: '#d97706', fontSize: 9, fontWeight: '600' },
  cancelledOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    borderRadius: borderRadius.lg,
  },
  cancelledX: { color: '#fb923c', fontSize: 40, fontWeight: '700' },
  filterModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  filterModalCard: {
    backgroundColor: colors.surface,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 25 },
    shadowOpacity: 0.65,
    shadowRadius: 80,
    elevation: 24,
  },
  filterModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[5],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterModalHeaderTitle: { color: colors.surface, fontSize: 22, fontWeight: '800' },
  filterModalCloseBtn: {
    position: 'absolute',
    right: spacing[4],
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[2],
  },
  filterModalCloseText: { color: colors.surface, fontSize: 22, fontWeight: '600' },
  filterModalScroll: { flex: 1 },
  filterModalScrollContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[4],
  },
  filterSectionTitle: {
    color: colors.primary,
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginBottom: spacing[3],
  },
  filterDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing[4],
  },
  filterChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  filterChipRowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  filterChip: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: 999,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: '600' },
  filterChipTextActive: { color: colors.surface },
  filterMarketList: { gap: spacing[2], marginBottom: spacing[2] },
  filterMarketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.background,
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    borderColor: colors.border,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
  },
  filterMarketRowActive: { borderColor: colors.primary },
  filterCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  filterCheckboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterCheckmark: { color: colors.surface, fontSize: 14, fontWeight: '800' },
  filterMarketLabel: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  filterModalFooter: {
    flexDirection: 'row',
    gap: spacing[4],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[5],
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  filterCancelBtn: {
    flex: 1,
    paddingVertical: spacing[4],
    borderRadius: 999,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
  },
  filterCancelBtnText: { color: colors.text, fontWeight: '700', fontSize: fontSize.base },
  filterApplyBtn: {
    flex: 1,
    paddingVertical: spacing[4],
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  filterApplyBtnText: { color: colors.surface, fontWeight: '800', fontSize: fontSize.base },
});
