import { test } from 'node:test';
import assert from 'node:assert/strict';
import { internalByDefault } from '../src/custom-fields/internal-by-default.ts';

const shop = { apiType: 'shop' } as any;
const admin = { apiType: 'admin' } as any;
const withoutValidate = (fields: any[] | undefined) => fields?.map(({ validate, ...rest }) => rest);

test('a field without `public` becomes hidden from the Shop API', () => {
    const result = internalByDefault({ Customer: [{ name: 'secret', type: 'string' }] });
    assert.equal(result.Customer?.[0].public, false);
});

test('an explicit `public: true` keeps the field exposed and adds no guard', () => {
    const result = internalByDefault({ Customer: [{ name: 'nickname', type: 'string', public: true }] });
    assert.equal(result.Customer?.[0].public, true);
    assert.equal(result.Customer?.[0].validate, undefined);
});

test('an explicit `public: false` stays hidden', () => {
    const result = internalByDefault({ Customer: [{ name: 'note', type: 'text', public: false }] });
    assert.equal(result.Customer?.[0].public, false);
});

test('every other key is preserved, across several entities', () => {
    const result = internalByDefault({
        Payment: [{ name: 'gil_payment', type: 'int', defaultValue: 99999, nullable: true }],
        ProductVariant: [{ name: 'internalNote', type: 'text', nullable: true, readonly: true }],
    });
    assert.deepEqual(withoutValidate(result.Payment), [{ public: false, name: 'gil_payment', type: 'int', defaultValue: 99999, nullable: true }]);
    assert.deepEqual(withoutValidate(result.ProductVariant), [{ public: false, name: 'internalNote', type: 'text', nullable: true, readonly: true }]);
});

test('empty and undefined entity arrays are handled', () => {
    const result = internalByDefault({ Order: [], Customer: undefined });
    assert.deepEqual(result.Order, []);
    assert.equal(result.Customer, undefined);
    assert.deepEqual(internalByDefault({}), {});
});

test('the input config is not mutated', () => {
    const field = { name: 'secret', type: 'string' as const };
    const input = { Customer: [field] };
    internalByDefault(input);
    assert.equal('public' in field, false);
    assert.equal('validate' in field, false);
    assert.equal(input.Customer[0], field);
});

test('a hidden field rejects writes from the Shop API', async () => {
    const [field] = internalByDefault({ Customer: [{ name: 'GilTest', type: 'int' }] }).Customer!;
    const error = await (field.validate as any)(1, {}, shop);
    assert.match(String(error), /GilTest.*Shop API/);
});

test('a hidden field accepts writes from the Admin API', async () => {
    const [field] = internalByDefault({ Customer: [{ name: 'GilTest', type: 'int' }] }).Customer!;
    assert.equal(await (field.validate as any)(1, {}, admin), undefined);
});

test('the field\'s own validate still runs for Admin API writes', async () => {
    const [field] = internalByDefault({
        Customer: [{ name: 'code', type: 'string', validate: (v: string) => (v.length > 3 ? 'too long' : undefined) }],
    }).Customer!;
    assert.equal(await (field.validate as any)('toolong', {}, admin), 'too long');
    assert.equal(await (field.validate as any)('ok', {}, admin), undefined);
    assert.match(String(await (field.validate as any)('ok', {}, shop)), /Shop API/);
});
