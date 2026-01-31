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
            bg: 'from-green-500/5 to-transparent',
            border: 'border-green-500/50',
            iconBg: 'bg-green-500/10',
            iconBorder: 'border-green-500/20',
            iconText: 'text-green-400',
            shadow: 'shadow-green-500/10',
            textColor: 'text-green-400',
        },
        blue: {
            bg: 'from-blue-500/5 to-transparent',
            border: 'border-blue-500/50',
            iconBg: 'bg-blue-500/10',
            iconBorder: 'border-blue-500/20',
            iconText: 'text-blue-400',
            shadow: 'shadow-blue-500/10',
            textColor: 'text-blue-400',
        },
        purple: {
            bg: 'from-purple-500/5 to-transparent',
            border: 'border-purple-500/50',
            iconBg: 'bg-purple-500/10',
            iconBorder: 'border-purple-500/20',
            iconText: 'text-purple-400',
            shadow: 'shadow-purple-500/10',
            textColor: 'text-purple-400',
        },
        yellow: {
            bg: 'from-yellow-500/5 to-transparent',
            border: 'border-yellow-500/50',
            iconBg: 'bg-yellow-500/10',
            iconBorder: 'border-yellow-500/20',
            iconText: 'text-yellow-400',
            shadow: 'shadow-yellow-500/10',
            textColor: 'text-yellow-400',
        },
    };

    const c = colors[color];

    return (
        <div
            className={`group relative glass rounded-xl p-6 border border-gray-700/50 hover:${c.border} transition-all duration-300 hover:shadow-xl hover:${c.shadow} hover:-translate-y-1 overflow-hidden animate-slideUp`}
            style={{ animationDelay: `${delay}s` }}
        >
            {/* Animated background gradient */}
            <div className={`absolute inset-0 bg-gradient-to-br ${c.bg} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>

            {/* Content */}
            <div className="relative z-10">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                        <p className="text-sm font-medium text-gray-400 mb-1">{title}</p>
                        <p className="text-3xl font-bold text-white font-mono">{value}</p>
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
                    <div className="pt-3 border-t border-gray-700/30">
                        <div className="flex gap-4 text-xs">
                            {details.map((detail, index) => (
                                <div key={index}>
                                    <span className="text-gray-500">{detail.label}: </span>
                                    <span className={`font-semibold ${c.textColor}`}>{detail.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Subtitle */}
                {subtitle && (
                    <div className="pt-3 border-t border-gray-700/30">
                        <p className="text-xs text-gray-500">{subtitle}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StatCard;
