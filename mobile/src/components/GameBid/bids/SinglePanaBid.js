import React from 'react';
import EasyModeBid from './EasyModeBid';

const validateSinglePana = (n) => {
  if (!n || !/^[0-9]{3}$/.test(String(n).trim())) return false;
  const s = String(n).trim();
  return new Set(s.split('')).size === 3;
};

export default function SinglePanaBid({ market, title }) {
  return (
    <EasyModeBid
      market={market}
      title={title}
      label="Single Pana (3 distinct digits, e.g. 123)"
      maxLength={3}
      validateInput={validateSinglePana}
      betTypeKey="panna"
    />
  );
}
