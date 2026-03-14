import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import BidLayout from '../BidLayout';
import BidReviewModal from './BidReviewModal';
import { placeBet, updateUserBalance } from '../../../api/bets';
import { useAuth } from '../../../context/AuthContext';

const ODD_DIGITS = [1, 3, 5, 7, 9];
const EVEN_DIGITS = [0, 2, 4, 6, 8];

export default function OddEvenBid({ market, title }) {
  const [session, setSession] = useState(() => (market?.status === 'running' ? 'CLOSE' : 'OPEN'));
  const [choice, setChoice] = useState('odd');
  const [digitInputs, setDigitInputs] = useState(() => {
    const o = {};
    [...ODD_DIGITS, ...EVEN_DIGITS].forEach((d) => { o[d] = ''; });
    return o;
  });
  const [bids, setBids] = useState([]);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [warning, setWarning] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const { user } = useAuth();

  const digits = choice === 'odd' ? ODD_DIGITS : EVEN_DIGITS;

  const showWarning = (msg) => {
    setWarning(msg);
    const t = setTimeout(() => setWarning(''), 2200);
    return () => clearTimeout(t);
  };

  const handleDateChange = (newDate) => {
    setSelectedDate(newDate);
  };

  const clearAll = () => {
    setBids([]);
    const o = {};
    [...ODD_DIGITS, ...EVEN_DIGITS].forEach((d) => { o[d] = ''; });
    setDigitInputs(o);
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const handleAddBid = () => {
    const toAdd = digits
      .filter((num) => Number(digitInputs[num]) > 0)
      .map((num) => ({ id: Date.now() + num, number: String(num), points: String(digitInputs[num]), type: session }));
    if (toAdd.length === 0) {
      showWarning(`Please enter points for at least one ${choice === 'odd' ? 'odd' : 'even'} number.`);
      return;
    }
    setBids((prev) => [...prev, ...toAdd]);
    const cleared = { ...digitInputs };
    digits.forEach((d) => { cleared[d] = ''; });
    setDigitInputs(cleared);
    setIsReviewOpen(true);
  };

  const totalPoints = bids.reduce((sum, b) => sum + Number(b.points), 0);
  const dateText = new Date().toLocaleDateString('en-GB');
  const marketTitle = market?.gameName || market?.marketName || title;
  const isRunning = market?.status === 'running';

  useEffect(() => {
    if (isRunning) setSession('CLOSE');
  }, [isRunning]);

  const walletBefore = useMemo(() => {
    const val = user?.wallet ?? user?.balance ?? user?.points ?? user?.walletAmount ?? 0;
    const n = Number(val);
    return Number.isFinite(n) ? n : 0;
  }, [user]);

  const handleSubmitBet = async () => {
    const marketId = market?._id || market?.id;
    if (!marketId) throw new Error('Market not found');
    const bets = bids.map((b) => ({
      betType: 'single',
      betNumber: String(b.number),
      amount: Number(b.points) || 0,
      betOn: String(b?.type || session).toUpperCase() === 'CLOSE' ? 'close' : 'open',
    }));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDateObj = new Date(selectedDate);
    selectedDateObj.setHours(0, 0, 0, 0);
    const scheduledDate = selectedDateObj > today ? selectedDate : null;

    const result = await placeBet(marketId, bets, scheduledDate);
    if (!result.success) throw new Error(result.message);
    if (result.data?.newBalance != null) await updateUserBalance(result.data.newBalance);
    setIsReviewOpen(false);
    clearAll();
  };

  const handleCancelBet = () => {
    setIsReviewOpen(false);
    clearAll();
  };

  return (
    <BidLayout
      market={market}
      title={title}
      bidsCount={bids.length}
      totalPoints={totalPoints}
      showDateSession
      session={session}
      setSession={setSession}
      hideFooter
      walletBalance={walletBefore}
      selectedDate={selectedDate}
      setSelectedDate={handleDateChange}
    >
      <View style={styles.content}>
{warning ? (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>{warning}</Text>
          </View>
        ) : null}
        <View style={styles.sessionRow}>
          <Text style={styles.sessionLabel}>Session:</Text>
          <View style={styles.sessionTabs}>
            <TouchableOpacity onPress={() => setSession('OPEN')} style={[styles.sessionTab, session === 'OPEN' && styles.sessionTabActive]} activeOpacity={0.9}>
              <Text style={[styles.sessionTabText, session === 'OPEN' && styles.sessionTabTextActive]}>OPEN</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSession('CLOSE')} style={[styles.sessionTab, session === 'CLOSE' && styles.sessionTabActive]} activeOpacity={0.9}>
              <Text style={[styles.sessionTabText, session === 'CLOSE' && styles.sessionTabTextActive]}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.tabs}>
            <TouchableOpacity
              onPress={() => setChoice('odd')}
              style={[styles.tab, choice === 'odd' && styles.tabActive]}
              activeOpacity={0.9}
            >
              <Text style={[styles.tabText, choice === 'odd' && styles.tabTextActive]}>Odd</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setChoice('even')}
              style={[styles.tab, choice === 'even' && styles.tabActive]}
              activeOpacity={0.9}
            >
              <Text style={[styles.tabText, choice === 'even' && styles.tabTextActive]}>Even</Text>
            </TouchableOpacity>
        </View>
        <View style={styles.digitGrid}>
          {digits.map((num) => (
            <View key={num} style={styles.digitRow}>
              <View style={styles.digitBox}>
                <Text style={styles.digitText}>{num}</Text>
              </View>
              <TextInput
                style={styles.ptsInput}
                value={digitInputs[num]}
                onChangeText={(v) => setDigitInputs((p) => ({ ...p, [num]: v.replace(/\D/g, '').slice(0, 6) }))}
                placeholder="Pts"
                keyboardType="number-pad"
              />
            </View>
          ))}
        </View>
        <TouchableOpacity onPress={handleAddBid} style={styles.addBtn} activeOpacity={0.9}>
          <Text style={styles.addBtnText}>Add to List</Text>
        </TouchableOpacity>
      </View>

      <BidReviewModal
        open={isReviewOpen}
        onClose={handleCancelBet}
        onSubmit={handleSubmitBet}
        marketTitle={marketTitle}
        dateText={dateText}
        labelKey="Digit"
        rows={bids}
        walletBefore={walletBefore}
        totalBids={bids.length}
        totalAmount={totalPoints}
      />
    </BidLayout>
  );
}

