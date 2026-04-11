import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import Markets from './pages/Markets';
import AddUser from './pages/AddUser';
import AddMarket from './pages/AddMarket';
import BetHistory from './pages/BetHistory';
import Reports from './pages/Reports';
import Revenue from './pages/Revenue';
import BookieDetail from './pages/BookieDetail';
import PaymentManagement from './pages/PaymentManagement';
import Wallet from './pages/Wallet';
import HelpDesk from './pages/HelpDesk';
import Logs from './pages/Logs';
import BookieManagement from './pages/BookieManagement';
import AllUsers from './pages/AllUsers';
import PlayerDetail from './pages/PlayerDetail';
import PlayerDevices from './pages/PlayerDevices';
import AddResult from './pages/AddResult';
import DeclareConfirm from './pages/DeclareConfirm';
import DeclareSuccess from './pages/DeclareSuccess';
import UpdateRate from './pages/UpdateRate';
import MarketDetail from './pages/MarketDetail';
import Settings from './pages/Settings';
import TopWinners from './pages/TopWinners';

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

const PrivateRoute = ({ children }) => {
    const admin = localStorage.getItem('admin');
    return admin ? children : <Navigate to="/" />;
};

const App = () => {
    return (
        <Router>
            <ScrollToTop />
            <Routes>
                <Route path="/" element={<Login />} />
                <Route
                    path="/dashboard"
                    element={
                        <PrivateRoute>
                            <AdminDashboard />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/markets"
                    element={
                        <PrivateRoute>
                            <Markets />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/markets/:marketId"
                    element={
                        <PrivateRoute>
                            <MarketDetail />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/add-result"
                    element={
                        <PrivateRoute>
                            <AddResult />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/declare-confirm"
                    element={
                        <PrivateRoute>
                            <DeclareConfirm />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/declare-success"
                    element={
                        <PrivateRoute>
                            <DeclareSuccess />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/update-rate"
                    element={
                        <PrivateRoute>
                            <UpdateRate />
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
                    path="/reports"
                    element={
                        <PrivateRoute>
                            <Reports />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/revenue"
                    element={
                        <PrivateRoute>
                            <Revenue />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/revenue/:bookieId"
                    element={
                        <PrivateRoute>
                            <BookieDetail />
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
                <Route
                    path="/logs"
                    element={
                        <PrivateRoute>
                            <Logs />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/all-users"
                    element={
                        <PrivateRoute>
                            <AllUsers />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/all-users/:userId"
                    element={
                        <PrivateRoute>
                            <PlayerDetail />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/all-users/:userId/devices"
                    element={
                        <PrivateRoute>
                            <PlayerDevices />
                        </PrivateRoute>
                    }
                />
                <Route path="/suspend-player" element={<Navigate to="/all-users" replace />} />
                <Route path="/suspend-bookie" element={<Navigate to="/bookie-management" replace />} />
                <Route
                    path="/bookie-management"
                    element={
                        <PrivateRoute>
                            <BookieManagement />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/settings"
                    element={
                        <PrivateRoute>
                            <Settings />
                        </PrivateRoute>
                    }
                />
            </Routes>
        </Router>
    );
};

export default App;