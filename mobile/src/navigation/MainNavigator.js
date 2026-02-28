import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AppHeader from '../components/AppHeader';
import BottomNavbar from '../components/BottomNavbar';
import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';
import BidOptionsScreen from '../screens/BidOptionsScreen';
import GameBidScreen from '../screens/GameBidScreen';
import BankScreen from '../screens/BankScreen';
import FundsScreen from '../screens/FundsScreen';
import BidsScreen from '../screens/BidsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import PassbookScreen from '../screens/PassbookScreen';
import DownloadScreen from '../screens/DownloadScreen';
import SupportScreen from '../screens/SupportScreen';
import SupportNewScreen from '../screens/SupportNewScreen';
import SupportStatusScreen from '../screens/SupportStatusScreen';
import BetHistoryScreen from '../screens/BetHistoryScreen';
import MarketResultHistoryScreen from '../screens/MarketResultHistoryScreen';
import TopWinnersScreen from '../screens/TopWinnersScreen';
import StartlineDashboardScreen from '../screens/StartlineDashboardScreen';
import AddFundScreen from '../screens/AddFundScreen';
import AddFundPaymentScreen from '../screens/AddFundPaymentScreen';
import WithdrawFundScreen from '../screens/WithdrawFundScreen';
import BankDetailScreen from '../screens/BankDetailScreen';
import AddFundHistoryScreen from '../screens/AddFundHistoryScreen';
import WithdrawFundHistoryScreen from '../screens/WithdrawFundHistoryScreen';

const Stack = createNativeStackNavigator();

function MainLayout() {
  return (
    <View style={styles.container}>
      <AppHeader />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#fff' },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="BidOptions" component={BidOptionsScreen} />
        <Stack.Screen name="GameBid" component={GameBidScreen} />
        <Stack.Screen name="Bank" component={BankScreen} />
        <Stack.Screen name="Funds" component={FundsScreen} />
        <Stack.Screen name="Bids" component={BidsScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="Passbook" component={PassbookScreen} />
        <Stack.Screen name="Download" component={DownloadScreen} />
        <Stack.Screen name="Support" component={SupportScreen} />
        <Stack.Screen name="SupportNew" component={SupportNewScreen} />
        <Stack.Screen name="SupportStatus" component={SupportStatusScreen} />
        <Stack.Screen name="BetHistory" component={BetHistoryScreen} />
        <Stack.Screen name="MarketResultHistory" component={MarketResultHistoryScreen} />
        <Stack.Screen name="AddFund" component={AddFundScreen} />
        <Stack.Screen name="AddFundPayment" component={AddFundPaymentScreen} />
        <Stack.Screen name="WithdrawFund" component={WithdrawFundScreen} />
        <Stack.Screen name="BankDetail" component={BankDetailScreen} />
        <Stack.Screen name="AddFundHistory" component={AddFundHistoryScreen} />
        <Stack.Screen name="WithdrawFundHistory" component={WithdrawFundHistoryScreen} />
        <Stack.Screen name="TopWinners" component={TopWinnersScreen} />
        <Stack.Screen name="StartlineDashboard" component={StartlineDashboardScreen} />
      </Stack.Navigator>
      <BottomNavbar />
    </View>
  );
}

export default function MainNavigator({ initialRouteName = 'Login' }) {
  return (
    <Stack.Navigator initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Main" component={MainLayout} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
});
