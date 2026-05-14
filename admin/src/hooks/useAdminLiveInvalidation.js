/**
 * Previously: admin socket → throttled invalidate (extra API via refetch).
 * Intentionally disabled to reduce backend load.
 */
const useAdminLiveInvalidation = () => {};

export default useAdminLiveInvalidation;
