import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Modal, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '../config/api';

const BOTTOM_NAV_HEIGHT = 88;

const toDateKeyIST = (d) => {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return '';
  }
};

const formatDateLabel = (d) => {
  try {
    return d.toLocaleDateString('en-GB');
  } catch {
    return '';
  }
};

export default function MarketResultHistoryScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const todayKey = useMemo(() => toDateKeyIST(new Date()), []);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const dateKey = toDateKeyIST(selectedDate) || todayKey;
      const res = await fetch(`${API_BASE_URL}/markets/result-history?date=${encodeURIComponent(dateKey)}`);
      const data = await res.json();
      if (data?.success && Array.isArray(data?.data)) {
        setResults(data.data);
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, todayKey]);

  useEffect(() => {
    const k = toDateKeyIST(selectedDate);
    if (k && k > todayKey) setSelectedDate(new Date());
  }, [selectedDate, todayKey]);

  useEffect(() => {
    fetchResults();
    const id = setInterval(fetchResults, 30000);
    return () => clearInterval(id);
  }, [fetchResults]);

  const rows = useMemo(() => {
    const list = Array.isArray(results) ? results : [];
    const mapped = list.map((x) => ({
      id: x?._id || `${x?.marketId || ''}-${x?.dateKey || ''}`,
      name: (x?.marketName || '').toString().trim(),
      result: (x?.displayResult || '***_**_***').toString().trim(),
    }));
    mapped.sort((a, b) => a.name.localeCompare(b.name));
    return mapped.filter((x) => x.name);
  }, [results]);

  const contentBottomPadding = 24 + BOTTOM_NAV_HEIGHT + insets.bottom;

  const adjustDate = (delta) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    const dk = toDateKeyIST(d);
    if (dk && dk <= todayKey) setSelectedDate(d);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.title}>MARKET RESULT HISTORY</Text>
      </View>

      <View style={styles.dateCard}>
        <Text style={styles.dateLabel}>Select Date</Text>
        <TouchableOpacity
          onPress={() => setDatePickerOpen(true)}
          style={styles.dateButton}
          activeOpacity={0.9}
        >
          <Text style={styles.dateButtonText}>{formatDateLabel(selectedDate)}</Text>
          <Ionicons name="calendar-outline" size={20} color="#1B3150" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: contentBottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#1B3150" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No markets found.</Text>
          </View>
        ) : (
          rows.map((r) => (
            <View key={r.id} style={styles.rowCard}>
              <Text style={styles.rowName} numberOfLines={1}>{r.name.toUpperCase()}</Text>
              <Text style={styles.rowResult}>{r.result}</Text>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={datePickerOpen} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setDatePickerOpen(false)}>
          <Pressable style={styles.dateModal} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.dateModalTitle}>Select Date</Text>
            <View style={styles.dateModalRow}>
              <TouchableOpacity onPress={() => adjustDate(-1)} style={styles.dateNavBtn}>
                <Ionicons name="chevron-back" size={24} color="#1B3150" />
              </TouchableOpacity>
              <Text style={styles.dateModalValue}>{formatDateLabel(selectedDate)}</Text>
              <TouchableOpacity
                onPress={() => adjustDate(1)}
                style={styles.dateNavBtn}
                disabled={toDateKeyIST(selectedDate) >= todayKey}
              >
                <Ionicons name="chevron-forward" size={24} color={toDateKeyIST(selectedDate) >= todayKey ? '#9ca3af' : '#1B3150'} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => setDatePickerOpen(false)} style={styles.dateModalDone}>
              <Text style={styles.dateModalDoneText}>Done</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backBtn: { padding: 8, marginRight: 4 },
  title: { fontSize: 18, fontWeight: '800', color: '#1B3150' },
  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    padding: 16,
    margin: 16,
    marginBottom: 8,
  },
  dateLabel: { fontSize: 14, fontWeight: '600', color: '#374151' },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  dateButtonText: { fontSize: 14, fontWeight: '700', color: '#1f2937' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },
  loadingWrap: { padding: 32, alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#6b7280' },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    padding: 24,
    alignItems: 'center',
  },
  emptyText: { fontSize: 14, color: '#6b7280' },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  rowName: { flex: 1, fontSize: 14, fontWeight: '800', color: '#1f2937', marginRight: 12 },
  rowResult: { fontSize: 14, fontWeight: '800', color: '#1B3150' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  dateModal: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    padding: 24,
  },
  dateModalTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937', marginBottom: 16, textAlign: 'center' },
  dateModalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  dateNavBtn: { padding: 8 },
  dateModalValue: { fontSize: 16, fontWeight: '700', color: '#1B3150' },
  dateModalDone: {
    backgroundColor: '#1B3150',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  dateModalDoneText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
