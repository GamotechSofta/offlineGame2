import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Header from '../components/Header';
import BottomNavbar from '../components/BottomNavbar';
import Home from '../pages/Home';
import Bank from '../pages/Bank';
import Download from '../pages/Download';
import Login from '../pages/Login';

const Layout = ({ children }) => {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';
  const isHomePage = location.pathname === '/';

  if (isLoginPage) {
    return <>{children}</>;
  }

  // Home page: Mobile shows WalletSection, Desktop shows Navbar/Header
  if (isHomePage) {
    return (
      <div className="min-h-screen pb-16 md:pb-0">
        {/* Desktop Navbar and Header */}
        <div className="hidden md:block">
          <Navbar />
          <Header />
        </div>
        {children}
        <BottomNavbar />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16 md:pb-0">
      <Navbar />
      <Header />
      {children}
      <BottomNavbar />
    </div>
  );
};

const AppRoutes = () => {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/bank" element={<Bank />} />
          <Route path="/download" element={<Download />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default AppRoutes;
