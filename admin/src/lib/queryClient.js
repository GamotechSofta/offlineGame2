import { QueryClient } from '@tanstack/react-query';
import { isAdminTraceEnabled, traceQueryFetch, traceQueryInvalidation } from './runtimeTrace';

export const adminQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      gcTime: 5 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchIntervalInBackground: false,
    },
  },
});

const originalInvalidateQueries = adminQueryClient.invalidateQueries.bind(adminQueryClient);
adminQueryClient.invalidateQueries = (...args) => {
  if (isAdminTraceEnabled()) {
    const key = JSON.stringify(args?.[0]?.queryKey || ['*']);
    traceQueryInvalidation(key);
  }
  return originalInvalidateQueries(...args);
};

adminQueryClient.getQueryCache().subscribe((event) => {
  if (!isAdminTraceEnabled()) return;
  if (event?.type === 'updated' && event?.query?.state?.fetchStatus === 'fetching') {
    traceQueryFetch(JSON.stringify(event.query.queryKey || ['unknown']));
  }
});
