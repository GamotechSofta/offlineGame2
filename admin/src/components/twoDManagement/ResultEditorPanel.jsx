import React from 'react';

const ResultEditorPanel = ({
    editState,
    setEditState,
    onSave,
    saving,
    selectedSlot,
}) => {
    if (!selectedSlot) return null;

    return (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Edit Old Slot Result</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Quiz ID</label>
                    <input
                        type="number"
                        min={1}
                        max={30}
                        value={editState.quizId}
                        onChange={(e) => setEditState((prev) => ({ ...prev, quizId: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300"
                    />
                </div>
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Result (00-99)</label>
                    <input
                        type="number"
                        min={0}
                        max={99}
                        value={editState.result}
                        onChange={(e) => setEditState((prev) => ({ ...prev, result: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300"
                    />
                </div>
                <div className="flex items-end">
                    <button
                        type="button"
                        onClick={onSave}
                        disabled={saving}
                        className="w-full px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold disabled:opacity-60"
                    >
                        {saving ? 'Saving...' : 'Save Result'}
                    </button>
                </div>
            </div>
            <p className="mt-2 text-xs text-gray-500 break-all">Slot: {selectedSlot}</p>
        </div>
    );
};

export default ResultEditorPanel;
