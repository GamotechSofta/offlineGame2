import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Dimensions } from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SPECIAL_SCROLL_HEIGHT = Math.max(280, Math.min(SCREEN_HEIGHT * 0.52, 380));
import BidLayout from '../BidLayout';
import BidReviewModal from './BidReviewModal';
import { placeBet, updateUserBalance } from '../../../api/bets';
import { useAuth } from '../../../context/AuthContext';

const JODI_NUMBERS = Array.from({ length: 100 }, (_, i) => String(i).padStart(2, '0'));
const validateJodi = (n) => n && /^[0-9]{2}$/.test(String(n).trim());

export default function JodiBid({ market, title }) {
  const [activeTab, setActiveTab] = useState('easy'); // easy | special
  const [session, setSession] = useState('OPEN');
  const [inputJodi, setInputJodi] = useState('');
  const [inputPoints, setInputPoints] = useState('');
  const [list, setList] = useState([]);
  const [specialInputs, setSpecialInputs] = useState(() =>
    Object.fromEntries(JODI_NUMBERS.map((n) => [n, '']))
  );
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewRows, setReviewRows] = useState([]);
  const [warning, setWarning] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    setSession('OPEN');
  }, []);

  const showWarning = (msg) => {
    setWarning(msg);
    const t = setTimeout(() => setWarning(''), 2400);
    return () => clearTimeout(t);
  };

  const handleDateChange = (newDate) => setSelectedDate(newDate);

  const handleAddToList = () => {
    const jodi = String(inputJodi ?? '').trim().replace(/\s/g, '');
    const pts = Number(inputPoints);
    if (!jodi) {
      showWarning('Please enter Jodi.');
      return;
    }
    if (!validateJodi(jodi)) {
      showWarning('Jodi must be 2 digits (00-99).');
      return;
    }
    if (!pts || pts <= 0) {
      showWarning('Please enter points.');
      return;
    }
    setList((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), number: jodi, points: String(pts), type: session },
    ]);
    setInputJodi('');
    setInputPoints('');
  };

  const removeFromList = (id) => {
    setList((prev) => prev.filter((b) => b.id !== id));
  };

  const handleAddSpecialToList = () => {
    const toAdd = Object.entries(specialInputs)
      .filter(([, pts]) => Number(pts) > 0)
      .map(([num, pts]) => ({
        id: Date.now() + num + Math.random(),
        number: num,
        points: String(pts),
        type: 'OPEN',
      }));
    if (!toAdd.length) {
      showWarning('Please enter points for at least one Digit (00-99).');
      return;
    }
    setList((prev) => {
      const map = new Map();
      for (const b of prev) map.set(b.number, { ...b, points: String(Number(b.points || 0)) });
      for (const b of toAdd) {
        const cur = map.get(b.number);
        const addPts = Number(b.points || 0);
        if (cur) cur.points = String((Number(cur.points || 0) || 0) + addPts);
        else map.set(b.number, { ...b });
      }
      return Array.from(map.values());
    });
    setSpecialInputs(Object.fromEntries(JODI_NUMBERS.map((n) => [n, ''])));
  };

  const handleSubmitFromSpecial = () => {
    const toAdd = Object.entries(specialInputs)
      .filter(([, pts]) => Number(pts) > 0)
      .map(([num, pts]) => ({
        id: Date.now() + num + Math.random(),
        number: num,
        points: String(pts),
        type: 'OPEN',
      }));
    if (!toAdd.length && list.length === 0) {
      showWarning('Please enter points for at least one Digit (00-99).');
      return;
    }
    const merged = toAdd.length
      ? (() => {
          const map = new Map();
          for (const b of list) map.set(b.number, { ...b, points: String(Number(b.points || 0)) });
          for (const b of toAdd) {
            const cur = map.get(b.number);
            const addPts = Number(b.points || 0);
            if (cur) cur.points = String((Number(cur.points || 0) || 0) + addPts);
            else map.set(b.number, { ...b });
          }
          return Array.from(map.values());
        })()
      : list;
    setList(merged);
    setSpecialInputs(Object.fromEntries(JODI_NUMBERS.map((n) => [n, ''])));
    setReviewRows(merged);
    setIsReviewOpen(true);
  };

  const totalPoints = useMemo(() => list.reduce((sum, b) => sum + Number(b.points || 0), 0), [list]);
  const specialHasPoints = useMemo(
    () => Object.values(specialInputs).some((v) => Number(v) > 0),
    [specialInputs]
  );
  const canSubmit = list.length > 0 || (activeTab === 'special' && specialHasPoints);

  const dateText = new Date().toLocaleDateString('en-GB');
  const marketTitle = market?.gameName || market?.marketName || title;
  const { user } = useAuth();
  const walletBefore = Number(user?.wallet ?? user?.balance ?? user?.points ?? 0) || 0;

  const clearAll = () => {
    setIsReviewOpen(false);
    setReviewRows([]);
    setList([]);
    setInputJodi('');
    setInputPoints('');
    setSpecialInputs(Object.fromEntries(JODI_NUMBERS.map((n) => [n, ''])));
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const openReview = () => {
    if (activeTab === 'easy') {
      if (list.length === 0) {
        showWarning('Add at least one Jodi to the list.');
        return;
      }
      setReviewRows(list);
      setIsReviewOpen(true);
    } else {
      handleSubmitFromSpecial();
    }
  };

  const handleSubmitBet = async () => {
    const marketId = market?._id || market?.id;
    if (!marketId) throw new Error('Market not found');
    const rowsToSubmit = reviewRows.length ? reviewRows : list;
    const payload = rowsToSubmit.map((r) => ({
      betType: 'jodi',
      betNumber: String(r.number),
      amount: Number(r.points) || 0,
      betOn: 'open',
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

  const displayJodi = (jodi) => {
    const s = String(jodi).trim();
    if (s.length === 2) return `${s[0]} ${s[1]}`;
    return s;
  };

  const rowsForModal = useMemo(
    () =>
      (reviewRows.length ? reviewRows : list).map((r) => ({
        id: r.id,
        number: displayJodi(r.number),
        points: r.points,
        type: r.type || 'OPEN',
      })),
    [reviewRows, list]
  );
  const totalForModal = useMemo(
    () => (reviewRows.length ? reviewRows : list).reduce((s, b) => s + Number(b.points || 0), 0),
    [reviewRows, list]
  );

  return (
    <BidLayout
      market={market}
      title={title}
      bidsCount={list.length}
      totalPoints={totalPoints}
      showDateSession
      session={session}
      setSession={() => {}}
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
                <View style={styles.sessionDisplay}>
                  <Text style={styles.sessionText}>OPEN</Text>
                </View>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Enter Jodi:</Text>
                <TextInput
                  style={styles.input}
                  value={inputJodi}
                  onChangeText={(v) => setInputJodi(v.replace(/\D/g, '').slice(0, 2))}
                  placeholder="Jodi"
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
                <Text style={[styles.tableHeaderCell, styles.colJodi]}>Jodi</Text>
                <Text style={[styles.tableHeaderCell, styles.colPoint]}>Point</Text>
                <Text style={[styles.tableHeaderCell, styles.colType]}>Type</Text>
                <Text style={[styles.tableHeaderCell, styles.colDelete]}>Delete</Text>
              </View>
              {list.length === 0 ? (
                <View style={styles.emptyRow}>
                  <Text style={styles.emptyText}>No jodi added yet</Text>
                </View>
              ) : (
                list.map((row) => (
                  <View key={row.id} style={styles.tableRow}>
                    <Text style={[styles.tableCell, styles.colJodi]} numberOfLines={1}>{displayJodi(row.number)}</Text>
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
          <ScrollView
            style={[styles.specialScroll, { height: SPECIAL_SCROLL_HEIGHT }]}
            contentContainerStyle={styles.specialContent}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.specialGrid}>
              {JODI_NUMBERS.map((num) => (
                <View key={num} style={styles.specialCell}>
                  <View style={styles.specialJodiBox}>
                    <Text style={styles.specialJodiText}>{num[0]} {num[1]}</Text>
                  </View>
                  <TextInput
                    style={styles.specialPtsInput}
                    value={specialInputs[num] || ''}
                    onChangeText={(v) =>
                      setSpecialInputs((p) => ({ ...p, [num]: (v ?? '').replace(/\D/g, '').slice(0, 6) }))
                    }
                    placeholder="Pts"
                    placeholderTextColor="#9ca3af"
                    keyboardType="number-pad"
                  />
                </View>
              ))}
            </View>
            <View style={styles.specialActions}>
              <TouchableOpacity onPress={handleAddSpecialToList} style={styles.addBtn} activeOpacity={0.9}>
                <Text style={styles.addBtnText}>Add to List</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSubmitFromSpecial}
                disabled={!canSubmit}
                style={[styles.submitBtn, canSubmit ? styles.submitBtnActive : styles.submitBtnDisabled]}
                activeOpacity={0.9}
              >
                <Text style={styles.submitBtnText}>Submit Bet</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.bottomSpacer} />
          </ScrollView>
        )}
      </View>

      <BidReviewModal
        open={isReviewOpen}
        onClose={clearAll}
        onSubmit={handleSubmitBet}
        marketTitle={marketTitle}
        dateText={dateText}
        labelKey="Jodi"
        rows={rowsForModal}
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
  sessionDisplay: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  sessionText: { fontSize: 14, fontWeight: '700', color: '#1f2937' },
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
  colJodi: { flex: 1.2, minWidth: 56 },
  colPoint: { flex: 0.8, minWidth: 48 },
  colType: { flex: 0.9, minWidth: 56 },
  colDelete: { flex: 0.5, minWidth: 44, alignItems: 'center' },
  deleteBtn: { padding: 8 },
  deleteBtnText: { fontSize: 18 },
  emptyRow: { padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#6b7280' },
  specialScroll: { flexGrow: 0 },
  specialContent: { paddingBottom: 16 },
  specialGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-start' },
  specialCell: { flexDirection: 'row', alignItems: 'center', width: '48%', minWidth: 130 },
  specialJodiBox: {
    width: 44,
    height: 36,
    backgroundColor: '#1B3150',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  specialJodiText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  specialPtsInput: {
    flex: 1,
    height: 36,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 8,
    fontSize: 12,
    color: '#1f2937',
    paddingHorizontal: 10,
    paddingVertical: 0,
  },
  specialActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  bottomSpacer: { height: 20 },
});
