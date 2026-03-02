import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import BidLayout from '../BidLayout';
import BidReviewModal from './BidReviewModal';
import { placeBet, updateUserBalance } from '../../../api/bets';
import { useAuth } from '../../../context/AuthContext';

// Triple Pana: 000, 111, 222, ... 999 (same digit 3x)
const isValidTriplePana = (n) => {
  const s = (n ?? '').toString().trim();
  if (!/^[0-9]{3}$/.test(s)) return false;
  return s[0] === s[1] && s[1] === s[2];
};

const TRIPLE_NUMBERS = ['000', '111', '222', '333', '444', '555', '666', '777', '888', '999'];

export default function TriplePanaBid({ market, title }) {
  const [activeTab, setActiveTab] = useState('easy');
  const [session, setSession] = useState(() => (market?.status === 'running' ? 'CLOSE' : 'OPEN'));
  const [inputPana, setInputPana] = useState('');
  const [inputPoints, setInputPoints] = useState('');
  const [list, setList] = useState([]);
  const [specialInputs, setSpecialInputs] = useState(() =>
    Object.fromEntries(TRIPLE_NUMBERS.map((n) => [n, '']))
  );
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
    const t = setTimeout(() => setWarning(''), 2400);
    return () => clearTimeout(t);
  };

  const handleDateChange = (newDate) => setSelectedDate(newDate);

  const handleAddBid = () => {
    const pana = String(inputPana ?? '').trim();
    const pts = Number(inputPoints);
    if (!pana) {
      showWarning('Please enter triple pana (000-999).');
      return;
    }
    if (!isValidTriplePana(pana)) {
      showWarning('Invalid triple pana. Use 000, 111, 222 ... 999.');
      return;
    }
    if (!pts || pts <= 0) {
      showWarning('Please enter points.');
      return;
    }
    setList((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), number: pana, points: String(pts), type: session },
    ]);
    setInputPana('');
    setInputPoints('');
  };

  const handleAddSpecialModeBids = () => {
    const toAdd = Object.entries(specialInputs)
      .filter(([, pts]) => Number(pts) > 0)
      .map(([num, pts]) => ({
        id: Date.now() + num + Math.random(),
        number: num,
        points: String(pts),
        type: session,
      }));

    if (!toAdd.length) {
      showWarning('Please enter points for at least one triple pana (000-999).');
      return;
    }
    setList((prev) => [...prev, ...toAdd]);
    setSpecialInputs(Object.fromEntries(TRIPLE_NUMBERS.map((n) => [n, ''])));
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
    setReviewRows([]);
    setList([]);
    setInputPana('');
    setInputPoints('');
    setSpecialInputs(Object.fromEntries(TRIPLE_NUMBERS.map((n) => [n, ''])));
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const openReview = () => {
    if (list.length === 0) {
      showWarning('Add at least one pana to the list.');
      return;
    }
    setReviewRows(list);
    setIsReviewOpen(true);
  };

  const handleSubmitBet = async () => {
    const marketId = market?._id || market?.id;
    if (!marketId) throw new Error('Market not found');
    const rowsToSubmit = reviewRows.length ? reviewRows : list;
    const payload = rowsToSubmit.map((r) => ({
      betType: 'panna',
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

  const rowsForModal = reviewRows.length ? reviewRows : list;
  const totalForModal = rowsForModal.reduce((s, b) => s + Number(b.points || 0), 0);

  // Easy mode: typing one digit can auto-expand to triple (e.g. 2 -> 222)
  const handlePanaChange = (v) => {
    const raw = v.replace(/\D/g, '').slice(0, 3);
    if (raw.length <= 1) {
      setInputPana(raw);
      return;
    }
    const d = raw[0];
    setInputPana(`${d}${d}${d}`);
  };

  const isPanaInvalid = inputPana.length === 3 && !isValidTriplePana(inputPana);

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
      onSubmit={openReview}
      walletBalance={walletBefore}
    >
      <View style={styles.wrap}>
        {warning ? (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>{warning}</Text>
          </View>
        ) : null}

        <View style={styles.modeRow}>
          <TouchableOpacity
            onPress={() => setActiveTab('easy')}
            style={[styles.modeBtn, activeTab === 'easy' && styles.modeBtnActive]}
            activeOpacity={0.85}
          >
            <Text style={[styles.modeBtnText, activeTab === 'easy' && styles.modeBtnTextActive]}>EASY MODE</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('special')}
            style={[styles.modeBtn, activeTab === 'special' && styles.modeBtnActive]}
            activeOpacity={0.85}
          >
            <Text style={[styles.modeBtnText, activeTab === 'special' && styles.modeBtnTextActive]}>SPECIAL MODE</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'easy' ? (
          <>
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
              <View style={styles.field}>
                <Text style={styles.label}>Enter Pana:</Text>
                <TextInput
                  style={[styles.input, isPanaInvalid && styles.inputInvalid]}
                  value={inputPana}
                  onChangeText={handlePanaChange}
                  placeholder="Pana"
                  placeholderTextColor="#9ca3af"
                  keyboardType="number-pad"
                  maxLength={3}
                />
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
              <TouchableOpacity onPress={handleAddBid} style={styles.addBtn} activeOpacity={0.9}>
                <Text style={styles.addBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.tableCard}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, styles.colPana]}>Pana</Text>
                <Text style={[styles.tableHeaderCell, styles.colPoint]}>Point</Text>
                <Text style={[styles.tableHeaderCell, styles.colType]}>Type</Text>
                <Text style={[styles.tableHeaderCell, styles.colDelete]}>Delete</Text>
              </View>
              {list.length === 0 ? (
                <View style={styles.emptyRow}>
                  <Text style={styles.emptyText}>No pana added yet</Text>
                </View>
              ) : (
                list.map((row) => (
                  <View key={row.id} style={styles.tableRow}>
                    <Text style={[styles.tableCell, styles.colPana]} numberOfLines={1}>{row.number}</Text>
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
          </>
        ) : (
          <>
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
            <View style={styles.specialGrid}>
              {TRIPLE_NUMBERS.map((num) => (
                <View key={num} style={styles.specialRow}>
                  <View style={styles.panaBox}>
                    <Text style={styles.panaText}>{num}</Text>
                  </View>
                  <TextInput
                    style={styles.ptsInput}
                    value={specialInputs[num]}
                    onChangeText={(v) =>
                      setSpecialInputs((p) => ({
                        ...p,
                        [num]: v.replace(/\D/g, '').slice(0, 6),
                      }))
                    }
                    placeholder="Pts"
                    placeholderTextColor="#9ca3af"
                    keyboardType="number-pad"
                  />
                </View>
              ))}
            </View>
            <TouchableOpacity onPress={handleAddSpecialModeBids} style={styles.addToListBtn} activeOpacity={0.9}>
              <Text style={styles.addToListBtnText}>Add to List</Text>
            </TouchableOpacity>
            <View style={styles.tableCard}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, styles.colPana]}>Pana</Text>
                <Text style={[styles.tableHeaderCell, styles.colPoint]}>Point</Text>
                <Text style={[styles.tableHeaderCell, styles.colType]}>Type</Text>
                <Text style={[styles.tableHeaderCell, styles.colDelete]}>Delete</Text>
              </View>
              {list.length === 0 ? (
                <View style={styles.emptyRow}>
                  <Text style={styles.emptyText}>No pana added yet</Text>
                </View>
              ) : (
                list.map((row) => (
                  <View key={row.id} style={styles.tableRow}>
                    <Text style={[styles.tableCell, styles.colPana]} numberOfLines={1}>{row.number}</Text>
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
          </>
        )}
      </View>

      <BidReviewModal
        open={isReviewOpen}
        onClose={clearAll}
        onSubmit={handleSubmitBet}
        marketTitle={marketTitle}
        dateText={dateText}
        labelKey="Pana"
        rows={rowsForModal.map((r) => ({ id: r.id, number: r.number, points: r.points, type: r.type || session }))}
        walletBefore={walletBefore}
        totalBids={rowsForModal.length}
        totalAmount={totalForModal}
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
  modeRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  modeBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeBtnActive: { backgroundColor: '#1B3150', borderColor: '#1B3150' },
  modeBtnText: { fontSize: 14, fontWeight: '700', color: '#6b7280' },
  modeBtnTextActive: { color: '#fff' },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    padding: 16,
    marginBottom: 16,
  },
  field: { marginBottom: 14 },
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
  inputInvalid: { borderColor: '#ef4444' },
  addBtn: {
    backgroundColor: '#1B3150',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  specialGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
    justifyContent: 'center',
  },
  specialRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  panaBox: {
    minWidth: 48,
    height: 40,
    backgroundColor: '#1B3150',
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panaText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  ptsInput: {
    width: 72,
    height: 40,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 8,
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
  },
  addToListBtn: {
    backgroundColor: '#1B3150',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  addToListBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
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
  colPana: { flex: 1.2, minWidth: 56 },
  colPoint: { flex: 0.8, minWidth: 48 },
  colType: { flex: 0.9, minWidth: 56 },
  colDelete: { flex: 0.5, minWidth: 44, alignItems: 'center' },
  deleteBtn: { padding: 8 },
  deleteBtnText: { fontSize: 18 },
  emptyRow: { padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#6b7280' },
});
