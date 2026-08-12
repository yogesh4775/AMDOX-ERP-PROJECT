export function normalizeResponse(res: any) {
  if (!res) return { items: [], totalPages: 1, totalCount: 0 };
  
  if (Array.isArray(res)) {
    return { items: res, totalPages: 1, totalCount: res.length };
  }
  
  let payload = res;
  if (res.success && res.data !== undefined) {
    payload = res.data;
  }
  
  if (Array.isArray(payload)) {
    return { items: payload, totalPages: 1, totalCount: payload.length };
  }
  
  if (payload && Array.isArray(payload.data)) {
    return {
      items: payload.data,
      totalPages: payload.meta?.totalPages || 1,
      totalCount: payload.meta?.total || payload.data.length
    };
  }
  
  return { items: [], totalPages: 1, totalCount: 0 };
}
