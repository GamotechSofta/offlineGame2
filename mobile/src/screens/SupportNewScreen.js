import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { submitTicket } from '../api/helpDesk';

const MAX_SCREENSHOTS = 5;

export default function SupportNewScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [subject, setSubject] = useState('Support Request');
  const [description, setDescription] = useState('');
  const [screenshots, setScreenshots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const userId = user?._id || user?.id;

  const handleChooseFiles = async () => {
    if (!userId) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photos to attach screenshots.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (result.canceled) return;
    const newUris = result.assets.map((a) => ({
      uri: a.uri,
      name: a.fileName || `image_${Date.now()}.jpg`,
      type: 'image/jpeg',
    }));
    setScreenshots((prev) => [...prev, ...newUris].slice(0, MAX_SCREENSHOTS));
  };

  const handleSubmit = async () => {
    if (!userId) {
      setMessage({ type: 'error', text: 'Please login to submit a support request.' });
      return;
    }
    if (!description.trim()) {
      setMessage({ type: 'error', text: 'Please describe your problem.' });
      return;
    }
    setMessage({ type: '', text: '' });
    setLoading(true);
    try {
      const res = await submitTicket({
        subject: subject.trim() || 'Support Request',
        description: description.trim(),
        screenshots,
      });
      if (res.success) {
        setMessage({ type: 'success', text: 'Your request has been submitted. We will get back to you soon.' });
        setDescription('');
        setScreenshots([]);
      } else {
        setMessage({ type: 'error', text: res.message || 'Failed to submit. Please try again.' });
      }
    } catch (_) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboard}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { paddingTop: Math.max(12, insets.top) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.title}>Raise help ticket</Text>
      </View>
      <Text style={styles.subtitle}>Describe your problem and attach screenshots if needed.</Text>

      {!userId && (
        <View style={styles.loginCard}>
          <Text style={styles.loginCardText}>Please login to submit a support request.</Text>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.label}>Subject</Text>
            <TextInput
              style={styles.input}
              value={subject}
              onChangeText={setSubject}
              placeholder="e.g. Payment issue, Game error"
              placeholderTextColor="#9ca3af"
              editable={!!userId}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>
              Describe your problem <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.textArea}
              value={description}
              onChangeText={setDescription}
              placeholder="Explain your issue in detail..."
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              editable={!!userId}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Screenshots (optional, max 5 images)</Text>
            <View style={styles.fileRow}>
              <TouchableOpacity
                onPress={handleChooseFiles}
                disabled={!userId}
                style={[styles.chooseBtn, !userId && styles.chooseBtnDisabled]}
                activeOpacity={0.9}
              >
                <Text style={styles.chooseBtnText}>Choose files</Text>
              </TouchableOpacity>
              <Text style={styles.fileChosen}>{screenshots.length > 0 ? `${screenshots.length} file(s) chosen` : 'No file chosen'}</Text>
            </View>
          </View>
          {message.text ? (
            <View style={[styles.messageBox, message.type === 'success' ? styles.messageSuccess : styles.messageError]}>
              <Text style={styles.messageText}>{message.text}</Text>
            </View>
          ) : null}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!userId || loading}
            style={[styles.submitBtn, (!userId || loading) && styles.submitBtnDisabled]}
            activeOpacity={0.9}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboard: { flex: 1, backgroundColor: '#f3f4f6' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    paddingBottom: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backBtn: { padding: 8, marginRight: 4 },
  title: { fontSize: 20, fontWeight: '600', color: '#1B3150' },
  subtitle: { fontSize: 14, color: '#6b7280', marginHorizontal: 16, marginTop: 12, marginBottom: 8 },
  loginCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  loginCardText: { fontSize: 14, color: '#1B3150', textAlign: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    padding: 20,
  },
  field: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6 },
  required: { color: '#dc2626' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  textArea: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f2937',
    minHeight: 120,
  },
  fileRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  chooseBtn: {
    backgroundColor: '#1B3150',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  chooseBtnDisabled: { opacity: 0.5 },
  chooseBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  fileChosen: { fontSize: 14, color: '#6b7280' },
  messageBox: { marginBottom: 12, padding: 12, borderRadius: 14 },
  messageSuccess: { backgroundColor: '#dcfce7', borderWidth: 1, borderColor: '#86efac' },
  messageError: { backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fca5a5' },
  messageText: { fontSize: 14, color: '#374151' },
  submitBtn: {
    backgroundColor: '#1B3150',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
