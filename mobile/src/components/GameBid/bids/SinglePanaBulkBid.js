import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import BidLayout from '../BidLayout';
import BidReviewModal from './BidReviewModal';
import { placeBet, updateUserBalance } from '../../../api/bets';
import { useAuth } from '../../../context/AuthContext';

const sanitizePoints = (v) => (v ?? '').toString().replace(/\D/g, '').slice(0, 6);

// Valid Single Pana by sum digit (0-9), same as frontend SinglePanaBulkBid
const SINGLE_PANA_BY_SUM = {
  '0': ['127', '136', '145', '190', '235', '280', '370', '389', '460', '479', '569', '578'],
  '1': ['128', '137', '146', '236', '245', '290', '380', '470', '489', '560', '579', '678'],
  '2': ['129', '138', '147', '156', '237', '246', '345', '390', '480', '570', '589', '679'],
  '3': ['120', '139', '148', '157', '238', '247', '256', '346', '490', '580', '670', '689'],
  '4': ['130', '149', '158', '167', '239', '248', '257', '347', '356', '590', '680', '789'],
  '5': ['140', '159', '168', '230', '249', '258', '267', '348', '357', '456', '690', '780'],
  '6': ['123', '150', '169', '178', '240', '259', '268', '349', '358', '367', '457', '790'],
  '7': ['124', '133', '142', '151', '160', '179', '250', '278', '340', '359', '467', '890'],
  '8': ['125', '134', '170', '189', '260', '279', '350', '369', '378', '459', '468', '567'],
  '9': ['126', '135', '180', '234', '270', '289', '360', '379', '450', '469', '478', '568'],
};

const buildSinglePanas = () =>
  Object.keys(SINGLE_PANA_BY_SUM)
    .sort()
    .flatMap((k) => SINGLE_PANA_BY_SUM[k]);

const GROUP_KEYS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

