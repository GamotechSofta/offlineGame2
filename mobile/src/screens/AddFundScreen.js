import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { getPaymentsConfig } from '../api/funds';

const BOTTOM_NAV_HEIGHT = 88;
const QUICK_AMOUNTS = [200, 500, 1000, 2000];

export default function AddFundScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user, balance } = useAuth();
  const [config, setConfig] = useState(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [addCashLoading, setAddCashLoading] = useState(false);
  const [error, setError] = useState('');

  const displayBalance = balance != null ? Number(balance) : 0;
  const displayName = user?.username || user?.name || 'User';
  const minDeposit = config?.minDeposit ?? 100;
  const maxDeposit = config?.maxDeposit ?? 50000;

  useEffect(() => {
    getPaymentsConfig().then((res) => {
      if (res.success && res.data) setConfig(res.data);
      setLoading(false);
    });
  }, []);

  const handleAddCash = () => {
    setError('');
    const num = parseFloat(amount);
    if (!num || num < minDeposit || num > maxDeposit) {
      setError(`Amount must be between ₹${minDeposit} and ₹${maxDeposit}`);
      return;
    }
    setAddCashLoading(true);
    setTimeout(() => {
      setAddCashLoading(false);
      navigation.navigate('Main', { screen: 'AddFundPayment', params: { amount: num } });
    }, 500);
  };

  const contentBottomPadding = 24 + BOTTOM_NAV_HEIGHT + insets.bottom;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.title}>Add Fund</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: contentBottomPadding }]} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.brandRow}>
            <Ionicons name="globe-outline" size={18} color="#1B3150" />
            <Text style={styles.brandText}>GoldenBets.com</Text>
          </View>

          <View style={styles.balanceBar}>
            <View style={styles.rupeeCircle}>
              <Text style={styles.rupeeText}>₹</Text>
            </View>
            <Text style={styles.balanceText}>₹ {displayBalance.toLocaleString('en-IN')}</Text>
          </View>

          <View style={styles.userRow}>
            <Text style={styles.userName}>{displayName}</Text>
            <View style={styles.dots}>
              <View style={[styles.dot, styles.dotGreen]} />
              <View style={[styles.dot, styles.dotBlue]} />
            </View>
          </View>
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('Main', { screen: 'Support' })} style={styles.supportBtn} activeOpacity={0.9}>
          <Ionicons name="chatbubble-outline" size={18} color="#1B3150" />
          <Text style={styles.supportText}>Support</Text>
        </TouchableOpacity>

        <View style={styles.amountRow}>
          <View style={styles.bankIconWrap}>
            <Ionicons name="business-outline" size={22} color="#1B3150" />
          </View>
          <TextInput
            style={styles.amountInput}
            value={amount}
            onChangeText={setAmount}
            placeholder="Enter Amount"
            placeholderTextColor="#9ca3af"
            keyboardType="number-pad"
          />
        </View>

        <View style={styles.quickGrid}>
          {QUICK_AMOUNTS.map((amt) => (
            <TouchableOpacity
              key={amt}
              onPress={() => setAmount(String(amt))}
              style={[styles.quickBtn, amount === String(amt) && styles.quickBtnActive]}
              activeOpacity={0.9}
            >
              <Text style={[styles.quickBtnText, amount === String(amt) && styles.quickBtnTextActive]}>{amt}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          onPress={handleAddCash}
          disabled={addCashLoading}
          style={[styles.addCashBtn, addCashLoading && styles.addCashBtnDisabled]}
          activeOpacity={0.9}
        >
          {addCashLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.addCashText}>Add Cash</Text>}
        </TouchableOpacity>

        <View style={styles.noteBox}>
          <Text style={styles.noteText}>Deposit time use only phone pay App Always 🙏🙏</Text>
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
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingTop: 16 },
  card: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 2, borderColor: '#e5e7eb', overflow: 'hidden' },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  brandText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  balanceBar: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1B3150', paddingVertical: 14, paddingHorizontal: 16 },
  rupeeCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  rupeeText: { fontSize: 16, fontWeight: '800', color: '#1B3150' },
  balanceText: { fontSize: 18, fontWeight: '800', color: '#fff' },
  userRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#f9fafb' },
  userName: { fontSize: 14, fontWeight: '500', color: '#1f2937' },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  dotGreen: { backgroundColor: '#22c55e' },
  dotBlue: { backgroundColor: '#1B3150' },
  supportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, paddingVertical: 12, paddingHorizontal: 20, alignSelf: 'center', backgroundColor: '#fff', borderRadius: 24, borderWidth: 2, borderColor: '#e5e7eb' },
  supportText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20 },
  bankIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f3f4f6', borderWidth: 2, borderColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' },
  amountInput: { flex: 1, backgroundColor: '#fff', borderWidth: 2, borderColor: '#e5e7eb', borderRadius: 24, paddingHorizontal: 20, paddingVertical: 14, fontSize: 16, color: '#1f2937' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  quickBtn: { width: '48%', paddingVertical: 12, borderRadius: 12, borderWidth: 2, borderColor: '#e5e7eb', backgroundColor: '#fff', alignItems: 'center' },
  quickBtnActive: { backgroundColor: '#1B3150', borderColor: '#1B3150' },
  quickBtnText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  quickBtnTextActive: { color: '#fff' },
  errorText: { marginTop: 12, fontSize: 13, color: '#dc2626' },
  addCashBtn: { marginTop: 16, backgroundColor: '#1B3150', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  addCashBtnDisabled: { opacity: 0.7 },
  addCashText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  noteBox: { marginTop: 14, padding: 12, backgroundColor: '#f9fafb', borderRadius: 12, borderWidth: 2, borderColor: '#e5e7eb' },
  noteText: { fontSize: 11, color: '#6b7280', textAlign: 'center' },
});
