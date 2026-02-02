import React from 'react';
import EasyModeBid from './EasyModeBid';

// Single Panna: 3 digits, strictly increasing (H < T < U)
const validateSinglePana = (n) => {
    const s = (n ?? '').toString().trim();
    if (!/^[0-9]{3}$/.test(s)) return false;
    const a = Number(s[0]);
    const b = Number(s[1]);
    const c = Number(s[2]);
    return a < b && b < c;
};

const SinglePanaBid = (props) => (
    <EasyModeBid
        {...props}
        label="Enter Pana"
        maxLength={3}
        validateInput={validateSinglePana}
        showBidsList
        openReviewOnAdd={false}
        showInlineSubmit
        showModeTabs
        desktopSplit
    />
);

export default SinglePanaBid;
