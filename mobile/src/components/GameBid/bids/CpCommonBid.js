import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import BidLayout from '../BidLayout';
import BidReviewModal from './BidReviewModal';
import { placeBet, updateUserBalance } from '../../../api/bets';
import { useAuth } from '../../../context/AuthContext';
import { useBettingWindow } from '../BettingWindowContext';
import { generateCPCommon } from './cpCommonGenerator';

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const GRID_GAP = 8;
const PICK_COLS = 5;

export default function CpCommonBid({ market, title }) {
  const [session, setSession] = useState(() => (market?.status === 'running' ? 'CLOSE' : 'OPEN'));
  const [selectedDigits, setSelectedDigits] = useState([]);
  const [pointsInput, setPointsInput] = useState('');
  const [generatedRows, setGeneratedRows] = useState([]);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewRows, setReviewRows] = useState([]);
  const [warning, setWarning] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);

  const isRunning = market?.status === 'running';
  useEffect(() => {
    if (isRunning) setSession('CLOSE');
  }, [isRunning]);

  const showWarning = (msg) => {
    setWarning(msg);
    setTimeout(() => setWarning(''), 2400);
  };

  const toggleDigit = (d) => {
    const digit = String(d);
    if (selectedDigits.includes(digit)) {
      setSelectedDigits((prev) => prev.filter((x) => x !== digit));
      return;
    }
    if (selectedDigits.length >= 2) {
      showWarning('Select at most 2 digits for CP (Common Pana).');
      return;
    }
    setSelectedDigits([...selectedDigits, digit].sort((a, b) => Number(a) - Number(b)));
  };

  const handleDateChange = (newDate) => setSelectedDate(newDate);

  const rowsWithPoints = useMemo(
    () => generatedRows.filter((row) => Number(row.points) > 0),
    [generatedRows]
  );
  const bidsCount = rowsWithPoints.length;
  const totalPoints = useMemo(
    () => rowsWithPoints.reduce((sum, row) => sum + (Number(row.points) || 0), 0),
    [rowsWithPoints]
  );

  const clearLocal = () => {
    setSelectedDigits([]);
    setPointsInput('');
    setGeneratedRows([]);
  };

  const handleGenerate = () => {
    const digitsInput = selectedDigits.join('');
    if (!digitsInput) {
      showWarning('Please select at least one digit (0-9), at most two.');
      return;
    }
    const result = generateCPCommon({ digitsInput, points: Number(pointsInput) });
    if (!result.success) {
      showWarning(result.message);
      return;
    }
    const now = Date.now();
    setGeneratedRows(
      result.data.map((row, idx) => ({
        id: `${row.pana}-${now}-${idx}`,
        pana: row.pana,
        points: String(row.points),
      }))
    );
  };

  const updatePoint = (id, value) => {
    const clean = (value ?? '').toString().replace(/\D/g, '').slice(0, 6);
    setGeneratedRows((prev) => prev.map((row) => (row.id === id ? { ...row, points: clean } : row)));
  };

  const removeRow = (id) => {
    setGeneratedRows((prev) => prev.filter((row) => row.id !== id));
  };

  const openReview = () => {
    const items = rowsWithPoints.map((row) => ({
      id: row.id,
      number: row.pana,
      points: String(row.points),
      type: session,
    }));
    if (!items.length) {
      showWarning('Generate and keep at least one row with points.');
      return;
    }
    setReviewRows(items);
    setIsReviewOpen(true);
  };

  const totalReview = useMemo(
    () => reviewRows.reduce((sum, r) => sum + Number(r.points || 0), 0),
    [reviewRows]
  );

  const dateText = new Date().toLocaleDateString('en-GB');
  const pickSize = Math.floor(
    (Dimensions.get('window').width - 32 - GRID_GAP * (PICK_COLS - 1)) / PICK_COLS
  );
  const marketTitle = market?.gameName || market?.marketName || title;
  const { user } = useAuth();
  const walletBefore = Number(user?.wallet ?? user?.balance ?? user?.points ?? 0) || 0;
  const { allowed: bettingAllowed } = useBettingWindow();

  const handleSubmitBet = async () => {
    const marketId = market?._id || market?.id;
    if (!marketId) throw new Error('Market not found');
    const payload = reviewRows
      .map((row) => ({
        betType: 'cp-common',
        betNumber: String(row.number || '').trim(),
        amount: Number(row.points) || 0,
        betOn: String(row?.type || session).toUpperCase() === 'CLOSE' ? 'close' : 'open',
      }))
      .filter((bet) => /^[0-9]{3}$/.test(bet.betNumber) && bet.amount > 0);
    if (!payload.length) throw new Error('No valid bets to place');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDateObj = new Date(selectedDate);
    selectedDateObj.setHours(0, 0, 0, 0);
    const scheduledDate = selectedDateObj > today ? selectedDate : null;

    const result = await placeBet(marketId, payload, scheduledDate);
    if (!result.success) throw new Error(result.message);
    if (result.data?.newBalance != null) await updateUserBalance(result.data.newBalance);
    setIsReviewOpen(false);
    setReviewRows([]);
    clearLocal();
  };

  return (
    <BidLayout
      market={market}
      title={title}
      bidsCount={bidsCount}
      totalPoints={totalPoints}
      showDateSession
      session={session}
      setSession={setSession}
      selectedDate={selectedDate}
      setSelectedDate={handleDateChange}
      hideFooter
      showFooterStats={false}
      walletBalance={walletBefore}
      extraHeader={
        <View style={styles.statsBar}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Count</Text>
            <Text style={styles.statVal}>{bidsCount}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Bet Amount</Text>
            <Text style={styles.statVal}>{totalPoints}</Text>
          </View>
        </View>
      }
    >
      <View style={styles.wrap}>
        {warning ? (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>{warning}</Text>
          </View>
        ) : null}

        <View style={styles.formCard}>
          <Text style={styles.label}>Session</Text>
          <View style={styles.sessionRow}>
            <TouchableOpacity
              onPress={() => !isRunning && setSession('OPEN')}
              style={[styles.sessionBtn, session === 'OPEN' && styles.sessionBtnActive]}
              disabled={isRunning}
              activeOpacity={0.8}
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

        <Text style={styles.fieldLabel}>Select Digits</Text>
        <View style={styles.digitPickGrid}>
          {DIGITS.map((d) => {
            const selected = selectedDigits.includes(String(d));
            return (
              <TouchableOpacity
                key={d}
                onPress={() => toggleDigit(d)}
                activeOpacity={0.85}
                style={[
                  styles.digitPickBtn,
                  { width: pickSize, height: pickSize },
                  selected && styles.digitPickBtnActive,
                ]}
              >
                <Text style={[styles.digitPickText, selected && styles.digitPickTextActive]}>{d}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.fieldLabel}>Enter Digit</Text>
        <TextInput
          style={[styles.input, styles.inputReadOnly]}
          value={selectedDigits.join(',')}
          editable={false}
          placeholder="e.g. 1,2"
          placeholderTextColor="#9ca3af"
        />

        <View style={styles.rowPts}>
          <Text style={styles.fieldLabel}>Points</Text>
          <TextInput
            style={[styles.input, styles.inputFlex]}
            value={pointsInput}
            onChangeText={(v) => setPointsInput(v.replace(/\D/g, '').slice(0, 6))}
            placeholder="Points"
            placeholderTextColor="#9ca3af"
            keyboardType="number-pad"
          />
          <TouchableOpacity onPress={clearLocal} style={styles.clearBtn} activeOpacity={0.8}>
            <Text style={styles.clearBtnText}>Clear</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.rowBtns}>
          <TouchableOpacity style={styles.genBtn} onPress={handleGenerate} activeOpacity={0.9}>
            <Text style={styles.genBtnText}>GENERATE</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitBtn, (!bidsCount || !bettingAllowed) && styles.submitBtnDisabled]}
            onPress={openReview}
            disabled={!bidsCount || !bettingAllowed}
            activeOpacity={0.9}
          >
            <Text style={styles.submitBtnText}>Submit {bidsCount > 0 ? `(${bidsCount})` : ''}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tableCard}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.colP]}>Pana</Text>
            <Text style={[styles.th, styles.colPt]}>Pt</Text>
            <Text style={[styles.th, styles.colT]}>Type</Text>
            <Text style={[styles.th, styles.colX]}> </Text>
          </View>
          {generatedRows.length === 0 ? (
            <Text style={styles.empty}>Generate to add</Text>
          ) : (
            generatedRows.map((row) => (
              <View key={row.id} style={styles.tableRow}>
                <Text style={[styles.td, styles.colP]}>{row.pana}</Text>
                <TextInput
                  style={[styles.tdInput, styles.colPt]}
                  value={row.points}
                  onChangeText={(v) => updatePoint(row.id, v)}
                  keyboardType="number-pad"
                />
                <Text style={[styles.td, styles.colT]}>{session}</Text>
                <TouchableOpacity style={styles.colX} onPress={() => removeRow(row.id)} hitSlop={12}>
                  <Text style={styles.del}>🗑</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </View>

      <BidReviewModal
        open={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        onSubmit={handleSubmitBet}
        marketTitle={marketTitle}
        dateText={dateText}
        labelKey="Pana"
        rows={reviewRows}
        walletBefore={walletBefore}
        totalBids={reviewRows.length}
        totalAmount={totalReview}
      />
    </BidLayout>
  );
}

const styles = StyleSheet.create({
  statsBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 4, paddingBottom: 8 },
  statBox: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#d1d5db',
    paddingVertical: 8,
    alignItems: 'center',
  },
  statLabel: { fontSize: 10, color: '#6b7280', fontWeight: '600' },
  statVal: { fontSize: 16, fontWeight: '800', color: '#1B3150' },
  wrap: { paddingBottom: 24 },
  warningBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 2,
    borderColor: '#fca5a5',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  warningText: { color: '#dc2626', fontSize: 13 },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    padding: 14,
    marginBottom: 12,
  },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
  sessionRow: { flexDirection: 'row', gap: 10 },
  sessionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  sessionBtnActive: { backgroundColor: '#1B3150', borderColor: '#1B3150' },
  sessionBtnText: { fontWeight: '700', color: '#6b7280' },
  sessionBtnTextActive: { color: '#fff' },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#4b5563', marginBottom: 6 },
  digitPickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    marginBottom: 12,
  },
  digitPickBtn: {
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitPickBtnActive: {
    backgroundColor: '#1B3150',
    borderColor: '#1B3150',
  },
  digitPickText: { fontSize: 17, fontWeight: '800', color: '#1B3150' },
  digitPickTextActive: { color: '#fff' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    letterSpacing: 3,
  },
  inputReadOnly: { backgroundColor: '#f9fafb', color: '#374151' },
  rowPts: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  inputFlex: { flex: 1, marginBottom: 0 },
  clearBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(27,49,80,0.35)',
  },
  clearBtnText: { fontWeight: '700', color: '#1B3150', fontSize: 12 },
  rowBtns: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  genBtn: {
    flex: 1,
    backgroundColor: '#1B3150',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  genBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  submitBtn: {
    flex: 1,
    backgroundColor: '#1B3150',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  tableCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#e5e7eb',
  },
  th: { fontSize: 11, fontWeight: '800', color: '#1B3150' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  td: { fontSize: 14, fontWeight: '700', color: '#111827' },
  tdInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingVertical: 6,
    textAlign: 'center',
    fontWeight: '700',
    color: '#1B3150',
    backgroundColor: '#fff',
  },
  colP: { flex: 1, minWidth: 52 },
  colPt: { flex: 1, minWidth: 44 },
  colT: { width: 52, textAlign: 'center' },
  colX: { width: 40, alignItems: 'center' },
  del: { fontSize: 16 },
  empty: { textAlign: 'center', color: '#9ca3af', padding: 20, fontSize: 13 },
});
