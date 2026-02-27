// MongoDB API Client (formerly Supabase wrapper)
const API_BASE = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5000';

interface Filter {
    field: string;
    value: any;
    operator: string;
}

function buildQuery(filters: Filter[]) {
    return filters.map(f => {
        if (f.operator === 'gte') return `${encodeURIComponent(f.field)}=gte.${encodeURIComponent(String(f.value))}`;
        if (f.operator === 'lte') return `${encodeURIComponent(f.field)}=lte.${encodeURIComponent(String(f.value))}`;
        if (f.operator === 'in') return `${encodeURIComponent(f.field)}=in.(${Array.isArray(f.value) ? f.value.join(',') : f.value})`;
        if (f.operator === 'or') return `or=(${encodeURIComponent(String(f.value))})`;
        return `${encodeURIComponent(f.field)}=${encodeURIComponent(String(f.value))}`;
    }).join('&');
}

function collection(table: string) {
    const state = {
        table,
        filters: [] as Filter[],
        selectFields: '*',
        singleFlag: false,
        orderBy: null as { field: string, opts: any } | null,
        payload: null as any,
        operation: 'SELECT', // SELECT, UPDATE, INSERT, DELETE, UPSERT
        limitVal: null as number | null
    };

    const execute = async () => {
        try {
            let res, data, error = null;

            const token = localStorage.getItem('token');
            const authHeader: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};

            // --- UPDATE ---
            if (state.operation === 'UPDATE') {
                // Special handling for worker_profiles update by user_id
                if (state.table === 'worker_profiles') {
                    const userFilter = state.filters.find(f => f.field === 'user_id');
                    if (userFilter) {
                        res = await fetch(`${API_BASE}/api/worker-profiles/user/${userFilter.value}`, {
                            method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeader }, body: JSON.stringify(state.payload)
                        });
                    } else {
                        // Try generic update if ID is present
                        const idFilter = state.filters.find(f => f.field === 'id');
                        if (idFilter) {
                            // Not implemented generic update yet, assuming worker profile mainly
                            error = { message: 'Update by ID not fully implemented in wrapper' };
                        } else {
                            error = { message: 'Update requires user_id filter for worker_profiles' };
                        }
                    }
                } else if (state.table === 'profiles') {
                    // Handle profiles update
                    const idFilter = state.filters.find(f => f.field === 'id');
                    if (idFilter) {
                        res = await fetch(`${API_BASE}/api/users/${idFilter.value}`, {
                            method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeader }, body: JSON.stringify(state.payload)
                        });
                    } else {
                        error = { message: 'Update profiles requires id' };
                    }
                } else if (state.table === 'bookings') {
                    // Handle bookings update
                    const idFilter = state.filters.find(f => f.field === 'id');
                    if (idFilter) {
                        res = await fetch(`${API_BASE}/api/bookings/${idFilter.value}`, {
                            method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeader }, body: JSON.stringify(state.payload)
                        });
                    } else {
                        error = { message: 'Update bookings requires id' };
                    }
                } else {
                    // Generic update logic (mock)
                    error = { message: `Update not implemented for table ${state.table}` };
                }

                if (!error && res) {
                    if (!res.ok) error = await res.json();
                    else data = await res.json();
                }

                // --- INSERT / UPSERT ---
            } else if (state.operation === 'INSERT' || state.operation === 'UPSERT') {
                // For UPSERT, we should ideally check existence, but for now map to POST (backend should handle duplicates or we map to update if ID exists)
                // Since this is a simple wrapper, we'll try POST.
                res = await fetch(`${API_BASE}/api/${state.table}`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader }, body: JSON.stringify(state.payload)
                });
                if (!res.ok) error = await res.json();
                else data = await res.json();

                // --- SELECT ---
            } else {
                // Worker profiles select by user_id
                if (state.table === 'worker_profiles') {
                    const userFilter = state.filters.find(f => f.field === 'user_id');
                    if (userFilter) {
                        res = await fetch(`${API_BASE}/api/worker-profiles/user/${userFilter.value}`, { headers: authHeader });
                        if (res.ok) data = await res.json();
                        else error = await res.json();
                    } else {
                        // List all or filter
                        const q = buildQuery(state.filters);
                        res = await fetch(`${API_BASE}/api/worker-profiles${q ? `?${q}` : ''}`, { headers: authHeader });
                        if (res.ok) data = await res.json();
                        else error = await res.json();
                    }
                }
                // Bookings select by worker_id
                else if (state.table === 'bookings') {
                    const workerFilter = state.filters.find(f => f.field === 'worker_id');
                    if (workerFilter) {
                        res = await fetch(`${API_BASE}/api/bookings/worker/${workerFilter.value}`, { headers: authHeader });
                        if (res.ok) data = await res.json();
                        else error = await res.json();
                    } else {
                        const q = buildQuery(state.filters);
                        res = await fetch(`${API_BASE}/api/bookings${q ? `?${q}` : ''}`, { headers: authHeader });
                        if (res.ok) data = await res.json();
                        else error = await res.json();
                    }
                }
                // Default Generic List
                else {
                    const q = buildQuery(state.filters);
                    const url = `${API_BASE}/api/${state.table}${q ? `?${q}` : ''}`;
                    res = await fetch(url, { headers: authHeader });
                    if (res.ok) data = await res.json();
                    else error = await res.json();
                }
            }

            return { data, error };
        } catch (err) {
            return { data: null, error: err };
        }
    };

    const builder = {
        select(fields = '*') {
            state.operation = 'SELECT';
            state.selectFields = fields;
            return builder;
        },
        eq(field: string, value: any) {
            state.filters.push({ field, value, operator: 'eq' });
            return builder;
        },
        ilike(field: string, value: any) {
            state.filters.push({ field, value, operator: 'ilike' });
            return builder;
        },
        gte(field: string, value: any) {
            state.filters.push({ field, value, operator: 'gte' });
            return builder;
        },
        lte(field: string, value: any) {
            state.filters.push({ field, value, operator: 'lte' });
            return builder;
        },
        in(field: string, value: any[]) {
            state.filters.push({ field, value, operator: 'in' });
            return builder;
        },
        or(query: string) {
            state.filters.push({ field: 'or', value: query, operator: 'or' });
            return builder;
        },
        single() {
            state.singleFlag = true;
            return builder;
        },
        maybeSingle() {
            state.singleFlag = true;
            return builder;
        },
        order(field: string, opts = {}) {
            state.orderBy = { field, opts };
            return builder;
        },
        limit(n: number) {
            state.limitVal = n;
            return builder;
        },
        update(payload: any) {
            state.operation = 'UPDATE';
            state.payload = payload;
            return builder;
        },
        insert(payload: any) {
            state.operation = 'INSERT';
            state.payload = payload;
            return builder;
        },
        upsert(payload: any) {
            state.operation = 'UPSERT';
            state.payload = payload;
            return builder;
        },
        delete() {
            state.operation = 'DELETE';
            return builder;
        },
        then(onfulfilled?: ((value: { data: any; error: any }) => any) | null, onrejected?: ((reason: any) => any) | null) {
            return execute().then(onfulfilled, onrejected);
        }
    };

    return builder;
}

export const db = { collection };
