/**
 * Pure in-memory operator tree utilities (no MongoDB, no commission logic).
 * DB field parentBookieId is exposed as parentOperatorId in traversal APIs.
 */

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

/** @typedef {{ operators: Map<string, object>, children: Map<string, string[]>, rootIds: string[] }} OperatorTreeIndex */

export function getParentOperatorId(operator) {
    const raw = operator?.parentBookieId ?? operator?.parentOperatorId;
    if (!raw) return null;
    return String(raw._id ?? raw);
}

export function buildChildrenIndex(operatorsList) {
    const operators = new Map();
    const children = new Map();

    for (const op of operatorsList) {
        const id = String(op._id);
        operators.set(id, op);
    }

    for (const op of operatorsList) {
        const id = String(op._id);
        const parentId = getParentOperatorId(op);
        const parentKey = parentId && operators.has(parentId) ? parentId : null;
        if (parentKey) {
            if (!children.has(parentKey)) children.set(parentKey, []);
            children.get(parentKey).push(id);
        }
    }

    for (const ids of children.values()) {
        ids.sort();
    }

    return { operators, children };
}

export function getRootOperatorIds(operators, children) {
    const hasParentInTree = new Set();
    for (const [parentId, childIds] of children.entries()) {
        if (operators.has(parentId)) {
            for (const cid of childIds) hasParentInTree.add(cid);
        }
    }
    return [...operators.keys()].filter((id) => !hasParentInTree.has(id)).sort();
}

/** Collect operator id + all descendants (BFS). */
export function collectSubtreeOperatorIds(rootId, children) {
    const root = String(rootId);
    const ids = new Set();
    const queue = [root];
    while (queue.length) {
        const id = queue.shift();
        if (ids.has(id)) continue;
        ids.add(id);
        for (const kid of children.get(id) || []) {
            queue.push(kid);
        }
    }
    return [...ids];
}

export function filterTreeToSubtree(fullIndex, rootOperatorId) {
    const rootId = String(rootOperatorId);
    if (!fullIndex.operators.has(rootId)) {
        return { operators: new Map(), children: new Map(), rootIds: [] };
    }

    const subtreeIds = new Set(collectSubtreeOperatorIds(rootId, fullIndex.children));
    const operators = new Map();
    const children = new Map();

    for (const id of subtreeIds) {
        operators.set(id, fullIndex.operators.get(id));
        const kids = (fullIndex.children.get(id) || []).filter((cid) => subtreeIds.has(cid));
        children.set(id, kids);
    }

    return { operators, children, rootIds: [rootId] };
}

/** Direct child operator ids. */
export function getOperatorChildren(operatorId, children) {
    return [...(children.get(String(operatorId)) || [])];
}

/** Walk parentBookieId chain upward. */
export function getOperatorAncestors(operatorId, operators) {
    const ancestors = [];
    let current = operators.get(String(operatorId));
    const seen = new Set();
    while (current) {
        const parentId = getParentOperatorId(current);
        if (!parentId || seen.has(parentId)) break;
        seen.add(parentId);
        const parent = operators.get(parentId);
        if (!parent) break;
        ancestors.push(parentId);
        current = parent;
    }
    return ancestors;
}

/** All descendant operator ids (excludes self). */
export function getOperatorDescendants(operatorId, children) {
    const root = String(operatorId);
    const all = collectSubtreeOperatorIds(root, children);
    return all.filter((id) => id !== root);
}

/** Operators with no child operators in the given tree. */
export function getLeafOperators(children, operatorIds) {
    return operatorIds.filter((id) => (children.get(String(id)) || []).length === 0);
}

export function getPostOrderOperatorIds(childrenMap, rootIds) {
    const order = [];
    const visited = new Set();

    const dfs = (id) => {
        if (visited.has(id)) return;
        visited.add(id);
        for (const kidId of childrenMap.get(id) || []) {
            dfs(kidId);
        }
        order.push(id);
    };

    for (const rootId of rootIds) {
        dfs(rootId);
    }
    return order;
}

/**
 * Money conservation: leaf gross profit === Σ actualCommission + platform remainder.
 * @param {{ edges: object[], platformRemainder: number, totalLeafGrossProfit: number }} input
 */
export function validateMoneyConservation({ edges, platformRemainder, totalLeafGrossProfit }) {
    const active = (edges || []).filter((e) => e.status !== 'skipped' && e.status !== 'SKIPPED');
    const totalActual = round2(active.reduce((s, e) => s + Number(e.actualCommission || 0), 0));
    const remainder = round2(platformRemainder ?? 0);
    const leafGross = round2(totalLeafGrossProfit ?? 0);
    const distributed = round2(totalActual + remainder);
    const delta = round2(Math.abs(distributed - leafGross));

    if (delta > 0.02) {
        const err = new Error(
            `Money conservation violated: leafGross=${leafGross}, actual+remainder=${distributed} (actual=${totalActual}, remainder=${remainder})`,
        );
        err.code = 'MONEY_CONSERVATION_VIOLATION';
        err.status = 500;
        err.details = { leafGross, totalActual, platformRemainder: remainder, distributed, delta };
        throw err;
    }

    return { leafGross, totalActual, platformRemainder: remainder, distributed };
}
