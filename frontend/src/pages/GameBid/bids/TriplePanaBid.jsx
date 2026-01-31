import React from 'react';
import EasyModeBid from './EasyModeBid';

const validateTriplePana = (n) => {
    if (!n || !/^[0-9]{3}$/.test(n.toString().trim())) return false;
    const s = n.toString().trim();
    return s[0] === s[1] && s[1] === s[2]; // 111, 222, etc.
};

const TriplePanaBid = (props) => (
    <EasyModeBid {...props} label="Enter Pana" maxLength={3} validateInput={validateTriplePana} />
);

export default TriplePanaBid;
