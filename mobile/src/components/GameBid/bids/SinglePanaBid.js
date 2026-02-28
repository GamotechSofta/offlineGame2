import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import BidLayout from '../BidLayout';
import BidReviewModal from './BidReviewModal';
import { placeBet, updateUserBalance } from '../../../api/bets';
import { useAuth } from '../../../context/AuthContext';

// Valid Single Pana set (from frontend SinglePanaBid / panaRules)
const VALID_SINGLE_PANAS = [
  '127', '136', '145', '190', '235', '280', '370', '389', '460', '479', '569', '578',
  '128', '137', '146', '236', '245', '290', '380', '470', '489', '560', '579', '678',
  '129', '138', '147', '156', '237', '246', '345', '390', '480', '570', '589', '679',
  '120', '139', '148', '157', '238', '247', '256', '346', '490', '580', '670', '689',
  '130', '149', '158', '167', '239', '248', '257', '347', '356', '590', '680', '789',
  '140', '159', '168', '230', '249', '258', '267', '348', '357', '456', '690', '780',
  '123', '150', '169', '178', '240', '259', '268', '349', '358', '367', '457', '790',
  '124', '133', '142', '151', '160', '179', '250', '278', '340', '359', '467', '890',
  '125', '134', '170', '189', '260', '279', '350', '369', '378', '459', '468', '567',
  '126', '135', '180', '234', '270', '289', '360', '379', '450', '469', '478', '568',
];
const VALID_SET = new Set(VALID_SINGLE_PANAS);

const validateSinglePana = (n) => {
  const s = (n ?? '').toString().trim();
  if (!/^[0-9]{3}$/.test(s)) return false;
  return VALID_SET.has(s);
};

const findPanaBySum = (targetNum) => {
  const matches = [];
  for (const pana of VALID_SINGLE_PANAS) {
    const digits = pana.split('').map(Number);
    const sum = digits[0] + digits[1] + digits[2];
    const unitPlace = sum % 10;
    if (sum === targetNum || unitPlace === targetNum) matches.push(pana);
  }
  return matches;
};

export default function SinglePanaBid({ market, title }) {
  const [activeTab, setActiveTab] = useState('easy');
  const [session, setSession] = useState(() => (market?.status === 'running' ? 'CLOSE' : 'OPEN'));
  const [inputPana, setInputPana] = useState('');
  const [inputPoints, setInputPoints] = useState('');
  const [list, setList] = useState([]);
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

  const mergeBids = (prev, incoming) => {
    const map = new Map();
    for (const b of prev || []) {
      const num = (b?.number ?? '').toString().trim();
      const type = (b?.type ?? '').toString().trim();
      const key = `${num}__${type}`;
      map.set(key, { ...b, number: num, type, points: String(Number(b?.points || 0) || 0) });
    }
    for (const b of incoming || []) {
      const num = (b?.number ?? '').toString().trim();
      const type = (b?.type ?? '').toString().trim();
      const key = `${num}__${type}`;
      const pts = Number(b?.points || 0) || 0;
      const existing = map.get(key);
      if (existing) {
        existing.points = String((Number(existing.points || 0) || 0) + pts);
      } else {
        map.set(key, { id: b?.id ?? `${Date.now()}-${Math.random()}`, number: num, points: String(pts), type });
      }
    }
    return Array.from(map.values());
  };

  const handleAddToList = () => {
    const pana = String(inputPana ?? '').trim();
    const pts = Number(inputPoints);
    if (!pana) {
      showWarning('Please enter Pana.');
      return;
    }
    if (!validateSinglePana(pana)) {
      showWarning('Invalid Single Pana. Use 3 distinct digits from valid chart.');
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

  const removeFromList = (id) => {
    setList((prev) => prev.filter((b) => b.id !== id));
  };

  const handleSumClick = (num) => {
    const pts = Number(inputPoints);
    if (!pts || pts <= 0) {
      showWarning('Enter points to add.');
      return;
    }
    const matches = findPanaBySum(num);
    if (matches.length === 0) {
      showWarning(`No single pana with sum ${num}.`);
      return;
    }
    const toAdd = matches.map((pana) => ({
      id: Date.now() + pana + Math.random(),
      number: pana,
      points: String(pts),
      type: session,
    }));
    setList((prev) => mergeBids(prev, toAdd));
    showWarning(`Added ${matches.length} single pana with sum ${num}`);
  };

  const pointsBySum = useMemo(() => {
    const sumMap = {};
    for (let i = 0; i <= 9; i++) sumMap[i] = 0;
    list.forEach((bid) => {
      const pana = bid.number;
      if (VALID_SET.has(pana)) {
        const digits = pana.split('').map(Number);
        const sum = digits[0] + digits[1] + digits[2];
        const unitPlace = sum % 10;
        const points = Number(bid.points) || 0;
        if (sum <= 9) sumMap[sum] = (sumMap[sum] || 0) + points;
        else sumMap[unitPlace] = (sumMap[unitPlace] || 0) + points;
      }
    });
    return sumMap;
  }, [list]);

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
                  style={styles.input}
                  value={inputPana}
                  onChangeText={(v) => setInputPana(v.replace(/\D/g, '').slice(0, 3))}
                  placeholder="Pana"
                  placeholderTextColor="#9ca3af"
                  keyboardType="number-pad"
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
              <View style={styles.actionRow}>
                <TouchableOpacity onPress={handleAddToList} style={styles.addBtn} activeOpacity={0.9}>
                  <Text style={styles.addBtnText}>Add to List</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={openReview}
                  disabled={list.length === 0}
                  style={[styles.submitBtn, list.length > 0 ? styles.submitBtnActive : styles.submitBtnDisabled]}
                  activeOpacity={0.9}
                >
                  <Text style={styles.submitBtnText}>Submit Bet</Text>
                </TouchableOpacity>
              </View>
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
            <View style={styles.sumCard}>
              <Text style={styles.sumTitle}>Select Sum</Text>
              <View style={styles.sumGrid}>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
                  const totalForSum = pointsBySum[num] || 0;
                  const hasPoints = Number(inputPoints) > 0;
                  return (
                    <TouchableOpacity
                      key={num}
                      onPress={() => hasPoints && handleSumClick(num)}
                      disabled={!hasPoints}
                      style={[styles.sumBtn, !hasPoints && styles.sumBtnDisabled]}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.sumBtnText, !hasPoints && styles.sumBtnTextDisabled]}>{num}</Text>
                      {totalForSum > 0 && (
                        <View style={styles.sumBadge}>
                          <Text style={styles.sumBadgeText}>{totalForSum > 999 ? '999+' : totalForSum}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
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
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  addBtn: {
    flex: 1,
    backgroundColor: '#1B3150',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  submitBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnActive: { backgroundColor: '#1B3150' },
  submitBtnDisabled: { backgroundColor: '#9ca3af', opacity: 0.5 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  sumCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    padding: 16,
    marginBottom: 16,
  },
  sumTitle: { fontSize: 14, fontWeight: '700', color: '#1B3150', textAlign: 'center', marginBottom: 12 },
  sumGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  sumBtn: {
    width: '18%',
    minWidth: 56,
    aspectRatio: 1,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sumBtnDisabled: { opacity: 0.5 },
  sumBtnText: { fontSize: 18, fontWeight: '700', color: '#1f2937' },
  sumBtnTextDisabled: { color: '#9ca3af' },
  sumBadge: {
    position: 'absolute',
    top: 4,
    right: 6,
    backgroundColor: '#1B3150',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  sumBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
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
