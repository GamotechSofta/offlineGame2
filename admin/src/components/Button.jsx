import React from 'react';

const Button = ({
    children,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    icon: Icon,
    onClick,
    type = 'button',
    className = '',
    ...props
}) => {
    const baseStyles = "font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2";

    const variants = {
        primary: "bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black glow-yellow hover:-translate-y-0.5",
        secondary: "bg-gray-700 hover:bg-gray-600 text-white border border-gray-600 hover:border-gray-500",
        success: "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white glow-green hover:-translate-y-0.5",
        danger: "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white glow-red hover:-translate-y-0.5",
        ghost: "bg-transparent hover:bg-gray-700/50 text-gray-300 hover:text-white border border-gray-600/50 hover:border-gray-500",
        outline: "bg-transparent hover:bg-yellow-500/10 text-yellow-400 border border-yellow-500/50 hover:border-yellow-500",
    };

    const sizes = {
        sm: "px-3 py-1.5 text-sm",
        md: "px-6 py-3 text-base",
        lg: "px-8 py-4 text-lg",
    };

    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled || loading}
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
            {...props}
        >
            {loading && (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            )}
            {!loading && Icon && <Icon className="w-4 h-4" />}
            {children}
        </button>
    );
};

export default Button;
