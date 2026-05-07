export const queryParser = (req, res, next) => {
    const query = { ...req.query };
    const mongoQuery = {};
    const coerceValue = (raw) => {
        const trimmed = String(raw).trim();
        if (trimmed === '') return trimmed;
        const parsed = Number(trimmed);
        return Number.isNaN(parsed) ? trimmed : parsed;
    };

    for (const key in query) {
        let value = query[key];

        // Handle Supabase-style operators: field=gte.100, field=in.(1,2,3)
        if (typeof value === 'string') {
            if (value.startsWith('gte.')) {
                mongoQuery[key] = { $gte: coerceValue(value.replace('gte.', '')) };
            } else if (value.startsWith('lte.')) {
                mongoQuery[key] = { $lte: coerceValue(value.replace('lte.', '')) };
            } else if (value.startsWith('gt.')) {
                mongoQuery[key] = { $gt: coerceValue(value.replace('gt.', '')) };
            } else if (value.startsWith('lt.')) {
                mongoQuery[key] = { $lt: coerceValue(value.replace('lt.', '')) };
            } else if (value.startsWith('eq.')) {
                mongoQuery[key] = coerceValue(value.replace('eq.', ''));
            } else if (value.startsWith('in.')) {
                // e.g. in.(1,2,3) -> [1,2,3]
                const list = value.replace('in.(', '').replace(')', '').split(',').map(coerceValue);
                mongoQuery[key] = { $in: list };
            } else if (value.startsWith('is.')) {
                // e.g. is.null -> null
                const val = value.replace('is.', '');
                if (val === 'null') mongoQuery[key] = null;
                else if (val === 'true') mongoQuery[key] = true;
                else if (val === 'false') mongoQuery[key] = false;
            } else {
                // Default to equality if no operator, but handle potential numbers?
                // For now, keep as string or try to parse number if it looks like one?
                // Supabase client sends strings usually.
                // Let's safe-guard: if it's a number-string, maybe we need to convert?
                // The backend logic might need to cast.
                mongoQuery[key] = coerceValue(value);
            }
        } else {
            mongoQuery[key] = value;
        }
    }

    req.mongoQuery = mongoQuery;
    next();
};
