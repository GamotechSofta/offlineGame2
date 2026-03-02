import React, { useRef, useState, useCallback } from 'react';
import { StyleSheet, ScrollView, RefreshControl } from 'react-native';
import HeroSection from '../components/HeroSection';
import Section1 from '../components/Section1';
import { useSetInnerNavRef } from '../navigation/InnerStackNavContext';

export default function HomeScreen() {
  useSetInnerNavRef();
  const refreshRef = useRef(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshRef.current?.();
    setRefreshing(false);
  }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1B3150']} tintColor="#1B3150" />}
    >
      <HeroSection />
      <Section1 refreshRef={refreshRef} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e5e7eb' },
  content: { paddingBottom: 100 },
});
