import React from 'react';
import Layout from '../components/Layout';

const Dashboard = () => {
    return (
        <Layout title="Dashboard">
            <div className="space-y-6">
                <h1 className="text-2xl font-bold text-white">Welcome to Bookie Panel</h1>
                <p className="text-gray-400">
                    This is your dashboard. Functionality will be added in the next steps.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                        <h3 className="text-emerald-400 font-semibold mb-2">Quick Stats</h3>
                        <p className="text-gray-500 text-sm">Stats will appear here</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                        <h3 className="text-emerald-400 font-semibold mb-2">Recent Activity</h3>
                        <p className="text-gray-500 text-sm">Activity will appear here</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                        <h3 className="text-emerald-400 font-semibold mb-2">Overview</h3>
                        <p className="text-gray-500 text-sm">Overview will appear here</p>
                    </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h3 className="text-emerald-400 font-semibold mb-2">Reference</h3>
                    <p className="text-gray-400 text-sm">
                        This panel mirrors the admin structure. Admin (Games\admin) and Bookie share similar functionality.
                        Super Admin has full access; Bookie has limited access. Tell me which features to add next!
                    </p>
                </div>
            </div>
        </Layout>
    );
};

export default Dashboard;
