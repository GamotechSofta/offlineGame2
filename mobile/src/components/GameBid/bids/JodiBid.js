import React from 'react';
import EasyModeBid from './EasyModeBid';

const validateJodi = (n) => n && /^[0-9]{2}$/.test(String(n).trim());

export default function JodiBid({ market, title }) {
  return (
    <EasyModeBid
      market={market}
      title={title}
      label="Enter Jodi (00-99)"
      maxLength={2}
      validateInput={validateJodi}
      betTypeKey="jodi"
      lockSessionToOpen
    />
  );
}
