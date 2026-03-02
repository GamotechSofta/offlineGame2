import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { setOnLogout } from './src/config/api';
import { navigationRef, resetToLogin } from './src/navigation/navigationRef';
import { useHeartbeat } from './src/hooks/useHeartbeat';
import MainNavigator from './src/navigation/MainNavigator';

function AppContent() {
  const { user, authReady } = useAuth();

  useEffect(() => {
    setOnLogout(resetToLogin);
  }, []);

  useHeartbeat();

  if (!authReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#1B3150" />
      </View>
    );
  }

  const initialRoute = user?.token ? 'Main' : 'Login';
  return <MainNavigator initialRouteName={initialRoute} />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer ref={navigationRef} navigationInChildEnabled>
          <AppContent />
        </NavigationContainer>
      </AuthProvider>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
