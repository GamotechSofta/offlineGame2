import React from 'react';
import EasyModeBid from './EasyModeBid';

const validateJodi = (n) => n && /^[0-9]{2}$/.test(n.toString().trim());

const JodiBulkBid = (props) => (
    <EasyModeBid {...props} label="Enter Jodi" maxLength={2} validateInput={validateJodi} />
);

export default JodiBulkBid;
