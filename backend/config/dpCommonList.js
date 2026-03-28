/**
 * DP Common (Double Pana Common) - predefined list of commonly used Double Pana combinations.
 * Used as the valid pool for DP Common bets and (optionally) for result generation.
 * Each is a 3-digit number with exactly two identical digits.
 */
const DP_COMMON_LIST = [
    '100', '110', '112', '113', '114', '115', '116', '117', '118', '119',
    '122', '133', '144', '155', '166', '177', '188', '199', '200', '220',
    '223', '224', '225', '226', '227', '228', '229', '233', '244', '255',
    '266', '277', '288', '299', '300', '330', '334', '335', '336', '337',
    '338', '339', '344', '355', '366', '377', '388', '399', '400', '440',
    '445', '446', '447', '448', '449', '455', '466', '477', '488', '499',
    '500', '550', '556', '557', '558', '559', '566', '577', '588', '599',
    '600', '660', '667', '668', '669', '677', '688', '699', '700', '770',
    '778', '779', '788', '799', '800', '880', '889', '899', '900', '990'
];

const DP_COMMON_SET = new Set(DP_COMMON_LIST);

function isDpCommon(betNumber) {
    const s = (betNumber ?? '').toString().trim();
    return /^[0-9]{3}$/.test(s) && DP_COMMON_SET.has(s);
}

export { DP_COMMON_LIST, DP_COMMON_SET, isDpCommon };
export default DP_COMMON_LIST;