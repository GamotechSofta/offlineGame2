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
import HalfSangamBid from './bids/HalfSangamBid';
import SpMotorBid from './bids/SpMotorBid';
import DpMotorBid from './bids/DpMotorBid';
import SpDpMotorBid from './bids/SpDpMotorBid';

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
    'half sangam': HalfSangamBid,
    'sp motor': SpMotorBid,
    'dp motor': DpMotorBid,
    'sp dp motor': SpDpMotorBid,
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
