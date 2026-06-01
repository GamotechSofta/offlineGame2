/**
 * UI display labels for the bookie hierarchy.
 * Backend roles and API paths stay `bookie` / `super_bookie`.
 *
 * Rename mapping:
 * - role `bookie` (top-level accounts) → SuperBookie
 * - role `super_bookie` (sub-accounts) → Bookie
 */
export const TOP_LEVEL_LABEL = 'SuperBookie';
export const TOP_LEVEL_LABEL_PLURAL = 'SuperBookies';
export const SUB_LEVEL_LABEL = 'Bookie';
export const SUB_LEVEL_LABEL_PLURAL = 'Bookies';

/** e.g. "SuperBookie › John" when player is under a sub-account */
export function ownershipChainLabel(parentName, subName) {
    const parent = parentName || TOP_LEVEL_LABEL;
    return subName ? `${parent} › ${subName}` : parent;
}
