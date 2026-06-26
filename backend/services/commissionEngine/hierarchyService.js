import mongoose from 'mongoose';
import Admin from '../../models/admin/admin.js';
import User from '../../models/user/user.js';
import { OPERATOR_ROLES } from './constants.js';
import {
    buildChildrenIndex,
    getRootOperatorIds,
    filterTreeToSubtree,
    getOperatorChildren,
    getOperatorAncestors,
    getOperatorDescendants,
    getLeafOperators,
    getPostOrderOperatorIds,
    getParentOperatorId,
    collectSubtreeOperatorIds,
} from './treeUtils.js';

export const OPERATOR_SELECT = '_id username role parentBookieId commissionPercentage status balance';

const toObjectId = (id) => {
    if (!id) return null;
    if (id instanceof mongoose.Types.ObjectId) return id;
    if (mongoose.Types.ObjectId.isValid(String(id))) {
        return new mongoose.Types.ObjectId(String(id));
    }
    return id;
};

/** Any hierarchy operator (not platform admin). Role is metadata only — never used for commission math. */
export const isOperatorAccount = (admin) =>
    Boolean(admin && OPERATOR_ROLES.includes(admin.role));

export async function loadOperator(operatorId, select = OPERATOR_SELECT) {
    return Admin.findById(operatorId).select(select).lean();
}

/**
 * Single query: load all active operators into an in-memory index.
 * O(n) tree construction — no per-node DB round-trips.
 */
export async function loadActiveOperatorIndex(select = OPERATOR_SELECT) {
    const list = await Admin.find({
        role: { $in: OPERATOR_ROLES },
        status: 'active',
    })
        .select(select)
        .lean();

    const { operators, children } = buildChildrenIndex(list);
    const rootIds = getRootOperatorIds(operators, children);
    return { operators, children, rootIds, allOperators: list };
}

/** @deprecated Prefer loadActiveOperatorIndex + getOperatorChildren. */
export async function getDirectChildOperators(parentId) {
    const index = await loadActiveOperatorIndex();
    return getOperatorChildren(parentId, index.children)
        .map((id) => index.operators.get(id))
        .filter(Boolean);
}

/** Top-level operators (no parent in tree). */
export async function getTopLevelOperators() {
    const index = await loadActiveOperatorIndex();
    return index.rootIds.map((id) => index.operators.get(id)).filter(Boolean);
}

export async function hasDirectPlayers(operatorId) {
    const count = await User.countDocuments({ referredBy: toObjectId(operatorId) });
    return count > 0;
}

/**
 * Batch: which operators in the set have at least one direct player.
 * One User aggregation instead of N countDocuments calls.
 */
export async function batchOperatorsWithDirectPlayers(operatorIds) {
    const oids = [...new Set(operatorIds.map((id) => toObjectId(id)).filter(Boolean))];
    if (!oids.length) return new Set();

    const rows = await User.aggregate([
        { $match: { referredBy: { $in: oids } } },
        { $group: { _id: '$referredBy' } },
    ]);

    return new Set(rows.map((r) => String(r._id)));
}

/**
 * Build operator tree for a subtree (single operator query + in-memory filter).
 * @returns {{ operators: Map, children: Map, rootIds: string[] }}
 */
export async function buildOperatorTree(rootOperatorId = null) {
    const fullIndex = await loadActiveOperatorIndex();

    if (rootOperatorId) {
        return filterTreeToSubtree(fullIndex, rootOperatorId);
    }

    return {
        operators: fullIndex.operators,
        children: fullIndex.children,
        rootIds: fullIndex.rootIds,
    };
}

/** Full operator tree (all active operators). */
export async function getOperatorTree(rootOperatorId = null) {
    return buildOperatorTree(rootOperatorId);
}

export async function getOperatorChildrenIds(operatorId) {
    const index = await loadActiveOperatorIndex();
    return getOperatorChildren(operatorId, index.children);
}

export async function getOperatorAncestorIds(operatorId) {
    const index = await loadActiveOperatorIndex();
    return getOperatorAncestors(operatorId, index.operators);
}

export async function getOperatorDescendantIds(operatorId) {
    const index = await loadActiveOperatorIndex();
    return getOperatorDescendants(operatorId, index.children);
}

export async function getLeafOperatorIds(rootOperatorId = null) {
    const tree = await buildOperatorTree(rootOperatorId);
    const scopeIds = rootOperatorId
        ? collectSubtreeOperatorIds(rootOperatorId, tree.children)
        : [...tree.operators.keys()];
    return getLeafOperators(tree.children, scopeIds);
}

export { getPostOrderOperatorIds, getOperatorChildren, getOperatorAncestors, getOperatorDescendants, getLeafOperators, getParentOperatorId };

export function assertChildrenCompleted(childContexts, childIds) {
    const missing = [];
    for (const childId of childIds) {
        const ctx = childContexts.get(childId);
        if (!ctx || (ctx.status !== 'completed' && ctx.status !== 'skipped')) {
            missing.push(childId);
        }
    }
    if (missing.length) {
        const err = new Error(`Child settlements incomplete: ${missing.join(', ')}`);
        err.status = 409;
        err.code = 'CHILD_SETTLEMENTS_INCOMPLETE';
        throw err;
    }
}
