import React from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { clearAdminSession } from '../lib/auth';

const ThreeDManagement = () => {
    const navigate = useNavigate();

    const handleLogout = () => {
        clearAdminSession();
        navigate('/');
    };

    return (
        <AdminLayout onLogout={handleLogout} title="3D Management">
            <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h1 className="text-2xl font-bold text-gray-800">3D Management</h1>
                <p className="mt-2 text-sm text-gray-500">
                    3D admin features can be managed here. You can add slot control, panel-wise result edit, and 3D analytics in this section.
                </p>
            </div>
        </AdminLayout>
    );
};

export default ThreeDManagement;
