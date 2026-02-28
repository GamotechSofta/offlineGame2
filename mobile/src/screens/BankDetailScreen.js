import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getBankDetails, createBankDetail, updateBankDetail, deleteBankDetail } from '../api/funds';

const BOTTOM_NAV_HEIGHT = 88;
const MAX_ACCOUNTS = 5;

export default function BankDetailScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    accountHolderName: '',
    accountNumber: '',
    ifscCode: '',
    bankName: '',
    upiId: '',
    accountType: 'savings',
  });

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    const res = await getBankDetails();
    if (res.success && Array.isArray(res.data)) setBankAccounts(res.data);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAccounts();
    }, [loadAccounts])
  );

  const resetForm = () => {
    setFormData({
      accountHolderName: '',
      accountNumber: '',
      ifscCode: '',
      bankName: '',
      upiId: '',
      accountType: 'savings',
    });
    setEditingId(null);
    setShowForm(false);
    setError('');
  };

  const handleEdit = (acc) => {
    setFormData({
      accountHolderName: acc.accountHolderName || '',
      accountNumber: acc.accountNumber || '',
      ifscCode: acc.ifscCode || '',
      bankName: acc.bankName || '',
      upiId: acc.upiId || '',
      accountType: acc.accountType || 'savings',
    });
    setEditingId(acc._id);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    setError('');
    if (!(formData.accountHolderName || '').trim()) {
      setError('Account holder name is required');
      return;
    }
    if (!formData.upiId && (!formData.accountNumber || !formData.ifscCode)) {
      setError('Provide either UPI ID or bank account number + IFSC');
      return;
    }
    setSubmitting(true);
    try {
      const res = editingId
        ? await updateBankDetail(editingId, formData)
        : await createBankDetail(formData);
      if (res.success) {
        resetForm();
        loadAccounts();
      } else {
        setError(res.message || 'Failed to save');
      }
    } catch (e) {
      setError(e?.message || 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id) => {
    Alert.alert('Delete account', 'Are you sure you want to remove this bank account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const res = await deleteBankDetail(id);
          if (res.success) loadAccounts();
        },
      },
    ]);
  };

  const contentBottomPadding = 24 + BOTTOM_NAV_HEIGHT + insets.bottom;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.title}>Bank Detail</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: contentBottomPadding }]} showsVerticalScrollIndicator={false}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Bank Accounts</Text>
            <Text style={styles.sectionSubtitle}>{bankAccounts.length}/{MAX_ACCOUNTS} accounts added</Text>
          </View>
          {bankAccounts.length < MAX_ACCOUNTS && !showForm && (
            <TouchableOpacity onPress={() => setShowForm(true)} style={styles.addBtn} activeOpacity={0.9}>
              <Text style={styles.addBtnText}>+ Add Account</Text>
            </TouchableOpacity>
          )}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {showForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{editingId ? 'Edit Bank Account' : 'Add New Bank Account'}</Text>
            <TextInput style={styles.input} value={formData.accountHolderName} onChangeText={(v) => setFormData({ ...formData, accountHolderName: v })} placeholder="Account Holder Name *" placeholderTextColor="#9ca3af" />
            <TextInput style={styles.input} value={formData.bankName} onChangeText={(v) => setFormData({ ...formData, bankName: v })} placeholder="Bank Name" placeholderTextColor="#9ca3af" />
            <TextInput style={styles.input} value={formData.accountNumber} onChangeText={(v) => setFormData({ ...formData, accountNumber: v })} placeholder="Account Number" placeholderTextColor="#9ca3af" keyboardType="number-pad" />
            <TextInput style={styles.input} value={formData.ifscCode} onChangeText={(v) => setFormData({ ...formData, ifscCode: v.toUpperCase() })} placeholder="IFSC Code" placeholderTextColor="#9ca3af" autoCapitalize="characters" />
            <Text style={styles.orText}>OR</Text>
            <TextInput style={styles.input} value={formData.upiId} onChangeText={(v) => setFormData({ ...formData, upiId: v })} placeholder="UPI ID" placeholderTextColor="#9ca3af" autoCapitalize="none" />
            <View style={styles.formActions}>
              <TouchableOpacity onPress={resetForm} style={styles.cancelBtn} activeOpacity={0.9}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSubmit} disabled={submitting} style={[styles.saveBtn, submitting && styles.saveBtnDisabled]} activeOpacity={0.9}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{editingId ? 'Update' : 'Add Account'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {loading ? (
          <View style={styles.emptyCard}><ActivityIndicator color="#1B3150" /><Text style={styles.emptySubtext}>Loading...</Text></View>
        ) : bankAccounts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="business-outline" size={64} color="#9ca3af" />
            <Text style={styles.emptyTitle}>No bank accounts added yet</Text>
            <Text style={styles.emptySubtext}>Add a bank account to withdraw funds</Text>
          </View>
        ) : (
          bankAccounts.map((acc) => (
            <View key={acc._id} style={styles.accCard}>
              <View style={styles.accRow}>
                <View style={styles.accIcon}><Ionicons name="business-outline" size={26} color="#1B3150" /></View>
                <View style={styles.accInfo}>
                  <View style={styles.accNameRow}>
                    <Text style={styles.accName}>{acc.accountHolderName}</Text>
                    {acc.isDefault && <View style={styles.defaultBadge}><Text style={styles.defaultBadgeText}>Default</Text></View>}
                  </View>
                  {acc.bankName ? <Text style={styles.accDetail}>{acc.bankName}</Text> : null}
                  {acc.accountNumber ? <Text style={styles.accDetail}>****{acc.accountNumber.slice(-4)} {acc.ifscCode ? `| IFSC: ${acc.ifscCode}` : ''}</Text> : null}
                  {acc.upiId ? <Text style={styles.accDetail}>UPI: {acc.upiId}</Text> : null}
                </View>
              </View>
              <View style={styles.accActions}>
                <TouchableOpacity onPress={() => handleEdit(acc)} style={styles.accActionBtn}><Text style={styles.accActionText}>Edit</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(acc._id)} style={[styles.accActionBtn, styles.accActionDanger]}><Text style={styles.accActionDangerText}>Delete</Text></TouchableOpacity>
              </View>
            </View>
          ))
        )}
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
  scrollContent: { padding: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937' },
  sectionSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  addBtn: { backgroundColor: '#1B3150', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12 },
  addBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  errorText: { fontSize: 13, color: '#dc2626', marginBottom: 12 },
  formCard: { backgroundColor: '#f9fafb', borderRadius: 16, borderWidth: 2, borderColor: '#e5e7eb', padding: 16, marginBottom: 16 },
  formTitle: { fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 12 },
  input: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 10, color: '#1f2937' },
  orText: { textAlign: 'center', color: '#6b7280', marginVertical: 8 },
  formActions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#e5e7eb', alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  saveBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#1B3150', alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  emptyCard: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 2, borderColor: '#e5e7eb', padding: 32, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1f2937', marginTop: 16 },
  emptySubtext: { fontSize: 14, color: '#6b7280', marginTop: 8 },
  accCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 2, borderColor: '#e5e7eb', padding: 16, marginBottom: 12 },
  accRow: { flexDirection: 'row', alignItems: 'flex-start' },
  accIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  accInfo: { flex: 1 },
  accNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  accName: { fontSize: 16, fontWeight: '600', color: '#1f2937' },
  defaultBadge: { backgroundColor: '#f3f4f6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: '#d1d5db' },
  defaultBadgeText: { fontSize: 11, fontWeight: '600', color: '#1B3150' },
  accDetail: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  accActions: { flexDirection: 'row', gap: 12, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  accActionBtn: { paddingVertical: 6 },
  accActionText: { fontSize: 14, fontWeight: '600', color: '#1B3150' },
  accActionDanger: {},
  accActionDangerText: { fontSize: 14, fontWeight: '600', color: '#dc2626' },
});
