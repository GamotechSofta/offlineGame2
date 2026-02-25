import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';
import { getAuthHeaders, clearAdminSession, fetchWithAuth } from '../lib/auth';
const UPLOAD_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1').replace(/\/api\/v1\/?$/, '') || 'http://localhost:3010';

const HelpDesk = () => {
    const navigate = useNavigate();
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [bookies, setBookies] = useState([]);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [fullScreenImage, setFullScreenImage] = useState(null);
    const [filters, setFilters] = useState({
        status: '',
        userSource: '',
        bookieId: '',
    });

    useEffect(() => {
        fetchTickets();
    }, [filters]);

    useEffect(() => {
        const fetchBookies = async () => {
            try {
                const res = await fetchWithAuth(`${API_BASE_URL}/admin/bookies`);
                if (res.status === 401) return;
                const data = await res.json();
                if (data.success && data.data) setBookies(data.data);
            } catch (_) {}
        };
        fetchBookies();
    }, []);

    const fetchTickets = async () => {
        try {
            setLoading(true);
            const queryParams = new URLSearchParams();
            if (filters.status) queryParams.append('status', filters.status);
            if (filters.userSource) queryParams.append('userSource', filters.userSource);
            if (filters.bookieId) queryParams.append('bookieId', filters.bookieId);

            const response = await fetchWithAuth(`${API_BASE_URL}/help-desk/tickets?${queryParams}`);
            if (response.status === 401) return;
            const data = await response.json();
            if (data.success) {
                setTickets(data.data);
            }
        } catch (err) {
            console.error('Error fetching tickets:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusUpdate = async (ticketId, newStatus) => {
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/help-desk/tickets/${ticketId}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status: newStatus }),
            });
            if (response.status === 401) return;
            const data = await response.json();
            if (data.success) {
                fetchTickets();
                if (selectedTicket?._id === ticketId) {
                    setSelectedTicket({ ...selectedTicket, status: newStatus });
                }
            }
        } catch (err) {
            console.error('Error updating ticket:', err);
        }
    };

    const handleLogout = () => {
        clearAdminSession();
        navigate('/');
    };

    return (
        <AdminLayout onLogout={handleLogout} title="Help Desk">
                    <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">Help Desk</h1>

                    {/* Filters */}
                    <div className="bg-white rounded-lg p-4 mb-4 sm:mb-6 flex flex-wrap gap-3 items-center">
                        <select
                            value={filters.status}
                            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                            className="px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-800"
                        >
                            <option value="">All Status</option>
                            <option value="open">Open</option>
                            <option value="in-progress">In Progress</option>
                            <option value="resolved">Resolved</option>
                            <option value="closed">Closed</option>
                        </select>
                        <select
                            value={filters.userSource}
                            onChange={(e) => setFilters({ ...filters, userSource: e.target.value })}
                            className="px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-800"
                        >
                            <option value="">All Users</option>
                            <option value="bookie">Bookie user only</option>
                            <option value="super_admin">Admin user only</option>
                        </select>
                        {bookies.length > 0 && (
                            <select
                                value={filters.bookieId}
                                onChange={(e) => setFilters({ ...filters, bookieId: e.target.value })}
                                className="px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-800"
                            >
                                <option value="">All bookies</option>
                                {bookies.map((b) => (
                                    <option key={b._id} value={b._id}>{b.username}</option>
                                ))}
                            </select>
                        )}
                        <button
                            type="button"
                            onClick={() => setFilters({ status: '', userSource: '', bookieId: '' })}
                            className="px-4 py-2 bg-gray-200 hover:bg-gray-500 border border-gray-500 rounded-lg text-gray-800 text-sm font-medium"
                        >
                            Clear filter
                        </button>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
                        {/* Tickets List */}
                        <div className="bg-white rounded-lg overflow-hidden">
                            <div className="p-4 border-b border-gray-200">
                                <h2 className="text-xl font-semibold">Tickets</h2>
                            </div>
                            {loading ? (
                                <div className="text-center py-12">
                                    <p className="text-gray-400">Loading tickets...</p>
                                </div>
                            ) : tickets.length === 0 ? (
                                <div className="text-center py-12">
                                    <p className="text-gray-400">No tickets found</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-700">
                                    {tickets.map((ticket) => (
                                        <div
                                            key={ticket._id}
                                            onClick={() => setSelectedTicket(ticket)}
                                            className={`p-4 cursor-pointer hover:bg-gray-100 ${
                                                selectedTicket?._id === ticket._id ? 'bg-gray-100' : ''
                                            }`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="font-semibold">{ticket.subject}</h3>
                                                <span className={`px-2 py-1 rounded text-xs ${
                                                    ticket.status === 'resolved' ? 'bg-green-600' :
                                                    ticket.status === 'in-progress' ? 'bg-orange-600' :
                                                    ticket.status === 'closed' ? 'bg-gray-200' :
                                                    'bg-blue-600'
                                                }`}>
                                                    {ticket.status}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-400 truncate">{ticket.description}</p>
                                            <p className="text-xs text-gray-500 mt-2">
                                                {ticket.userId?.username || 'Unknown'}
                                                {ticket.userId?.source === 'bookie'
                                                    ? ` — bookie user${ticket.userId?.referredBy?.username ? ` (${ticket.userId.referredBy.username})` : ''}`
                                                    : ' — admin user'}
                                                {' • '}{new Date(ticket.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Ticket Details */}
                        <div className="bg-white rounded-lg p-6">
                            {selectedTicket ? (
                                <div>
                                    <div className="flex justify-between items-start mb-4">
                                        <h2 className="text-2xl font-bold">{selectedTicket.subject}</h2>
                                        <span className={`px-3 py-1 rounded text-sm ${
                                            selectedTicket.status === 'resolved' ? 'bg-green-600' :
                                            selectedTicket.status === 'in-progress' ? 'bg-orange-600' :
                                            selectedTicket.status === 'closed' ? 'bg-gray-200' :
                                            'bg-blue-600'
                                        }`}>
                                            {selectedTicket.status}
                                        </span>
                                    </div>

                                    <div className="mb-4">
                                        <p className="text-gray-400 text-sm mb-1">Player</p>
                                        <p className="font-semibold">
                                            {selectedTicket.userId?.username || selectedTicket.userId}
                                            {selectedTicket.userId?.source === 'bookie'
                                                ? ` — bookie user${selectedTicket.userId?.referredBy?.username ? ` (${selectedTicket.userId.referredBy.username})` : ''}`
                                                : ' — admin user'}
                                        </p>
                                    </div>

                                    <div className="mb-4">
                                        <p className="text-gray-400 text-sm mb-1">Description</p>
                                        <p className="whitespace-pre-wrap">{selectedTicket.description}</p>
                                    </div>

                                    {selectedTicket.screenshots && selectedTicket.screenshots.length > 0 && (
                                        <div className="mb-4">
                                            <p className="text-gray-400 text-sm mb-2">Screenshots (click to open full)</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                {selectedTicket.screenshots.map((screenshot, index) => (
                                                    <button
                                                        key={index}
                                                        type="button"
                                                        onClick={() => setFullScreenImage(screenshot.startsWith('http') ? screenshot : `${UPLOAD_BASE_URL}${screenshot}`)}
                                                        className="w-full h-32 rounded border border-gray-200 overflow-hidden focus:ring-2 focus:ring-orange-500 focus:outline-none"
                                                    >
                                                        <img
                                                            src={screenshot.startsWith('http') ? screenshot : `${UPLOAD_BASE_URL}${screenshot}`}
                                                            alt={`Screenshot ${index + 1}`}
                                                            className="w-full h-full object-cover cursor-pointer"
                                                        />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="mb-4">
                                        <p className="text-gray-400 text-sm mb-1">Created</p>
                                        <p>{new Date(selectedTicket.createdAt).toLocaleString()}</p>
                                    </div>

                                    <div className="flex gap-2 mt-6">
                                        {selectedTicket.status === 'open' && (
                                            <>
                                                <button
                                                    onClick={() => handleStatusUpdate(selectedTicket._id, 'in-progress')}
                                                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded"
                                                >
                                                    Mark In Progress
                                                </button>
                                                <button
                                                    onClick={() => handleStatusUpdate(selectedTicket._id, 'resolved')}
                                                    className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded"
                                                >
                                                    Mark Resolved
                                                </button>
                                            </>
                                        )}
                                        {selectedTicket.status === 'in-progress' && (
                                            <button
                                                onClick={() => handleStatusUpdate(selectedTicket._id, 'resolved')}
                                                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded"
                                            >
                                                Mark Resolved
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleStatusUpdate(selectedTicket._id, 'closed')}
                                            className="px-4 py-2 bg-gray-200 hover:bg-gray-100 rounded"
                                        >
                                            Close Ticket
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <p className="text-gray-400">Select a ticket to view details</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Full-screen screenshot lightbox */}
                    {fullScreenImage && (
                        <div
                            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
                            onClick={() => setFullScreenImage(null)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => e.key === 'Escape' && setFullScreenImage(null)}
                            aria-label="Close"
                        >
                            <button
                                type="button"
                                onClick={() => setFullScreenImage(null)}
                                className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-800 text-2xl leading-none flex items-center justify-center"
                                aria-label="Close"
                            >
                                ×
                            </button>
                            <img
                                src={fullScreenImage}
                                alt="Screenshot full size"
                                className="max-w-full max-h-[90vh] w-auto h-auto object-contain rounded"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    )}
        </AdminLayout>
    );
};

export default HelpDesk;
