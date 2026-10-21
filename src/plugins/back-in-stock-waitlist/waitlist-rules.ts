// Pure helpers, deliberately free of Vendure imports so they can be unit-tested with `npm test`.

type Id = string | number;

export interface StockMovementLike {
    type: string;
    quantity: number;
    productVariant?: { id: Id } | null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

/** The same person must map to one row: trim and lower-case before storing or comparing. */
export function normaliseEmail(raw: string): string {
    return raw.trim().toLowerCase();
}

/** Expects an already-normalised address. Intentionally simple; delivery is the real check. */
export function isValidEmail(email: string): boolean {
    return email.length > 0 && email.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(email);
}

/**
 * Which variants might have become saleable because of these stock movements. Allocations and
 * sales can only lower saleable stock, and a negative adjustment lowers it too. Every other
 * movement (positive adjustment, cancellation, release, and any type a future Vendure adds) is
 * a candidate; the caller re-checks the real saleable level before notifying anyone.
 */
export function restockCandidateVariantIds(movements: StockMovementLike[]): Id[] {
    const seen = new Set<string>();
    const ids: Id[] = [];
    for (const m of movements) {
        if (m.type === 'ALLOCATION' || m.type === 'SALE') continue;
        if (m.type === 'ADJUSTMENT' && !(m.quantity > 0)) continue;
        const id = m.productVariant?.id;
        if (id == null || seen.has(String(id))) continue;
        seen.add(String(id));
        ids.push(id);
    }
    return ids;
}
