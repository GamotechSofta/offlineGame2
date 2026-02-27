import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useBettingWindow } from './BettingWindowContext';
import { useAuth } from '../../context/AuthContext';

const getWalletFromStorage = (user) => {
  if (!user) return 0;
  const val = user?.wallet ?? user?.balance ?? user?.points ?? user?.walletAmount ?? user?.wallet_amount ?? user?.amount ?? 0;
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
};

export default function BidLayout({
  market,
  title,
  children,
  bidsCount,
  totalPoints,
  showDateSession = true,
  extraHeader,
  session = 'OPEN',
  setSession = () => {},
  sessionRightSlot = null,
  sessionOptionsOverride = null,
  lockSessionSelect = false,
  hideFooter = false,
  walletBalance,
  onSubmit = () => {},
  showFooterStats = true,
  submitLabel = 'Submit Bets',
  selectedDate = null,
  setSelectedDate = null,
}) {
  const navigation = useNavigation();
  const { allowed: bettingAllowed, closeOnly: bettingCloseOnly, message: bettingMessage } = useBettingWindow();
  const { user } = useAuth();
  const wallet = Number.isFinite(Number(walletBalance)) ? Number(walletBalance) : getWalletFromStorage(user);

  const today = new Date();
  const minDate = today.toISOString().split('T')[0];
  const [internalDate, setInternalDate] = useState(() => today.toISOString().split('T')[0]);

  const currentDate = selectedDate !== null ? selectedDate : internalDate;
  const setCurrentDate = setSelectedDate !== null ? setSelectedDate : setInternalDate;

  const marketStatus = market?.status;
  const isRunning = marketStatus === 'running';
  const isToday = currentDate === minDate;
  const sessionOptions = Array.isArray(sessionOptionsOverride) && sessionOptionsOverride.length
    ? sessionOptionsOverride
    : isToday && (isRunning || bettingCloseOnly) ? ['CLOSE'] : ['OPEN', 'CLOSE'];

  useEffect(() => {
    if (isToday && (isRunning || bettingCloseOnly) && session !== 'CLOSE') {
      setSession('CLOSE');
    }
  }, [isToday, isRunning, bettingCloseOnly, session, setSession]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (market ? navigation.navigate('BidOptions', { market }) : navigation.goBack())} style={styles.backBtn} activeOpacity={0.8}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{market?.gameName ? `${market.gameName} - ${title}` : title}</Text>
        <View style={styles.walletBadge}>
          <Image source={{ uri: 'https://res.cloudinary.com/dnyp5jknp/image/upload/v1771394532/wallet_n1oyef.png' }} style={styles.walletImg} />
          <Text style={styles.walletText}>₹{wallet.toFixed(1)}</Text>
        </View>
      </View>

      {!bettingAllowed && bettingMessage ? (
        <View style={styles.alert}>
          <Text style={styles.alertText}>{bettingMessage}</Text>
        </View>
      ) : null}

      {extraHeader}

      {showDateSession ? (
        <View style={styles.dateRow}>
          <View style={styles.dateBtn}>
            <Text style={styles.dateBtnText}>{currentDate}</Text>
          </View>
          {sessionRightSlot}
        </View>
      ) : null}

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>

      {!hideFooter && (
        <View style={styles.footer}>
          <View style={styles.footerInner}>
            {showFooterStats ? (
              <View style={styles.footerStats}>
                <View style={styles.footerStat}>
                  <Text style={styles.footerStatLabel}>Bets</Text>
                  <Text style={styles.footerStatValue}>{bidsCount}</Text>
                </View>
                <View style={styles.footerStat}>
                  <Text style={styles.footerStatLabel}>Points</Text>
                  <Text style={styles.footerStatValue}>{totalPoints}</Text>
                </View>
              </View>
            ) : null}
            <TouchableOpacity
              onPress={onSubmit}
              disabled={!bidsCount || !bettingAllowed}
              style={[styles.submitBtn, (bidsCount && bettingAllowed) ? styles.submitBtnActive : styles.submitBtnDisabled]}
              activeOpacity={0.9}
            >
              <Text style={styles.submitBtnText}>{submitLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E8ECEF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f3f4f6',
    borderBottomWidth: 2,
    borderBottomColor: '#e5e7eb',
  },
  backBtn: { padding: 8, marginRight: 4 },
  backIcon: { fontSize: 18, color: '#1f2937' },
  headerTitle: { flex: 1, fontSize: 12, fontWeight: '700', color: '#1f2937', textAlign: 'center' },
  walletBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#e5e7eb', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  walletImg: { width: 20, height: 20 },
  walletText: { fontSize: 11, fontWeight: '700', color: '#1f2937' },
  alert: { marginHorizontal: 12, marginTop: 8, padding: 12, backgroundColor: '#fef2f2', borderWidth: 2, borderColor: '#fca5a5', borderRadius: 12 },
  alertText: { fontSize: 14, color: '#dc2626' },
  dateRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  dateBtn: { flex: 1, backgroundColor: '#fff', borderWidth: 2, borderColor: '#d1d5db', borderRadius: 24, paddingVertical: 10, alignItems: 'center' },
  dateBtnText: { fontSize: 12, fontWeight: '700', color: '#1f2937' },
  content: { flex: 1 },
  contentInner: { padding: 12, paddingBottom: 100 },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingBottom: 90,
  },
  footerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    backgroundColor: '#E8ECEF',
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 16,
    padding: 16,
  },
  footerStats: { flexDirection: 'row', gap: 32 },
  footerStat: { alignItems: 'center' },
  footerStatLabel: { fontSize: 10, color: '#4b5563' },
  footerStatValue: { fontSize: 16, fontWeight: '700', color: '#1B3150' },
  submitBtn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  submitBtnActive: { backgroundColor: '#1B3150' },
  submitBtnDisabled: { backgroundColor: '#9ca3af', opacity: 0.5 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
