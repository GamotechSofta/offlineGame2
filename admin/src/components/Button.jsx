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
        primary: "bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white glow-orange hover:-translate-y-0.5",
        secondary: "bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 hover:border-gray-300",
        success: "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white glow-green hover:-translate-y-0.5",
        danger: "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white glow-red hover:-translate-y-0.5",
        ghost: "bg-transparent hover:bg-gray-100 text-gray-600 hover:text-gray-800 border border-gray-200 hover:border-gray-300",
        outline: "bg-transparent hover:bg-orange-50 text-orange-500 border border-orange-300 hover:border-orange-500",
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
