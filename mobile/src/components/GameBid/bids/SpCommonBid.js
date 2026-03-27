import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import BidLayout from '../BidLayout';
import BidReviewModal from './BidReviewModal';
import { placeBet, updateUserBalance } from '../../../api/bets';
import { useAuth } from '../../../context/AuthContext';

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * SP Common: bet on the result digit (0-9). Win when (sum of digits of open/close panel) % 10 equals your digit.
 */
export default function SpCommonBid({ market, title }) {
  const [session, setSession] = useState(() => (market?.status === 'running' ? 'CLOSE' : 'OPEN'));
  const [inputs, setInputs] = useState(() => Object.fromEntries(DIGITS.map((d) => [d, ''])));
  const [list, setList] = useState([]);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [warning, setWarning] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);

  const isRunning = market?.status === 'running';
  useEffect(() => {
    if (isRunning) setSession('CLOSE');
  }, [isRunning]);

  const showWarning = (msg) => {
    setWarning(msg);
    const t = setTimeout(() => setWarning(''), 2400);
    return () => clearTimeout(t);
  };

  const handleDateChange = (newDate) => setSelectedDate(newDate);

  const countWithPoints = useMemo(
    () => Object.values(inputs).filter((v) => Number(v) > 0).length,
    [inputs]
  );

  const handleAddToList = () => {
    const toAdd = DIGITS.filter((num) => Number(inputs[num]) > 0).map((num) => ({
      id: `${Date.now()}-${num}-${Math.random()}`,
      number: String(num),
      points: String(inputs[num]),
      type: session,
    }));
    if (toAdd.length === 0) {
      showWarning('Please enter points for at least one digit (0-9).');
      return;
    }
    setList((prev) => [...prev, ...toAdd]);
    setInputs(Object.fromEntries(DIGITS.map((d) => [d, ''])));
    setIsReviewOpen(true);
  };

  const removeFromList = (id) => {
    setList((prev) => prev.filter((b) => b.id !== id));
  };

  const totalPoints = useMemo(() => list.reduce((sum, b) => sum + Number(b.points || 0), 0), [list]);
  const dateText = new Date().toLocaleDateString('en-GB');
  const marketTitle = market?.gameName || market?.marketName || title;
  const { user } = useAuth();
  const walletBefore = Number(user?.wallet ?? user?.balance ?? user?.points ?? 0) || 0;

  const clearAll = () => {
    setIsReviewOpen(false);
    setList([]);
    setInputs(Object.fromEntries(DIGITS.map((d) => [d, ''])));
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const handleSubmitBet = async () => {
    const marketId = market?._id || market?.id;
    if (!marketId) throw new Error('Market not found');
    const payload = list.map((r) => ({
      betType: 'sp-common',
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

  return (
    <BidLayout
      market={market}
      title={title}
      bidsCount={list.length}
      totalPoints={totalPoints}
      showDateSession
      session={session}
      setSession={setSession}
      selectedDate={selectedDate}
      setSelectedDate={handleDateChange}
      hideFooter={false}
      showFooterStats={false}
      submitLabel="Submit Bet"
      onSubmit={list.length > 0 ? () => setIsReviewOpen(true) : () => showWarning('Add at least one digit (0-9) to the list.')}
      walletBalance={walletBefore}
    >
      <View style={styles.wrap}>
        {warning ? (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>{warning}</Text>
          </View>
        ) : null}
        <Text style={styles.hint}>Bet on result digit (0-9). Win when open/close digit-sum last digit matches.</Text>
        <View style={styles.formCard}>
          <View style={styles.field}>
            <Text style={styles.label}>Select Game Type:</Text>
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
        </View>
        <View style={styles.digitGrid}>
          {DIGITS.map((num) => (
            <View key={num} style={styles.digitRow}>
              <View style={styles.digitLabel}>
                <Text style={styles.digitLabelText}>{num}</Text>
              </View>
              <TextInput
                style={styles.digitInput}
                value={inputs[num]}
                onChangeText={(v) => setInputs((p) => ({ ...p, [num]: v.replace(/\D/g, '').slice(0, 6) }))}
                placeholder="Pts"
                placeholderTextColor="#9ca3af"
                keyboardType="number-pad"
              />
            </View>
          ))}
        </View>
        <TouchableOpacity
          onPress={handleAddToList}
          style={[styles.addBtn, countWithPoints === 0 && styles.addBtnDisabled]}
          activeOpacity={0.9}
          disabled={countWithPoints === 0}
        >
          <Text style={styles.addBtnText}>Add to List {countWithPoints > 0 ? `(${countWithPoints})` : ''}</Text>
        </TouchableOpacity>
        <View style={styles.tableCard}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colDigit]}>Digit</Text>
            <Text style={[styles.tableHeaderCell, styles.colPoint]}>Point</Text>
            <Text style={[styles.tableHeaderCell, styles.colType]}>Type</Text>
            <Text style={[styles.tableHeaderCell, styles.colDelete]}>Delete</Text>
          </View>
          {list.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={styles.emptyText}>No SP Common digit added yet</Text>
            </View>
          ) : (
            list.map((row) => (
              <View key={row.id} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.colDigit]}>{row.number}</Text>
                <Text style={[styles.tableCell, styles.colPoint]}>{row.points}</Text>
                <Text style={[styles.tableCell, styles.colType]}>{row.type}</Text>
                <View style={styles.colDelete}>
                  <TouchableOpacity onPress={() => removeFromList(row.id)} style={styles.deleteBtn} activeOpacity={0.8}>
                    <Text style={styles.deleteBtnText}>🗑</Text>
                  </TouchableOpacity>
                </View>
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
        labelKey="Digit"
        rows={list.map((r) => ({ id: r.id, number: r.number, points: r.points, type: r.type || session }))}
        walletBefore={walletBefore}
        totalBids={list.length}
        totalAmount={totalPoints}
      />
    </BidLayout>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 12, paddingBottom: 8 },
  warningBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 2,
    borderColor: '#fca5a5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  warningText: { color: '#dc2626', fontSize: 14 },
  hint: { fontSize: 13, color: '#6b7280', marginBottom: 12 },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    padding: 16,
    marginBottom: 16,
  },
  field: { marginBottom: 0 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
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
  sessionBtnText: { fontSize: 14, fontWeight: '700', color: '#6b7280' },
  sessionBtnTextActive: { color: '#fff' },
  digitGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  digitRow: { flexDirection: 'row', alignItems: 'center', width: '30%', minWidth: 100 },
  digitLabel: {
    width: 36,
    height: 40,
    backgroundColor: '#1B3150',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitLabelText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  digitInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderLeftWidth: 0,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    paddingHorizontal: 8,
    fontSize: 14,
    color: '#1f2937',
  },
  addBtn: {
    backgroundColor: '#1B3150',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  addBtnDisabled: { opacity: 0.5 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
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
    borderBottomWidth: 2,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  tableHeaderCell: { fontSize: 12, fontWeight: '700', color: '#1B3150' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  tableCell: { fontSize: 13, fontWeight: '600', color: '#1f2937' },
  colDigit: { flex: 0.6, minWidth: 36 },
  colPoint: { flex: 0.8, minWidth: 48 },
  colType: { flex: 0.9, minWidth: 56 },
  colDelete: { flex: 0.5, minWidth: 44, alignItems: 'center' },
  deleteBtn: { padding: 8 },
  deleteBtnText: { fontSize: 18 },
  emptyRow: { padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#6b7280' },
});
