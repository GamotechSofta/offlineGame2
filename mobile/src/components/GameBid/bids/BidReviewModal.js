import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView } from 'react-native';
import { useBettingWindow } from '../BettingWindowContext';

const formatMoney = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  return n.toFixed(1);
};

const formatDateTitle = (marketTitle, dateText) => {
  const m = (marketTitle || '').toString().trim();
  const d = (dateText || '').toString().trim();
  if (m && d) return `${m} - ${d}`;
  return m || d || 'Review Bet';
};

export default function BidReviewModal({
  open,
  onClose,
  onSubmit,
  marketTitle,
  dateText,
  labelKey = 'Digit',
  rows = [],
  walletBefore = 0,
  totalBids = 0,
  totalAmount = 0,
}) {
  const { allowed: bettingAllowed, message: bettingMessage } = useBettingWindow();
  const [stage, setStage] = useState('review');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (open) {
      setStage('review');
      setSubmitError('');
    }
  }, [open]);

  if (!open && stage !== 'success') return null;

  const before = Number(walletBefore) || 0;
  const amount = Number(totalAmount) || 0;
  const after = before - amount;
  const insufficientBalance = after < 0;
  const cannotSubmit = insufficientBalance || !bettingAllowed;

  const handleClose = () => onClose?.();
  const handleSubmitClick = async () => {
    if (cannotSubmit) return;
    setSubmitError('');
    setSubmitting(true);
    try {
      const fn = onSubmit?.();
      if (fn && typeof fn.then === 'function') await fn;
      setStage('success');
    } catch (e) {
      setSubmitError(e?.message || 'Failed to place bet');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={open || stage === 'success'} transparent animationType="fade">
      <View style={styles.overlay}>
        {stage === 'review' ? (
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={handleClose} activeOpacity={1} />
        ) : (
          <View style={StyleSheet.absoluteFill} />
        )}
        <View style={styles.modalCard}>
          {stage === 'success' ? (
            <View style={styles.successCard}>
              <View style={styles.successIcon}>
                <Text style={styles.successCheck}>✓</Text>
              </View>
              <Text style={styles.successTitle}>Your Bet Placed Successfully</Text>
              <TouchableOpacity
                onPress={() => {
                  setStage('review');
                  handleClose();
                }}
                style={styles.okBtn}
                activeOpacity={0.9}
              >
                <Text style={styles.okBtnText}>OK</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.titleBar}>
                <Text style={styles.titleBarText}>{formatDateTitle(marketTitle, dateText)}</Text>
              </View>
              <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                <View style={styles.rowHeader}>
                  <Text style={styles.rowHeaderText}>{labelKey}</Text>
                  <Text style={styles.rowHeaderText}>Points</Text>
                  <Text style={styles.rowHeaderText}>Type</Text>
                </View>
                {rows.map((r) => (
                  <View key={r.id} style={styles.row}>
                    <Text style={styles.rowText} numberOfLines={1}>{String(r.number)}</Text>
                    <Text style={[styles.rowText, styles.rowPoints]}>{r.points}</Text>
                    <Text style={styles.rowText}>{String(r.type || '').toUpperCase()}</Text>
                  </View>
                ))}
                <View style={styles.summary}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Total Bets</Text>
                    <Text style={styles.summaryValue}>{totalBids}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Total Bet Amount</Text>
                    <Text style={styles.summaryValue}>{amount}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Wallet Before</Text>
                    <Text style={styles.summaryValue}>{formatMoney(before)}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Wallet After</Text>
                    <Text style={[styles.summaryValue, after < 0 && styles.negative]}>{formatMoney(after)}</Text>
                  </View>
                </View>
                {!bettingAllowed && bettingMessage ? (
                  <View style={styles.alert}>
                    <Text style={styles.alertText}>{bettingMessage}</Text>
                  </View>
                ) : null}
                {insufficientBalance ? (
                  <View style={styles.alertAmber}>
                    <Text style={styles.alertText}>Insufficient balance. Add funds to place this bet.</Text>
                  </View>
                ) : null}
                {submitError ? (
                  <View style={styles.alert}>
                    <Text style={styles.alertText}>{submitError}</Text>
                  </View>
                ) : null}
                <Text style={styles.note}>*Note: Bet once placed cannot be cancelled*</Text>
              </ScrollView>
              <View style={styles.buttons}>
                <TouchableOpacity onPress={handleClose} disabled={submitting} style={styles.cancelBtn} activeOpacity={0.9}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSubmitClick}
                  disabled={submitting || cannotSubmit}
                  style={[styles.submitBtn, (submitting || cannotSubmit) && styles.submitBtnDisabled]}
                  activeOpacity={0.9}
                >
                  {submitting ? <Text style={styles.submitBtnText}>Placing...</Text> : <Text style={styles.submitBtnText}>Submit Bet</Text>}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 400, backgroundColor: '#fff', borderRadius: 16, borderWidth: 2, borderColor: '#d1d5db', maxHeight: '90%' },
  titleBar: { backgroundColor: '#1B3150', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 2, borderBottomColor: '#1B3150' },
  titleBarText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  scroll: { maxHeight: 360, padding: 16 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  rowHeaderText: { fontSize: 12, fontWeight: '600', color: '#1B3150' },
  row: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f9fafb', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 2, borderColor: '#d1d5db' },
  rowText: { fontSize: 12, fontWeight: '600', color: '#1f2937' },
  rowPoints: { color: '#1B3150' },
  summary: { marginTop: 12, borderRadius: 16, borderWidth: 2, borderColor: '#d1d5db', overflow: 'hidden' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  summaryLabel: { fontSize: 12, color: '#4b5563' },
  summaryValue: { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  negative: { color: '#dc2626' },
  alert: { marginTop: 8, padding: 12, backgroundColor: '#fef2f2', borderWidth: 2, borderColor: '#fca5a5', borderRadius: 12 },
  alertAmber: { marginTop: 8, padding: 12, backgroundColor: '#fffbeb', borderWidth: 2, borderColor: '#fcd34d', borderRadius: 12 },
  alertText: { fontSize: 12, color: '#dc2626' },
  note: { marginTop: 12, textAlign: 'center', fontSize: 12, color: '#dc2626', fontWeight: '600' },
  buttons: { flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 2, borderTopColor: '#d1d5db' },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#fff', borderWidth: 2, borderColor: '#d1d5db', alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '700', color: '#374151' },
  submitBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#1B3150', alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  successCard: { padding: 32, alignItems: 'center' },
  successIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#22c55e', alignItems: 'center', justifyContent: 'center' },
  successCheck: { fontSize: 40, color: '#fff', fontWeight: '700' },
  successTitle: { marginTop: 24, fontSize: 16, fontWeight: '600', color: '#16a34a' },
  okBtn: { marginTop: 24, width: '100%', paddingVertical: 14, borderRadius: 8, backgroundColor: '#1B3150', alignItems: 'center' },
  okBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
