/**
 * Optional: daily loss limit, cool-off, self-exclusion. Can be used by spin route.
 * For now a no-op; extend with real limits from user prefs or config.
 */
export function responsibleGamingLimits(req, res, next) {
    // TODO: check user's daily loss limit, cool-off period, self-exclusion
    next();
}
