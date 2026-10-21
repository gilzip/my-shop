import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidEmail, normaliseEmail, restockCandidateVariantIds } from '../src/plugins/back-in-stock-waitlist/waitlist-rules.ts';

test('the same person maps to one address: trimmed and lower-cased', () => {
    assert.equal(normaliseEmail('  Ann@Example.COM '), 'ann@example.com');
});

test('valid and invalid addresses', () => {
    assert.equal(isValidEmail('ann@example.com'), true);
    for (const bad of ['', 'ann', 'ann@', '@example.com', 'ann@example', 'a b@example.com', 'a'.repeat(250) + '@x.com']) {
        assert.equal(isValidEmail(bad), false, bad);
    }
});

const mv = (type: string, quantity: number, id: string | number | null) => ({
    type,
    quantity,
    productVariant: id == null ? null : { id },
});

test('allocations and sales never count as a restock', () => {
    assert.deepEqual(restockCandidateVariantIds([mv('ALLOCATION', 2, 1), mv('SALE', 2, 1)]), []);
});

test('a negative or zero adjustment is not a restock; a positive one is', () => {
    assert.deepEqual(restockCandidateVariantIds([mv('ADJUSTMENT', -3, 1), mv('ADJUSTMENT', 0, 2)]), []);
    assert.deepEqual(restockCandidateVariantIds([mv('ADJUSTMENT', 5, 3)]), [3]);
});

test('cancellations, releases and unknown future types are candidates', () => {
    assert.deepEqual(
        restockCandidateVariantIds([mv('CANCELLATION', 1, 1), mv('RELEASE', 1, 2), mv('SOMETHING_NEW', 1, 3)]),
        [1, 2, 3],
    );
});

test('variants are de-duplicated (also across string and number ids) and missing ones skipped', () => {
    assert.deepEqual(
        restockCandidateVariantIds([
            mv('RELEASE', 1, 7),
            mv('CANCELLATION', 1, '7'),
            mv('RELEASE', 1, null),
            { type: 'RELEASE', quantity: 1 },
        ]),
        [7],
    );
});
