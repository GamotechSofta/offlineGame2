import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ErrorState({ message = 'Something went wrong', onRetry }) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name="alert-circle-outline" size={48} color="#dc2626" />
      </View>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <TouchableOpacity onPress={onRetry} style={styles.btn} activeOpacity={0.9}>
          <Ionicons name="refresh" size={18} color="#fff" />
          <Text style={styles.btnText}>Retry</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32, paddingHorizontal: 24 },
  iconWrap: { marginBottom: 12 },
  message: { fontSize: 15, color: '#6b7280', textAlign: 'center', marginBottom: 16 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1B3150', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 },
  btnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
