import React from 'react';
import EasyModeBid from './EasyModeBid';

const validateTriplePana = (n) => {
  if (!n || !/^[0-9]{3}$/.test(String(n).trim())) return false;
  const s = String(n).trim();
  return s[0] === s[1] && s[1] === s[2];
};

export default function TriplePanaBid({ market, title }) {
  return (
    <EasyModeBid
      market={market}
      title={title}
      label="Triple Pana (3 same digits, e.g. 111)"
      maxLength={3}
      validateInput={validateTriplePana}
      betTypeKey="panna"
    />
  );
}
