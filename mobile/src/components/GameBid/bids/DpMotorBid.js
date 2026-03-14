import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BidLayout from '../BidLayout';
import BidReviewModal from './BidReviewModal';
import { useBettingWindow } from '../BettingWindowContext';
import { placeBet, updateUserBalance } from '../../../api/bets';
import { useAuth } from '../../../context/AuthContext';

const sanitizeDigits = (v) => (v ?? '').toString().replace(/\D/g, '').slice(0, 10);
const sanitizePoints = (v) => (v ?? '').toString().replace(/\D/g, '').slice(0, 6);

/** Same validation as Double Pana: 3 digits, two consecutive same, first !== 0, digit ordering rules. */
function validateDoublePana(n) {
  if (!n) return false;
  const str = n.toString().trim();
  if (!/^[0-9]{3}$/.test(str)) return false;
  const digits = str.split('').map(Number);
  const [first, second, third] = digits;
  const hasConsecutiveSame = first === second || second === third;
  if (!hasConsecutiveSame) return false;
  if (first === 0) return false;
  if (second === 0 && third === 0) return true;
  if (first === second && third === 0) return true;
  if (third <= first) return false;
  return true;
}

/** Generate all 3-digit double pana combinations from unique digits (aab, aba, baa per pair), then filter to valid double pana only (same rules as Double Pana). */
function generateDoublePanaCombinations(digitStr) {
  const digits = [...new Set(digitStr.replace(/\D/g, '').split('').sort())];
  if (digits.length < 2) return [];
  const out = [];
  const n = digits.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const a = digits[i];
      const b = digits[j];
      out.push(a + a + b);
      out.push(a + b + a);
      out.push(b + a + a);
    }
  }
  const unique = [...new Set(out)];
  return unique.filter(validateDoublePana);
}

