import SingleDigitBid from './bids/SingleDigitBid';
import OddEvenBid from './bids/OddEvenBid';
import JodiBulkBid from './bids/JodiBulkBid';
import SinglePanaBulkBid from './bids/SinglePanaBulkBid';
import DoublePanaBulkBid from './bids/DoublePanaBulkBid';
import TriplePanaBid from './bids/TriplePanaBid';
import FullSangamBid from './bids/FullSangamBid';
import HalfSangamBid from './bids/HalfSangamBid';
import SpMotorBid from './bids/SpMotorBid';
import DpMotorBid from './bids/DpMotorBid';
import SpDpMotorBid from './bids/SpDpMotorBid';

export const GAME_TYPE_ORDER = [
    'single-digit',
    'odd-even',
    'jodi',
    'single-pana-bulk',
    'double-pana-bulk',
    'triple-pana',
    'full-sangam',
    'half-sangam',
    'sp-motor',
    'dp-motor',
    'sp-dp-motor',
];

export const CLOSE_SESSION_HIDDEN_GAME_TYPES = ['jodi', 'full-sangam', 'half-sangam'];

export const getBettableGameTypeOrder = (isPastOpenTime) => {
    if (!isPastOpenTime) return GAME_TYPE_ORDER;
    return GAME_TYPE_ORDER.filter((id) => !CLOSE_SESSION_HIDDEN_GAME_TYPES.includes(id));
};

export const BID_COMPONENTS = {
    'single-digit': { component: SingleDigitBid, title: 'Single Digit', betType: 'single' },
    'odd-even': { component: OddEvenBid, title: 'Odd Even', betType: 'odd-even' },
    'jodi': { component: JodiBulkBid, title: 'Jodi Bulk', betType: 'jodi' },
    'single-pana-bulk': { component: SinglePanaBulkBid, title: 'Single Pana Bulk', betType: 'panna' },
    'double-pana-bulk': { component: DoublePanaBulkBid, title: 'Double Pana Bulk', betType: 'panna' },
    'triple-pana': { component: TriplePanaBid, title: 'Triple Pana', betType: 'panna' },
    'full-sangam': { component: FullSangamBid, title: 'Full Sangam', betType: 'full-sangam' },
    'half-sangam': { component: HalfSangamBid, title: 'Half Sangam', betType: 'half-sangam' },
    'sp-motor': { component: SpMotorBid, title: 'SP Motor', betType: 'sp-motor' },
    'dp-motor': { component: DpMotorBid, title: 'DP Motor', betType: 'dp-motor' },
    'sp-dp-motor': { component: SpDpMotorBid, title: 'SP DP Motor', betType: 'sp-motor' },
};
