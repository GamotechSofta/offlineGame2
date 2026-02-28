import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getBalance, updateUserBalance } from '../api/bets';
import { useAuth } from '../context/AuthContext';

const MENU_ITEMS = [
  { label: 'My Bets', path: 'Bids' },
  { label: 'Bank', path: 'Bank' },
  { label: 'Funds', path: 'Funds' },
  { label: 'Game Rate', path: 'Support' },
  { label: 'Help Desk', path: 'Support' },
  { label: 'Logout', path: 'Login' },
];

export default function AppHeader() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user, balance, setBalance, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const fetchAndUpdateBalance = async () => {
      try {
        if (!user?.id && !user?._id) return;
        const res = await getBalance();
        if (res.success && res.data?.balance != null) {
          await updateUserBalance(res.data.balance);
          setBalance(res.data.balance);
        }
      } catch (_) {}
    };
    fetchAndUpdateBalance();
  }, [user?.id, user?._id]);

  const handleLogout = () => {
    logout();
    setIsMenuOpen(false);
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const displayName = user?.username || 'Sign In';
  const displayPhone =
    user?.phone ||
    user?.mobile ||
    user?.mobileNumber ||
    user?.phoneNumber ||
    user?.phone_number ||
    user?.mobilenumber ||
    user?.email ||
    '-';
  const sinceDateRaw = user?.createdAt || user?.created_at || user?.createdOn;
  const sinceDate = sinceDateRaw ? new Date(sinceDateRaw) : null;
  const sinceText =
    sinceDate && !Number.isNaN(sinceDate.getTime())
      ? `Since ${sinceDate.toLocaleDateString('en-GB')}`
      : 'Since -';
  const avatarInitial = displayName ? displayName.charAt(0).toUpperCase() : 'U';

  const handleProfileClick = () => {
    setIsMenuOpen(false);
    if (user) navigation.navigate('Main', { screen: 'Profile' });
    else navigation.navigate('Login');
  };

  const displayBalance = balance != null ? Number(balance) : 0;
  const formattedBalance = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(displayBalance);

  return (
    <>
      <View
        style={[
          styles.header,
          {
            paddingTop: 8 + insets.top,
            paddingBottom: 8,
            paddingLeft: Math.max(12, insets.left),
            paddingRight: Math.max(12, insets.right),
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View style={styles.leftRow}>
            <TouchableOpacity
              onPress={() => setIsMenuOpen(true)}
              style={styles.iconBtn}
              activeOpacity={0.8}
              accessibilityLabel="Open menu"
            >
              <View style={styles.hamburger}>
                <View style={[styles.hamLine, { width: 16 }]} />
                <View style={[styles.hamLine, { width: 14 }]} />
                <View style={[styles.hamLine, { width: 12 }]} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('Main', { screen: 'Home' })}
              style={styles.iconBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.homeIcon}>⌂</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.rightRow}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Main', { screen: 'Funds', params: { tab: 'add-fund' } })}
              style={styles.walletBtn}
              activeOpacity={0.8}
            >
              <Image
                source={{ uri: 'https://res.cloudinary.com/dnyp5jknp/image/upload/v1771394532/wallet_n1oyef.png' }}
                style={styles.walletImg}
              />
              <Text style={styles.walletText}>₹{formattedBalance}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleProfileClick}
              style={[styles.iconBtn, user ? styles.profileBtnLogged : styles.profileBtn]}
              activeOpacity={0.8}
            >
              <Ionicons
                name="person-outline"
                size={24}
                color={user ? '#1B3150' : '#9ca3af'}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <Modal visible={isMenuOpen} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setIsMenuOpen(false)}>
          <Pressable style={styles.menuPanel} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.menuHeader, { paddingTop: 24, paddingBottom: 20 }]}>
              <TouchableOpacity
                onPress={() => {
                  setIsMenuOpen(false);
                  handleProfileClick();
                }}
                style={styles.menuUserRow}
                activeOpacity={0.8}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarTextLarge}>{avatarInitial}</Text>
                  {user && <View style={styles.onlineDot} />}
                </View>
                <View style={styles.menuUserInfo}>
                  <Text style={styles.menuUserName} numberOfLines={1}>{displayName}</Text>
                  <Text style={styles.menuUserPhone} numberOfLines={1}>{displayPhone}</Text>
                  <Text style={styles.menuSince}>{sinceText}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setIsMenuOpen(false)}
                style={styles.closeBtn}
                activeOpacity={0.8}
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.menuScroll} showsVerticalScrollIndicator={false}>
              {MENU_ITEMS.map((item) => (
                <TouchableOpacity
                  key={item.label}
                  onPress={() => {
                    setIsMenuOpen(false);
                    if (item.label === 'Logout') {
                      handleLogout();
                    } else {
                      navigation.navigate('Main', { screen: item.path });
                    }
                  }}
                  style={styles.menuItem}
                  activeOpacity={0.8}
                >
                  <Text style={styles.menuItemLabel}>{item.label}</Text>
                  <Text style={styles.menuItemArrow}>›</Text>
                </TouchableOpacity>
              ))}
              <Text style={styles.versionText}>Version: 1.0.0</Text>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#fff',
    borderBottomWidth: 2,
    borderBottomColor: '#d1d5db',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rightRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hamburger: { gap: 4 },
  hamLine: { height: 2, backgroundColor: '#000', borderRadius: 1 },
  homeIcon: { fontSize: 18, color: '#000' },
  walletBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: '#d1d5db',
  },
  walletImg: { width: 24, height: 24 },
  walletText: { fontSize: 12, fontWeight: '700', color: '#1f2937' },
  profileBtn: {
    backgroundColor: '#fff',
    borderColor: '#9ca3af',
  },
  profileBtnLogged: {
    backgroundColor: '#f9fafb',
    borderColor: '#6b7280',
  },
  avatarText: { fontSize: 14, fontWeight: '700', color: '#374151' },
  avatarTextGuest: { color: '#1B3150' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: 0,
  },
  menuPanel: {
    width: '86%',
    maxWidth: 360,
    height: '100%',
    backgroundColor: '#fff',
    borderRightWidth: 2,
    borderRightColor: '#d1d5db',
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#d1d5db',
    backgroundColor: '#f9fafb',
  },
  menuUserRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1B3150',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTextLarge: { fontSize: 22, fontWeight: '700', color: '#fff' },
  onlineDot: {
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
  menuUserInfo: { flex: 1, minWidth: 0 },
  menuUserName: { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  menuUserPhone: { fontSize: 12, color: '#4b5563', marginTop: 2 },
  menuSince: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { fontSize: 18, color: '#6b7280' },
  menuScroll: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
  },
  menuItemLabel: { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  menuItemArrow: { fontSize: 18, color: '#9ca3af' },
  versionText: { textAlign: 'center', fontSize: 12, color: '#6b7280', paddingVertical: 16 },
});
