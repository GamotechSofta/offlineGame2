import React from 'react';
import { DATE_RANGE_PRESETS } from '../lib/dateRangePresets';

/**
 * Dashboard-style date range: All, Today, …, Custom with optional from/to pickers.
 */
const DateRangeFilter = ({
    datePreset,
    customMode,
    customOpen,
    customFrom,
    customTo,
    displayLabel,
    onPresetSelect,
    onCustomToggle,
    onCustomFromChange,
    onCustomToChange,
    onCustomApply,
    rangeUpdating = false,
    headerRight = null,
}) => (
    <div className="bg-white rounded-xl p-4 border border-gray-200">
        <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Date Range</p>
            {headerRight}
        </div>
        <div className="grid grid-cols-4 gap-x-1.5 gap-y-1.5 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
            {DATE_RANGE_PRESETS.map((p) => {
                const isActive = !customMode && datePreset === p.id;
                return (
                    <button
                        key={p.id}
                        type="button"
                        onClick={() => onPresetSelect(p.id)}
                        className={`min-w-0 px-1 py-1.5 text-[10px] sm:px-4 sm:py-2 sm:text-sm font-semibold leading-snug text-center rounded-md transition-all sm:rounded-lg ${
                            isActive
                                ? 'bg-orange-500 text-white'
                                : 'bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        {p.label}
                    </button>
                );
            })}
            <button
                type="button"
                onClick={onCustomToggle}
                className={`min-w-0 px-1 py-1.5 text-[10px] sm:px-4 sm:py-2 sm:text-sm font-semibold leading-snug text-center rounded-md transition-all sm:rounded-lg ${
                    customMode
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200'
                }`}
            >
                Custom
            </button>
            {customOpen && (
                <div className="col-span-4 w-full flex flex-wrap items-end gap-2 sm:gap-3 mt-1 p-2 sm:mt-3 sm:p-3 rounded-lg bg-gray-50 border border-gray-200 sm:basis-full">
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">From</label>
                        <input
                            type="date"
                            value={customFrom}
                            onChange={(e) => onCustomFromChange(e.target.value)}
                            className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-800"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">To</label>
                        <input
                            type="date"
                            value={customTo}
                            onChange={(e) => onCustomToChange(e.target.value)}
                            className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-800"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={onCustomApply}
                        className="px-4 py-2 rounded-lg bg-orange-500 text-white font-semibold text-sm"
                    >
                        Apply
                    </button>
                </div>
            )}
        </div>
        <p className="text-xs text-gray-500 mt-2">
            Showing data for: <span className="text-orange-500 font-medium">{displayLabel}</span>
        </p>
        {rangeUpdating && (
            <p className="text-xs text-blue-600 mt-2 font-medium">Updating selected range data...</p>
        )}
    </div>
);

export default DateRangeFilter;
