import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useHeartbeat } from './hooks/useHeartbeat';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Markets from './pages/Markets';
import AddUser from './pages/AddUser';
import MyUsers from './pages/MyUsers';
import ReferralLink from './pages/ReferralLink';
import BetHistory from './pages/BetHistory';
import TopWinners from './pages/TopWinners';
import Reports from './pages/Reports';
import Payments from './pages/Payments';
import Wallet from './pages/Wallet';
import HelpDesk from './pages/HelpDesk';

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
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
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
        <Route path="/markets" element={<PrivateRoute><Markets /></PrivateRoute>} />
        <Route path="/add-user" element={<PrivateRoute><AddUser /></PrivateRoute>} />
        <Route path="/referral-link" element={<PrivateRoute><ReferralLink /></PrivateRoute>} />
        <Route path="/bet-history" element={<PrivateRoute><BetHistory /></PrivateRoute>} />
        <Route path="/top-winners" element={<PrivateRoute><TopWinners /></PrivateRoute>} />
        <Route path="/reports" element={<PrivateRoute><Reports /></PrivateRoute>} />
        <Route path="/payments" element={<PrivateRoute><Payments /></PrivateRoute>} />
        <Route path="/wallet" element={<PrivateRoute><Wallet /></PrivateRoute>} />
        <Route path="/help-desk" element={<PrivateRoute><HelpDesk /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
);

const App = () => {
    return (
        <Router>
            <ScrollToTop />
            <AuthProvider>
                <AppRoutes />
            </AuthProvider>
        </Router>
    );
};

export default App;
