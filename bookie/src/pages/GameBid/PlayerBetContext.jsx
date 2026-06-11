import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { API_BASE_URL, getBookieAuthHeaders, fetchWithAuth } from '../../utils/api';
import { placeBetForPlayer } from './bookieApi';

const PlayerBetContext = createContext({});

export const PlayerBetProvider = ({ children }) => {
    const { marketId } = useParams();
    const [searchParams] = useSearchParams();
    const preSelectedPlayerId = searchParams.get('playerId') || '';

    const [market, setMarket] = useState(null);
    const [players, setPlayers] = useState([]);
    const [loadingMarket, setLoadingMarket] = useState(true);
    const [loadingPlayers, setLoadingPlayers] = useState(true);
    const [selectedPlayerId, setSelectedPlayerId] = useState(preSelectedPlayerId);

    useEffect(() => {
        if (preSelectedPlayerId) setSelectedPlayerId(preSelectedPlayerId);
    }, [preSelectedPlayerId]);

    // Fetch market data
    useEffect(() => {
        const fetchMarket = async () => {
            try {
                const res = await fetchWithAuth(`${API_BASE_URL}/markets/get-markets`);
                if (res.status === 401) return;
                const data = await res.json();
                if (data.success && Array.isArray(data.data)) {
                    const found = data.data.find((m) => m._id === marketId);
                    if (found) {
                        const hasOpening = found.openingNumber && /^\d{3}$/.test(String(found.openingNumber));
                        const hasClosing = found.closingNumber && /^\d{3}$/.test(String(found.closingNumber));
                        found.status = hasOpening && hasClosing ? 'closed' : hasOpening ? 'running' : 'open';
                        found.gameName = found.marketName;
                    }
                    setMarket(found || null);
                }
            } catch (err) {
                // silent
            } finally {
                setLoadingMarket(false);
            }
        };
        fetchMarket();
    }, [marketId]);

    // Fetch players
    useEffect(() => {
        const fetchPlayers = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/users`, { headers: getBookieAuthHeaders() });
                const data = await res.json();
                if (data.success) setPlayers(data.data || []);
            } catch (err) {
                // silent
            } finally {
                setLoadingPlayers(false);
            }
        };
        fetchPlayers();
    }, []);

    const selectedPlayer = useMemo(
        () => players.find((p) => p._id === selectedPlayerId) || null,
        [players, selectedPlayerId]
    );

    const walletBalance = useMemo(
        () => Number(selectedPlayer?.walletBalance ?? 0),
        [selectedPlayer]
    );

    const playerName = selectedPlayer?.username || '';

    // Refresh players after bet placement
    const refreshPlayers = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/users`, { headers: getBookieAuthHeaders() });
            const data = await res.json();
            if (data.success) setPlayers(data.data || []);
        } catch (err) {
            // silent
        }
    }, []);

    const updatePlayerBalance = useCallback((newBalance) => {
        setPlayers(prev => prev.map(p =>
            p._id === selectedPlayerId
                ? { ...p, walletBalance: newBalance }
                : p
        ));
    }, [selectedPlayerId]);

    const placeBet = useCallback(async (mktId, bets, scheduledDate = null) => {
        if (!selectedPlayerId) {
            return { success: false, message: 'No player selected' };
        }
        const result = await placeBetForPlayer(selectedPlayerId, mktId, bets, scheduledDate);
        if (result.success && result.data?.newBalance != null) {
            updatePlayerBalance(Number(result.data.newBalance));
        }
        return result;
    }, [selectedPlayerId, updatePlayerBalance]);

    const value = useMemo(() => ({
        market,
        marketId,
        players,
        selectedPlayerId,
        setSelectedPlayerId,
        selectedPlayer,
        walletBalance,
        playerName,
        loadingMarket,
        loadingPlayers,
        placeBet,
        updatePlayerBalance,
        refreshPlayers,
    }), [market, marketId, players, selectedPlayerId, selectedPlayer, walletBalance, playerName, loadingMarket, loadingPlayers, placeBet, updatePlayerBalance, refreshPlayers]);

    return (
        <PlayerBetContext.Provider value={value}>
            {children}
        </PlayerBetContext.Provider>
    );
};

export const usePlayerBet = () => useContext(PlayerBetContext);

export default PlayerBetContext;
