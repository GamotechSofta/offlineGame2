import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

/**
 * YouTube-style skeleton placeholder with pulse animation.
 * Use for loading states where backend data is being fetched.
 */
export function SkeletonBox({ width, height, borderRadius = 6, style }) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.box,
        {
          width: width ?? '100%',
          height: height ?? 16,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
}

/**
 * Skeleton for a list row (e.g. transaction, bet, market result)
 */
export function SkeletonRow({ hasIcon = true }) {
  return (
    <View style={styles.row}>
      {hasIcon && <SkeletonBox width={40} height={40} borderRadius={12} />}
      <View style={[styles.rowContent, !hasIcon && { marginLeft: 0 }]}>
        <SkeletonBox width="70%" height={14} style={{ marginBottom: 6 }} />
        <SkeletonBox width="40%" height={12} />
      </View>
      <View style={styles.rowRight}>
        <SkeletonBox width={60} height={14} style={{ marginBottom: 4 }} />
        <SkeletonBox width={40} height={10} />
      </View>
    </View>
  );
}

/**
 * Skeleton for a card (e.g. market card)
 */
export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <SkeletonBox width="50%" height={16} />
        <SkeletonBox width={80} height={20} borderRadius={10} />
      </View>
      <View style={styles.cardMiddle}>
        <SkeletonBox width={120} height={20} />
        <SkeletonBox width={36} height={36} borderRadius={18} />
      </View>
      <View style={styles.cardBottom}>
        <View>
          <SkeletonBox width={60} height={10} style={{ marginBottom: 4 }} />
          <SkeletonBox width={50} height={12} />
        </View>
        <View>
          <SkeletonBox width={60} height={10} style={{ marginBottom: 4 }} />
          <SkeletonBox width={50} height={12} />
        </View>
      </View>
    </View>
  );
}

/**
 * Skeleton for balance card + list
 */
export function SkeletonBalanceList({ rowCount = 6 }) {
  return (
    <View style={styles.balanceList}>
      <View style={styles.balanceCard}>
        <SkeletonBox width={100} height={12} style={{ marginBottom: 8 }} />
        <SkeletonBox width={120} height={32} style={{ marginBottom: 16 }} />
        <View style={styles.balanceStats}>
          <SkeletonBox width="48%" height={50} borderRadius={12} />
          <SkeletonBox width="48%" height={50} borderRadius={12} />
        </View>
      </View>
      {[...Array(rowCount)].map((_, i) => (
        <SkeletonRow key={i} hasIcon={true} />
      ))}
    </View>
  );
}

/**
 * Skeleton for bet history card
 */
export function SkeletonBetCard() {
  return (
    <View style={styles.betCard}>
      <SkeletonBox width="70%" height={14} style={{ marginBottom: 12 }} />
      <View style={styles.betTable}>
        <SkeletonBox width="30%" height={12} style={{ marginBottom: 6 }} />
        <SkeletonBox width="30%" height={12} style={{ marginBottom: 6 }} />
        <SkeletonBox width="30%" height={12} style={{ marginBottom: 6 }} />
      </View>
      <View style={styles.betTable}>
        <SkeletonBox width="25%" height={14} />
        <SkeletonBox width="25%" height={14} />
        <SkeletonBox width="25%" height={14} />
      </View>
      <SkeletonBox width="60%" height={12} style={{ marginTop: 12 }} />
      <SkeletonBox width="50%" height={14} style={{ marginTop: 12 }} />
    </View>
  );
}

/**
 * Skeleton for bet history responsive card grid (light theme)
 */
export function SkeletonCardGrid({ count = 8, columns = 2, width, height }) {
  const rows = Math.ceil(count / columns);
  const gap = width && width < 360 ? 6 : 8;
  const padding = width ? Math.round((width * 4) / 100) : 12;
  const paddingBottom = 100 + (height ? Math.round(height * 0.02) : 0);
  return (
    <View style={[skeletonGridStyles.grid, { padding, paddingBottom }]}>
      {[...Array(rows)].map((_, rowIdx) => (
        <View key={rowIdx} style={[skeletonGridStyles.row, { marginBottom: gap, gap }]}>
          {[...Array(columns)].map((_, colIdx) => (
            <View key={colIdx} style={skeletonGridStyles.card}>
              <SkeletonBox width="30%" height={10} borderRadius={4} style={{ marginBottom: 8 }} />
              <SkeletonBox width="60%" height={10} borderRadius={4} style={{ marginBottom: 6 }} />
              <SkeletonBox width="80%" height={10} borderRadius={4} style={{ marginBottom: 6 }} />
              <SkeletonBox width="70%" height={10} borderRadius={4} style={{ marginBottom: 6 }} />
              <SkeletonBox width="50%" height={10} borderRadius={4} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const skeletonGridStyles = StyleSheet.create({
  grid: { backgroundColor: '#f3f4f6' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  card: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    minHeight: 160,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
});

/**
 * Skeleton for simple list (e.g. market results)
 */
export function SkeletonSimpleList({ rowCount = 8 }) {
  return (
    <View style={styles.simpleList}>
      {[...Array(rowCount)].map((_, i) => (
        <View key={i} style={styles.simpleRow}>
          <SkeletonBox width="60%" height={16} />
          <SkeletonBox width={100} height={16} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: '#e5e7eb',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  rowContent: { flex: 1, marginLeft: 12 },
  rowRight: { alignItems: 'flex-end' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardMiddle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardBottom: { flexDirection: 'row', gap: 24 },
  betCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  betTable: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  balanceList: { padding: 16 },
  balanceCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  balanceStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  simpleList: { padding: 16 },
  simpleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
});
