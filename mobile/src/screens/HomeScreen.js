import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import HeroSection from '../components/HeroSection';
import Section1 from '../components/Section1';

export default function HomeScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <HeroSection />
      <Section1 />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e5e7eb' },
  content: { paddingBottom: 100 },
});
