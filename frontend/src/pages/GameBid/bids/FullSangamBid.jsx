import React from 'react';
import EasyModeBid from './EasyModeBid';

const validateSangam = (n) => n && n.toString().trim().length >= 4; // Pana + Digit format

const FullSangamBid = (props) => (
    <EasyModeBid {...props} label="Enter Full Sangam" maxLength={6} validateInput={validateSangam} />
);

export default FullSangamBid;
