import React, { useEffect } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { BettingWindowProvider } from '../components/GameBid/BettingWindowContext';
import SingleDigitBid from '../components/GameBid/bids/SingleDigitBid';
import SingleDigitBulkBid from '../components/GameBid/bids/SingleDigitBulkBid';
import JodiBid from '../components/GameBid/bids/JodiBid';
import JodiBulkBid from '../components/GameBid/bids/JodiBulkBid';
import SinglePanaBid from '../components/GameBid/bids/SinglePanaBid';
import SinglePanaBulkBid from '../components/GameBid/bids/SinglePanaBulkBid';
import DoublePanaBid from '../components/GameBid/bids/DoublePanaBid';
import DoublePanaBulkBid from '../components/GameBid/bids/DoublePanaBulkBid';
import TriplePanaBid from '../components/GameBid/bids/TriplePanaBid';
import FullSangamBid from '../components/GameBid/bids/FullSangamBid';
import HalfSangamBid from '../components/GameBid/bids/HalfSangamBid';
import SpMotorBid from '../components/GameBid/bids/SpMotorBid';
import DpMotorBid from '../components/GameBid/bids/DpMotorBid';
import SpDpMotorBid from '../components/GameBid/bids/SpDpMotorBid';
import OddEvenBid from '../components/GameBid/bids/OddEvenBid';
import SpCommonBid from '../components/GameBid/bids/SpCommonBid';
import DpCommonBid from '../components/GameBid/bids/DpCommonBid';

const BID_COMPONENTS = {
  'single digit': SingleDigitBid,
  'single digit bulk': SingleDigitBulkBid,
  'odd even': OddEvenBid,
  'sp common': SpCommonBid,
  'dp common': DpCommonBid,
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

export default function GameBidScreen() {
  const navigate = useNavigation();
  const route = useRoute();
  const { market, betType } = route.params || {};

  useEffect(() => {
    if (!market && !route.params?.title) {
      navigate.replace('Home');
    }
  }, [market, route.params?.title, navigate]);

  const title = betType || route.params?.title || 'Select Bet Type';
  const key = title.toLowerCase().trim();
  const BidComponent = BID_COMPONENTS[key] || SingleDigitBid;

  return (
    <BettingWindowProvider market={market}>
      <BidComponent market={market} title={title} />
    </BettingWindowProvider>
  );
}
