import React from 'react';
import EasyModeBid from './EasyModeBid';

const validateDoublePana = (n) => {
  if (!n || !/^[0-9]{3}$/.test(String(n).trim())) return false;
  const s = String(n).trim();
  const set = new Set(s.split(''));
  return set.size === 2;
};

export default function DoublePanaBid({ market, title }) {
  return (
    <EasyModeBid
      market={market}
      title={title}
      label="Double Pana (2 same + 1 different, e.g. 112)"
      maxLength={3}
      validateInput={validateDoublePana}
      betTypeKey="panna"
    />
  );
}
