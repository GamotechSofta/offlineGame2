import React from 'react';
import { View, Text } from 'react-native';
import BidLayout from '../BidLayout';
// TODO: Convert from frontend/src/pages/GameBid/bids/SingleDigitBulkBid.jsx
export default function SingleDigitBulkBid({ market, title }) {
  return (
    <BidLayout market={market} title={title} bidsCount={0} totalPoints={0} hideFooter>
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 14, color: '#6b7280' }}>Single Digit Bulk – convert from web.</Text>
      </View>
    </BidLayout>
  );
}
