import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AddUser from './pages/AddUser';
import AddMarket from './pages/AddMarket';
import BetHistory from './pages/BetHistory';
import TopWinners from './pages/TopWinners';
import Reports from './pages/Reports';
import PaymentManagement from './pages/PaymentManagement';
import Wallet from './pages/Wallet';
import HelpDesk from './pages/HelpDesk';

const PrivateRoute = ({ children }) => {
    const admin = localStorage.getItem('admin');
    return admin ? children : <Navigate to="/" />;
};

const App = () => {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Login />} />
                <Route
                    path="/dashboard"
                    element={
                        <PrivateRoute>
                            <Dashboard />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/add-user"
                    element={
                        <PrivateRoute>
                            <AddUser />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/add-market"
                    element={
                        <PrivateRoute>
                            <AddMarket />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/bet-history"
                    element={
                        <PrivateRoute>
                            <BetHistory />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/top-winners"
                    element={
                        <PrivateRoute>
                            <TopWinners />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/reports"
                    element={
                        <PrivateRoute>
                            <Reports />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/payment-management"
                    element={
                        <PrivateRoute>
                            <PaymentManagement />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/wallet"
                    element={
                        <PrivateRoute>
                            <Wallet />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/help-desk"
                    element={
                        <PrivateRoute>
                            <HelpDesk />
                        </PrivateRoute>
                    }
                />
            </Routes>
        </Router>
    );
};

export default App;