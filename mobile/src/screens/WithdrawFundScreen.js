import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { getBalance } from '../api/bets';
import { getBankDetails, getPaymentsConfig, submitWithdraw } from '../api/funds';

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

  const displayName = user?.username || user?.name || 'User';
  const minWithdraw = config?.minWithdrawal ?? 500;
  const maxWithdraw = config?.maxWithdrawal ?? 25000;
  const contentBottomPadding = 24 + BOTTOM_NAV_HEIGHT + insets.bottom;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [cfgRes, bankRes, balRes] = await Promise.all([
        getPaymentsConfig(),
        getBankDetails(),
        getBalance(),
      ]);
      if (cancelled) return;
      if (cfgRes.success && cfgRes.data) setConfig(cfgRes.data);
      if (bankRes.success && Array.isArray(bankRes.data)) {
        setBankAccounts(bankRes.data);
        const defaultAcc = bankRes.data.find((a) => a.isDefault);
        if (defaultAcc) setSelectedBankId(defaultAcc._id);
      }
      if (balRes.success && balRes.data?.balance != null) setWalletBalance(Number(balRes.data.balance));
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, []);

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
      setError('Please select a bank account');
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
        <View style={styles.centered}><ActivityIndicator size="large" color="#1B3150" /></View>
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

        <Text style={styles.limits}>Min: ₹{minWithdraw} | Max: ₹{maxWithdraw}</Text>

        {bankAccounts.length === 0 && (
          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>No bank account added!</Text>
            <Text style={styles.warningText}>Please add a bank account first from the "Bank Detail" section to withdraw funds.</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Main', { screen: 'BankDetail' })} style={styles.bankDetailLink} activeOpacity={0.9}>
              <Text style={styles.bankDetailLinkText}>Go to Bank Detail</Text>
            </TouchableOpacity>
          </View>
        )}

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
          {bankAccounts.length === 0 ? (
            <Text style={styles.hintText}>Add a bank account from Bank Detail to see options here.</Text>
          ) : null}
          {bankAccounts.map((acc) => (
            <TouchableOpacity
              key={acc._id}
              onPress={() => setSelectedBankId(acc._id)}
              style={[styles.bankCard, selectedBankId === acc._id && styles.bankCardActive]}
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
        </View>

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

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Withdrawal Info:</Text>
          <Text style={styles.infoItem}>• Withdrawals are processed within 24 hours</Text>
          <Text style={styles.infoItem}>• Ensure your bank details are correct</Text>
          <Text style={styles.infoItem}>• Minimum withdrawal: ₹{minWithdraw}</Text>
          <Text style={styles.infoItem}>• Maximum withdrawal: ₹{maxWithdraw}</Text>
        </View>
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
  limits: { marginTop: 12, fontSize: 14, color: '#6b7280' },
  warningBox: { marginTop: 16, padding: 14, backgroundColor: '#f9fafb', borderRadius: 14, borderWidth: 2, borderColor: '#d1d5db' },
  warningTitle: { fontSize: 14, fontWeight: '600', color: '#1B3150' },
  warningText: { fontSize: 13, color: '#1B3150', marginTop: 6 },
  bankDetailLink: { marginTop: 10 },
  bankDetailLinkText: { fontSize: 13, fontWeight: '600', color: '#1B3150' },
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
  infoBox: { marginTop: 24, padding: 16, backgroundColor: '#f9fafb', borderRadius: 14, borderWidth: 2, borderColor: '#e5e7eb' },
  infoTitle: { fontSize: 15, fontWeight: '600', color: '#1B3150', marginBottom: 10 },
  infoItem: { fontSize: 14, color: '#374151', marginBottom: 4 },
});
