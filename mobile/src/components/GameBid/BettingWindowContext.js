import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { isBettingAllowed } from '../../utils/marketTiming';

const BettingWindowContext = createContext({ allowed: true, closeOnly: false, message: null });

function computeWindowState(market) {
  if (!market?.startingTime || !market?.closingTime) {
    return { allowed: true, closeOnly: false, message: null };
  }
  const result = isBettingAllowed(market);
  return {
    allowed: result.allowed,
    closeOnly: result.closeOnly === true,
    message: result.message || null,
  };
}

function MarketClosedModal({ market, allowed }) {
  const navigation = useNavigation();
  const [visible, setVisible] = useState(false);
  const prevAllowedRef = useRef(null);
  const hasShownRef = useRef(false);
  const marketIdRef = useRef(null);

  useEffect(() => {
    const mid = market?._id || market?.id || null;
    if (mid !== marketIdRef.current) {
      marketIdRef.current = mid;
      hasShownRef.current = false;
      prevAllowedRef.current = null;
      setVisible(false);
    }
  }, [market?._id, market?.id]);

  useEffect(() => {
    if (prevAllowedRef.current === true && allowed === false && !hasShownRef.current) {
      hasShownRef.current = true;
      setVisible(true);
    }
    prevAllowedRef.current = allowed;
  }, [allowed]);

  const goHome = () => {
    setVisible(false);
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      })
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={goHome}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Pressable style={styles.cornerClose} onPress={goHome} hitSlop={12}>
            <Text style={styles.cornerCloseText}>×</Text>
          </Pressable>
          <Text style={styles.bigCross} accessibilityRole="image">
            ✕
          </Text>
          <Text style={styles.title}>Market is closed</Text>
          <Text style={styles.subtitle}>
            Betting for this market has ended. Tap OK to go to the home page.
          </Text>
          <TouchableOpacity style={styles.okBtn} onPress={goHome} activeOpacity={0.85}>
            <Text style={styles.okText}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export function BettingWindowProvider({ market, children }) {
  const [windowState, setWindowState] = useState(() => computeWindowState(market));

  useEffect(() => {
    const tick = () => setWindowState(computeWindowState(market));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [market?._id, market?.id, market?.startingTime, market?.closingTime, market?.betClosureTime]);

  const value = useMemo(
    () => ({
      allowed: windowState.allowed,
      closeOnly: windowState.closeOnly,
      message: windowState.message,
    }),
    [windowState.allowed, windowState.closeOnly, windowState.message]
  );

  return (
    <BettingWindowContext.Provider value={value}>
      <MarketClosedModal market={market} allowed={windowState.allowed} />
      {children}
    </BettingWindowContext.Provider>
  );
}

export function useBettingWindow() {
  return useContext(BettingWindowContext);
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingTop: 40,
    paddingBottom: 24,
    paddingHorizontal: 24,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  cornerClose: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  cornerCloseText: {
    fontSize: 28,
    color: '#9ca3af',
    lineHeight: 32,
  },
  bigCross: {
    fontSize: 72,
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '300',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  okBtn: {
    backgroundColor: '#1B3150',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  okText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
