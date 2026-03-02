import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { isBettingAllowed } from '../utils/marketTiming';

// Use PNG format for React Native (Image does not support SVG). Fallback letter shown if image fails.
const OPTIONS = [
  {
    id: 1,
    title: 'Single Digit',
    icon:
      'https://res.cloudinary.com/dzd47mpdo/image/upload/f_png/v1769756244/Untitled_90_x_160_px_1080_x_1080_px_1_yinraf.svg',
    letter: '1',
  },
  {
    id: 2,
    title: 'Single Digit Bulk',
    icon:
      'https://res.cloudinary.com/dzd47mpdo/image/upload/f_png/v1769756244/Untitled_90_x_160_px_1080_x_1080_px_1_yinraf.svg',
    letter: '1',
  },
  {
    id: 3,
    title: 'Jodi',
    icon:
      'https://res.cloudinary.com/dzd47mpdo/image/upload/f_png/v1769714108/Untitled_1080_x_1080_px_1080_x_1080_px_7_rpzykt.svg',
    letter: 'J',
  },
  {
    id: 4,
    title: 'Jodi Bulk',
    icon:
      'https://res.cloudinary.com/dzd47mpdo/image/upload/f_png/v1769714108/Untitled_1080_x_1080_px_1080_x_1080_px_7_rpzykt.svg',
    letter: 'J',
  },
  {
    id: 5,
    title: 'Single Pana',
    icon:
      'https://res.cloudinary.com/dzd47mpdo/image/upload/f_png/v1769714254/Untitled_1080_x_1080_px_1080_x_1080_px_8_jdbxyd.svg',
    letter: 'P',
  },
  {
    id: 6,
    title: 'Single Pana Bulk',
    icon:
      'https://res.cloudinary.com/dzd47mpdo/image/upload/f_png/v1769714254/Untitled_1080_x_1080_px_1080_x_1080_px_8_jdbxyd.svg',
    letter: 'P',
  },
  {
    id: 7,
    title: 'Double Pana',
    icon:
      'https://res.cloudinary.com/dzd47mpdo/image/upload/f_png/v1769713943/Untitled_1080_x_1080_px_1080_x_1080_px_6_uccv7o.svg',
    letter: 'D',
  },
  {
    id: 8,
    title: 'Double Pana Bulk',
    icon:
      'https://res.cloudinary.com/dzd47mpdo/image/upload/f_png/v1769713943/Untitled_1080_x_1080_px_1080_x_1080_px_6_uccv7o.svg',
    letter: 'D',
  },
  {
    id: 9,
    title: 'Triple Pana',
    icon:
      'https://res.cloudinary.com/dzd47mpdo/image/upload/f_png/v1769714392/Untitled_1080_x_1080_px_1080_x_1080_px_9_ugcdef.svg',
    letter: 'T',
  },
  {
    id: 10,
    title: 'Full Sangam',
    icon:
      'https://res.cloudinary.com/dzd47mpdo/image/upload/f_png/v1770033671/Untitled_design_2_kr1imj.svg',
    letter: 'F',
  },
  {
    id: 11,
    title: 'Half Sangam',
    icon:
      'https://res.cloudinary.com/dzd47mpdo/image/upload/f_png/v1770033165/Untitled_design_c5hag8.svg',
    letter: 'H',
  },
];

function isStarline(market) {
  const mType = (market?.marketType || '').toString().trim().toLowerCase();
  if (mType === 'startline' || mType === 'starline') return true;
  const name = (market?.marketName || market?.gameName || '').toString().toLowerCase();
  return name.includes('starline') || name.includes('startline');
}

export default function BidOptionsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const market = route.params?.market;

  useEffect(() => {
    if (!market) {
      navigation.replace('Home');
      return;
    }
    if (isStarline(market) && market?.status === 'closed') {
      navigation.replace('StartlineDashboard');
    }
  }, [market, navigation]);

  if (!market) return null;

  const timing = isBettingAllowed(market);
  const isCloseOnlyWindow = timing.allowed && timing.closeOnly === true;
  const isRunning = market.status === 'running' || isCloseOnlyWindow;

  let visibleOptions = OPTIONS;
  if (isStarline(market)) {
    const allowed = new Set([
      'Single Digit', 'Single Digit Bulk', 'Single Pana', 'Single Pana Bulk',
      'Double Pana', 'Double Pana Bulk', 'Triple Pana', 'Half Sangam',
    ]);
    visibleOptions = OPTIONS.filter((opt) => allowed.has(opt.title));
  }
  if (!isStarline(market) && isRunning) {
    const hideWhenRunning = new Set(['jodi', 'jodi bulk', 'full sangam', 'half sangam']);
    visibleOptions = visibleOptions.filter(
      (opt) => !hideWhenRunning.has(opt.title.toLowerCase().trim())
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.navigate(isStarline(market) ? 'StartlineDashboard' : 'Home')}
          style={styles.backBtn}
          activeOpacity={0.8}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{market?.gameName || 'SELECT MARKET'}</Text>
          {isStarline(market) ? (
            <Text style={styles.starlineLabel}>STARLINE MARKET</Text>
          ) : null}
        </View>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {visibleOptions.map((option) => (
          <TouchableOpacity
            key={option.id}
            onPress={() =>
              navigation.navigate('GameBid', {
                market,
                betType: option.title,
                gameMode: option.title.toLowerCase().includes('bulk') ? 'bulk' : 'easy',
              })
            }
            style={styles.optionCard}
            activeOpacity={0.9}
          >
            <View style={styles.optionIconWrap}>
              <Image source={{ uri: option.icon }} style={styles.optionIcon} resizeMode="contain" />
            </View>
            <Text style={styles.optionTitle}>{option.title}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#d1d5db',
  },
  backBtn: { padding: 8, marginLeft: -8 },
  backIcon: { fontSize: 24, color: '#4b5563' },
  headerCenter: { flex: 1, alignItems: 'center', marginHorizontal: 12 },
  headerTitle: { fontSize: 14, fontWeight: '700', color: '#1f2937' },
  starlineLabel: { fontSize: 11, fontWeight: '800', color: '#1B3150', letterSpacing: 1, marginTop: 4 },
  scroll: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 12, paddingBottom: 100 },
  optionCard: {
    width: '47%',
    minHeight: 104,
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconWrap: { width: 72, height: 72, marginBottom: 8, alignItems: 'center', justifyContent: 'center' },
  optionIcon: { width: 72, height: 72 },
  optionTitle: { fontSize: 10, fontWeight: '600', color: '#1f2937', textAlign: 'center' },
});
