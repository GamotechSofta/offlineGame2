import React, { useEffect } from 'react';
import { FaCheckCircle, FaExclamationCircle, FaExclamationTriangle, FaInfoCircle, FaTimes } from 'react-icons/fa';

const Toast = ({ type = 'info', message, onClose, duration = 5000 }) => {
    const config = {
        success: {
            bg: 'bg-green-50',
            border: 'border-green-200',
            text: 'text-green-700',
            icon: FaCheckCircle,
        },
        error: {
            bg: 'bg-red-50',
            border: 'border-red-200',
            text: 'text-red-700',
            icon: FaExclamationCircle,
        },
        warning: {
            bg: 'bg-amber-50',
            border: 'border-amber-200',
            text: 'text-amber-700',
            icon: FaExclamationTriangle,
        },
        info: {
            bg: 'bg-blue-50',
            border: 'border-blue-200',
            text: 'text-blue-700',
            icon: FaInfoCircle,
        },
    };

    const { bg, border, text, icon: Icon } = config[type];

    useEffect(() => {
        if (duration && onClose) {
            const timer = setTimeout(onClose, duration);
            return () => clearTimeout(timer);
        }
    }, [duration, onClose]);

    return (
        <div className={`flex items-center gap-3 p-4 rounded-xl border ${bg} ${border} ${text} shadow-lg animate-slideInRight`}>
            <Icon className="w-5 h-5 flex-shrink-0" />
            <p className="flex-1 text-sm font-medium">{message}</p>
            {onClose && (
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
                >
                    <FaTimes className="w-4 h-4" />
                </button>
            )}
        </div>
    );
};

// Toast Container
export const ToastContainer = ({ toasts, removeToast }) => {
    return (
        <div className="fixed top-4 right-4 z-50 space-y-3 max-w-md">
            {toasts.map((toast) => (
                <Toast
                    key={toast.id}
                    type={toast.type}
                    message={toast.message}
                    onClose={() => removeToast(toast.id)}
                />
            ))}
        </div>
    );
};

export default Toast;
