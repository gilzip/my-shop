// Acceptance checks for protect-internal-custom-fields against a running my-shop server.
// Usage: node e2e-protect.mjs snapshot <file> | node e2e-protect.mjs run <snapshot-file>
import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire('C:/vendure/my-shop/package.json')
const Database = require('better-sqlite3')
const DB = 'C:/vendure/my-shop/vendure.sqlite'
const SHOP = 'http://localhost:3000/shop-api'
const ADMIN = 'http://localhost:3000/admin-api'

function snapshot() {
  const db = new Database(DB, { readonly: true })
  const s = {
    customer: db.prepare('select id, customFieldsGiltest g, customFieldsDror_cust d, customFieldsInternalnote n from customer order by id').all(),
    payment: db.prepare('select id, customFieldsGil_payment p from payment order by id').all(),
    variant: db.prepare('select id, customFieldsInternalnote n from product_variant order by id').all(),
    migrations: db.prepare('select name from migrations order by id').all().map((r) => r.name),
  }
  db.close()
  return s
}

const [mode, file] = process.argv.slice(2)
if (mode === 'snapshot') {
  const s = snapshot()
  fs.writeFileSync(file, JSON.stringify(s))
  console.log(`snapshot: ${s.customer.length} customers, ${s.payment.length} payments, ${s.variant.length} variants, ${s.migrations.length} migrations`)
  process.exit(0)
}
const before = JSON.parse(fs.readFileSync(file, 'utf8'))

const results = []
async function check(name, fn) {
  try { results.push({ name, ok: true, note: (await fn()) ?? '' }) } catch (e) { results.push({ name, ok: false, note: e.message.slice(0, 400) }) }
}
function assert(c, m) { if (!c) throw new Error(m) }

function session(url = SHOP) {
  let token
  return async (query, variables = {}, { raw = false } = {}) => {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ query, variables }) })
    const t = res.headers.get('vendure-auth-token'); if (t) token = t
    const body = await res.json()
    if (raw) return body
    if (body.errors) throw new Error(JSON.stringify(body.errors))
    return body.data
  }
}
const typeFields = async (q, name) => {
  const d = (await q(`{ __type(name:"${name}"){ fields{name} inputFields{name} } }`)).__type
  return d ? (d.fields ?? d.inputFields ?? []).map((f) => f.name) : null
}
const run = Date.now()
const shop = session()
const admin = session(ADMIN)

// ---- Story 1/2/4: Shop API schema
const HIDDEN = ['GilTest', 'dror_cust', 'gil_payment', 'internalNote']
await check('Shop schema: no internal/test field name appears in any type', async () => {
  const types = (await shop(`{ __schema { types { name fields { name } inputFields { name } } } }`)).__schema.types
  const hits = types.flatMap((t) => [...(t.fields ?? []), ...(t.inputFields ?? [])].filter((f) => HIDDEN.includes(f.name)).map((f) => `${t.name}.${f.name}`))
  assert(hits.length === 0, `exposed: ${hits}`)
  return `${types.length} types scanned`
})
for (const t of ['CustomerCustomFields', 'PaymentCustomFields', 'UpdateCustomerCustomFieldsInput', 'RegisterCustomerCustomFieldsInput', 'CreateCustomerCustomFieldsInput']) {
  await check(`Shop schema: ${t} no longer exists`, async () => {
    const f = await typeFields(shop, t)
    assert(f === null, `still present with [${f}]`)
  })
}
await check('Shop schema: Customer.customFields and Payment.customFields are JSON (all-hidden mode)', async () => {
  const out = []
  for (const t of ['Customer', 'Payment']) {
    const f = (await shop(`{ __type(name:"${t}"){ fields{ name type{ name } } } }`)).__type.fields.find((x) => x.name === 'customFields')
    out.push(`${t}:${f?.type?.name}`)
    assert(f?.type?.name === 'JSON', out.join(' '))
  }
  return out.join(' ')
})

// ---- Story 1: write paths rejected
const variant = (await shop(`{ products(options:{take:100}){ items { variants { id priceWithTax stockLevel } } } }`)).products.items.flatMap((p) => p.variants).filter((v) => v.stockLevel !== 'OUT_OF_STOCK').sort((a, b) => a.priceWithTax - b.priceWithTax)[0]
const q = session()
const email = `protect-${run}@example.com`
await q(`mutation($v:ID!){ addItemToOrder(productVariantId:$v, quantity:1){ __typename } }`, { v: variant.id })
for (const cf of [{ GilTest: 1 }, { dror_cust: 'WRITE-CANARY' }, { internalNote: 'WRITE-CANARY' }]) {
  const key = Object.keys(cf)[0]
  await check(`Write path rejected (JSON input): setCustomerForOrder with customFields.${key}, nothing persisted`, async () => {
    const em = `json-${key}-${email}`
    const s = session()
    await s(`mutation($v:ID!){ addItemToOrder(productVariantId:$v, quantity:1){ __typename } }`, { v: variant.id })
    const b = await s(`mutation($i:CreateCustomerInput!){ setCustomerForOrder(input:$i){ __typename } }`, { i: { firstName: 'P', lastName: 'T', emailAddress: em, customFields: cf } }, { raw: true })
    const db = new Database(DB, { readonly: true })
    const row = db.prepare('select customFieldsGiltest g, customFieldsDror_cust d, customFieldsInternalnote n from customer where emailAddress = ?').get(em)
    db.close()
    assert(b.errors?.length, `accepted: ${JSON.stringify(b)}; stored ${JSON.stringify(row)}`)
    assert(!row || (row.g === null && row.d === null && row.n === null), `persisted: ${JSON.stringify(row)}`)
    return b.errors[0].message.slice(0, 90)
  })
}
await check('Write path rejected: registerCustomerAccount with customFields.dror_cust', async () => {
  const b = await session()(`mutation($i:RegisterCustomerInput!){ registerCustomerAccount(input:$i){ __typename } }`, { i: { emailAddress: `reg-${email}`, password: 'test-only-pw-1', customFields: { dror_cust: 'x' } } }, { raw: true })
  assert(b.errors?.length, `accepted: ${JSON.stringify(b)}`)
  return b.errors[0].message.slice(0, 110)
})
await check('Write path rejected: updateCustomer with customFields.GilTest', async () => {
  const b = await session()(`mutation{ updateCustomer(input:{ customFields: { GilTest: 1 } }){ id } }`, {}, { raw: true })
  assert(b.errors?.length, `accepted: ${JSON.stringify(b)}`)
  return b.errors[0].message.slice(0, 110)
})

