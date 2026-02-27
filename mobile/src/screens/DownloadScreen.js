import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function DownloadScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Download App</Text>
      <Text style={styles.subtitle}>Download the RATAN 365 mobile app</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', padding: 32 },
  title: { fontSize: 24, fontWeight: '700', color: '#1f2937' },
  subtitle: { marginTop: 16, fontSize: 14, color: '#6b7280' },
});
