import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { useHeartbeat } from './hooks/useHeartbeat';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AddUser from './pages/AddUser';
import MyUsers from './pages/MyUsers';
import PlayerDetail from './pages/PlayerDetail';
import Settings from './pages/Settings';
import Commission from './pages/Commission';

const ScrollToTop = () => {
    const { pathname } = useLocation();
    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }, [pathname]);
    return null;
};

const SuperBookieHeartbeat = () => {
    useHeartbeat();
    return null;
};

const PrivateRoute = ({ children }) => {
    const { superBookie, bookie, loading } = useAuth();
    const session = superBookie || bookie;

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-emerald-500 animate-pulse">Loading...</div>
            </div>
        );
    }

    return session?.token ? (
        <>
            <SuperBookieHeartbeat />
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
        <Route path="/add-user" element={<PrivateRoute><AddUser /></PrivateRoute>} />
        <Route path="/commission" element={<PrivateRoute><Commission /></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
);

const App = () => (
    <Router>
        <ScrollToTop />
        <LanguageProvider>
            <AuthProvider>
                <AppRoutes />
            </AuthProvider>
        </LanguageProvider>
    </Router>
);

export default App;