export default function SinglePanaBulkBid({ market, title }) {
  const [session, setSession] = useState(() => (market?.status === 'running' ? 'CLOSE' : 'OPEN'));
  const [warning, setWarning] = useState('');
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewRows, setReviewRows] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);

  const singlePanas = useMemo(() => buildSinglePanas(), []);
  const [specialInputs, setSpecialInputs] = useState(() =>
    Object.fromEntries(singlePanas.map((n) => [n, '']))
  );
  const [groupBulk, setGroupBulk] = useState(() =>
    Object.fromEntries(GROUP_KEYS.map((d) => [d, '']))
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
  const handleDateChange = (newDate) => setSelectedDate(newDate);

  const specialCount = useMemo(
    () => Object.values(specialInputs).filter((v) => Number(v) > 0).length,
    [specialInputs]
  );
  const selectedTotalPoints = useMemo(
    () => Object.values(specialInputs).reduce((sum, v) => sum + Number(v || 0), 0),
    [specialInputs]
  );
  const canSubmit = specialCount > 0;

  const clearAll = () => {
    setIsReviewOpen(false);
    setReviewRows([]);
    setSpecialInputs(Object.fromEntries(singlePanas.map((n) => [n, ''])));
    setGroupBulk(Object.fromEntries(GROUP_KEYS.map((d) => [d, ''])));
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const applyGroup = (groupKey, pts) => {
    const p = sanitizePoints(pts);
    const n = Number(p);
    if (!n || n <= 0) {
      showWarning('Please enter points.');
      return;
    }
    const list = SINGLE_PANA_BY_SUM[groupKey] || [];
    setSpecialInputs((prev) => {
      const next = { ...prev };
      for (const num of list) {
        const cur = Number(next[num] || 0) || 0;
        next[num] = String(cur + n);
      }
      return next;
    });
    setGroupBulk((prev) => ({ ...prev, [groupKey]: '' }));
  };

  const openReview = () => {
    const rows = Object.entries(specialInputs)
      .filter(([, pts]) => Number(pts) > 0)
      .map(([num, pts]) => ({
        id: `${num}-${pts}-${session}`,
        number: num,
        points: String(pts),
        type: session,
      }));

    if (!rows.length) {
      showWarning('Please enter points for at least one Single Pana.');
      return;
    }
    setReviewRows(rows);
    setIsReviewOpen(true);
  };

  const totalPointsForFooter = useMemo(
    () => reviewRows.reduce((sum, b) => sum + Number(b.points || 0), 0),
    [reviewRows]
  );

  const handleSubmitBet = async () => {
    const marketId = market?._id || market?.id;
    if (!marketId) throw new Error('Market not found');
    const payload = reviewRows.map((r) => ({
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

  const dateText = new Date().toLocaleDateString('en-GB');
  const marketTitle = market?.gameName || market?.marketName || title;
  const { user } = useAuth();
  const walletBefore = Number(user?.wallet ?? user?.balance ?? user?.points ?? 0) || 0;

  return (
    <BidLayout
      market={market}
      title={title}
      bidsCount={specialCount}
      totalPoints={selectedTotalPoints}
      showDateSession
      session={session}
      setSession={setSession}
      selectedDate={selectedDate}
      setSelectedDate={handleDateChange}
      hideFooter={false}
      showFooterStats={false}
      submitLabel="Submit"
      onSubmit={openReview}
      walletBalance={walletBefore}
    >
      <View style={styles.wrap}>
        {warning ? (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>{warning}</Text>
          </View>
        ) : null}

        <View style={styles.topRow}>
          <TouchableOpacity onPress={clearAll} style={styles.clearBtn} activeOpacity={0.9}>
            <Text style={styles.clearBtnText}>Clear</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.centeredContent}>
          {GROUP_KEYS.map((groupKey) => {
            const list = SINGLE_PANA_BY_SUM[groupKey] || [];
            if (!list.length) return null;

            return (
              <View key={groupKey} style={styles.groupBlock}>
                <View style={styles.groupHeader}>
                  <View style={styles.groupDigitBox}>
                    <Text style={styles.groupDigitText}>{groupKey}</Text>
                  </View>
                  <TextInput
                    style={styles.groupInput}
                    value={groupBulk[groupKey]}
                    onChangeText={(v) =>
                      setGroupBulk((p) => ({ ...p, [groupKey]: sanitizePoints(v) }))
                    }
                    placeholder="All pts"
                    placeholderTextColor="#9ca3af"
                    keyboardType="number-pad"
                  />
                  <TouchableOpacity
                    onPress={() => groupBulk[groupKey] && applyGroup(groupKey, groupBulk[groupKey])}
                    disabled={!groupBulk[groupKey]}
                    style={[styles.applyBtn, !groupBulk[groupKey] && styles.applyBtnDisabled]}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.applyBtnText}>Apply</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.cellGrid}>
                  {list.map((num) => (
                    <View key={num} style={styles.cellRow}>
                      <View style={styles.panaBox}>
                        <Text style={styles.panaText}>{num}</Text>
                      </View>
                      <View style={styles.ptsInputWrap}>
                        <TextInput
                          style={styles.ptsInput}
                          value={specialInputs[num]}
                          onChangeText={(v) =>
                            setSpecialInputs((p) => ({
                              ...p,
                              [num]: sanitizePoints(v),
                            }))
                          }
                          placeholder="Pts"
                          placeholderTextColor="#9ca3af"
                          keyboardType="number-pad"
                        />
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      </View>

      <BidReviewModal
        open={isReviewOpen}
        onClose={clearAll}
        onSubmit={handleSubmitBet}
        marketTitle={marketTitle}
        dateText={dateText}
        labelKey="Pana"
        rows={reviewRows}
        walletBefore={walletBefore}
        totalBids={reviewRows.length}
        totalAmount={totalPointsForFooter}
      />
    </BidLayout>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 12, paddingBottom: 8 },
  centeredContent: {
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 400,
  },
  warningBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 2,
    borderColor: '#fca5a5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  warningText: { color: '#dc2626', fontSize: 14 },
  topRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 12 },
  clearBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  clearBtnText: { fontSize: 14, fontWeight: '600', color: '#1B3150' },
  groupBlock: { marginBottom: 20 },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  groupDigitBox: {
    width: 40,
    height: 40,
    backgroundColor: '#1B3150',
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupDigitText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  groupInput: {
    width: 88,
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
    textAlignVertical: 'center',
  },
  applyBtn: {
    height: 40,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#9ca3af',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnDisabled: { backgroundColor: '#f3f4f6', borderColor: '#d1d5db', opacity: 0.7 },
  applyBtnText: { fontSize: 13, fontWeight: '700', color: '#1B3150' },
  cellGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  cellRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 130,
  },
  panaBox: {
    minWidth: 48,
    width: 48,
    height: 40,
    backgroundColor: '#1B3150',
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panaText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  ptsInputWrap: {
    width: 72,
    height: 40,
  },
  ptsInput: {
    width: '100%',
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
    textAlignVertical: 'center',
  },
});
