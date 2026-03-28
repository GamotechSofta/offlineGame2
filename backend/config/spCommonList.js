/**
 * SP Common (Single Patti Common) - predefined list of commonly used Single Patti combinations.
 * Used as the valid pool for SP Common bets and (optionally) for result generation.
 * Each is a 3-digit number; digit sum's last digit gives the single result digit.
 */
// Keep in sync with frontend/src/pages/GameBid/bids/panaRules.js VALID_SINGLE_PANAS
const SP_COMMON_LIST = [
    '127', '136', '145', '190', '235', '280', '370', '389', '460', '479', '569', '578',
    '128', '137', '146', '236', '245', '290', '380', '470', '489', '560', '579', '678',
    '129', '138', '147', '156', '237', '246', '345', '390', '480', '570', '589', '679',
    '120', '139', '148', '157', '238', '247', '256', '346', '490', '580', '670', '689',
    '130', '149', '158', '167', '239', '248', '257', '347', '356', '590', '680', '789',
    '140', '159', '168', '230', '249', '258', '267', '348', '357', '456', '690', '780',
    '123', '150', '169', '178', '240', '259', '268', '349', '358', '367', '457', '790',
    '124', '160', '179', '250', '269', '278', '340', '359', '368', '458', '467', '890',
    '125', '134', '170', '189', '260', '279', '350', '369', '378', '459', '468', '567',
    '126', '135', '180', '234', '270', '289', '360', '379', '450', '469', '478', '568',
];

const SP_COMMON_SET = new Set(SP_COMMON_LIST);

function isSpCommon(betNumber) {
    const s = (betNumber ?? '').toString().trim();
    return /^[0-9]{3}$/.test(s) && SP_COMMON_SET.has(s);
}

export { SP_COMMON_LIST, SP_COMMON_SET, isSpCommon };
export default SP_COMMON_LIST;
