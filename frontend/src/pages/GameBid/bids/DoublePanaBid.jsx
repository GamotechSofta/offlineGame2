import React from 'react';
import EasyModeBid from './EasyModeBid';

const validatePana = (n) => {
    if (!n) return false;
    const str = n.toString().trim();
    
    // Must be exactly 3 digits
    if (!/^[0-9]{3}$/.test(str)) return false;
    
    const digits = str.split('').map(Number);
    const [first, second, third] = digits;
    
    // Two consecutive digits must be the same (positions 0-1 or 1-2)
    const hasConsecutiveSame = (first === second) || (second === third);
    if (!hasConsecutiveSame) return false;
    
    // Special case: Two zeros at the start are not allowed (001-009)
    if (first === 0 && second === 0) {
        return false; // All numbers starting with 00 are disallowed
    }
    
    // Special case: Two zeros at the end are allowed (300, 900, 100)
    // For these cases, third (0) is not > first, but they're explicitly allowed
    if (second === 0 && third === 0) {
        return true;
    }
    
    // Special case: Numbers ending with zero where first two digits are the same (220, 990, 880, 660)
    if (first === second && third === 0) {
        return true;
    }
    
    // For all other cases, last digit must be greater than first
    if (third <= first) return false;
    
    return true;
};

// Generate all valid double pana numbers
const getAllValidDoublePana = () => {
    const validPanas = [];
    for (let i = 0; i <= 999; i++) {
        const str = String(i).padStart(3, '0');
        if (validatePana(str)) {
            validPanas.push(str);
        }
    }
    return validPanas;
};

const DoublePanaBid = (props) => (
    <EasyModeBid
        {...props}
        label="Enter Pana"
        maxLength={3}
        validateInput={validatePana}
        showBidsList
        openReviewOnAdd={false}
        showInlineSubmit
        showModeTabs
        desktopSplit
        specialModeType="doublePana"
        validDoublePanas={getAllValidDoublePana()}
    />
);

export default DoublePanaBid;
