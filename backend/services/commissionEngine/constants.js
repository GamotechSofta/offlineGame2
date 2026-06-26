/** Panel operator roles — extend here for sub_bookie, agent, etc. */
export const OPERATOR_ROLES = Object.freeze(['bookie', 'super_bookie']);

export const SETTLEMENT_STATUS = Object.freeze({
    COMPLETED: 'completed',
    SKIPPED: 'skipped',
    FAILED: 'failed',
    PENDING: 'pending',
});
