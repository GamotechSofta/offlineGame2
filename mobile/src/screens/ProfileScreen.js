import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const displayName = user?.username || 'User';
  const phone = user?.phone || user?.mobile || user?.email || '-';

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.phone}>{phone}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  card: { backgroundColor: '#f9fafb', borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 2, borderColor: '#e5e7eb' },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#1B3150', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 32, fontWeight: '700', color: '#fff' },
  name: { marginTop: 16, fontSize: 20, fontWeight: '700', color: '#1f2937' },
  phone: { marginTop: 4, fontSize: 14, color: '#6b7280' },
});
