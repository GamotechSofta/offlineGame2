import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { navigate as rootNavigate } from '../navigation/navigationRef';

const BOTTOM_NAV_HEIGHT = 88;

function openScreen(navigation, screenName) {
  const state = navigation.getState();
  const firstRouteName = state?.routes?.[0]?.name;
  const isRootNavigator = firstRouteName === 'Login' || firstRouteName === 'Main';
  if (isRootNavigator) rootNavigate('Main', { screen: screenName });
  else navigation.navigate(screenName);
}

export default function SupportScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const contentBottomPadding = 24 + BOTTOM_NAV_HEIGHT + insets.bottom;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.title}>Help Desk</Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: contentBottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>Choose an option below.</Text>

        <TouchableOpacity
          onPress={() => openScreen(navigation, 'SupportNew')}
          style={styles.card}
          activeOpacity={0.9}
        >
          <View style={styles.cardIconWrap}>
            <Ionicons name="create-outline" size={26} color="#1B3150" />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Raise help ticket</Text>
            <Text style={styles.cardSubtitle}>Submit a new problem with description and screenshots.</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#1B3150" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => openScreen(navigation, 'SupportStatus')}
          style={styles.card}
          activeOpacity={0.9}
        >
          <View style={styles.cardIconWrap}>
            <Ionicons name="document-text-outline" size={26} color="#1B3150" />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Check ticket status</Text>
            <Text style={styles.cardSubtitle}>View your submitted tickets and their status.</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#1B3150" />
        </TouchableOpacity>
      </ScrollView>
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
  title: { fontSize: 20, fontWeight: '600', color: '#1B3150' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingTop: 16 },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 24 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    padding: 20,
    marginBottom: 12,
  },
  cardIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(27,49,80,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardText: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#1f2937' },
  cardSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 4 },
});
