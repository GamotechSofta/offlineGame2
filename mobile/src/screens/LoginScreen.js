import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_HEIGHT = 220;
import { useNavigation } from '@react-navigation/native';
import { API_BASE_URL } from '../config/api';
import { useAuth } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginScreen() {
  const navigation = useNavigation();
  const { setUser } = useAuth();
  const [formData, setFormData] = useState({ phone: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isAbove18, setIsAbove18] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (name, value) => {
    let processedValue = value;
    if (name === 'phone') {
      processedValue = value.replace(/\D/g, '').slice(0, 10);
    }
    setFormData((prev) => ({ ...prev, [name]: processedValue }));
    setError('');
  };

  const handleSubmit = async () => {
    setError('');
    if (!isAbove18) {
      setError('You must be above 18 years to continue');
      return;
    }
    if (!formData.phone) {
      setError('Phone number is required');
      return;
    }
    if (!formData.password) {
      setError('Password is required');
      return;
    }

    setLoading(true);
    try {
      let deviceId = '';
      try {
        deviceId = (await AsyncStorage.getItem('deviceId')) || '';
        if (!deviceId) {
          deviceId = `rn-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
          await AsyncStorage.setItem('deviceId', deviceId);
        }
      } catch (e) {
        deviceId = `rn-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      }

      const response = await fetch(`${API_BASE_URL}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: formData.phone,
          password: formData.password,
          deviceId: deviceId || undefined,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (data.success) {
        const userPayload = {
          ...data.data,
          createdAt: data.data?.createdAt || data.data?.created_at || data.data?.createdOn,
        };
        await setUser(userPayload);
        navigation.reset({ index: 0, routes: [{ name: 'Main', params: { screen: 'Home' } }] });
      } else {
        setError(data.message || 'Something went wrong');
      }
    } catch (err) {
      setError('Network error. Please check if the server is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.bannerWrap}>
          <Image
            source={{
              uri: 'https://res.cloudinary.com/dzd47mpdo/image/upload/v1770101961/Black_and_Gold_Classy_Casino_Night_Party_Instagram_Post_1080_x_1080_px_d1n00g.png',
            }}
            style={styles.banner}
            resizeMode="cover"
          />
        </View>

        <View style={styles.formWrap}>
          <Text style={styles.welcome}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>Phone Number <Text style={styles.asterisk}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="10-digit phone number"
              placeholderTextColor="#9ca3af"
              value={formData.phone}
              onChangeText={(v) => handleChange('phone', v)}
              keyboardType="phone-pad"
              maxLength={10}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Password <Text style={styles.asterisk}>*</Text></Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="Enter your password"
                placeholderTextColor="#9ca3af"
                value={formData.password}
                onChangeText={(v) => handleChange('password', v)}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
              >
                <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => setIsAbove18(!isAbove18)}
            style={styles.checkRow}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, isAbove18 && styles.checkboxChecked]}>
              {isAbove18 ? <Text style={styles.checkMark}>✓</Text> : null}
            </View>
            <Text style={styles.checkLabel}>
              I confirm that I am above 18 years of age and agree to the Terms of Use and Privacy Policy
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading || !isAbove18}
            style={[styles.submitBtn, (loading || !isAbove18) && styles.submitBtnDisabled]}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.submitText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.legal}>
            By continuing, you agree to our Terms of Use and Privacy Policy
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { paddingBottom: 48 },
  bannerWrap: {
    width: SCREEN_WIDTH,
    height: BANNER_HEIGHT,
    backgroundColor: '#0f0f0f',
  },
  banner: {
    width: SCREEN_WIDTH,
    height: BANNER_HEIGHT,
  },
  formWrap: {
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  welcome: { fontSize: 24, fontWeight: '700', color: '#1f2937', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 20 },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 2,
    borderColor: '#fca5a5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: '#dc2626', fontSize: 12 },
  field: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '500', color: '#374151', marginBottom: 6 },
  asterisk: { color: '#1B3150' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  passwordRow: { position: 'relative' },
  passwordInput: { paddingRight: 70 },
  eyeBtn: { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' },
  eyeText: { fontSize: 12, color: '#6b7280' },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 20 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#9ca3af',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: '#22c55e', borderColor: '#22c55e' },
  checkMark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  checkLabel: { flex: 1, fontSize: 12, color: '#374151', lineHeight: 18 },
  submitBtn: {
    backgroundColor: '#1B3150',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  legal: { textAlign: 'center', fontSize: 12, color: '#6b7280' },
});
