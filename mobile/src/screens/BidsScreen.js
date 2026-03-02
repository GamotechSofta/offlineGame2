import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function BidsScreen() {
  const navigation = useNavigation();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Bets</Text>
      <Text style={styles.subtitle}>Convert from frontend Bids.jsx for full list.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16, paddingTop: 48 },
  title: { fontSize: 20, fontWeight: '700', color: '#1B3150' },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 8 },
});
