import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { API_BASE_URL, getBookieAuthHeaders } from '../utils/api';
import { useLanguage } from '../context/LanguageContext';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1').replace('/api/v1', '') || 'http://localhost:3010';

const HelpDesk = () => {
    const { t } = useLanguage();
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [fullScreenImage, setFullScreenImage] = useState(null);
    const [filters, setFilters] = useState({ status: '' });

    useEffect(() => {
        fetchTickets();
    }, [filters]);

    const fetchTickets = async () => {
        try {
            setLoading(true);
            const q = new URLSearchParams();
            if (filters.status) q.append('status', filters.status);
            const response = await fetch(`${API_BASE_URL}/help-desk/tickets?${q}`, { headers: getBookieAuthHeaders() });
            const data = await response.json();
            if (data.success) setTickets(data.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusUpdate = async (ticketId, newStatus) => {
        try {
            const response = await fetch(`${API_BASE_URL}/help-desk/tickets/${ticketId}/status`, {
                method: 'PATCH',
                headers: getBookieAuthHeaders(),
                body: JSON.stringify({ status: newStatus }),
            });
            const data = await response.json();
            if (data.success) {
                fetchTickets();
                if (selectedTicket?._id === ticketId) setSelectedTicket({ ...selectedTicket, status: newStatus });
            }
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <Layout title={t('helpDesk')}>
            <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">Help Desk</h1>
            <div className="bg-white rounded-lg p-4 mb-4 sm:mb-6 flex flex-wrap gap-3 items-center">
                <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-800">
                    <option value="">All Status</option>
                    <option value="open">Open</option>
                    <option value="in-progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                </select>
                <button
                    type="button"
                    onClick={() => setFilters({ status: '' })}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-500 border border-gray-500 rounded-lg text-gray-800 text-sm font-medium"
                >
                    Clear filter
                </button>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
                <div className="bg-white rounded-lg overflow-hidden">
                    <div className="p-4 border-b border-gray-200"><h2 className="text-xl font-semibold">Tickets</h2></div>
                    {loading ? <div className="p-12 text-center text-gray-400">Loading...</div> : tickets.length === 0 ? <div className="p-12 text-center text-gray-400">No tickets found</div> : (
                        <div className="divide-y divide-gray-700">
                            {tickets.map((ticket) => (
                                <div key={ticket._id} onClick={() => setSelectedTicket(ticket)} className={`p-4 cursor-pointer hover:bg-gray-100 ${selectedTicket?._id === ticket._id ? 'bg-gray-100' : ''}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-semibold">{ticket.subject}</h3>
                                        <span className={`px-2 py-1 rounded text-xs ${ticket.status === 'resolved' ? 'bg-green-600' : ticket.status === 'in-progress' ? 'bg-orange-600' : ticket.status === 'closed' ? 'bg-gray-200' : 'bg-blue-600'}`}>{ticket.status}</span>
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
                <div className="bg-white rounded-lg p-6">
                    {selectedTicket ? (
                        <div>
                            <div className="flex justify-between items-start mb-4">
                                <h2 className="text-2xl font-bold">{selectedTicket.subject}</h2>
                                <span className={`px-3 py-1 rounded text-sm ${selectedTicket.status === 'resolved' ? 'bg-green-600' : selectedTicket.status === 'in-progress' ? 'bg-orange-600' : selectedTicket.status === 'closed' ? 'bg-gray-200' : 'bg-blue-600'}`}>{selectedTicket.status}</span>
                            </div>
                            <div className="mb-4"><p className="text-gray-400 text-sm mb-1">Player</p><p className="font-semibold">{selectedTicket.userId?.username || selectedTicket.userId}{selectedTicket.userId?.source === 'bookie' ? ` — bookie user${selectedTicket.userId?.referredBy?.username ? ` (${selectedTicket.userId.referredBy.username})` : ''}` : ' — admin user'}</p></div>
                            <div className="mb-4"><p className="text-gray-400 text-sm mb-1">Description</p><p className="whitespace-pre-wrap">{selectedTicket.description}</p></div>
                            {selectedTicket.screenshots?.length > 0 && (
                                <div className="mb-4">
                                    <p className="text-gray-400 text-sm mb-2">Screenshots (click to open full)</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {selectedTicket.screenshots.map((s, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                onClick={() => setFullScreenImage(s.startsWith('http') ? s : `${BASE_URL}${s}`)}
                                                className="w-full h-32 rounded border border-gray-200 overflow-hidden focus:ring-2 focus:ring-orange-500 focus:outline-none"
                                            >
                                                <img src={s.startsWith('http') ? s : `${BASE_URL}${s}`} alt={`Screenshot ${i + 1}`} className="w-full h-full object-cover cursor-pointer" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="mb-4"><p className="text-gray-400 text-sm mb-1">Created</p><p>{new Date(selectedTicket.createdAt).toLocaleString()}</p></div>
                            <div className="flex gap-2 mt-6">
                                {selectedTicket.status === 'open' && (
                                    <>
                                        <button onClick={() => handleStatusUpdate(selectedTicket._id, 'in-progress')} className="px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded">Mark In Progress</button>
                                        <button onClick={() => handleStatusUpdate(selectedTicket._id, 'resolved')} className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded">Mark Resolved</button>
                                    </>
                                )}
                                {selectedTicket.status === 'in-progress' && <button onClick={() => handleStatusUpdate(selectedTicket._id, 'resolved')} className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded">Mark Resolved</button>}
                                <button onClick={() => handleStatusUpdate(selectedTicket._id, 'closed')} className="px-4 py-2 bg-gray-200 hover:bg-gray-100 rounded">Close Ticket</button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-12 text-gray-400">Select a ticket to view details</div>
                    )}
                </div>
            </div>

            {/* Full-screen screenshot lightbox */}
            {fullScreenImage && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
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
        </Layout>
    );
};

export default HelpDesk;
