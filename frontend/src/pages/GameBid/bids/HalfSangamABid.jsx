import React from 'react';
import EasyModeBid from './EasyModeBid';

const validateSangam = (n) => n && n.toString().trim().length >= 4;

const HalfSangamABid = (props) => (
    <EasyModeBid {...props} label="Enter Half Sangam (A)" maxLength={6} validateInput={validateSangam} />
);

export default HalfSangamABid;