const styles = StyleSheet.create({
  content: { padding: 12 },
  warningBox: { backgroundColor: '#fef2f2', borderWidth: 2, borderColor: '#fca5a5', borderRadius: 12, padding: 12, marginBottom: 16 },
  warningText: { color: '#dc2626', fontSize: 14 },
  sessionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  sessionLabel: { fontSize: 14, fontWeight: '500', color: '#374151' },
  sessionTabs: { flex: 1, flexDirection: 'row', gap: 8 },
  sessionTab: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#fff', borderWidth: 2, borderColor: '#d1d5db', alignItems: 'center' },
  sessionTabActive: { backgroundColor: '#1B3150', borderColor: '#1B3150' },
  sessionTabText: { fontSize: 13, fontWeight: '700', color: '#4b5563' },
  sessionTabTextActive: { color: '#fff' },
  tabs: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#fff', borderWidth: 2, borderColor: '#d1d5db', alignItems: 'center' },
  tabActive: { backgroundColor: '#1B3150', borderColor: '#1B3150' },
  tabText: { fontSize: 12, fontWeight: '700', color: '#4b5563' },
  tabTextActive: { color: '#fff' },
  digitGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  digitRow: { flexDirection: 'row', alignItems: 'center', width: '47%' },
  digitBox: { width: 40, height: 40, backgroundColor: '#1B3150', borderWidth: 2, borderColor: '#d1d5db', borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  digitText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  ptsInput: { flex: 1, height: 40, backgroundColor: '#fff', borderWidth: 2, borderColor: '#d1d5db', borderRadius: 6, paddingHorizontal: 8, fontSize: 14, fontWeight: '600' },
  addBtn: { marginTop: 4, backgroundColor: '#1B3150', paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
