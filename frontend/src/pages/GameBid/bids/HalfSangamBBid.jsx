import React from 'react';
import EasyModeBid from './EasyModeBid';

const validateSangam = (n) => n && n.toString().trim().length >= 4;

const HalfSangamBBid = (props) => (
    <EasyModeBid {...props} label="Enter Half Sangam (B)" maxLength={6} validateInput={validateSangam} />
);

export default HalfSangamBBid;
