import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL, fetchWithAuth } from '../utils/api';

const WALLET_SUMMARY_EVENT = 'bookie-wallet-summary-changed';

export function dispatchWalletSummaryRefresh() {
    window.dispatchEvent(new Event(WALLET_SUMMARY_EVENT));
}

export function useWalletGrandTotal() {
    const [walletBalance, setWalletBalance] = useState(0);
    const [grandTotal, setGrandTotal] = useState(0);

    const refresh = useCallback(async () => {
        try {
            const res = await fetchWithAuth(
                `${API_BASE_URL}/bookie/wallet-transactions?limit=1&page=1&category=all`
            );
            if (res.status === 401) return;
            const json = await res.json();
            if (json.success) {
                const cash = Number(
                    json.walletBalance ?? json.cashBalance ?? json.currentBalance ?? 0,
                );
                const total = Number(
                    json.grandTotalSummary ?? json.summaries?.grandTotal?.received ?? cash,
                );
                setWalletBalance(cash);
                setGrandTotal(total);
                window.dispatchEvent(
                    new CustomEvent('bookie-panel-wallet-balance', { detail: { balance: total } }),
                );
            }
        } catch {
            setWalletBalance(0);
            setGrandTotal(0);
        }
    }, []);

    useEffect(() => {
        refresh();
        const onRefresh = () => refresh();
        window.addEventListener(WALLET_SUMMARY_EVENT, onRefresh);
        window.addEventListener('focus', onRefresh);
        return () => {
            window.removeEventListener(WALLET_SUMMARY_EVENT, onRefresh);
            window.removeEventListener('focus', onRefresh);
        };
    }, [refresh]);

    return { walletBalance, grandTotal, displayBalance: grandTotal, refresh };
}
