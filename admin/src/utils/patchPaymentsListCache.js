/**
 * Apply a payment status patch across all payments-list-v2 query variants.
 */
export function patchPaymentsListCache(queryClient, payload) {
    const paymentId = payload?.paymentId ? String(payload.paymentId) : '';
    const status = payload?.status ? String(payload.status) : '';
    if (!paymentId || !status) return;

    queryClient.setQueriesData({ queryKey: ['payments-list-v2'] }, (old) => {
        if (!old || !Array.isArray(old.data)) return old;
        return {
            ...old,
            data: old.data.map((item) => (
                String(item._id) === paymentId
                    ? {
                        ...item,
                        status,
                        adminRemarks: payload.adminRemarks ?? item.adminRemarks,
                        processedAt: payload.processedAt ?? item.processedAt,
                    }
                    : item
            )),
        };
    });
}
