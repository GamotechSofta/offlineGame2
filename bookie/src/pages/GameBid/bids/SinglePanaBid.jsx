import React from 'react';
import EasyModeBid from './EasyModeBid';
import { VALID_SINGLE_PANAS, isValidSinglePana } from '../panaRules';

const SinglePanaBid = (props) => (
    <EasyModeBid
        {...props}
        label="Enter Pana"
        maxLength={3}
        validateInput={isValidSinglePana}
        specialModeType="singlePana"
        validSinglePanas={Array.from(VALID_SINGLE_PANAS)}
        showModeTabs
    />
);

export default SinglePanaBid;