export default function DpMotorBid({ market, title }) {
  const [session, setSession] = useState(() =>
    market?.status === 'running' ? 'CLOSE' : 'OPEN'
  );
  const [digitInput, setDigitInput] = useState('');
  const [pointsInput, setPointsInput] = useState('');
  const [combinations, setCombinations] = useState([]);
  const [warning, setWarning] = useState('');
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewRows, setReviewRows] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() =>
    new Date().toISOString().split('T')[0]
  );

  const isRunning = market?.status === 'running';
  useEffect(() => {
    if (isRunning) setSession('CLOSE');
  }, [isRunning]);

  const showWarning = (msg) => {
    setWarning(msg);
    const t = setTimeout(() => setWarning(''), 2200);
    return () => clearTimeout(t);
  };

  const handleGenerate = () => {
    const digits = sanitizeDigits(digitInput);
    if (digits.length < 2) {
      showWarning('Enter at least 2 digits to generate double pana combinations.');
      return;
    }
    const rawPoints = sanitizePoints(pointsInput);
    const pts = parseInt(rawPoints, 10);
    if (!Number.isFinite(pts) || pts < 1) {
      showWarning('Please enter points.');
      return;
    }
    const combos = generateDoublePanaCombinations(digits);
    if (!combos.length) {
      showWarning('No valid double pana from these digits. Use same rules as Double Pana (e.g. 112, 220).');
      return;
    }
    setCombinations(
      combos.map((pana) => ({
        id: `${pana}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        pana,
        points: String(pts),
      }))
    );
  };

  const updatePoint = (id, value) => {
    setCombinations((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, points: sanitizePoints(value) } : c
      )
    );
  };

  const removeCombination = (id) => {
    setCombinations((prev) => prev.filter((c) => c.id !== id));
  };

  const rowsWithPoints = useMemo(
    () => combinations.filter((c) => Number(c.points) > 0),
    [combinations]
  );
  const bidsCount = rowsWithPoints.length;
  const totalPoints = useMemo(
    () => rowsWithPoints.reduce((sum, c) => sum + Number(c.points || 0), 0),
    [rowsWithPoints]
  );

  const openReview = () => {
    if (!rowsWithPoints.length) {
      showWarning('Add at least one combination with points, or generate and then submit.');
      return;
    }
    setReviewRows(
      rowsWithPoints.map((c) => ({
        id: c.id,
        number: c.pana,
        points: c.points,
        type: session,
      }))
    );
    setIsReviewOpen(true);
  };

  const totalPointsForFooter = useMemo(
    () => reviewRows.reduce((sum, r) => sum + Number(r.points || 0), 0),
    [reviewRows]
  );

  const handleSubmitBet = async () => {
    const marketId = market?._id || market?.id;
    if (!marketId) throw new Error('Market not found');
    const payload = reviewRows.map((r) => ({
      betType: 'dp-motor',
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
    if (result.data?.newBalance != null)
      await updateUserBalance(result.data.newBalance);
    setIsReviewOpen(false);
    setCombinations([]);
    setReviewRows([]);
  };

  const { width: screenWidth } = useWindowDimensions();
  const isNarrow = screenWidth < 400;
  const dateText = new Date().toLocaleDateString('en-GB');
  const marketTitle = market?.gameName || market?.marketName || title;
  const { user } = useAuth();
  const { allowed: bettingAllowed } = useBettingWindow();
  const walletBefore =
    Number(user?.wallet ?? user?.balance ?? user?.points ?? 0) || 0;

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
      setSelectedDate={setSelectedDate}
      hideFooter={true}
      walletBalance={walletBefore}
      stickyFooter={isNarrow ? (
        <View style={styles.stickyBar}>
          <View style={styles.stickyStats}>
            <Text style={styles.stickyLabel}>Bets</Text>
            <Text style={styles.stickyValue}>{bidsCount}</Text>
          </View>
          <View style={styles.stickyStats}>
            <Text style={styles.stickyLabel}>Points</Text>
            <Text style={styles.stickyValue}>{totalPoints}</Text>
          </View>
          <TouchableOpacity
            onPress={openReview}
            disabled={!bidsCount || !bettingAllowed}
            style={[
              styles.stickySubmitBtn,
              (bidsCount && bettingAllowed) ? styles.submitBtnActive : styles.submitBtnDisabled,
            ]}
            activeOpacity={0.9}
          >
            <Text style={styles.submitBtnText}>SUBMIT</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    >
      <View style={styles.wrap}>
        {warning ? (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>{warning}</Text>
          </View>
        ) : null}

        <View style={[styles.twoColRow, isNarrow && styles.twoColRowStack]}>
          <View style={[styles.leftCol, isNarrow && styles.leftColFull]}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Enter Digit</Text>
              <TextInput
                style={styles.input}
                value={digitInput}
                onChangeText={(v) => setDigitInput(sanitizeDigits(v))}
                placeholder="e.g. 12345"
                placeholderTextColor="#9ca3af"
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Enter Points</Text>
              <TextInput
                style={styles.input}
                value={pointsInput}
                onChangeText={(v) => setPointsInput(sanitizePoints(v))}
                placeholder="Points"
                placeholderTextColor="#9ca3af"
                keyboardType="number-pad"
              />
            </View>
            <TouchableOpacity
              onPress={handleGenerate}
              style={styles.generateBtn}
              activeOpacity={0.9}
            >
              <Text style={styles.generateBtnText}>GENERATE</Text>
            </TouchableOpacity>

            {!isNarrow ? (
              <>
                <View style={styles.footerBlock}>
                  <View style={styles.footerStat}>
                    <Text style={styles.footerStatLabel}>Bets</Text>
                    <Text style={styles.footerStatValue}>{bidsCount}</Text>
                  </View>
                  <View style={styles.footerStat}>
                    <Text style={styles.footerStatLabel}>Points</Text>
                    <Text style={styles.footerStatValue}>{totalPoints}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={openReview}
                  disabled={!bidsCount || !bettingAllowed}
                  style={[
                    styles.submitBtn,
                    (bidsCount && bettingAllowed) ? styles.submitBtnActive : styles.submitBtnDisabled,
                  ]}
                  activeOpacity={0.9}
                >
                  <Text style={styles.submitBtnText}>SUBMIT</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>

          <View style={[styles.tableWrap, isNarrow && styles.tableWrapFull]}>
            <View style={styles.tableHeader}>
              <View style={styles.tableHeaderSpMotar}>
                <Text style={styles.tableHeaderText}>Dp Motar</Text>
              </View>
              <View style={styles.tableHeaderPoint}>
                <Text style={styles.tableHeaderText}>Point</Text>
              </View>
              <View style={styles.tableHeaderDelete}>
                <Text style={styles.tableHeaderText}>Delete</Text>
              </View>
            </View>
            <ScrollView
              style={styles.tableScroll}
              showsVerticalScrollIndicator={false}
            >
              {combinations.length === 0 ? (
                <View style={styles.emptyRow}>
                  <Text style={styles.emptyText}>Generate to add</Text>
                </View>
              ) : (
                combinations.map((c) => (
                  <View key={c.id} style={styles.tableRow}>
                    <View style={styles.panaCell}>
                      <Text style={styles.panaText}>{c.pana}</Text>
                    </View>
                    <View style={styles.pointCell}>
                      <TextInput
                        style={styles.pointInput}
                        value={c.points}
                        onChangeText={(v) => updatePoint(c.id, v)}
                        keyboardType="number-pad"
                      />
                    </View>
                    <TouchableOpacity
                      onPress={() => removeCombination(c.id)}
                      style={styles.deleteBtn}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="trash-outline" size={20} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </View>

      <BidReviewModal
        open={isReviewOpen}
        onClose={() => {
          setIsReviewOpen(false);
        }}
        onSubmit={handleSubmitBet}
        marketTitle={marketTitle}
        dateText={dateText}
        labelKey="Dp Motar"
        rows={reviewRows}
        walletBefore={walletBefore}
        totalBids={reviewRows.length}
        totalAmount={totalPointsForFooter}
      />
    </BidLayout>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 12, paddingBottom: 24 },
  warningBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  warningText: { color: '#dc2626', fontSize: 14 },
  twoColRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  twoColRowStack: { flexDirection: 'column', gap: 16 },
  leftCol: { flex: 1, minWidth: 0, gap: 12 },
  leftColFull: { width: '100%' },
  label: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6 },
  inputGroup: {},
  input: {
    minHeight: 44,
    height: 44,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  generateBtn: {
    backgroundColor: '#1B3150',
    minHeight: 48,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  footerBlock: { flexDirection: 'row', gap: 24, marginTop: 8 },
  footerStat: { alignItems: 'center' },
  footerStatLabel: { fontSize: 10, color: '#4b5563' },
  footerStatValue: { fontSize: 16, fontWeight: '700', color: '#1B3150' },
  submitBtn: { marginTop: 12, minHeight: 48, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  submitBtnActive: { backgroundColor: '#1B3150' },
  submitBtnDisabled: { backgroundColor: '#9ca3af', opacity: 0.5 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  stickyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#E8ECEF',
    borderTopWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 8,
  },
  stickyStats: { alignItems: 'center' },
  stickyLabel: { fontSize: 9, color: '#4b5563' },
  stickyValue: { fontSize: 13, fontWeight: '700', color: '#1B3150' },
  stickySubmitBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  tableWrap: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableWrapFull: { width: '100%', minHeight: 200 },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1B3150',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  tableHeaderText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  tableHeaderSpMotar: { width: 72, alignItems: 'center' },
  tableHeaderPoint: { flex: 1, paddingHorizontal: 8, alignItems: 'center' },
  tableHeaderDelete: { width: 40, alignItems: 'center' },
  tableScroll: { maxHeight: 280, minHeight: 120 },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  panaCell: {
    width: 72,
    alignItems: 'center',
  },
  panaText: { fontSize: 14, fontWeight: '700', color: '#1f2937' },
  pointCell: { flex: 1, paddingHorizontal: 8 },
  pointInput: {
    height: 36,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 8,
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
  },
  deleteBtn: {
    width: 40,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 6,
  },
  emptyRow: { padding: 16, alignItems: 'center', backgroundColor: '#fff' },
  emptyText: { fontSize: 12, color: '#9ca3af' },
});
