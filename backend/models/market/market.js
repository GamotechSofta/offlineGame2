import mongoose from 'mongoose';

/**
 * Result format: ***-**-***
 * - Opening: 3 digits (e.g. 123)
 * - Middle: 2 digits — first = last digit of (sum of opening digits), second = last digit of (sum of closing digits)
 *   e.g. 1+2+3=6 → 6, 4+5+6=15 → 5 → middle = "65"
 * - Closing: 3 digits (e.g. 456)
 *
 * Display flow:
 * - At creation: ***-**-***
 * - After opening announced: 123-6*-***  (opening + first middle digit)
 * - After closing announced: 123-65-456  (full result)
 */

const THREE_DIGITS = /^\d{3}$/;

function sumDigits(str) {
    return [...str].reduce((acc, c) => acc + parseInt(c, 10), 0);
}

function lastDigitOfSum(threeDigitStr) {
    return sumDigits(threeDigitStr) % 10;
}

const marketSchema = new mongoose.Schema({
    /** 'main' = daily/main market (home MARKETS list). 'startline' = startline dashboard only. */
    marketType: {
        type: String,
        enum: ['main', 'startline'],
        default: 'main',
    },
    /** For startline: which starline market this slot belongs to (e.g. 'kalyan', 'milan', 'radha'). Enables per-market tabs. */
    starlineGroup: {
        type: String,
        default: null,
    },
    marketName: {
        type: String,
        required: true,
        unique: true,
    },
    /** Hindi display name for the market (editable, not auto-translated). */
    marketNameHi: {
        type: String,
        default: null,
    },
    startingTime: {
        type: String,
        required: true,
    },
    closingTime: {
        type: String,
        required: true,
    },
    /** Bet closure time in seconds – betting stops this many seconds before closing time (e.g. 300 = no bets in last 5 min). */
    betClosureTime: {
        type: Number,
        default: null,
    },
    /** Opening market number (3 digits), e.g. "123". Set when opening is announced. */
    openingNumber: {
        type: String,
        default: null,
        validate: {
            validator(v) {
                if (v == null || v === '') return true;
                return THREE_DIGITS.test(v);
            },
            message: 'Opening number must be exactly 3 digits',
        },
    },
    /** Closing market number (3 digits), e.g. "456". Set when closing is announced. */
    closingNumber: {
        type: String,
        default: null,
        validate: {
            validator(v) {
                if (v == null || v === '') return true;
                return THREE_DIGITS.test(v);
            },
            message: 'Closing number must be exactly 3 digits',
        },
    },
    /**
     * Full result string (e.g. "123-65-456"). Computed when both opening and closing are set.
     * Stored for quick display; can be recomputed from openingNumber + closingNumber.
     */
    result: {
        type: String,
        default: null,
    },
    /** Win number declared by admin (can be any format, e.g. "123", "123-65-456", etc.) */
    winNumber: {
        type: String,
        default: null,
    },
});

/** Compute middle two digits: first from opening sum, second from closing sum (last digit only). */
marketSchema.statics.getMiddleDigits = function (openingNumber, closingNumber) {
    if (!openingNumber || !THREE_DIGITS.test(openingNumber)) return null;
    const first = lastDigitOfSum(openingNumber);
    if (!closingNumber || !THREE_DIGITS.test(closingNumber)) return `${first}*`;
    const second = lastDigitOfSum(closingNumber);
    return `${first}${second}`;
};

/** Compute full result string "OPENING-MIDDLE-CLOSING" from opening and closing numbers. */
marketSchema.statics.computeResult = function (openingNumber, closingNumber) {
    if (!openingNumber || !THREE_DIGITS.test(openingNumber)) return null;
    const middle = this.getMiddleDigits(openingNumber, closingNumber);
    if (!middle || middle.includes('*')) return null;
    if (!closingNumber || !THREE_DIGITS.test(closingNumber)) return null;
    return `${openingNumber}-${middle}-${closingNumber}`;
};

/**
 * Get display string for current state:
 * - Startline: single result only → "123 - 6" (open patti - open digit) or "*** - *"
 * - Main: ***-**-*** | 123-6*-*** | 123-65-456
 */
marketSchema.methods.getDisplayResult = function () {
    const opening = this.openingNumber;
    const closing = this.closingNumber;
    const isStartline = this.marketType === 'startline';

    if (isStartline) {
        const openingDisplay = opening && THREE_DIGITS.test(opening) ? opening : '***';
        const digit = opening && THREE_DIGITS.test(opening) ? String(sumDigits(opening) % 10) : '*';
        return `${openingDisplay} - ${digit}`;
    }

    const openingDisplay = opening && THREE_DIGITS.test(opening) ? opening : '***';
    const closingDisplay = closing && THREE_DIGITS.test(closing) ? closing : '***';

    if (!opening || !THREE_DIGITS.test(opening)) {
        return '***-**-***';
    }

    const middle = this.constructor.getMiddleDigits(opening, closing);
    const middleDisplay = middle === null ? '**' : middle.length === 1 ? `${middle}*` : middle;

    return `${openingDisplay}-${middleDisplay}-${closingDisplay}`;
};

marketSchema.pre('save', function () {
    if (this.openingNumber && this.closingNumber &&
        THREE_DIGITS.test(this.openingNumber) && THREE_DIGITS.test(this.closingNumber)) {
        this.result = this.constructor.computeResult(this.openingNumber, this.closingNumber);
    } else {
        this.result = null;
    }
});

const Market = mongoose.model('Market', marketSchema);
export default Market;