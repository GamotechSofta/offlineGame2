import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { API_BASE_URL } from '../config/api';
import { isPastClosingTime } from '../utils/marketTiming';
import { useRefreshOnMarketReset } from '../hooks/useRefreshOnMarketReset';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function formatTime(time24) {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

function getMarketStatus(market) {
  if (isPastClosingTime(market)) {
    return { status: 'closed', timer: null };
  }
  const hasOpening = market.openingNumber && /^\d{3}$/.test(String(market.openingNumber));
  const hasClosing = market.closingNumber && /^\d{3}$/.test(String(market.closingNumber));
  if (hasOpening && hasClosing) return { status: 'closed', timer: null };
  if (hasOpening && !hasClosing) return { status: 'running', timer: null };
  return { status: 'open', timer: null };
}

export default function Section1() {
  const navigation = useNavigation();
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMarkets = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/markets/get-markets`);
      const data = await response.json();
      if (data.success) {
        const mainOnly = (data.data || []).filter((m) => m.marketType !== 'startline');
        const transformedMarkets = mainOnly.map((market) => {
          const st = getMarketStatus(market);
          return {
            id: market._id,
            gameName: market.marketName,
            timeRange: `${formatTime(market.startingTime)} - ${formatTime(market.closingTime)}`,
            result: market.displayResult || '***-**-***',
            status: st.status,
            timer: st.timer,
            startingTime: market.startingTime,
            closingTime: market.closingTime,
            betClosureTime: market.betClosureTime ?? 0,
            openingNumber: market.openingNumber,
            closingNumber: market.closingNumber,
          };
        });
        setMarkets(transformedMarkets);
      }
    } catch (error) {
      console.error('Error fetching markets:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarkets();
    const dataInterval = setInterval(fetchMarkets, 30000);
    return () => clearInterval(dataInterval);
  }, []);

  useRefreshOnMarketReset(fetchMarkets);

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <View style={styles.line} />
        <View style={styles.headerCenter}>
          <Text style={styles.plus}>+</Text>
          <Text style={styles.title}>MARKETS</Text>
          <Text style={styles.plus}>+</Text>
        </View>
        <View style={styles.line} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="small" color="#4b5563" />
          <Text style={styles.loadingText}>Loading markets...</Text>
        </View>
      ) : markets.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.loadingText}>No markets available</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {markets.map((market) => {
            const isClickable = market.status === 'open' || market.status === 'running';
            const statusText =
              market.status === 'closed'
                ? 'Closed for today'
                : market.status === 'running'
                  ? 'Close is Running'
                  : 'Market is Open';
            return (
              <TouchableOpacity
                key={market.id}
                onPress={() => isClickable && navigation.navigate('BidOptions', { market })}
                style={[styles.card, !isClickable && styles.cardDisabled]}
                activeOpacity={isClickable ? 0.8 : 1}
                disabled={!isClickable}
              >
                <View style={styles.cardInner}>
                  <View style={styles.cardTop}>
                    <Text style={styles.gameName} numberOfLines={1}>
                      {market.gameName}
                    </Text>
                    <Text style={[styles.statusBadge, market.status === 'closed' ? styles.statusClosed : styles.statusOpen]}>
                      {statusText}
                    </Text>
                  </View>
                  <View style={styles.cardMiddle}>
                    <Text style={styles.result}>{market.result}</Text>
                    <TouchableOpacity
                      onPress={(e) => {
                        e?.stopPropagation?.();
                        if (isClickable) navigation.navigate('BidOptions', { market });
                      }}
                      style={[styles.playBtn, market.status === 'closed' && styles.playBtnClosed]}
                      activeOpacity={0.8}
                      disabled={!isClickable}
                    >
                      <Text style={styles.playIcon}>▶</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.cardBottom}>
                    <View>
                      <Text style={styles.timeLabel}>Open Bids</Text>
                      <Text style={styles.timeValue}>{formatTime(market.startingTime) || '-'}</Text>
                    </View>
                    <View>
                      <Text style={styles.timeLabel}>Close Bids</Text>
                      <Text style={styles.timeValue}>{formatTime(market.closingTime) || '-'}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width: '100%',
    paddingHorizontal: 12,
    paddingBottom: 100,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  line: { flex: 1, height: 1, backgroundColor: '#9ca3af', minWidth: 20 },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  plus: { fontSize: 16, fontWeight: '700', color: '#1B3150' },
  title: { fontSize: 16, fontWeight: '700', color: '#1B3150', letterSpacing: 2 },
  centered: { paddingVertical: 48, alignItems: 'center' },
  loadingText: { color: '#4b5563', marginTop: 8 },
  grid: { gap: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardDisabled: { opacity: 0.9 },
  cardInner: { padding: 8 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  gameName: { fontSize: 14, fontWeight: '700', color: '#111827', flex: 1 },
  statusBadge: { fontSize: 10, fontWeight: '500', paddingHorizontal: 6, paddingVertical: 2 },
  statusClosed: { color: '#ef4444' },
  statusOpen: { color: '#16a34a' },
  cardMiddle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, marginTop: 4 },
  result: { fontSize: 18, fontWeight: '700', color: '#16a34a' },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnClosed: { backgroundColor: '#ef4444' },
  playIcon: { color: '#fff', fontSize: 14 },
  cardBottom: { flexDirection: 'row', gap: 16 },
  timeLabel: { fontSize: 10, fontWeight: '500', color: '#6b7280' },
  timeValue: { fontSize: 12, fontWeight: '600' },
});
