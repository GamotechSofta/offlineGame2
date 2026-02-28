import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { getMyTickets } from '../api/helpDesk';

const statusLabel = (status) => {
  const map = { open: 'Open', 'in-progress': 'In Progress', resolved: 'Resolved', closed: 'Closed' };
  return map[status] || status;
};

const statusStyle = (status) => {
  switch (status) {
    case 'in-progress': return styles.status_inprogress;
    case 'resolved': return styles.status_resolved;
    case 'closed': return styles.status_closed;
    default: return styles.status_open;
  }
};

export default function SupportStatusScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [myTickets, setMyTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  const userId = user?._id || user?.id;

  const fetchTickets = useCallback(async () => {
    if (!userId) {
      setMyTickets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await getMyTickets();
      if (res.success && Array.isArray(res.data)) setMyTickets(res.data);
      else setMyTickets([]);
    } catch {
      setMyTickets([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      fetchTickets();
    }, [fetchTickets])
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.title}>Check problem status</Text>
      </View>
      <Text style={styles.subtitle}>See status and reply for your submitted tickets.</Text>

      {!userId ? (
        <View style={styles.card}>
          <Text style={styles.cardText}>Please login to see your ticket status.</Text>
        </View>
      ) : loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1B3150" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : myTickets.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardText}>No tickets yet. Raise a help ticket from Help Desk.</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {myTickets.map((t) => (
            <View key={t._id} style={styles.ticketCard}>
              <View style={styles.ticketRow}>
                <View style={styles.ticketHead}>
                  <Text style={styles.ticketSubject} numberOfLines={1}>{t.subject}</Text>
                  <Text style={styles.ticketDate}>{t.createdAt ? new Date(t.createdAt).toLocaleString() : ''}</Text>
                </View>
                <View style={[styles.statusBadge, statusStyle(t.status)]}>
                  <Text style={styles.statusText}>{statusLabel(t.status)}</Text>
                </View>
              </View>
              <Text style={styles.ticketDesc} numberOfLines={3}>{t.description}</Text>
              {t.adminResponse ? (
                <View style={styles.responseBlock}>
                  <Text style={styles.responseLabel}>Response from support</Text>
                  <Text style={styles.responseText}>{t.adminResponse}</Text>
                </View>
              ) : null}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    paddingBottom: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backBtn: { padding: 8, marginRight: 4 },
  title: { fontSize: 20, fontWeight: '600', color: '#1B3150' },
  subtitle: { fontSize: 14, color: '#6b7280', marginHorizontal: 16, marginTop: 12, marginBottom: 16 },
  card: {
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14, color: '#6b7280' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  ticketCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    padding: 16,
    marginBottom: 12,
  },
  ticketRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  ticketHead: { flex: 1, minWidth: 0 },
  ticketSubject: { fontSize: 15, fontWeight: '600', color: '#1f2937' },
  ticketDate: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  status_open: { backgroundColor: 'rgba(27,49,80,0.15)', borderWidth: 2, borderColor: 'rgba(27,49,80,0.3)' },
  status_inprogress: { backgroundColor: '#fef3c7', borderWidth: 2, borderColor: '#fde68a' },
  status_resolved: { backgroundColor: '#dcfce7', borderWidth: 2, borderColor: '#86efac' },
  status_closed: { backgroundColor: '#f3f4f6', borderWidth: 2, borderColor: '#d1d5db' },
  statusText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  ticketDesc: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  responseBlock: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  responseLabel: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  responseText: { fontSize: 14, color: '#6b7280' },
});
