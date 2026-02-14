import React from 'react';
import Layout from '../components/Layout';
import { FaKeyboard, FaArrowRight, FaArrowLeft, FaHome, FaUsers, FaUserPlus, FaHistory, FaChartBar, FaGamepad } from 'react-icons/fa';

const Shortcuts = () => {
    const shortcuts = [
        {
            category: 'Game Navigation',
            items: [
                { keys: ['Ctrl', '→'], description: 'Next game type (in betting page)', icon: FaArrowRight },
                { keys: ['Ctrl', '←'], description: 'Previous game type (in betting page)', icon: FaArrowLeft },
            ],
        },
        {
            category: 'Quick Access',
            items: [
                { keys: ['Alt', 'D'], description: 'Go to Dashboard', icon: FaHome },
                { keys: ['Alt', 'P'], description: 'Go to My Players', icon: FaUsers },
                { keys: ['Alt', 'A'], description: 'Add New Player', icon: FaUserPlus },
                { keys: ['Alt', 'B'], description: 'Go to Bet History', icon: FaHistory },
                { keys: ['Alt', 'M'], description: 'Go to Markets', icon: FaChartBar },
                { keys: ['Alt', 'G'], description: 'Go to Games', icon: FaGamepad },
                { keys: ['Alt', 'R'], description: 'Go to Reports', icon: null },
                { keys: ['Alt', 'W'], description: 'Go to Wallet', icon: null },
                { keys: ['Alt', 'H'], description: 'Go to Help Desk', icon: null },
                { keys: ['Alt', '?'], description: 'View Keyboard Shortcuts', icon: null },
            ],
        },
        {
            category: 'General',
            items: [
                { keys: ['Esc'], description: 'Close modal or sidebar', icon: null },
                { keys: ['Enter'], description: 'Submit form or confirm action', icon: null },
            ],
        },
    ];

    const formatKey = (key) => {
        const keyMap = {
            'Ctrl': 'Ctrl',
            'Alt': 'Alt',
            'Shift': 'Shift',
            '→': '→',
            '←': '←',
            '↑': '↑',
            '↓': '↓',
            'Enter': 'Enter',
            'Esc': 'Esc',
        };
        return keyMap[key] || key;
    };

    return (
        <Layout title="Keyboard Shortcuts">
            <div className="max-w-4xl mx-auto p-4 sm:p-6">
                <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 text-white">
                        <div className="flex items-center gap-3">
                            <FaKeyboard className="w-8 h-8" />
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-bold">Keyboard Shortcuts</h1>
                                <p className="text-orange-100 text-sm mt-1">Speed up your workflow with these shortcuts</p>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-8">
                        {shortcuts.map((category, catIdx) => (
                            <div key={catIdx} className="border-b border-gray-200 last:border-b-0 pb-6 last:pb-0">
                                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <span className="w-1 h-6 bg-orange-500 rounded-full" />
                                    {category.category}
                                </h2>
                                <div className="space-y-3">
                                    {category.items.map((item, itemIdx) => (
                                        <div
                                            key={itemIdx}
                                            className="flex items-start gap-4 p-4 rounded-lg bg-gray-50 hover:bg-orange-50 transition-colors border border-gray-100"
                                        >
                                            {item.icon && (
                                                <div className="mt-1 text-orange-500">
                                                    <item.icon className="w-5 h-5" />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-gray-700 text-sm sm:text-base mb-2">{item.description}</p>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {item.keys.map((key, keyIdx) => (
                                                        <React.Fragment key={keyIdx}>
                                                            <kbd className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-mono font-semibold text-gray-700 shadow-sm">
                                                                {formatKey(key)}
                                                            </kbd>
                                                            {keyIdx < item.keys.length - 1 && (
                                                                <span className="text-gray-400 text-sm">+</span>
                                                            )}
                                                        </React.Fragment>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer Note */}
                    <div className="bg-gray-50 border-t border-gray-200 p-4">
                        <p className="text-xs text-gray-500 text-center">
                            💡 Tip: These shortcuts work when you're on the relevant pages. Some shortcuts may vary based on your current context.
                        </p>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default Shortcuts;
