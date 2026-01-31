import React from 'react';
import EasyModeBid from './EasyModeBid';

const validatePana = (n) => n && /^[0-9]{3}$/.test(n.toString().trim());

const DoublePanaBid = (props) => (
    <EasyModeBid {...props} label="Enter Pana" maxLength={3} validateInput={validatePana} />
);

export default DoublePanaBid;
