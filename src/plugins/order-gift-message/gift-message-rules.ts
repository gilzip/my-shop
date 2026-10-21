/**
 * Pure rules for the order gift message (see .ai/work/order-gift-message/architecture.md).
 * Kept free of Vendure imports so they can be unit-tested with node:test.
 */

export const GIFT_MESSAGE_MAX = 200;

// Fulfillment states in which goods have left the shop.
const SHIPPED_FULFILLMENT_STATES = ['Shipped', 'Delivered'];

// Control characters other than tab, line feed and carriage return.
const DISALLOWED_CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

// `Intl.Segmenter` exists at runtime (Node 16+, current browsers) but is not in this
// project's `es2019` TypeScript lib, so it is typed locally.
type Segmenter = { segment(input: string): Iterable<unknown> };
const SegmenterCtor = (Intl as unknown as { Segmenter: new (locale?: string, options?: { granularity: 'grapheme' }) => Segmenter }).Segmenter;
const graphemes = new SegmenterCtor(undefined, { granularity: 'grapheme' });

/** Counts user-visible characters: one per grapheme, so "🎂", "👨‍👩‍👧" and "ש" each count as 1. */
export function countCharacters(text: string): number {
    let count = 0;
    for (const _ of graphemes.segment(text)) {
        count++;
    }
    return count;
}

/** Whitespace-only text means "no message". */
export function normalizeGiftMessage(value: string | null | undefined): string | null {
    if (value == null || value.trim() === '') {
        return null;
    }
    return value;
}

/** Custom field `validate` hook: returns an error message, or undefined when the value is valid. */
export function validateGiftMessage(value: string | null | undefined): string | undefined {
    const message = normalizeGiftMessage(value);
    if (message === null) {
        return undefined;
    }
    if (DISALLOWED_CONTROL_CHARS.test(message)) {
        return 'Gift message contains characters that are not allowed.';
    }
    const length = countCharacters(message);
    if (length > GIFT_MESSAGE_MAX) {
        return `Gift message is limited to ${GIFT_MESSAGE_MAX} characters (got ${length}).`;
    }
    return undefined;
}

/** True once any fulfillment of the order has shipped or been delivered. */
export function hasShipped(fulfillmentStates: string[]): boolean {
    return fulfillmentStates.some(state => SHIPPED_FULFILLMENT_STATES.includes(state));
}
