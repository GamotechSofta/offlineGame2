import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function SupportScreen() {
  const navigation = useNavigation();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Help Desk</Text>
      <Text style={styles.subtitle}>Choose an option below.</Text>
      <TouchableOpacity onPress={() => navigation.navigate('SupportNew')} style={styles.btn} activeOpacity={0.9}>
        <Text style={styles.btnText}>Raise help ticket</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('SupportStatus')} style={styles.btn} activeOpacity={0.9}>
        <Text style={styles.btnText}>Check ticket status</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6', padding: 16 },
  title: { fontSize: 20, fontWeight: '600', color: '#1B3150' },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 24 },
  btn: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 2, borderColor: '#e5e7eb', padding: 20, marginBottom: 12 },
  btnText: { fontSize: 16, fontWeight: '600', color: '#1f2937' },
});
