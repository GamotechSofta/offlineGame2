import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const HelpDesk = () => {
    const navigate = useNavigate();
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [filters, setFilters] = useState({
        status: '',
    });

    useEffect(() => {
        fetchTickets();
    }, [filters]);

    const fetchTickets = async () => {
        try {
            setLoading(true);
            const admin = JSON.parse(localStorage.getItem('admin'));
            const password = sessionStorage.getItem('adminPassword') || '';
            const queryParams = new URLSearchParams();
            if (filters.status) queryParams.append('status', filters.status);

            const response = await fetch(`${API_BASE_URL}/help-desk/tickets?${queryParams}`, {
                headers: {
                    'Authorization': `Basic ${btoa(`${admin.username}:${password}`)}`,
                },
            });
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
            const admin = JSON.parse(localStorage.getItem('admin'));
            const password = sessionStorage.getItem('adminPassword') || '';
            const response = await fetch(`${API_BASE_URL}/help-desk/tickets/${ticketId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${btoa(`${admin.username}:${password}`)}`,
                },
                body: JSON.stringify({ status: newStatus }),
            });
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
        localStorage.removeItem('admin');
        sessionStorage.removeItem('adminPassword');
        navigate('/');
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white flex">
            <Sidebar onLogout={handleLogout} />
            <div className="flex-1">
                <div className="p-8">
                    <h1 className="text-3xl font-bold mb-6">Help Desk</h1>

                    {/* Filters */}
                    <div className="bg-gray-800 rounded-lg p-4 mb-6">
                        <select
                            value={filters.status}
                            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                            className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                        >
                            <option value="">All Status</option>
                            <option value="open">Open</option>
                            <option value="in-progress">In Progress</option>
                            <option value="resolved">Resolved</option>
                            <option value="closed">Closed</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Tickets List */}
                        <div className="bg-gray-800 rounded-lg overflow-hidden">
                            <div className="p-4 border-b border-gray-700">
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
                                            className={`p-4 cursor-pointer hover:bg-gray-700 ${
                                                selectedTicket?._id === ticket._id ? 'bg-gray-700' : ''
                                            }`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="font-semibold">{ticket.subject}</h3>
                                                <span className={`px-2 py-1 rounded text-xs ${
                                                    ticket.status === 'resolved' ? 'bg-green-600' :
                                                    ticket.status === 'in-progress' ? 'bg-yellow-600' :
                                                    ticket.status === 'closed' ? 'bg-gray-600' :
                                                    'bg-blue-600'
                                                }`}>
                                                    {ticket.status}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-400 truncate">{ticket.description}</p>
                                            <p className="text-xs text-gray-500 mt-2">
                                                {ticket.userId?.username || 'Unknown'} • {new Date(ticket.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Ticket Details */}
                        <div className="bg-gray-800 rounded-lg p-6">
                            {selectedTicket ? (
                                <div>
                                    <div className="flex justify-between items-start mb-4">
                                        <h2 className="text-2xl font-bold">{selectedTicket.subject}</h2>
                                        <span className={`px-3 py-1 rounded text-sm ${
                                            selectedTicket.status === 'resolved' ? 'bg-green-600' :
                                            selectedTicket.status === 'in-progress' ? 'bg-yellow-600' :
                                            selectedTicket.status === 'closed' ? 'bg-gray-600' :
                                            'bg-blue-600'
                                        }`}>
                                            {selectedTicket.status}
                                        </span>
                                    </div>

                                    <div className="mb-4">
                                        <p className="text-gray-400 text-sm mb-1">User</p>
                                        <p className="font-semibold">{selectedTicket.userId?.username || selectedTicket.userId}</p>
                                    </div>

                                    <div className="mb-4">
                                        <p className="text-gray-400 text-sm mb-1">Description</p>
                                        <p className="whitespace-pre-wrap">{selectedTicket.description}</p>
                                    </div>

                                    {selectedTicket.screenshots && selectedTicket.screenshots.length > 0 && (
                                        <div className="mb-4">
                                            <p className="text-gray-400 text-sm mb-2">Screenshots</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                {selectedTicket.screenshots.map((screenshot, index) => (
                                                    <img
                                                        key={index}
                                                        src={`http://localhost:3010${screenshot}`}
                                                        alt={`Screenshot ${index + 1}`}
                                                        className="w-full h-32 object-cover rounded border border-gray-700"
                                                    />
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
                                                    className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded"
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
                                            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded"
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
                </div>
            </div>
        </div>
    );
};

export default HelpDesk;
