import React from 'react';

/** Remaining column: positive green, negative red, zero blue. */
export function remainingAmountClassName(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n === 0) return 'text-blue-600';
    return n > 0 ? 'text-green-600' : 'text-red-500';
}

const SlotHistoryTable = ({ slots, selectedSlot, onSelectSlot, loading }) => {
    return (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between gap-2 mb-2">
                <div>
                    <h3 className="text-lg font-semibold text-gray-800">Old Slots</h3>
                    <p className="text-sm text-gray-500">Completed time slots for the selected date will appear here.</p>
                </div>
                {loading ? <span className="text-xs text-gray-500">Loading...</span> : null}
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-200">
                            <th className="py-2 pr-3">Draw Time</th>
                            <th className="py-2 pr-3 text-right">Tickets</th>
                            <th className="py-2 pr-3 text-right">Bets</th>
                            <th className="py-2 pr-3 text-right">Users</th>
                            <th className="py-2 pr-3 text-right">Winners</th>
                            <th className="py-2 pr-3 text-right">Revenue</th>
                            <th className="py-2 pr-3 text-right">Winner Payout</th>
                            <th className="py-2 pr-3 text-right">Remaining</th>
                        </tr>
                    </thead>
                    <tbody>
                        {!slots.length && !loading ? (
                            <tr>
                                <td colSpan={8} className="py-6 text-center text-gray-500">No completed slots found.</td>
                            </tr>
                        ) : null}
                        {slots.map((slot) => {
                            const active = selectedSlot === slot.slotStartIso;
                            return (
                                <tr
                                    key={slot.slotStartIso}
                                    onClick={() => onSelectSlot(slot.slotStartIso)}
                                    className={`border-b border-gray-100 cursor-pointer ${active ? 'bg-orange-50' : 'hover:bg-gray-50'}`}
                                >
                                    <td className="py-2 pr-3 font-medium text-gray-800">{slot.drawLabelEnd}</td>
                                    <td className="py-2 pr-3 text-right font-mono">{slot.totalTickets ?? 0}</td>
                                    <td className="py-2 pr-3 text-right font-mono">{slot.totalBets ?? 0}</td>
                                    <td className="py-2 pr-3 text-right font-mono">{slot.totalUsers}</td>
                                    <td className="py-2 pr-3 text-right font-mono">{slot.winnerTickets}</td>
                                    <td className="py-2 pr-3 text-right font-mono text-green-600">
                                        ₹{Number((slot.revenue ?? slot.totalBetAmount) || 0).toLocaleString('en-IN')}
                                    </td>
                                    <td className="py-2 pr-3 text-right font-mono text-red-500">
                                        ₹{Number(slot.winnerPayout || 0).toLocaleString('en-IN')}
                                    </td>
                                    <td className={`py-2 pr-3 text-right font-mono ${remainingAmountClassName(slot.amountRemaining)}`}>
                                        ₹{Number(slot.amountRemaining || 0).toLocaleString('en-IN')}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default SlotHistoryTable;
