import React from 'react';
import { FaChevronDown } from 'react-icons/fa';
import SlotHistoryTable from './SlotHistoryTable';
import QuizSlotStatsTable from './QuizSlotStatsTable';

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
    loadingDetail,
    detailData,
    currentSlotData,
}) => (
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
                    Quiz-wise Slot Stats
                </button>
            </div>
        </div>

        {activeSection === 'oldSlots' ? (
            <>
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800">Current Slot</h3>
                            <p className="text-sm text-gray-500">Only running slot is shown here.</p>
                        </div>
                    </div>
                    {!currentSlotData?.slot ? (
                        <div className="text-sm text-gray-500">No running slot found.</div>
                    ) : (
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
                                    <tr className="border-b border-gray-100">
                                        <td className="py-2 pr-3 font-medium text-gray-800">{currentSlotData?.slot?.drawLabelEnd || '-'}</td>
                                        <td className="py-2 pr-3 text-right font-mono">{currentSlotData?.summary?.totalTickets ?? 0}</td>
                                        <td className="py-2 pr-3 text-right font-mono">{currentSlotData?.summary?.totalBets ?? 0}</td>
                                        <td className="py-2 pr-3 text-right font-mono">{currentSlotData?.summary?.totalUsers ?? 0}</td>
                                        <td className="py-2 pr-3 text-right font-mono">{currentSlotData?.summary?.winnerTickets ?? 0}</td>
                                        <td className="py-2 pr-3 text-right font-mono text-green-600">₹{Number((currentSlotData?.summary?.revenue ?? currentSlotData?.summary?.totalBetAmount) || 0).toLocaleString('en-IN')}</td>
                                        <td className="py-2 pr-3 text-right font-mono text-red-500">₹{Number(currentSlotData?.summary?.winnerPayout || 0).toLocaleString('en-IN')}</td>
                                        <td className="py-2 pr-3 text-right font-mono text-blue-600">₹{Number(currentSlotData?.summary?.amountRemaining || 0).toLocaleString('en-IN')}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

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
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="min-w-[180px]">
                            <label className="mb-1 block text-sm font-medium text-gray-700">Filter Date</label>
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
                            <label className="mb-1 block text-sm font-medium text-gray-700">Filter Time Slot</label>
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
                        {selectedSlotMeta ? (
                            <div className="text-sm text-gray-500">
                                Showing stats for <span className="font-semibold text-gray-700">{selectedSlotMeta.drawLabelEnd}</span>
                            </div>
                        ) : null}
                    </div>
                </div>

                {loadingDetail ? (
                    <div className="bg-white border border-gray-200 rounded-xl p-5 text-sm text-gray-500">Loading slot detail...</div>
                ) : detailData?.perQuiz ? (
                    <QuizSlotStatsTable rows={detailData.perQuiz} canEdit={false} />
                ) : (
                    <div className="bg-white border border-gray-200 rounded-xl p-5 text-sm text-gray-500">
                        Please select a slot from Old Slots to view quiz-wise stats.
                    </div>
                )}
            </div>
        ) : null}
    </>
);

export default OldSlotsSection;

