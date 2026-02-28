import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import BidLayout from '../BidLayout';
import BidReviewModal from './BidReviewModal';
import { placeBet, updateUserBalance } from '../../../api/bets';
import { useAuth } from '../../../context/AuthContext';

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const GRID_GAP = 10;
const SCROLL_H_PAD = 24; // BidLayout contentInner padding 12 * 2

export default function SingleDigitBulkBid({ market, title }) {
  const [session, setSession] = useState(() => (market?.status === 'running' ? 'CLOSE' : 'OPEN'));
  const [inputPoints, setInputPoints] = useState('');
  const [bids, setBids] = useState([]);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [warning, setWarning] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);

  const isRunning = market?.status === 'running';

  useEffect(() => {
    if (isRunning) setSession('CLOSE');
  }, [isRunning]);

  const showWarning = (msg) => {
    setWarning(msg);
    const t = setTimeout(() => setWarning(''), 2200);
    return () => clearTimeout(t);
  };

  const handleDateChange = (newDate) => setSelectedDate(newDate);

  const handleDigitClick = (num) => {
    const pts = Number(inputPoints);
    if (!pts || pts <= 0) {
      showWarning('Please enter points.');
      return;
    }
    setBids((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), number: String(num), points: String(pts), type: session },
    ]);
  };

  const bulkBidsCount = bids.length;
  const bulkTotalPoints = bids.reduce((sum, b) => sum + Number(b.points || 0), 0);
  const dateText = new Date().toLocaleDateString('en-GB');
  const marketTitle = market?.gameName || market?.marketName || title;
  const { user } = useAuth();
  const walletBefore = Number(user?.wallet ?? user?.balance ?? user?.points ?? 0) || 0;

  const rows = useMemo(() => {
    const map = new Map();
    for (const b of bids) {
      const num = String(b.number ?? '').trim();
      const type = String(b.type ?? '').trim();
      const key = `${num}__${type}`;
      const prev = map.get(key);
      const pts = Number(b.points || 0) || 0;
      if (prev) {
        prev.points = String((Number(prev.points || 0) || 0) + pts);
      } else {
        map.set(key, { id: key, number: num, points: String(pts), type });
      }
    }
    return Array.from(map.values()).sort((a, c) => {
      if (a.type !== c.type) return a.type.localeCompare(c.type);
      return a.number.localeCompare(c.number);
    });
  }, [bids]);

  const pointsByDigit = useMemo(
    () =>
      bids.reduce((acc, b) => {
        const k = String(b.number);
        acc[k] = (acc[k] || 0) + Number(b.points || 0);
        return acc;
      }, {}),
    [bids]
  );

  const clearAll = () => {
    setIsReviewOpen(false);
    setBids([]);
    setInputPoints('');
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const handleSubmitBet = async () => {
    const marketId = market?._id || market?.id;
    if (!marketId) throw new Error('Market not found');
    const payload = rows.map((r) => ({
      betType: 'single',
      betNumber: String(r.number),
      amount: Number(r.points) || 0,
      betOn: String(r?.type || session).toUpperCase() === 'CLOSE' ? 'close' : 'open',
    }));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDateObj = new Date(selectedDate);
    selectedDateObj.setHours(0, 0, 0, 0);
    const scheduledDate = selectedDateObj > today ? selectedDate : null;

    const result = await placeBet(marketId, payload, scheduledDate);
    if (!result.success) throw new Error(result.message);
    if (result.data?.newBalance != null) await updateUserBalance(result.data.newBalance);
    setIsReviewOpen(false);
    clearAll();
  };

  const todayDateFormatted = selectedDate
    ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')
    : '';

  const { width: screenWidth } = useWindowDimensions();
  const contentWidth = screenWidth - SCROLL_H_PAD;
  const digitSize = Math.floor((contentWidth - GRID_GAP * 2) / 3);
  const zeroBtnSize = Math.min(digitSize * 1.2, 96);

  return (
    <BidLayout
      market={market}
      title={title}
      bidsCount={bulkBidsCount}
      totalPoints={bulkTotalPoints}
      showDateSession
      session={session}
      setSession={setSession}
      selectedDate={selectedDate}
      setSelectedDate={handleDateChange}
      hideFooter={false}
      showFooterStats={false}
      submitLabel="Submit Bet"
      onSubmit={() => bids.length > 0 && setIsReviewOpen(true)}
      walletBalance={walletBefore}
    >
      <View style={styles.content}>
        {warning ? (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>{warning}</Text>
          </View>
        ) : null}

        <View style={styles.formCard}>
          <View style={styles.field}>
            <Text style={styles.label}>Date:</Text>
            <View style={styles.dateDisplay}>
              <Text style={styles.dateText}>{todayDateFormatted || selectedDate}</Text>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Type:</Text>
            <View style={styles.sessionRow}>
              <TouchableOpacity
                onPress={() => !isRunning && setSession('OPEN')}
                style={[styles.sessionBtn, session === 'OPEN' && styles.sessionBtnActive]}
                activeOpacity={0.8}
                disabled={isRunning}
              >
                <Text style={[styles.sessionBtnText, session === 'OPEN' && styles.sessionBtnTextActive]}>OPEN</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSession('CLOSE')}
                style={[styles.sessionBtn, session === 'CLOSE' && styles.sessionBtnActive]}
                activeOpacity={0.8}
              >
                <Text style={[styles.sessionBtnText, session === 'CLOSE' && styles.sessionBtnTextActive]}>CLOSE</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Enter Points:</Text>
            <TextInput
              style={styles.input}
              value={inputPoints}
              onChangeText={(v) => setInputPoints(v.replace(/\D/g, '').slice(0, 6))}
              placeholder="Point"
              placeholderTextColor="#9ca3af"
              keyboardType="number-pad"
            />
          </View>
        </View>

        <View style={[styles.digitGrid, { width: contentWidth }]}>
          {DIGITS.map((num) => (
            <TouchableOpacity
              key={num}
              onPress={() => handleDigitClick(num)}
              style={[styles.digitBtn, { width: digitSize, height: digitSize }]}
              activeOpacity={0.85}
            >
              <Text style={styles.digitBtnText}>{num}</Text>
              {(pointsByDigit[String(num)] || 0) > 0 && (
                <Text style={styles.digitBadge}>{pointsByDigit[String(num)]}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.zeroRow}>
          <TouchableOpacity
            onPress={() => handleDigitClick(0)}
            style={[styles.digitBtnZero, { width: zeroBtnSize, height: zeroBtnSize }]}
            activeOpacity={0.85}
          >
            <Text style={styles.digitBtnText}>0</Text>
            {(pointsByDigit['0'] || 0) > 0 && (
              <Text style={styles.digitBadge}>{pointsByDigit['0']}</Text>
            )}
          </TouchableOpacity>
        </View>
        <View style={styles.bottomSpacer} />
      </View>

      <BidReviewModal
        open={isReviewOpen}
        onClose={clearAll}
        onSubmit={handleSubmitBet}
        marketTitle={marketTitle}
        dateText={dateText}
        labelKey="Digit"
        rows={rows}
        walletBefore={walletBefore}
        totalBids={bulkBidsCount}
        totalAmount={bulkTotalPoints}
      />
    </BidLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: 12,
    paddingBottom: 24,
  },
  warningBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 2,
    borderColor: '#fca5a5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  warningText: { color: '#dc2626', fontSize: 14 },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    padding: 16,
    marginBottom: 20,
  },
  field: { marginBottom: 14 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  dateDisplay: {
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  dateText: { fontSize: 15, fontWeight: '700', color: '#1f2937' },
  sessionRow: { flexDirection: 'row', gap: 12 },
  sessionBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionBtnActive: { backgroundColor: '#1B3150', borderColor: '#1B3150' },
  sessionBtnText: { fontSize: 15, fontWeight: '700', color: '#6b7280' },
  sessionBtnTextActive: { color: '#fff' },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1f2937',
    minHeight: 48,
  },
  digitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    alignSelf: 'center',
  },
  digitBtn: {
    backgroundColor: '#1B3150',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  digitBtnText: { fontSize: 24, fontWeight: '700', color: '#fff' },
  digitBadge: {
    position: 'absolute',
    top: 6,
    right: 8,
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  zeroRow: { alignItems: 'center', marginTop: 14 },
  digitBtnZero: {
    backgroundColor: '#1B3150',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  bottomSpacer: { height: 140 },
});
