import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getStoredAdmin } from '../lib/auth';
import { isPathAllowedForSpecificAdmin, getDefaultRouteForAdmin } from '../config/adminMenu';

/**
 * Redirects specific_admin users away from disallowed routes.
 */
const SpecificAdminRouteGuard = ({ children }) => {
    const location = useLocation();
    const admin = getStoredAdmin();

    if (admin?.role === 'specific_admin') {
        const tabs = admin.allowedTabs || [];
        if (tabs.length > 0 && !isPathAllowedForSpecificAdmin(location.pathname, tabs)) {
            return <Navigate to={getDefaultRouteForAdmin(admin)} replace />;
        }
    }

    return children;
};

export default SpecificAdminRouteGuard;
