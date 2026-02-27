import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import BidLayout from '../BidLayout';
import BidReviewModal from './BidReviewModal';
import { placeBet, updateUserBalance } from '../../../api/bets';
import { useAuth } from '../../../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SingleDigitBid({ market, title }) {
  const [activeTab, setActiveTab] = useState('special');
  const [session, setSession] = useState(() => (market?.status === 'running' ? 'CLOSE' : 'OPEN'));
  const [bids, setBids] = useState([]);
  const [inputNumber, setInputNumber] = useState('');
  const [inputPoints, setInputPoints] = useState('');
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [warning, setWarning] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const pointsInputRef = useRef(null);
  const { user } = useAuth();

  const [specialModeInputs, setSpecialModeInputs] = useState(
    Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i, '']))
  );

  const resetSpecialInputs = () =>
    setSpecialModeInputs(Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i, ''])));

  const showWarning = (msg) => {
    setWarning(msg);
    const t = setTimeout(() => setWarning(''), 2200);
    return () => clearTimeout(t);
  };

  const clearAll = () => {
    setBids([]);
    setInputNumber('');
    setInputPoints('');
    resetSpecialInputs();
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const handleDateChange = (newDate) => {
    setSelectedDate(newDate);
  };

  const handleAddBid = () => {
    const pts = Number(inputPoints);
    if (!pts || pts <= 0) {
      showWarning('Please enter points.');
      return;
    }
    const n = inputNumber.toString().trim();
    if (!n || !/^[0-9]$/.test(n)) {
      showWarning('Please enter digit (0-9).');
      return;
    }
    setBids((prev) => [...prev, { id: Date.now(), number: n, points: inputPoints, type: session }]);
    setInputNumber('');
    setInputPoints('');
    setIsReviewOpen(true);
  };

  const handleAddSpecialModeBids = () => {
    const toAdd = Object.entries(specialModeInputs)
      .filter(([, pts]) => Number(pts) > 0)
      .map(([num, pts]) => ({ id: Date.now() + parseInt(num, 10), number: num, points: String(pts), type: session }));
    if (toAdd.length === 0) {
      showWarning('Please enter points for at least one digit (0-9).');
      return;
    }
    setBids((prev) => [...prev, ...toAdd]);
    setSpecialModeInputs(Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i, ''])));
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
        <View style={styles.tabs}>
          <TouchableOpacity
            onPress={() => setActiveTab('special')}
            style={[styles.tab, activeTab === 'special' && styles.tabActive]}
            activeOpacity={0.9}
          >
            <Text style={[styles.tabText, activeTab === 'special' && styles.tabTextActive]}>SPECIAL MODE</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('easy')}
            style={[styles.tab, activeTab === 'easy' && styles.tabActive]}
            activeOpacity={0.9}
          >
            <Text style={[styles.tabText, activeTab === 'easy' && styles.tabTextActive]}>EASY MODE</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'easy' ? (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>Select Game Type:</Text>
              <View style={styles.sessionDisplay}><Text style={styles.sessionText}>{session}</Text></View>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Enter Single Digit:</Text>
              <TextInput
                style={styles.input}
                value={inputNumber}
                onChangeText={(v) => setInputNumber(v.replace(/\D/g, '').slice(0, 1))}
                placeholder="Digit"
                keyboardType="number-pad"
                maxLength={1}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Enter Points:</Text>
              <TextInput
                ref={pointsInputRef}
                style={styles.input}
                value={inputPoints}
                onChangeText={(v) => setInputPoints(v.replace(/\D/g, '').slice(0, 6))}
                placeholder="Point"
                keyboardType="number-pad"
              />
            </View>
            <TouchableOpacity onPress={handleAddBid} style={styles.addBtn} activeOpacity={0.9}>
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.specialGrid}>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <View key={num} style={styles.specialRow}>
                  <View style={styles.specialDigit}>
                    <Text style={styles.specialDigitText}>{num}</Text>
                  </View>
                  <TextInput
                    style={styles.specialInput}
                    placeholder="Pts"
                    value={specialModeInputs[num]}
                    onChangeText={(v) => setSpecialModeInputs((p) => ({ ...p, [num]: v }))}
                    keyboardType="number-pad"
                  />
                </View>
              ))}
            </View>
            <TouchableOpacity onPress={handleAddSpecialModeBids} style={styles.addBtn} activeOpacity={0.9}>
              <Text style={styles.addBtnText}>Add to List</Text>
            </TouchableOpacity>
          </>
        )}
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
  tabs: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#fff', borderWidth: 2, borderColor: '#d1d5db', alignItems: 'center' },
  tabActive: { backgroundColor: '#1B3150', borderColor: '#1B3150' },
  tabText: { fontSize: 12, fontWeight: '700', color: '#4b5563' },
  tabTextActive: { color: '#fff' },
  field: { marginBottom: 12 },
  label: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6 },
  sessionDisplay: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#d1d5db', borderRadius: 24, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center' },
  sessionText: { fontSize: 14, fontWeight: '700', color: '#1f2937' },
  input: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#d1d5db', borderRadius: 24, paddingVertical: 10, paddingHorizontal: 16, fontSize: 14, color: '#1f2937' },
  addBtn: { marginTop: 16, backgroundColor: '#1B3150', paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  specialGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  specialRow: { flexDirection: 'row', alignItems: 'center', width: '47%' },
  specialDigit: { width: 40, height: 40, backgroundColor: '#1B3150', borderWidth: 2, borderColor: '#d1d5db', borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  specialDigitText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  specialInput: { flex: 1, height: 40, backgroundColor: '#fff', borderWidth: 2, borderColor: '#d1d5db', borderRadius: 6, paddingHorizontal: 8, fontSize: 14, fontWeight: '600' },
});
