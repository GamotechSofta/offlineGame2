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
import BannerSettings from './pages/BannerSettings';
import TopWinners from './pages/TopWinners';
import TwoDManagement from './pages/TwoDManagement';
import TwoDQuizStakeDetail from './pages/TwoDQuizStakeDetail';
import TwoDCurrentSlotPlayers from './pages/TwoDCurrentSlotPlayers';
import TwoDPlayersRouteLayout from './pages/TwoDPlayersRouteLayout';
import TwoDPlayerHistoryRouteRedirect from './pages/TwoDPlayerHistoryRouteRedirect';
import TwoDOldSlotsStats from './pages/TwoDOldSlotsStats';
import ThreeDManagement from './pages/ThreeDManagement';
import ThreeDQuizStakeDetail from './pages/ThreeDQuizStakeDetail';
import TwoDResultControl from './pages/TwoDResultControl';
import ThreeDResultControl from './pages/ThreeDResultControl';
import ThreeDCurrentSlotPlayers from './pages/ThreeDCurrentSlotPlayers';
import ThreeDOldSlotsStats from './pages/ThreeDOldSlotsStats';
import BookieCommissions from './pages/BookieCommissions';
import ThreeDSlotWiseBets from './pages/ThreeDSlotWiseBets';
import TwoDTickets from './pages/TwoDTickets';
import ThreeDTickets from './pages/ThreeDTickets';
import LotteryNewsSettings from './pages/LotteryNewsSettings';

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
                    path="/bookie-commissions"
                    element={
                        <PrivateRoute>
                            <BookieCommissions />
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
                    path="/2d-management/quiz/:quizId/stake"
                    element={
                        <PrivateRoute>
                            <TwoDQuizStakeDetail />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/2d-management"
                    element={
                        <PrivateRoute>
                            <TwoDManagement />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/2d-management/old-slots"
                    element={
                        <PrivateRoute>
                            <TwoDOldSlotsStats />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/3d-management/set/:quizId/stake"
                    element={
                        <PrivateRoute>
                            <ThreeDQuizStakeDetail />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/3d-management"
                    element={
                        <PrivateRoute>
                            <ThreeDManagement />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/2d-management/result-control"
                    element={
                        <PrivateRoute>
                            <TwoDResultControl />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/2d-management/current-slot-players"
                    element={
                        <PrivateRoute>
                            <TwoDPlayersRouteLayout />
                        </PrivateRoute>
                    }
                >
                    <Route index element={<TwoDCurrentSlotPlayers />} />
                    <Route path="history/:userId" element={<TwoDPlayerHistoryRouteRedirect />} />
                </Route>
                <Route
                    path="/2d-management/tickets"
                    element={
                        <PrivateRoute>
                            <TwoDTickets />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/3d-management/result-control"
                    element={
                        <PrivateRoute>
                            <ThreeDResultControl />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/3d-management/tickets"
                    element={
                        <PrivateRoute>
                            <ThreeDTickets />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/3d-management/slot-wise-bets"
                    element={
                        <PrivateRoute>
                            <ThreeDSlotWiseBets />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/3d-management/current-slot-players"
                    element={
                        <PrivateRoute>
                            <ThreeDCurrentSlotPlayers />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/3d-management/old-slots"
                    element={
                        <PrivateRoute>
                            <ThreeDOldSlotsStats />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/banner"
                    element={
                        <PrivateRoute>
                            <BannerSettings />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/lottery-news"
                    element={
                        <PrivateRoute>
                            <LotteryNewsSettings />
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
                {/* If a frontend lottery URL is opened in admin app, redirect to admin 3D screen. */}
                <Route path="/lottery/*" element={<Navigate to="/3d-management" replace />} />
                {/* Catch-all fallback to avoid "No routes matched" warnings in admin app. */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
        </Router>
    );
};

export default App;