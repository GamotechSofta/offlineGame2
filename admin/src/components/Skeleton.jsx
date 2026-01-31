import React from 'react';

export const SkeletonCard = () => (
    <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50 animate-pulse">
        <div className="flex items-center justify-between mb-4">
            <div className="h-4 bg-gray-700 rounded w-24"></div>
            <div className="w-12 h-12 bg-gray-700 rounded-xl"></div>
        </div>
        <div className="h-8 bg-gray-700 rounded w-32 mb-4"></div>
        <div className="space-y-2">
            <div className="h-3 bg-gray-700 rounded w-full"></div>
            <div className="h-3 bg-gray-700 rounded w-3/4"></div>
        </div>
    </div>
);

export const SkeletonTable = ({ rows = 5 }) => (
    <div className="space-y-3">
        {[...Array(rows)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-800/50 rounded-lg animate-pulse"></div>
        ))}
    </div>
);

export const SkeletonText = ({ lines = 3, className = '' }) => (
    <div className={`space-y-2 ${className}`}>
        {[...Array(lines)].map((_, i) => (
            <div
                key={i}
                className="h-4 bg-gray-700 rounded animate-pulse"
                style={{ width: i === lines - 1 ? '60%' : '100%' }}
            ></div>
        ))}
    </div>
);

export const Spinner = ({ size = 'md', className = '' }) => {
    const sizes = {
        sm: 'w-4 h-4 border-2',
        md: 'w-8 h-8 border-3',
        lg: 'w-12 h-12 border-4',
    };

    return (
        <div className={`${sizes[size]} border-gray-700 border-t-yellow-500 rounded-full animate-spin ${className}`}></div>
    );
};

export const LoadingOverlay = ({ message = 'Loading...' }) => (
    <div className="flex flex-col items-center justify-center py-20">
        <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-gray-700"></div>
            <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-transparent border-t-yellow-500 animate-spin"></div>
        </div>
        <p className="mt-6 text-gray-400 font-medium">{message}</p>
        <p className="mt-2 text-sm text-gray-600">This won't take long</p>
    </div>
);
