import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { getBalance } from '../api/bets';

const BOTTOM_NAV_HEIGHT = 88;

function pick(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return '';
}

export default function ProfileScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user, balance, setBalance, logout } = useAuth();
  const [copiedLabel, setCopiedLabel] = useState('');
  const [balanceLoading, setBalanceLoading] = useState(false);

  const displayName = useMemo(
    () => pick(user, ['username', 'name', 'fullName']) || 'User',
    [user]
  );
  const email = useMemo(() => pick(user, ['email']) || 'Not set', [user]);
  const phone = useMemo(
    () =>
      pick(user, ['phone', 'mobile', 'mobileNumber', 'phoneNumber', 'phone_number', 'mobilenumber']) ||
      'Not set',
    [user]
  );
  const userId = user?.id || user?._id || 'N/A';
  const walletValue = useMemo(() => {
    const b = balance ?? pick(user, ['wallet', 'balance', 'points', 'walletAmount', 'wallet_amount', 'amount']);
    const n = Number(b);
    return Number.isFinite(n) ? n : 0;
  }, [user, balance]);
  const avatarInitial = displayName.charAt(0).toUpperCase();
  const contentBottomPadding = 24 + BOTTOM_NAV_HEIGHT + insets.bottom;

  useEffect(() => {
    if (!user?.id && !user?._id) return;
    let cancelled = false;
    setBalanceLoading(true);
    getBalance()
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data?.balance != null) setBalance(res.data.balance);
      })
      .finally(() => {
        if (!cancelled) setBalanceLoading(false);
      });
    return () => { cancelled = true; };
  }, [user?.id, user?._id, setBalance]);

  const copyToClipboard = async (text, label) => {
    const str = String(text || '').trim();
    if (!str || str === 'Not set' || str === 'N/A') return;
    try {
      const Clipboard = require('expo-clipboard');
      await Clipboard.setStringAsync(str);
      setCopiedLabel(label);
      setTimeout(() => setCopiedLabel(''), 1500);
    } catch (e) {
      Alert.alert('Copy', str);
    }
  };

  const quickActions = [
    {
      label: 'Add Fund',
      path: 'AddFund',
      params: {},
      color: '#10b981',
      Icon: Ionicons,
      iconName: 'add',
    },
    {
      label: 'Withdraw',
      path: 'WithdrawFund',
      params: {},
      color: '#3b82f6',
      Icon: Ionicons,
      iconName: 'arrow-down',
    },
    {
      label: 'Passbook',
      path: 'Passbook',
      params: {},
      color: '#8b5cf6',
      Icon: Ionicons,
      iconName: 'book-outline',
    },
    {
      label: 'History',
      path: 'BetHistory',
      params: {},
      color: '#1B3150',
      Icon: Ionicons,
      iconName: 'time-outline',
    },
  ];

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={24} color="#1f2937" />
          </TouchableOpacity>
          <Text style={styles.title}>My Profile</Text>
        </View>
        <View style={styles.centered}>
          <Text style={styles.placeholderText}>Please sign in to view profile.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.title}>My Profile</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: contentBottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile card */}
        <View style={styles.card}>
          <View style={styles.profileRow}>
            <View style={styles.avatarWrap}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{avatarInitial}</Text>
              </View>
              <View style={styles.statusDot} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
              <Text style={styles.email} numberOfLines={1}>{email}</Text>
              <View style={styles.activePill}>
                <Text style={styles.activeText}>ACTIVE</Text>
              </View>
            </View>
          </View>

          {/* Wallet balance */}
          <View style={styles.walletCard}>
            <View style={styles.walletLeft}>
              <Text style={styles.walletLabel}>WALLET BALANCE</Text>
              {balanceLoading ? (
                <ActivityIndicator size="small" color="#1B3150" style={styles.balanceLoader} />
              ) : (
                <Text style={styles.walletAmount}>
                  ₹{walletValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              )}
            </View>
            <View style={styles.walletIconWrap}>
              <Ionicons name="wallet-outline" size={24} color="#1B3150" />
            </View>
          </View>

          {/* Quick actions */}
          <View style={styles.quickActions}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.label}
                onPress={() => navigation.navigate('Main', { screen: action.path, params: action.params })}
                style={styles.quickActionBtn}
                activeOpacity={0.9}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: action.color }]}>
                  <action.Icon name={action.iconName} size={22} color="#fff" />
                </View>
                <Text style={styles.quickActionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Account information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT INFORMATION</Text>

          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <MaterialCommunityIcons name="identifier" size={20} color="#4b5563" />
            </View>
            <View style={styles.infoTextWrap} flex={1}>
              <Text style={styles.infoLabel}>USER ID</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{userId}</Text>
            </View>
            <TouchableOpacity
              onPress={() => copyToClipboard(userId, 'User ID')}
              style={styles.copyBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              {copiedLabel === 'User ID' ? (
                <Ionicons name="checkmark" size={18} color="#10b981" />
              ) : (
                <Ionicons name="copy-outline" size={18} color="#6b7280" />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <Ionicons name="person-outline" size={20} color="#4b5563" />
            </View>
            <View style={styles.infoTextWrap} flex={1}>
              <Text style={styles.infoLabel}>USERNAME</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{displayName}</Text>
            </View>
            <TouchableOpacity
              onPress={() => copyToClipboard(displayName, 'Username')}
              style={styles.copyBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              {copiedLabel === 'Username' ? (
                <Ionicons name="checkmark" size={18} color="#10b981" />
              ) : (
                <Ionicons name="copy-outline" size={18} color="#6b7280" />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <Ionicons name="mail-outline" size={20} color="#4b5563" />
            </View>
            <View style={styles.infoTextWrap} flex={1}>
              <Text style={styles.infoLabel}>EMAIL</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{email}</Text>
            </View>
            <TouchableOpacity
              onPress={() => copyToClipboard(email, 'Email')}
              style={styles.copyBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              {copiedLabel === 'Email' ? (
                <Ionicons name="checkmark" size={18} color="#10b981" />
              ) : (
                <Ionicons name="copy-outline" size={18} color="#6b7280" />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <Ionicons name="call-outline" size={20} color="#4b5563" />
            </View>
            <View style={styles.infoTextWrap} flex={1}>
              <Text style={styles.infoLabel}>PHONE</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{phone}</Text>
            </View>
            <TouchableOpacity
              onPress={() => copyToClipboard(phone, 'Phone')}
              style={styles.copyBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              {copiedLabel === 'Phone' ? (
                <Ionicons name="checkmark" size={18} color="#10b981" />
              ) : (
                <Ionicons name="copy-outline" size={18} color="#6b7280" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Sign out */}
        <TouchableOpacity
          onPress={() => {
            Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign Out', style: 'destructive', onPress: logout },
            ]);
          }}
          style={styles.logoutBtn}
          activeOpacity={0.9}
        >
          <Ionicons name="log-out-outline" size={22} color="#dc2626" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backBtn: { padding: 8, marginRight: 4 },
  title: { fontSize: 18, fontWeight: '700', color: '#1f2937' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingTop: 8 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  placeholderText: { fontSize: 16, color: '#6b7280' },

  card: {
    backgroundColor: '#f9fafb',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    padding: 20,
    marginBottom: 16,
  },
  profileRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1B3150',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 28, fontWeight: '700', color: '#fff' },
  statusDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#fff',
  },
  profileInfo: { marginLeft: 16, flex: 1, minWidth: 0 },
  name: { fontSize: 18, fontWeight: '700', color: '#1f2937' },
  email: { fontSize: 14, color: '#6b7280', marginTop: 2 },
  activePill: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
  },
  activeText: { fontSize: 10, fontWeight: '700', color: '#16a34a', letterSpacing: 0.5 },

  walletCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    padding: 16,
    marginBottom: 16,
  },
  walletLeft: { flex: 1 },
  walletLabel: { fontSize: 10, fontWeight: '600', color: '#6b7280', letterSpacing: 0.5 },
  balanceLoader: { marginTop: 4 },
  walletAmount: { fontSize: 24, fontWeight: '800', color: '#1B3150', marginTop: 4 },
  walletIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },

  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  quickActionBtn: { alignItems: 'center', flex: 1 },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  quickActionLabel: { fontSize: 11, fontWeight: '600', color: '#374151', textAlign: 'center' },

  section: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: '#1f2937', letterSpacing: 0.5,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  infoIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  infoTextWrap: { flex: 1, minWidth: 0 },
  infoLabel: { fontSize: 10, fontWeight: '600', color: '#6b7280', letterSpacing: 0.5 },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#1f2937', marginTop: 2 },
  copyBtn: { padding: 8 },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#fef2f2',
    borderWidth: 2,
    borderColor: '#fecaca',
  },
  logoutText: { fontSize: 16, fontWeight: '700', color: '#dc2626' },
});