// ---- Story 1: populated customer values are not leaked through the JSON field
await check('Guest checkout without customFields still works', async () => {
  const d = await q(`mutation($i:CreateCustomerInput!){ setCustomerForOrder(input:$i){ __typename ... on ErrorResult { message } } }`, { i: { firstName: 'P', lastName: 'T', emailAddress: email } })
  assert(d.setCustomerForOrder.__typename === 'Order', JSON.stringify(d))
})
await check('Populated Customer.GilTest/dror_cust/internalNote are not leaked (customFields = null)', async () => {
  const db = new Database(DB)
  const c = db.prepare('select id from customer where emailAddress = ?').get(email)
  db.prepare('update customer set customFieldsGiltest = 4242, customFieldsDror_cust = ?, customFieldsInternalnote = ? where id = ?').run('LEAK-CANARY', 'LEAK-CANARY', c.id)
  db.close()
  const b = await q(`{ activeOrder { customer { id customFields } } }`, {}, { raw: true })
  assert(!b.errors, JSON.stringify(b.errors))
  const s = JSON.stringify(b.data)
  assert(b.data.activeOrder.customer.customFields === null && !s.includes('LEAK-CANARY') && !s.includes('4242'), `leaked: ${s}`)
  return `customer ${c.id}: customFields = null`
})

// ---- Story 2: payment value hidden, default still applied
let code
await check('Checkout completes (address, shipping, payment)', async () => {
  await q(`mutation{ setOrderShippingAddress(input:{ fullName:"P T", streetLine1:"1 St", city:"Tel Aviv", postalCode:"61000", countryCode:"IL" }){ __typename } }`)
  const m = (await q(`{ eligibleShippingMethods { id code } }`)).eligibleShippingMethods.find((s) => s.code === 'standard-shipping')
  await q(`mutation($id:[ID!]!){ setOrderShippingMethod(shippingMethodId:$id){ __typename } }`, { id: [m.id] })
  await q(`mutation{ transitionOrderToState(state:"ArrangingPayment"){ __typename } }`)
  const d = await q(`mutation{ addPaymentToOrder(input:{ method:"apple-pay-simulated", metadata:{} }){ __typename ... on Order { code state } } }`)
  assert(d.addPaymentToOrder.state === 'PaymentSettled', JSON.stringify(d))
  code = d.addPaymentToOrder.code
  return `${code} PaymentSettled`
})
await check('Populated Payment.gil_payment is not leaked, and its 99999 default still applies', async () => {
  const b = await q(`query($c:String!){ orderByCode(code:$c){ payments { id customFields } } }`, { c: code }, { raw: true })
  assert(!b.errors, JSON.stringify(b.errors))
  const p = b.data.orderByCode.payments[0]
  assert(p.customFields === null && !JSON.stringify(b.data).includes('99999'), `leaked: ${JSON.stringify(p)}`)
  const db = new Database(DB, { readonly: true })
  const stored = db.prepare('select customFieldsGil_payment v from payment where id = ?').get(p.id).v
  db.close()
  assert(stored === 99999, `stored ${stored}`)
  return `payment ${p.id}: customFields = null, stored gil_payment = ${stored}`
})

// ---- Story 3: Admin API keeps full access
const ADMIN_EXPECT = {
  CustomerCustomFields: ['GilTest', 'internalNote', 'dror_cust'],
  UpdateCustomerCustomFieldsInput: ['GilTest', 'internalNote', 'dror_cust'],
  PaymentCustomFields: ['gil_payment'],
  ProductVariantCustomFields: ['internalNote'],
  UpdateProductVariantCustomFieldsInput: ['internalNote'],
}
for (const [t, want] of Object.entries(ADMIN_EXPECT)) {
  await check(`Admin schema: ${t} still has [${want}]`, async () => {
    const f = await typeFields(admin, t)
    assert(f && want.every((w) => f.includes(w)), `got [${f}]`)
  })
}

// ---- Story 3: no data changed, no migration
await check('Data: pre-existing values of all five fields unchanged; no new migration', async () => {
  const after = snapshot()
  const byId = (rows) => Object.fromEntries(rows.map((r) => [r.id, JSON.stringify(r)]))
  for (const k of ['customer', 'payment', 'variant']) {
    const a = byId(after[k])
    const diff = before[k].filter((r) => a[r.id] !== JSON.stringify(r))
    assert(diff.length === 0, `${k} changed: ${JSON.stringify(diff).slice(0, 200)}`)
  }
  assert(JSON.stringify(after.migrations) === JSON.stringify(before.migrations), 'migrations changed')
  return `${before.customer.length} customers, ${before.payment.length} payments, ${before.variant.length} variants identical; ${after.migrations.length} migrations`
})

const pass = results.filter((r) => r.ok).length
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.note ? `  — ${r.note}` : ''}`)
console.log(`\n${pass}/${results.length} passed`)
process.exitCode = pass === results.length ? 0 : 1
