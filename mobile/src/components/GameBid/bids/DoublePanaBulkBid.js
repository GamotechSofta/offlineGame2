import React from 'react';
import EasyModeBid from './EasyModeBid';

const validateDoublePana = (n) => {
  if (!n || !/^[0-9]{3}$/.test(String(n).trim())) return false;
  const s = String(n).trim();
  return new Set(s.split('')).size === 2;
};

export default function DoublePanaBulkBid({ market, title }) {
  return (
    <EasyModeBid
      market={market}
      title={title}
      label="Double Pana (e.g. 112)"
      maxLength={3}
      validateInput={validateDoublePana}
      betTypeKey="panna"
    />
  );
}
