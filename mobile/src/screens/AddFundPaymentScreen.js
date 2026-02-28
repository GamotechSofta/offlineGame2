import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { submitDeposit } from '../api/funds';

export default function AddFundPaymentScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const amount = route?.params?.amount ?? 0;
  const [upiTransactionId, setUpiTransactionId] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to photos to upload screenshot.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8 });
    if (!result.canceled && result.assets?.[0]) setScreenshot(result.assets[0]);
  };

  const handleSubmit = async () => {
    setError('');
    const utr = (upiTransactionId || '').trim();
    if (!utr) {
      setError('Please enter UTR / Transaction ID');
      return;
    }
    if (!/^\d{12}$/.test(utr)) {
      setError('UTR must be 12 digits');
      return;
    }
    if (!screenshot?.uri) {
      setError('Please upload payment screenshot');
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('amount', amount);
      formData.append('upiTransactionId', utr);
      formData.append('screenshot', {
        uri: screenshot.uri,
        type: 'image/jpeg',
        name: 'screenshot.jpg',
      });
      const res = await submitDeposit(formData);
      if (res.success) {
        Alert.alert('Success', 'Deposit request submitted. It will be processed soon.', [
          { text: 'OK', onPress: () => navigation.navigate('Main', { screen: 'Funds' }) },
        ]);
      } else {
        setError(res.message || 'Failed to submit');
      }
    } catch (e) {
      setError(e?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.title}>Payment Details</Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>Selected Amount</Text>
          <Text style={styles.amountValue}>₹{Number(amount).toLocaleString('en-IN')}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>UTR / Transaction ID (12 digits)</Text>
          <TextInput
            style={styles.input}
            value={upiTransactionId}
            onChangeText={setUpiTransactionId}
            placeholder="Enter 12-digit UTR"
            placeholderTextColor="#9ca3af"
            keyboardType="number-pad"
            maxLength={12}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Payment Screenshot</Text>
          <TouchableOpacity onPress={pickImage} style={styles.uploadBtn} activeOpacity={0.9}>
            <Ionicons name="image-outline" size={28} color="#1B3150" />
            <Text style={styles.uploadText}>{screenshot ? 'Photo selected' : 'Tap to upload'}</Text>
          </TouchableOpacity>
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <TouchableOpacity onPress={handleSubmit} disabled={loading} style={[styles.submitBtn, loading && styles.submitBtnDisabled]} activeOpacity={0.9}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit Request</Text>}
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
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  amountCard: { backgroundColor: '#f9fafb', borderRadius: 16, borderWidth: 2, borderColor: '#e5e7eb', padding: 16, marginBottom: 20 },
  amountLabel: { fontSize: 12, color: '#6b7280' },
  amountValue: { fontSize: 20, fontWeight: '800', color: '#1B3150', marginTop: 4 },
  field: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#1f2937' },
  uploadBtn: { backgroundColor: '#f9fafb', borderWidth: 2, borderColor: '#e5e7eb', borderRadius: 12, padding: 24, alignItems: 'center', borderStyle: 'dashed' },
  uploadText: { marginTop: 8, fontSize: 14, color: '#6b7280' },
  errorText: { fontSize: 13, color: '#dc2626', marginBottom: 12 },
  submitBtn: { backgroundColor: '#1B3150', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  submitBtnDisabled: { opacity: 0.7 },
  submitText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
