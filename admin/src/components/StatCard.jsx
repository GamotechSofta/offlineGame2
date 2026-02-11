import React from 'react';

const StatCard = ({
    title,
    value,
    icon: Icon,
    color = 'green',
    subtitle,
    details = [],
    delay = 0
}) => {
    const colors = {
        green: {
            bg: 'from-green-50 to-transparent',
            border: 'border-green-200',
            iconBg: 'bg-green-50',
            iconBorder: 'border-green-200',
            iconText: 'text-green-600',
            shadow: 'shadow-green-100',
            textColor: 'text-green-600',
        },
        blue: {
            bg: 'from-blue-50 to-transparent',
            border: 'border-blue-200',
            iconBg: 'bg-blue-50',
            iconBorder: 'border-blue-200',
            iconText: 'text-blue-600',
            shadow: 'shadow-blue-100',
            textColor: 'text-blue-600',
        },
        purple: {
            bg: 'from-purple-50 to-transparent',
            border: 'border-purple-200',
            iconBg: 'bg-purple-50',
            iconBorder: 'border-purple-200',
            iconText: 'text-purple-600',
            shadow: 'shadow-purple-100',
            textColor: 'text-purple-600',
        },
        yellow: {
            bg: 'from-orange-50 to-transparent',
            border: 'border-orange-200',
            iconBg: 'bg-orange-50',
            iconBorder: 'border-orange-200',
            iconText: 'text-orange-600',
            shadow: 'shadow-orange-100',
            textColor: 'text-orange-600',
        },
    };

    const c = colors[color];

    return (
        <div
            className={`group relative bg-white rounded-xl p-6 border border-gray-200 hover:${c.border} transition-all duration-300 hover:shadow-xl hover:${c.shadow} hover:-translate-y-1 overflow-hidden animate-slideUp`}
            style={{ animationDelay: `${delay}s` }}
        >
            {/* Animated background gradient */}
            <div className={`absolute inset-0 bg-gradient-to-br ${c.bg} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>

            {/* Content */}
            <div className="relative z-10">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                        <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
                        <p className="text-3xl font-bold text-gray-800 font-mono">{value}</p>
                    </div>

                    {/* Icon */}
                    {Icon && (
                        <div className={`w-12 h-12 rounded-xl ${c.iconBg} flex items-center justify-center group-hover:scale-110 transition-transform duration-300 border ${c.iconBorder}`}>
                            <Icon className={`w-6 h-6 ${c.iconText}`} />
                        </div>
                    )}
                </div>

                {/* Details */}
                {details.length > 0 && (
                    <div className="pt-3 border-t border-gray-100">
                        <div className="flex gap-4 text-xs">
                            {details.map((detail, index) => (
                                <div key={index}>
                                    <span className="text-gray-400">{detail.label}: </span>
                                    <span className={`font-semibold ${c.textColor}`}>{detail.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Subtitle */}
                {subtitle && (
                    <div className="pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-400">{subtitle}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StatCard;
