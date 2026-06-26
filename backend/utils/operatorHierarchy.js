/**
 * Application-wide generic operator hierarchy API.
 * Delegates to commission engine hierarchyService (no commission logic here).
 */
export {
    loadActiveOperatorIndex,
    buildOperatorTree,
    getOperatorTree,
    getOperatorChildrenIds,
    getOperatorAncestorIds,
    getOperatorDescendantIds,
    getLeafOperatorIds,
    getOperatorChildren,
    getOperatorAncestors,
    getOperatorDescendants,
    getLeafOperators,
    getParentOperatorId,
    isOperatorAccount,
    loadOperator,
    OPERATOR_SELECT,
} from '../services/commissionEngine/hierarchyService.js';
