import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, ActivityIndicator, Alert, Modal, Pressable } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { getBalance } from '../api/bets';
import { getBankDetails, getPaymentsConfig, submitWithdraw } from '../api/funds';
import { SkeletonBox } from '../components/Skeleton';

const BOTTOM_NAV_HEIGHT = 88;

export default function WithdrawFundScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [config, setConfig] = useState(null);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [amount, setAmount] = useState('');
  const [selectedBankId, setSelectedBankId] = useState('');
  const [userNote, setUserNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showBankModal, setShowBankModal] = useState(false);

  const displayName = user?.username || user?.name || 'User';
  const minWithdraw = config?.minWithdrawal ?? 500;
  const maxWithdraw = config?.maxWithdrawal ?? 25000;
  const contentBottomPadding = 24 + BOTTOM_NAV_HEIGHT + insets.bottom;

  const loadData = async () => {
    const [cfgRes, bankRes, balRes] = await Promise.all([
      getPaymentsConfig(),
      getBankDetails(),
      getBalance(),
    ]);
    if (cfgRes.success && cfgRes.data) setConfig(cfgRes.data);
    if (bankRes.success && Array.isArray(bankRes.data)) {
      setBankAccounts(bankRes.data);
      setSelectedBankId((prev) => {
        const defaultAcc = bankRes.data.find((a) => a.isDefault);
        if (defaultAcc) return defaultAcc._id;
        return prev || (bankRes.data[0]?._id ?? '');
      });
    }
    if (balRes.success && balRes.data?.balance != null) setWalletBalance(Number(balRes.data.balance));
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      if (!loading) {
        getBankDetails().then((bankRes) => {
          if (bankRes.success && Array.isArray(bankRes.data)) {
            setBankAccounts(bankRes.data);
            setSelectedBankId((prev) => {
              const exists = bankRes.data.some((a) => a._id === prev);
              if (exists) return prev;
              const defaultAcc = bankRes.data.find((a) => a.isDefault);
              return defaultAcc?._id || bankRes.data[0]?._id || '';
            });
          }
        });
      }
    }, [loading])
  );

  const handleSubmit = async () => {
    setError('');
    const num = parseFloat(amount);
    if (!num || num < minWithdraw || num > maxWithdraw) {
      setError(`Amount must be between ₹${minWithdraw} and ₹${maxWithdraw}`);
      return;
    }
    if (num > walletBalance) {
      setError('Insufficient wallet balance');
      return;
    }
    if (!selectedBankId) {
      setShowBankModal(true);
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitWithdraw({ amount: num, bankDetailId: selectedBankId, userNote: (userNote || '').trim() });
      if (res.success) {
        Alert.alert('Success', 'Withdrawal request submitted. Amount will be transferred after approval.', [
          { text: 'OK', onPress: () => navigation.navigate('Main', { screen: 'WithdrawFundHistory' }) },
        ]);
      } else {
        setError(res.message || 'Failed to submit');
      }
    } catch (e) {
      setError(e?.message || 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={24} color="#1f2937" />
          </TouchableOpacity>
          <Text style={styles.title}>Withdraw Fund</Text>
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: contentBottomPadding }]} showsVerticalScrollIndicator={false}>
          <View style={{ padding: 16 }}>
            <SkeletonBox width={120} height={14} style={{ marginBottom: 8 }} />
            <SkeletonBox width={100} height={28} style={{ marginBottom: 24 }} />
            <SkeletonBox width="100%" height={48} style={{ marginBottom: 16 }} />
            <SkeletonBox width="100%" height={48} style={{ marginBottom: 16 }} />
            <SkeletonBox width="60%" height={40} borderRadius={12} />
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.title}>Withdraw Fund</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: contentBottomPadding }]} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.brandRow}>
            <Ionicons name="globe-outline" size={18} color="#1B3150" />
            <Text style={styles.brandText}>RATAN 365</Text>
          </View>
          <View style={styles.balanceBar}>
            <View style={styles.rupeeCircle}>
              <Text style={styles.rupeeText}>₹</Text>
            </View>
            <View>
              <Text style={styles.balanceLabel}>Available Balance</Text>
              <Text style={styles.balanceValue}>₹ {Number(walletBalance).toLocaleString('en-IN')}</Text>
            </View>
          </View>
          <View style={styles.userRow}>
            <Text style={styles.userName}>{displayName}</Text>
            <View style={styles.dots}>
              <View style={[styles.dot, styles.dotBlue]} />
              <View style={[styles.dot, styles.dotBlue]} />
            </View>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Amount (₹)</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            placeholder="Enter amount"
            placeholderTextColor="#9ca3af"
            keyboardType="number-pad"
          />
          <TouchableOpacity onPress={() => setAmount(String(Math.min(walletBalance, maxWithdraw)))} style={styles.maxLink}>
            <Text style={styles.maxLinkText}>Withdraw Max (₹{Math.min(walletBalance, maxWithdraw).toLocaleString()})</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Select Bank Account</Text>
          <TouchableOpacity
            onPress={() => setShowBankModal(true)}
            style={styles.bankSelectTrigger}
            activeOpacity={0.9}
          >
            {selectedBankId ? (
              (() => {
                const acc = bankAccounts.find((a) => a._id === selectedBankId);
                return acc ? (
                  <View style={styles.bankCardLeft}>
                    <Text style={styles.bankCardName}>{acc.accountHolderName}</Text>
                    {acc.accountNumber ? <Text style={styles.bankCardDetail}>{acc.bankName} - ****{acc.accountNumber.slice(-4)}</Text> : null}
                    {acc.upiId ? <Text style={styles.bankCardDetail}>UPI: {acc.upiId}</Text> : null}
                  </View>
                ) : (
                  <Text style={styles.bankSelectPlaceholder}>Select bank account</Text>
                );
              })()
            ) : (
              <Text style={styles.bankSelectPlaceholder}>
                {bankAccounts.length === 0 ? 'No account added' : 'Select bank account'}
              </Text>
            )}
            <Ionicons name="chevron-down" size={20} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <Modal visible={showBankModal} transparent animationType="fade">
          <Pressable style={styles.modalOverlay} onPress={() => setShowBankModal(false)}>
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.modalTitle}>Select Bank Account</Text>
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {bankAccounts.map((acc) => (
                  <TouchableOpacity
                    key={acc._id}
                    onPress={() => {
                      setSelectedBankId(acc._id);
                      setShowBankModal(false);
                    }}
                    style={[styles.modalBankCard, selectedBankId === acc._id && styles.modalBankCardActive]}
                    activeOpacity={0.9}
                  >
                    <View style={styles.bankCardLeft}>
                      <Text style={styles.bankCardName}>{acc.accountHolderName}</Text>
                      {acc.accountNumber ? <Text style={styles.bankCardDetail}>{acc.bankName} - ****{acc.accountNumber.slice(-4)}</Text> : null}
                      {acc.upiId ? <Text style={styles.bankCardDetail}>UPI: {acc.upiId}</Text> : null}
                    </View>
                    {selectedBankId === acc._id ? <Ionicons name="checkmark-circle" size={24} color="#1B3150" /> : null}
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity
                onPress={() => {
                  setShowBankModal(false);
                  navigation.navigate('Main', { screen: 'BankDetail' });
                }}
                style={styles.addAccountBtn}
                activeOpacity={0.9}
              >
                <Ionicons name="add-circle-outline" size={22} color="#fff" />
                <Text style={styles.addAccountBtnText}>Add account</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowBankModal(false)} style={styles.modalCloseBtn} activeOpacity={0.9}>
                <Text style={styles.modalCloseText}>Cancel</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>

        <View style={styles.field}>
          <Text style={styles.label}>Note <Text style={styles.optional}>(Optional)</Text></Text>
          <TextInput
            style={styles.noteInput}
            value={userNote}
            onChangeText={setUserNote}
            placeholder="Any special instructions..."
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={3}
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting || bankAccounts.length === 0}
          style={[styles.submitBtn, (submitting || bankAccounts.length === 0) && styles.submitBtnDisabled]}
          activeOpacity={0.9}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit Withdrawal Request</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  backBtn: { padding: 8, marginRight: 4 },
  title: { fontSize: 20, fontWeight: '700', color: '#1f2937' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 2, borderColor: '#e5e7eb', overflow: 'hidden' },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  brandText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  balanceBar: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1B3150', paddingVertical: 14, paddingHorizontal: 16 },
  rupeeCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  rupeeText: { fontSize: 16, fontWeight: '800', color: '#1B3150' },
  balanceLabel: { fontSize: 11, color: 'rgba(255,255,255,0.9)' },
  balanceValue: { fontSize: 18, fontWeight: '800', color: '#fff' },
  userRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#f9fafb' },
  userName: { fontSize: 14, color: '#374151' },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  dotBlue: { backgroundColor: '#1B3150' },
  field: { marginTop: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#e5e7eb', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#1f2937' },
  maxLink: { marginTop: 8 },
  maxLinkText: { fontSize: 13, color: '#1B3150', fontWeight: '500' },
  bankCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', borderWidth: 2, borderColor: '#e5e7eb', borderRadius: 14, marginTop: 8 },
  bankCardActive: { borderColor: '#1B3150', backgroundColor: '#f9fafb' },
  bankCardLeft: { flex: 1 },
  bankCardName: { fontSize: 16, fontWeight: '600', color: '#1f2937' },
  bankCardDetail: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  hintText: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  optional: { fontWeight: '400', color: '#6b7280' },
  noteInput: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#e5e7eb', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#1f2937', minHeight: 80, textAlignVertical: 'top' },
  errorText: { marginTop: 12, fontSize: 13, color: '#dc2626' },
  submitBtn: { marginTop: 24, backgroundColor: '#1B3150', paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  bankSelectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    marginTop: 8,
  },
  bankSelectPlaceholder: { fontSize: 15, color: '#9ca3af' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxWidth: 360, maxHeight: '70%', backgroundColor: '#fff', borderRadius: 20, padding: 20, borderWidth: 2, borderColor: '#e5e7eb' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937', marginBottom: 16 },
  modalScroll: { maxHeight: 240, marginBottom: 12 },
  modalBankCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, backgroundColor: '#fff', borderWidth: 2, borderColor: '#e5e7eb', borderRadius: 12, marginBottom: 8 },
  modalBankCardActive: { borderColor: '#1B3150', backgroundColor: '#f9fafb' },
  addAccountBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1B3150', paddingVertical: 14, borderRadius: 14, marginBottom: 10 },
  addAccountBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  modalCloseBtn: { alignItems: 'center', paddingVertical: 8 },
  modalCloseText: { fontSize: 15, color: '#6b7280', fontWeight: '500' },
});
