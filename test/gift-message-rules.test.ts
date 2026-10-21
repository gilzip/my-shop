import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    countCharacters,
    GIFT_MESSAGE_MAX,
    hasShipped,
    normalizeGiftMessage,
    validateGiftMessage,
} from '../src/plugins/order-gift-message/gift-message-rules.ts';

test('characters are counted as a person sees them (graphemes)', () => {
    assert.equal(countCharacters('שלום'), 4);
    assert.equal(countCharacters('🎂'), 1);
    assert.equal(countCharacters('👨‍👩‍👧'), 1);
    assert.equal(countCharacters('מזל טוב! Happy birthday 🎂'), 25);
});

test('exactly 200 characters is accepted, 201 is refused with the limit in the message', () => {
    assert.equal(validateGiftMessage('א'.repeat(GIFT_MESSAGE_MAX)), undefined);
    assert.equal(validateGiftMessage('🎂'.repeat(GIFT_MESSAGE_MAX)), undefined);
    assert.match(String(validateGiftMessage('a'.repeat(GIFT_MESSAGE_MAX + 1))), /limited to 200 characters \(got 201\)/);
});

test('line breaks and tabs are allowed; other control characters are refused', () => {
    assert.equal(validateGiftMessage('Happy birthday!\nLove,\r\n\tDana'), undefined);
    assert.match(String(validateGiftMessage('bell\u0007')), /not allowed/);
    assert.match(String(validateGiftMessage('nul\u0000')), /not allowed/);
});

test('HTML-looking text is accepted as plain text', () => {
    assert.equal(validateGiftMessage('<3 <b>love</b> https://example.com'), undefined);
});

test('null, empty and whitespace-only mean "no message"', () => {
    for (const v of [null, undefined, '', '   ', '\n\t ']) {
        assert.equal(normalizeGiftMessage(v), null);
        assert.equal(validateGiftMessage(v), undefined);
    }
});

test('real content is never trimmed or changed', () => {
    assert.equal(normalizeGiftMessage('  Happy birthday  '), '  Happy birthday  ');
    assert.equal(normalizeGiftMessage('מזל טוב 🎂'), 'מזל טוב 🎂');
});

test('an order has shipped once any fulfillment is Shipped or Delivered', () => {
    assert.equal(hasShipped([]), false);
    assert.equal(hasShipped(['Pending', 'Cancelled']), false);
    assert.equal(hasShipped(['Pending', 'Shipped']), true);
    assert.equal(hasShipped(['Delivered']), true);
});
