import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { useHeartbeat } from './hooks/useHeartbeat';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Markets from './pages/Markets';
import AddUser from './pages/AddUser';
import MyUsers from './pages/MyUsers';
import BetHistory from './pages/BetHistory';
import TopWinners from './pages/TopWinners';
import Reports from './pages/Reports';
import Revenue from './pages/Revenue';
import Payments from './pages/Payments';
import Wallet from './pages/Wallet';

import HelpDesk from './pages/HelpDesk';
import PlayerDetail from './pages/PlayerDetail';
import GamesMarkets from './pages/GamesMarkets';
import GameTypes from './pages/GameTypes';
import BookieGameBid from './pages/GameBid/index';
import Shortcuts from './pages/Shortcuts';
import Receipt from './pages/Receipt';
import BetsByUser from './pages/BetsByUser';
import Settings from './pages/Settings';
import { BetLayoutProvider } from './context/BetLayoutContext';

// Scroll to top on route change
const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant'
    });
  }, [pathname]);

  return null;
};

const BookieHeartbeat = () => {
    useHeartbeat();
    return null;
};

const PrivateRoute = ({ children }) => {
    const { bookie, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-emerald-500 animate-pulse">Loading...</div>
            </div>
        );
    }

    return bookie ? (
        <>
            <BookieHeartbeat />
            {children}
        </>
    ) : (
        <Navigate to="/" replace />
    );
};

const AppRoutes = () => (
    <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/my-users" element={<PrivateRoute><MyUsers /></PrivateRoute>} />
        <Route path="/my-users/:userId" element={<PrivateRoute><PlayerDetail /></PrivateRoute>} />
        <Route path="/games" element={<PrivateRoute><GamesMarkets /></PrivateRoute>} />
        <Route path="/games/:marketId" element={<PrivateRoute><GameTypes /></PrivateRoute>} />
        <Route path="/games/:marketId/:gameType" element={<PrivateRoute><BookieGameBid /></PrivateRoute>} />
        <Route path="/markets" element={<PrivateRoute><Markets /></PrivateRoute>} />
        <Route path="/add-user" element={<PrivateRoute><AddUser /></PrivateRoute>} />
        <Route path="/bet-history" element={<PrivateRoute><BetHistory /></PrivateRoute>} />
        <Route path="/bets-by-user" element={<PrivateRoute><BetsByUser /></PrivateRoute>} />
        <Route path="/top-winners" element={<PrivateRoute><TopWinners /></PrivateRoute>} />
        <Route path="/reports" element={<PrivateRoute><Reports /></PrivateRoute>} />
        <Route path="/revenue" element={<PrivateRoute><Revenue /></PrivateRoute>} />
        <Route path="/payments" element={<PrivateRoute><Payments /></PrivateRoute>} />
        <Route path="/wallet" element={<PrivateRoute><Wallet /></PrivateRoute>} />
        <Route path="/receipt" element={<PrivateRoute><Receipt /></PrivateRoute>} />
        <Route path="/receipt/:sessionId" element={<PrivateRoute><Receipt /></PrivateRoute>} />

        <Route path="/help-desk" element={<PrivateRoute><HelpDesk /></PrivateRoute>} />
        <Route path="/shortcuts" element={<PrivateRoute><Shortcuts /></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
);

const App = () => {
    return (
        <Router>
            <ScrollToTop />
            <LanguageProvider>
                <AuthProvider>
                    <BetLayoutProvider>
                        <AppRoutes />
                    </BetLayoutProvider>
                </AuthProvider>
            </LanguageProvider>
        </Router>
    );
};

export default App;
