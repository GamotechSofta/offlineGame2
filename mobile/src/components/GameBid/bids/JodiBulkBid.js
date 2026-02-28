import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import BidLayout from '../BidLayout';
import BidReviewModal from './BidReviewModal';
import { placeBet, updateUserBalance } from '../../../api/bets';
import { useAuth } from '../../../context/AuthContext';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const MOBILE_VISIBLE_COLS = 5;
const sanitizePoints = (v) => (v ?? '').toString().replace(/\D/g, '').slice(0, 6);

const emptyCells = () => {
  const init = {};
  for (const r of DIGITS) for (const c of DIGITS) init[`${r}${c}`] = '';
  return init;
};
const emptyBulk = () => Object.fromEntries(DIGITS.map((d) => [d, '']));

export default function JodiBulkBid({ market, title }) {
  const [session, setSession] = useState(() => (market?.status === 'running' ? 'CLOSE' : 'OPEN'));
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [warning, setWarning] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [cells, setCells] = useState(() => emptyCells());
  const [rowBulk, setRowBulk] = useState(() => emptyBulk());
  const [colBulk, setColBulk] = useState(() => emptyBulk());
  const [columnStart, setColumnStart] = useState(0);

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

  const visibleDigits = useMemo(
    () => DIGITS.slice(columnStart, columnStart + MOBILE_VISIBLE_COLS),
    [columnStart]
  );
  const canSlideLeft = columnStart > 0;
  const canSlideRight = columnStart + MOBILE_VISIBLE_COLS < DIGITS.length;

  const applyRow = (r, pts) => {
    const p = Number(pts);
    if (!p || p <= 0) {
      showWarning('Please enter points.');
      return;
    }
    setCells((prev) => {
      const next = { ...prev };
      for (const c of DIGITS) {
        const key = `${r}${c}`;
        const cur = Number(next[key] || 0) || 0;
        next[key] = String(cur + p);
      }
      return next;
    });
    setRowBulk((prev) => ({ ...prev, [r]: '' }));
  };

  const applyCol = (c, pts) => {
    const p = Number(pts);
    if (!p || p <= 0) {
      showWarning('Please enter points.');
      return;
    }
    setCells((prev) => {
      const next = { ...prev };
      for (const r of DIGITS) {
        const key = `${r}${c}`;
        const cur = Number(next[key] || 0) || 0;
        next[key] = String(cur + p);
      }
      return next;
    });
    setColBulk((prev) => ({ ...prev, [c]: '' }));
  };

  const matrixRows = useMemo(() => {
    const out = [];
    for (const r of DIGITS) {
      for (const c of DIGITS) {
        const key = `${r}${c}`;
        const pts = Number(cells[key] || 0);
        if (pts > 0) out.push({ id: `${key}-${pts}`, number: key, points: String(pts), type: 'OPEN' });
      }
    }
    return out;
  }, [cells]);

  const matrixTotalPoints = useMemo(
    () => matrixRows.reduce((sum, b) => sum + Number(b.points || 0), 0),
    [matrixRows]
  );

  const dateText = new Date().toLocaleDateString('en-GB');
  const marketTitle = market?.gameName || market?.marketName || title;
  const { user } = useAuth();
  const walletBefore = Number(user?.wallet ?? user?.balance ?? user?.points ?? 0) || 0;

  const clearMatrix = () => {
    setCells(emptyCells());
    setRowBulk(emptyBulk());
    setColBulk(emptyBulk());
  };

  const clearAll = () => {
    setIsReviewOpen(false);
    clearMatrix();
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const handleSubmitBet = async () => {
    const marketId = market?._id || market?.id;
    if (!marketId) throw new Error('Market not found');
    const payload = matrixRows.map((r) => ({
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

  const openReview = () => {
    if (matrixRows.length === 0) {
      showWarning('Please enter points for at least one Jodi.');
      return;
    }
    setIsReviewOpen(true);
  };

  const reviewRows = matrixRows.map((r) => ({
    id: r.id,
    number: `${r.number[0]} ${r.number[1]}`,
    points: r.points,
    type: r.type,
  }));

  return (
    <BidLayout
      market={market}
      title={title}
      bidsCount={matrixRows.length}
      totalPoints={matrixTotalPoints}
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
      <View style={styles.scrollContent}>
        {warning ? (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>{warning}</Text>
          </View>
        ) : null}

        <View style={styles.gridCard}>
            <View style={styles.prevNextRow}>
              <TouchableOpacity
                onPress={() => setColumnStart((p) => Math.max(0, p - 1))}
                disabled={!canSlideLeft}
                style={[styles.prevNextBtn, !canSlideLeft && styles.prevNextBtnDisabled]}
                activeOpacity={0.9}
              >
                <Text style={[styles.prevNextBtnText, !canSlideLeft && styles.prevNextBtnTextDisabled]}>Previous</Text>
              </TouchableOpacity>
              <Text style={styles.jodiColumnsLabel}>
                Jodi Columns {visibleDigits[0]} - {visibleDigits[visibleDigits.length - 1]}
              </Text>
              <TouchableOpacity
                onPress={() => setColumnStart((p) => Math.min(DIGITS.length - MOBILE_VISIBLE_COLS, p + 1))}
                disabled={!canSlideRight}
                style={[styles.prevNextBtn, !canSlideRight && styles.prevNextBtnDisabled]}
                activeOpacity={0.9}
              >
                <Text style={[styles.prevNextBtnText, !canSlideRight && styles.prevNextBtnTextDisabled]}>Next</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { clearMatrix(); setIsReviewOpen(false); }} style={styles.clearBtn} activeOpacity={0.9}>
                <Text style={styles.clearBtnText}>Clear</Text>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gridScroll}>
              <View style={styles.gridTable}>
                  <View style={styles.gridRow}>
                    <View style={styles.cellRowLabel} />
                    <View style={styles.cellBulkLabel} />
                    {visibleDigits.map((c) => (
                      <View key={`h-${c}`} style={styles.cellHeader}>
                        <Text style={styles.cellHeaderText}>{c}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.gridRow}>
                    <View style={styles.cellRowLabel}>
                      <Text style={styles.enterPtsLabel}>Enter Points</Text>
                    </View>
                    <View style={styles.cellBulkLabel} />
                    {visibleDigits.map((c) => (
                      <TextInput
                        key={`col-${c}`}
                        style={styles.cellInputSmall}
                        value={colBulk[c]}
                        onChangeText={(v) => setColBulk((p) => ({ ...p, [c]: sanitizePoints(v) }))}
                        onBlur={() => { if (colBulk[c]) applyCol(c, colBulk[c]); }}
                        placeholder="Pts"
                        placeholderTextColor="#9ca3af"
                        keyboardType="number-pad"
                      />
                    ))}
                  </View>
                  {DIGITS.map((r) => (
                    <View key={`row-${r}`} style={styles.gridRow}>
                      <View style={styles.cellRowLabel}>
                        <Text style={styles.cellRowLabelText}>{r} Pts</Text>
                      </View>
                    <TextInput
                      style={styles.cellInputSmall}
                      value={rowBulk[r]}
                      onChangeText={(v) => setRowBulk((p) => ({ ...p, [r]: sanitizePoints(v) }))}
                      onBlur={() => { if (rowBulk[r]) applyRow(r, rowBulk[r]); }}
                      placeholder="Pts"
                      placeholderTextColor="#9ca3af"
                      keyboardType="number-pad"
                    />
                    {visibleDigits.map((c) => {
                      const key = `${r}${c}`;
                      return (
                        <View key={key} style={styles.cellWrap}>
                          <TextInput
                            style={styles.cellInput}
                            value={cells[key]}
                            onChangeText={(v) => setCells((p) => ({ ...p, [key]: sanitizePoints(v) }))}
                            placeholder=""
                            placeholderTextColor="#9ca3af"
                            keyboardType="number-pad"
                          />
                          <Text style={styles.cellJodiLabel}>{r}{c}</Text>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>

        <View style={styles.bottomSpacer} />
      </View>

      <BidReviewModal
        open={isReviewOpen}
        onClose={clearAll}
        onSubmit={handleSubmitBet}
        marketTitle={marketTitle}
        dateText={dateText}
        labelKey="Jodi"
        rows={reviewRows}
        walletBefore={walletBefore}
        totalBids={matrixRows.length}
        totalAmount={matrixTotalPoints}
      />
    </BidLayout>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingVertical: 12, paddingBottom: 180 },
  warningBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 2,
    borderColor: '#fca5a5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  warningText: { color: '#dc2626', fontSize: 14 },
  gridCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    padding: 12,
    marginBottom: 16,
  },
  clearBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  clearBtnText: { fontSize: 13, fontWeight: '700', color: '#1B3150' },
  prevNextRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  prevNextBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  prevNextBtnDisabled: { backgroundColor: '#f3f4f6', borderColor: '#e5e7eb' },
  prevNextBtnText: { fontSize: 12, fontWeight: '700', color: '#1B3150' },
  prevNextBtnTextDisabled: { color: '#9ca3af' },
  jodiColumnsLabel: { flex: 1, fontSize: 12, fontWeight: '700', color: '#1f2937', textAlign: 'center' },
  gridScroll: {},
  gridTable: { minWidth: 320 },
  gridRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 4 },
  cellRowLabel: { width: 48, alignItems: 'center', justifyContent: 'center' },
  cellRowLabelText: { fontSize: 11, fontWeight: '700', color: '#1B3150' },
  cellBulkLabel: { width: 52, justifyContent: 'center', paddingLeft: 2 },
  enterPtsLabel: { fontSize: 9, color: '#6b7280', textAlign: 'center' },
  cellHeader: { width: 48, alignItems: 'center', justifyContent: 'center' },
  cellHeaderText: { fontSize: 12, fontWeight: '700', color: '#1B3150' },
  cellInputSmall: {
    width: 48,
    height: 28,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 6,
    fontSize: 11,
    color: '#1f2937',
    textAlign: 'center',
    paddingVertical: 0,
  },
  cellWrap: { width: 48, alignItems: 'center', justifyContent: 'center' },
  cellJodiLabel: { fontSize: 10, fontWeight: '600', color: '#1f2937', marginTop: 2 },
  cellInput: {
    width: 44,
    height: 28,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 6,
    fontSize: 11,
    color: '#1f2937',
    textAlign: 'center',
    paddingVertical: 0,
  },
  bottomSpacer: { height: 24 },
});
