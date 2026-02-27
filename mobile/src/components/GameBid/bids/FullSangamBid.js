import React from 'react';
import { View, Text } from 'react-native';
import BidLayout from '../BidLayout';
export default function FullSangamBid({ market, title }) {
  return (
    <BidLayout market={market} title={title} bidsCount={0} totalPoints={0} hideFooter>
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 14, color: '#6b7280' }}>Full Sangam – convert from web.</Text>
      </View>
    </BidLayout>
  );
}
