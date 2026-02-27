import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import BidLayout from '../BidLayout';
import BidReviewModal from './BidReviewModal';
import { placeBet, updateUserBalance } from '../../../api/bets';
import { useAuth } from '../../../context/AuthContext';
import { getBidTypeConfig } from '../../../config/bidTypes';

export default function EasyModeBid({
  market,
  title,
  label = 'Enter number',
  maxLength = 3,
  validateInput,
  betTypeKey,
  lockSessionToOpen = false,
}) {
  const config = getBidTypeConfig(title);
  const key = betTypeKey || config?.key || 'single';
  const [session, setSession] = useState(() =>
    lockSessionToOpen ? 'OPEN' : market?.status === 'running' ? 'CLOSE' : 'OPEN'
  );
  const [bids, setBids] = useState([]);
  const [inputNumber, setInputNumber] = useState('');
  const [inputPoints, setInputPoints] = useState('');
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [warning, setWarning] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const pointsInputRef = useRef(null);
  const { user } = useAuth();

  const isValid = validateInput || ((n) => n && String(n).trim().length > 0);
  const isRunning = market?.status === 'running';

  useEffect(() => {
    if (lockSessionToOpen && session !== 'OPEN') setSession('OPEN');
    if (!lockSessionToOpen && isRunning) setSession('CLOSE');
  }, [isRunning, lockSessionToOpen, session]);

  const showWarning = (msg) => {
    setWarning(msg);
    const t = setTimeout(() => setWarning(''), 2200);
    return () => clearTimeout(t);
  };

  const clearAll = () => {
    setBids([]);
    setInputNumber('');
    setInputPoints('');
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const handleDateChange = (newDate) => setSelectedDate(newDate);

  const handleAddBid = () => {
    const pts = Number(inputPoints);
    if (!pts || pts <= 0) {
      showWarning('Please enter points.');
      return;
    }
    const n = String(inputNumber ?? '').trim();
    if (!n) {
      showWarning(`Please enter ${label}.`);
      return;
    }
    if (maxLength && n.length !== maxLength) {
      showWarning(`Enter ${maxLength} digit(s) (e.g. ${maxLength === 2 ? '00-99' : '0-9'}).`);
      return;
    }
    if (!isValid(n)) {
      showWarning('Invalid number.');
      return;
    }
    setBids((prev) => [...prev, { id: Date.now(), number: n, points: String(pts), type: session }]);
    setInputNumber('');
    setInputPoints('');
    setIsReviewOpen(true);
  };

  const totalPoints = bids.reduce((sum, b) => sum + Number(b.points), 0);
  const dateText = new Date().toLocaleDateString('en-GB');
  const marketTitle = market?.gameName || market?.marketName || title;
  const walletBefore = Number(user?.wallet ?? user?.balance ?? user?.points ?? 0) || 0;

  const handleSubmitBet = async () => {
    const marketId = market?._id || market?.id;
    if (!marketId) throw new Error('Market not found');
    const bets = bids.map((b) => ({
      betType: key,
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
        <View style={styles.field}>
          <Text style={styles.label}>Game type:</Text>
          <View style={styles.sessionDisplay}>
            <Text style={styles.sessionText}>{session}</Text>
          </View>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>{label}:</Text>
          <TextInput
            style={styles.input}
            value={inputNumber}
            onChangeText={(v) => setInputNumber(v.replace(/\D/g, '').slice(0, maxLength || 10))}
            placeholder={maxLength === 2 ? '00-99' : 'Number'}
            keyboardType="number-pad"
            maxLength={maxLength || 10}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Points:</Text>
          <TextInput
            ref={pointsInputRef}
            style={styles.input}
            value={inputPoints}
            onChangeText={(v) => setInputPoints(v.replace(/\D/g, '').slice(0, 6))}
            placeholder="Points"
            keyboardType="number-pad"
          />
        </View>
        <TouchableOpacity onPress={handleAddBid} style={styles.addBtn} activeOpacity={0.9}>
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <BidReviewModal
        open={isReviewOpen}
        onClose={() => { setIsReviewOpen(false); clearAll(); }}
        onSubmit={handleSubmitBet}
        marketTitle={marketTitle}
        dateText={dateText}
        labelKey={label}
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
  field: { marginBottom: 12 },
  label: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6 },
  sessionDisplay: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#d1d5db', borderRadius: 24, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center' },
  sessionText: { fontSize: 14, fontWeight: '700', color: '#1f2937' },
  input: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#d1d5db', borderRadius: 24, paddingVertical: 10, paddingHorizontal: 16, fontSize: 14, color: '#1f2937' },
  addBtn: { marginTop: 16, backgroundColor: '#1B3150', paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
