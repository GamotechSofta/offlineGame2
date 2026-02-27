import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function MarketResultHistoryScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Market Result History</Text>
      <Text style={styles.subtitle}>Convert from frontend MarketResultHistory.jsx.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#1B3150' },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 8 },
});
