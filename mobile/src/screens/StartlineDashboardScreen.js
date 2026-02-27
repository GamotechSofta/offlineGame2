import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function StartlineDashboardScreen() {
  const navigation = useNavigation();
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Text style={styles.backIcon}>←</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Starline Dashboard</Text>
      <Text style={styles.subtitle}>Convert from frontend StartlineDashboard.jsx for full UI.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  backBtn: { padding: 8, marginBottom: 16 },
  backIcon: { fontSize: 24, color: '#1f2937' },
  title: { fontSize: 20, fontWeight: '700', color: '#1B3150' },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 8 },
});
