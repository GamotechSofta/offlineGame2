import SingleDigitBid from './bids/SingleDigitBid';
import OddEvenBid from './bids/OddEvenBid';
import SpCommonBid from './bids/SpCommonBid';
import CpCommonBid from './bids/CpCommonBid';
import ChartBid from './bids/ChartBid';
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

export const GAME_TYPE_ORDER = [
    'single-digit',
    'jodi',
    'jodi-bulk',
    'single-pana',
    'single-pana-bulk',
    'double-pana',
    'double-pana-bulk',
    'triple-pana',
    'half-sangam',
    'full-sangam',
    'sp-common',
    'dp-common',
    'cp-common',
    'sp-motor',
    'dp-motor',
    'sp-dp-motor',
    'sp-dp-t-motor',
    'odd-even',
    'chart',
];

export const CLOSE_SESSION_HIDDEN_GAME_TYPES = ['jodi', 'jodi-bulk', 'full-sangam', 'half-sangam'];

export const getBettableGameTypeOrder = (isPastOpenTime) => {
    if (!isPastOpenTime) return GAME_TYPE_ORDER;
    return GAME_TYPE_ORDER.filter((id) => !CLOSE_SESSION_HIDDEN_GAME_TYPES.includes(id));
};

export const BID_COMPONENTS = {
    'single-digit': { component: SingleDigitBid, title: 'Single Digit', betType: 'single' },
    jodi: { component: JodiBid, title: 'Jodi', betType: 'jodi' },
    'jodi-bulk': { component: JodiBulkBid, title: 'Jodi Bulk', betType: 'jodi' },
    'single-pana': { component: SinglePanaBid, title: 'Single Pana', betType: 'panna' },
    'single-pana-bulk': { component: SinglePanaBulkBid, title: 'Single Pana Bulk', betType: 'panna' },
    'double-pana': { component: DoublePanaBid, title: 'Double Pana', betType: 'panna' },
    'double-pana-bulk': { component: DoublePanaBulkBid, title: 'Double Pana Bulk', betType: 'panna' },
    'triple-pana': { component: TriplePanaBid, title: 'Triple Pana', betType: 'panna' },
    'half-sangam': { component: HalfSangamBid, title: 'Half Sangam', betType: 'half-sangam' },
    'full-sangam': { component: FullSangamBid, title: 'Full Sangam', betType: 'full-sangam' },
    'sp-common': { component: SpCommonBid, title: 'SP Common', betType: 'sp-common' },
    // Bookie module does not yet have a separate DP Common screen;
    // temporarily route to CP Common to keep game-type parity with frontend UI.
    'dp-common': { component: CpCommonBid, title: 'DP Common', betType: 'dp-common' },
    'cp-common': { component: CpCommonBid, title: 'CP (Common Pana)', betType: 'cp-common' },
    'sp-motor': { component: SpMotorBid, title: 'SP Motor', betType: 'sp-motor' },
    'dp-motor': { component: DpMotorBid, title: 'DP Motor', betType: 'dp-motor' },
    'sp-dp-motor': { component: SpDpMotorBid, title: 'SP DP Motor', betType: 'sp-motor' },
    'sp-dp-t-motor': { component: SpDpMotorBid, title: 'SP DP T Motor', betType: 'sp-motor' },
    'odd-even': { component: OddEvenBid, title: 'Odd Even', betType: 'odd-even' },
    chart: { component: ChartBid, title: 'Chart Game', betType: 'panna' },
};
