import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BettingWindowProvider } from './BettingWindowContext';
import SingleDigitBid from './bids/SingleDigitBid';
import SingleDigitBulkBid from './bids/SingleDigitBulkBid';
import JodiBid from './bids/JodiBid';
import JodiBulkBid from './bids/JodiBulkBid';
import SinglePanaBid from './bids/SinglePanaBid';
import SinglePanaBulkBid from './bids/SinglePanaBulkBid';
import DoublePanaBid from './bids/DoublePanaBid';
import DoublePanaBulkBid from './bids/DoublePanaBulkBid';
import TriplePanaBid from './bids/TriplePanaBid';
import FullSangamBid from './bids/FullSangamBid';
import HalfSangamABid from './bids/HalfSangamABid';

const BID_COMPONENTS = {
    'single digit': SingleDigitBid,
    'single digit bulk': SingleDigitBulkBid,
    'jodi': JodiBid,
    'jodi bulk': JodiBulkBid,
    'single pana': SinglePanaBid,
    'single pana bulk': SinglePanaBulkBid,
    'double pana': DoublePanaBid,
    'double pana bulk': DoublePanaBulkBid,
    'triple pana': TriplePanaBid,
    'full sangam': FullSangamBid,
    // Half Sangam (O) only — Open Pana + Close Ank. Half Sangam (C) removed.
    'half sangam (a)': HalfSangamABid,
    'half sangam (o)': HalfSangamABid,
};

const GameBid = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { market, betType } = location.state || {};

    useEffect(() => {
        if (!market && !location.state?.title) {
            navigate('/', { replace: true });
        }
    }, [market, location.state?.title, navigate]);

    const title = betType || location.state?.title || 'Select Bet Type';
    const key = title.toLowerCase().trim();
    const BidComponent = BID_COMPONENTS[key] || SingleDigitBid;

    return (
        <BettingWindowProvider market={market}>
            <BidComponent market={market} title={title} />
        </BettingWindowProvider>
    );
};

export default GameBid;
