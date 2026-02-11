import React from 'react';
import EasyModeBid from './EasyModeBid';

const validateJodi = (n) => n && /^[0-9]{2}$/.test(n.toString().trim());

const JodiBid = (props) => (
    <EasyModeBid
        {...props}
        label="Enter Jodi"
        maxLength={2}
        validateInput={validateJodi}
        showModeTabs
        specialModeType="jodi"
    />
);

export default JodiBid;
