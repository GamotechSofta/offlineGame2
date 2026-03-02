import React, { useEffect, useContext } from 'react';
import { useNavigation } from '@react-navigation/native';

/**
 * Ref to the inner (Main) stack's navigation. Set by screens inside the stack.
 * Used by BottomNavbar and AppHeader to navigate to BetHistory, Bank, etc.
 * without going through the root (which could show Login).
 */
export const InnerStackNavContext = React.createContext({ current: null });

/** Call this in any screen that belongs to the inner stack so the ref is set for tab navigation. */
export function useSetInnerNavRef() {
  const navRef = useContext(InnerStackNavContext);
  const navigation = useNavigation();
  useEffect(() => {
    if (navRef) navRef.current = navigation;
    // Do NOT clear ref on unmount - next screen will overwrite it.
    // Clearing caused "screen not opening" when tapping nav during transition.
  }, [navigation, navRef]);
}
