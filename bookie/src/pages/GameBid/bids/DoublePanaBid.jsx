import React from 'react';
import EasyModeBid from './EasyModeBid';
import { isValidDoublePana } from '../panaRules';

const getAllValidDoublePana = () => {
    const validPanas = [];
    for (let i = 0; i <= 999; i++) {
        const str = String(i).padStart(3, '0');
        if (isValidDoublePana(str)) validPanas.push(str);
    }
    return validPanas;
};

const DoublePanaBid = (props) => (
    <EasyModeBid
        {...props}
        label="Enter Pana"
        maxLength={3}
        validateInput={isValidDoublePana}
        showModeTabs
        specialModeType="doublePana"
        validDoublePanas={getAllValidDoublePana()}
    />
);

export default DoublePanaBid;
