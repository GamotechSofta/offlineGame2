import React from 'react';
import Layout from '../components/Layout';
import { useLanguage } from '../context/LanguageContext';
import { useBetLayout } from '../context/BetLayoutContext';
import { LAYOUT_CART, LAYOUT_SINGLE } from '../utils/bookieLayout';
import { FaShoppingCart, FaList, FaCheck } from 'react-icons/fa';

const cardBase =
    'flex items-start gap-4 p-4 sm:p-5 rounded-2xl border-2 cursor-pointer select-none outline-none ' +
    'transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out ' +
    'hover:border-[#1B3150]/30 hover:bg-[#1B3150]/5 active:scale-[0.995] ' +
    'focus-visible:ring-2 focus-visible:ring-[#1B3150]/40 focus-visible:ring-offset-2';

const cardSelected = 'border-[#1B3150] bg-[#1B3150]/5 shadow-sm shadow-[#1B3150]/10';
const cardUnselected = 'border-gray-200 bg-white';

const LayoutOption = ({ id, value, layout, setLayout, icon: Icon, title, description }) => {
    const isSelected = layout === value;
    return (
        <button
            type="button"
            id={id}
            onClick={() => setLayout(value)}
            className={`w-full text-left ${cardBase} ${isSelected ? cardSelected : cardUnselected}`}
            aria-pressed={isSelected}
            aria-label={`Select ${title}`}
        >
            <div
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 pointer-events-none ${
                    isSelected ? 'border-[#1B3150] bg-[#1B3150]' : 'border-gray-300 bg-white'
                }`}
                aria-hidden
            >
                {isSelected && <FaCheck className="h-2.5 w-2.5 text-white" />}
            </div>
            <div className="min-w-0 flex-1 pointer-events-none">
                <div className="flex items-center gap-2 font-semibold text-gray-800">
                    <Icon className={`h-5 w-5 shrink-0 ${isSelected ? 'text-[#1B3150]' : 'text-gray-400'}`} />
                    {title}
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{description}</p>
            </div>
        </button>
    );
};

const Settings = () => {
    const { t } = useLanguage();
    const { layout, setLayout } = useBetLayout();

    return (
        <Layout title={t('settings')}>
            <div className="max-w-2xl animate-[settingsFadeIn_0.25s_ease-out]">
                <section className="rounded-2xl bg-white/80 p-4 sm:p-6 shadow-sm border border-gray-100">
                    <h2 className="text-base font-bold text-gray-800 sm:text-lg">Bet screen layout</h2>
                    <p className="mt-1 text-sm text-gray-500 sm:mt-1.5">
                        Choose how the betting screen looks when you place bets for a market.
                    </p>
                    <div className="relative z-10 mt-5 space-y-3 sm:mt-6 sm:space-y-4">
                        <LayoutOption
                            id="bet-layout-cart"
                            value={LAYOUT_CART}
                            layout={layout}
                            setLayout={setLayout}
                            icon={FaShoppingCart}
                            title="Cart layout"
                            description="Game types in a sidebar, one game at a time. Bet cart on the right. Add to cart, then place bet from the cart."
                        />
                        <LayoutOption
                            id="bet-layout-single"
                            value={LAYOUT_SINGLE}
                            layout={layout}
                            setLayout={setLayout}
                            icon={FaList}
                            title="Single screen"
                            description="All game types on one scrollable page. One sticky Submit bet button at the bottom to place the bet."
                        />
                    </div>
                    <p className="mt-5 text-xs text-gray-400 sm:mt-6">
                        Change takes effect as soon as you open a market or return to the games screen.
                    </p>
                </section>
            </div>
            <style>{`
                @keyframes settingsFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
        </Layout>
    );
};

export default Settings;
