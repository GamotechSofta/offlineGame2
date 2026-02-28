import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import BidLayout from '../BidLayout';
import BidReviewModal from './BidReviewModal';
import { placeBet, updateUserBalance } from '../../../api/bets';
import { useAuth } from '../../../context/AuthContext';

const VALID_SINGLE_PANAS = new Set([
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
]);

const isValidSinglePana = (n) => {
  const s = (n ?? '').toString().trim();
  if (!/^[0-9]{3}$/.test(s)) return false;
  return VALID_SINGLE_PANAS.has(s);
};

const isValidDoublePana = (n) => {
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
};

const isValidTriplePana = (n) => {
  const s = (n ?? '').toString().trim();
  if (!/^[0-9]{3}$/.test(s)) return false;
  return s[0] === s[1] && s[1] === s[2];
};

const isValidAnyPana = (n) =>
  isValidSinglePana(n) || isValidDoublePana(n) || isValidTriplePana(n);

// Half Sangam: Flip toggles (O) Open Pana+Close Ank ↔ (C) Open Ank+Close Pana
export default function HalfSangamBid({ market, title }) {
  const [flipped, setFlipped] = useState(false);
  const [session, setSession] = useState('OPEN');
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [points, setPoints] = useState('');
  const [panaInvalid, setPanaInvalid] = useState(false);
  const [bids, setBids] = useState([]);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [warning, setWarning] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);

  const showWarning = (msg) => {
    setWarning(msg);
    const t = setTimeout(() => setWarning(''), 2200);
    return () => clearTimeout(t);
  };

  const handleDateChange = (newDate) => setSelectedDate(newDate);

  const handleFlip = () => {
    setFlipped((prev) => !prev);
    setFirst('');
    setSecond('');
    setPoints('');
    setPanaInvalid(false);
  };

  const handleAdd = () => {
    const pts = Number(points);
    if (!pts || pts <= 0) {
      showWarning('Please enter points.');
      return;
    }
    const pana = flipped ? second : first;
    const ank = flipped ? first : second;
    if (!isValidAnyPana(pana)) {
      showWarning(flipped ? 'Close Pana must be a valid Pana.' : 'Open Pana must be a valid Pana.');
      return;
    }
    const ankStr = (ank ?? '').toString().trim();
    if (!/^[0-9]$/.test(ankStr)) {
      showWarning(flipped ? 'Please enter a valid Open Ank (0-9).' : 'Please enter a valid Close Ank (0-9).');
      return;
    }
    const numberKey = flipped ? `${ankStr}-${pana}` : `${pana}-${ankStr}`;
    setBids((prev) => {
      const idx = prev.findIndex((b) => String(b.number) === numberKey && String(b.type) === String(session));
      if (idx >= 0) {
        const next = [...prev];
        const cur = Number(next[idx].points || 0) || 0;
        next[idx] = { ...next[idx], points: String(cur + pts) };
        return next;
      }
      return [
        ...prev,
        { id: Date.now() + Math.random(), number: numberKey, points: String(pts), type: session },
      ];
    });
    setFirst('');
    setSecond('');
    setPoints('');
    setPanaInvalid(false);
  };

  const handleFirstChange = (v) => {
    if (flipped) {
      setFirst(v.replace(/\D/g, '').slice(0, 1));
    } else {
      const next = v.replace(/\D/g, '').slice(0, 3);
      setFirst(next);
      setPanaInvalid(!!next && next.length === 3 && !isValidAnyPana(next));
    }
  };

  const handleSecondChange = (v) => {
    if (flipped) {
      const next = v.replace(/\D/g, '').slice(0, 3);
      setSecond(next);
      setPanaInvalid(!!next && next.length === 3 && !isValidAnyPana(next));
    } else {
      setSecond(v.replace(/\D/g, '').slice(0, 1));
    }
  };

  const totalPoints = useMemo(() => bids.reduce((sum, b) => sum + Number(b.points || 0), 0), [bids]);
  const dateText = new Date().toLocaleDateString('en-GB');
  const marketTitle = market?.gameName || market?.marketName || title;
  const { user } = useAuth();
  const walletBefore = Number(user?.wallet ?? user?.balance ?? user?.points ?? 0) || 0;

  const clearAll = () => {
    setIsReviewOpen(false);
    setFirst('');
    setSecond('');
    setPoints('');
    setBids([]);
    setPanaInvalid(false);
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const handleDelete = (id) => setBids((prev) => prev.filter((b) => b.id !== id));

  const openReview = () => {
    if (!bids.length) {
      showWarning('Please add at least one Sangam.');
      return;
    }
    setIsReviewOpen(true);
  };

  const handleSubmitBet = async () => {
    const marketId = market?._id || market?.id;
    if (!marketId) throw new Error('Market not found');
    if (!bids.length) throw new Error('No bets to place');
    const payload = bids
      .map((b) => ({
        betType: 'half-sangam',
        betNumber: String(b?.number ?? '').trim(),
        amount: Number(b?.points) || 0,
        betOn: String(b?.type || session).toUpperCase() === 'CLOSE' ? 'close' : 'open',
      }))
      .filter((b) => b.betNumber && b.amount > 0);
    if (!payload.length) throw new Error('No valid bets to place');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDateObj = new Date(selectedDate);
    selectedDateObj.setHours(0, 0, 0, 0);
    const scheduledDate = selectedDateObj > today ? selectedDate : null;

    const result = await placeBet(marketId, payload, scheduledDate);
    if (!result.success) throw new Error(result.message || 'Failed to place bet');
    if (result.data?.newBalance != null) await updateUserBalance(result.data.newBalance);
    clearAll();
  };

  const firstLabel = flipped ? 'Open Ank:' : 'Open Pana:';
  const secondLabel = flipped ? 'Close Pana:' : 'Close Ank:';
  const firstPlaceholder = flipped ? 'Ank' : 'Pana';
  const secondPlaceholder = flipped ? 'Pana' : 'Ank';
  const titleText = flipped
    ? 'Half Sangam (C) — Open Ank + Close Pana'
    : 'Half Sangam (O) — Open Pana + Close Ank';
  const firstInvalid = !flipped && first.length === 3 && panaInvalid;
  const secondInvalid = flipped && second.length === 3 && panaInvalid;

  return (
    <BidLayout
      market={market}
      title={title}
      bidsCount={bids.length}
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

        <Text style={styles.sectionTitle}>{titleText}</Text>

        <View style={styles.formCard}>
          <View style={styles.field}>
            <Text style={styles.label}>{firstLabel}</Text>
            <TextInput
              style={[styles.input, firstInvalid && styles.inputInvalid]}
              value={first}
              onChangeText={handleFirstChange}
              placeholder={firstPlaceholder}
              placeholderTextColor="#9ca3af"
              keyboardType="number-pad"
              maxLength={flipped ? 1 : 3}
            />
          </View>
          <View style={styles.flipRow}>
            <TouchableOpacity onPress={handleFlip} style={styles.flipBtn} activeOpacity={0.9}>
              <Text style={styles.flipBtnText}>Flip</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>{secondLabel}</Text>
            <TextInput
              style={[styles.input, secondInvalid && styles.inputInvalid]}
              value={second}
              onChangeText={handleSecondChange}
              placeholder={secondPlaceholder}
              placeholderTextColor="#9ca3af"
              keyboardType="number-pad"
              maxLength={flipped ? 3 : 1}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Points:</Text>
            <TextInput
              style={styles.input}
              value={points}
              onChangeText={(v) => setPoints(v.replace(/\D/g, '').slice(0, 6))}
              placeholder="Point"
              placeholderTextColor="#9ca3af"
              keyboardType="number-pad"
            />
          </View>
          <TouchableOpacity onPress={handleAdd} style={styles.addBtn} activeOpacity={0.9}>
            <Text style={styles.addBtnText}>Add to List</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={openReview}
            disabled={bids.length === 0}
            style={[styles.submitBtn, bids.length > 0 ? styles.submitBtnActive : styles.submitBtnDisabled]}
            activeOpacity={0.9}
          >
            <Text style={styles.submitBtnText}>Submit Bet</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tableCard}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colSangam]}>Sangam</Text>
            <Text style={[styles.tableHeaderCell, styles.colPoint]}>Point</Text>
            <Text style={[styles.tableHeaderCell, styles.colDelete]}>Delete</Text>
          </View>
          {bids.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={styles.emptyText}>No sangam added yet</Text>
            </View>
          ) : (
            bids.map((b) => (
              <View key={b.id} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.colSangam]} numberOfLines={1}>
                  {b.number}
                </Text>
                <Text style={[styles.tableCell, styles.colPoint]}>{b.points}</Text>
                <View style={styles.colDelete}>
                  <TouchableOpacity onPress={() => handleDelete(b.id)} style={styles.deleteBtn} activeOpacity={0.8}>
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
        onClose={clearAll}
        onSubmit={handleSubmitBet}
        marketTitle={marketTitle}
        dateText={dateText}
        labelKey="Sangam"
        rows={bids.map((b) => ({
          id: b.id,
          number: b.number,
          points: b.points,
          type: b.type || session,
        }))}
        walletBefore={walletBefore}
        totalBids={bids.length}
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
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1B3150',
    marginBottom: 12,
  },
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
  flipRow: { marginBottom: 14 },
  flipBtn: {
    backgroundColor: '#e5e7eb',
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flipBtnText: { fontSize: 14, fontWeight: '700', color: '#374151' },
  addBtn: {
    backgroundColor: '#1B3150',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  submitBtn: {
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
  colSangam: { flex: 1.4, minWidth: 80 },
  colPoint: { flex: 0.7, minWidth: 48 },
  colDelete: { flex: 0.5, minWidth: 44, alignItems: 'center' },
  deleteBtn: { padding: 8 },
  deleteBtnText: { fontSize: 18 },
  emptyRow: { padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#6b7280' },
});
