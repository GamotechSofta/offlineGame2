import React from 'react';
import { FaChevronDown } from 'react-icons/fa';
import SlotHistoryTable from '../twoDManagement/SlotHistoryTable';
import QuizSlotStatsTable from '../twoDManagement/QuizSlotStatsTable';

const OldSlotsSection = ({
    activeSection,
    setActiveSection,
    date,
    setDate,
    setNotice,
    setError,
    isTimeDropdownOpen,
    setIsTimeDropdownOpen,
    timeDropdownRef,
    historySlots,
    selectedSlot,
    setSelectedSlot,
    selectedSlotMeta,
    handleSelectSlot,
    loadingHistory,
    detailSectionRef,
    loadingAllHistoryDetails,
    historyDetailsMap,
    getThreeDQuizLabel,
    loadingAllHistoryPlayers,
    slotPlayerListRows,
    handleOpenPlayerHistory,
}) => {
    return (
        <>
            <div className="bg-white border border-gray-200 rounded-xl p-2">
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveSection('oldSlots')}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                            activeSection === 'oldSlots'
                                ? 'bg-orange-500 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        Old Slots
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveSection('quizStats')}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                            activeSection === 'quizStats'
                                ? 'bg-orange-500 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        Set-wise Slot Stats
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveSection('playerHistory')}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                            activeSection === 'playerHistory'
                                ? 'bg-orange-500 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        Slot Player Bets
                    </button>
                </div>
            </div>

            {activeSection === 'oldSlots' ? (
                <>
                    <div className="bg-white border border-gray-200 rounded-xl p-5">
                        <div className="flex flex-wrap items-end gap-4">
                            <div className="min-w-[180px]">
                                <label className="mb-1 block text-sm font-medium text-gray-700">History Date</label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => {
                                        setDate(e.target.value);
                                        setNotice('');
                                        setError('');
                                        setIsTimeDropdownOpen(false);
                                    }}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300"
                                />
                            </div>
                            <div ref={timeDropdownRef} className="min-w-[220px] flex-1 relative">
                                <label className="mb-1 block text-sm font-medium text-gray-700">History Time Slot</label>
                                <button
                                    type="button"
                                    onClick={() => historySlots.length && setIsTimeDropdownOpen((prev) => !prev)}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-left flex items-center justify-between gap-3 disabled:bg-gray-50 disabled:text-gray-400"
                                    disabled={!historySlots.length}
                                >
                                    <span>{selectedSlotMeta?.drawLabelEnd || 'No slots available for selected date'}</span>
                                    <FaChevronDown className={`text-xs text-gray-500 transition-transform ${isTimeDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {isTimeDropdownOpen && historySlots.length ? (
                                    <div className="absolute z-20 mt-2 w-full rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
                                        <div className="max-h-64 overflow-y-auto py-1">
                                            {historySlots.map((slot) => {
                                                const active = slot.slotStartIso === selectedSlot;
                                                return (
                                                    <button
                                                        key={slot.slotStartIso}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedSlot(slot.slotStartIso);
                                                            setNotice('');
                                                            setError('');
                                                            setIsTimeDropdownOpen(false);
                                                        }}
                                                        className={`w-full px-3 py-2 text-left text-sm transition ${
                                                            active ? 'bg-orange-50 text-orange-600 font-semibold' : 'text-gray-700 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        {slot.drawLabelEnd}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    <SlotHistoryTable
                        slots={historySlots}
                        selectedSlot={selectedSlot}
                        onSelectSlot={handleSelectSlot}
                        loading={loadingHistory}
                    />
                </>
            ) : activeSection === 'quizStats' ? (
                <div ref={detailSectionRef} className="space-y-5">
                    <div className="bg-white border border-gray-200 rounded-xl p-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800">All Old Slots - Set-wise Stats</h3>
                                <p className="text-sm text-gray-500">Selected date मधले सर्व completed slots खाली दिसतील.</p>
                            </div>
                            {loadingAllHistoryDetails ? <span className="text-xs text-gray-500">Loading all slot stats...</span> : null}
                        </div>
                    </div>
                    {!historySlots.length && !loadingHistory ? (
                        <div className="bg-white border border-gray-200 rounded-xl p-5 text-sm text-gray-500">
                            Selected date साठी old slots नाहीत.
                        </div>
                    ) : historySlots.map((slot) => {
                        const detail = historyDetailsMap[slot.slotStartIso];
                        const hasDetailLoaded = Object.prototype.hasOwnProperty.call(historyDetailsMap, slot.slotStartIso);
                        const rows = Array.isArray(detail?.perQuiz)
                            ? detail.perQuiz.filter((row) => [1, 2, 3].includes(Number(row.quizId)))
                            : [];
                        return (
                            <div key={`set-stats-${slot.slotStartIso}`} className="space-y-2">
                                <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                            <p className="text-sm font-semibold text-gray-800">{slot.drawLabelEnd}</p>
                                            <p className="text-xs text-gray-500">{slot.slotStartIso}</p>
                                        </div>
                                        <p className="text-xs text-gray-500">
                                            Tickets: <span className="font-semibold text-gray-700">{slot.totalTickets}</span> | Revenue: <span className="font-semibold text-green-600">₹{Number((slot.revenue ?? slot.totalBetAmount) || 0).toLocaleString('en-IN')}</span>
                                        </p>
                                    </div>
                                </div>
                                {rows.length ? (
                                    <QuizSlotStatsTable
                                        rows={rows}
                                        canEdit={false}
                                        resultPadLength={3}
                                        quizLabelFormatter={getThreeDQuizLabel}
                                        title={`Set-wise Slot Stats - ${slot.drawLabelEnd}`}
                                    />
                                ) : (
                                    <div className="bg-white border border-gray-200 rounded-xl p-4 text-sm text-gray-500">
                                        {hasDetailLoaded ? 'No set-wise stats found for this slot.' : 'Slot stats loading...'}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="space-y-5">
                    <div className="bg-white border border-gray-200 rounded-xl p-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800">Slot Player Bets - Playing Players</h3>
                                <p className="text-sm text-gray-500">Player ID and basic details only (players who played). Click a row to view full history.</p>
                            </div>
                            {loadingAllHistoryPlayers ? <span className="text-xs text-gray-500">Loading all slot players...</span> : null}
                        </div>
                    </div>
                    {!historySlots.length && !loadingHistory ? (
                        <div className="bg-white border border-gray-200 rounded-xl p-5 text-sm text-gray-500">
                            Selected date साठी old slots नाहीत.
                        </div>
                    ) : (
                        <div className="bg-white border border-gray-200 rounded-xl p-5">
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-gray-500 border-b border-gray-200">
                                            <th className="py-2 pr-3">Player ID</th>
                                            <th className="py-2 pr-3">Player Name</th>
                                            <th className="py-2 pr-3">Phone</th>
                                            <th className="py-2 pr-3 text-right">Played Slots</th>
                                            <th className="py-2 pr-3 text-right">Bets (Selected Date)</th>
                                            <th className="py-2 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {!slotPlayerListRows.length ? (
                                            <tr>
                                                <td colSpan={6} className="py-4 text-center text-gray-500">
                                                    {loadingAllHistoryPlayers ? 'Slot player data loading...' : 'No playing players found for selected date.'}
                                                </td>
                                            </tr>
                                        ) : slotPlayerListRows.map((player) => (
                                            <tr
                                                key={`slot-player-${player.userId}`}
                                                className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                                                onClick={() => handleOpenPlayerHistory(player)}
                                            >
                                                <td className="py-2 pr-3 font-mono text-xs sm:text-sm">{player.userId}</td>
                                                <td className="py-2 pr-3">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleOpenPlayerHistory(player);
                                                        }}
                                                        className="text-blue-600 hover:text-blue-800 font-semibold"
                                                    >
                                                        {player.username || 'unknown'}
                                                    </button>
                                                </td>
                                                <td className="py-2 pr-3">{player.phone || '-'}</td>
                                                <td className="py-2 pr-3 text-right font-mono">{Number(player.slotCount || 0)}</td>
                                                <td className="py-2 pr-3 text-right font-mono">{Number(player.betCount || 0)}</td>
                                                <td className="py-2 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleOpenPlayerHistory(player);
                                                        }}
                                                        className="px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 text-xs font-semibold text-gray-700"
                                                    >
                                                        View Full History
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </>
    );
};

export default OldSlotsSection;

