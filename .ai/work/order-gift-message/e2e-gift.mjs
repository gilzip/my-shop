// Reviewer live checks for order-gift-message against the demo server (:3100).
import fs from 'node:fs'
import path from 'node:path'
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const SHOP = 'http://localhost:3100/shop-api'
const ADMIN = 'http://localhost:3100/admin-api'
const cred = JSON.parse(fs.readFileSync(path.join(here, 'demo-admin.json'), 'utf8'))

const results = []
async function check(name, fn) {
  try { results.push({ name, ok: true, note: (await fn()) ?? '' }) } catch (e) { results.push({ name, ok: false, note: e.message.slice(0, 300) }) }
}
function assert(c, m) { if (!c) throw new Error(m) }
function session(url) {
  let token
  return async (query, variables = {}) => {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ query, variables }) })
    const t = res.headers.get('vendure-auth-token'); if (t) token = t
    return res.json()
  }
}
const ok = (b) => { if (b.errors) throw new Error(JSON.stringify(b.errors).slice(0, 250)); return b.data }
const SET = `mutation($m:String){ setOrderCustomFields(input:{ customFields:{ giftMessage:$m } }){ __typename ... on Order { customFields { giftMessage } totalWithTax } ... on ErrorResult { errorCode message } } }`
const run = Date.now()
const HE = 'מזל טוב! Happy birthday 🎂\nמ-דנה'

// ---------- Story 1/2: shop, active order
const q = session(SHOP)
const variants = ok(await q(`{ products(options:{take:100}){ items { variants { id priceWithTax stockLevel } } } }`)).products.items.flatMap((p) => p.variants).filter((v) => v.stockLevel !== 'OUT_OF_STOCK')
const v = variants.sort((a, b) => a.priceWithTax - b.priceWithTax)[0]
ok(await q(`mutation($v:ID!){ addItemToOrder(productVariantId:$v, quantity:1){ __typename } }`, { v: v.id }))
let totalBefore
await check('S1 set message on active order (guest)', async () => {
  totalBefore = ok(await q(`{ activeOrder { totalWithTax } }`)).activeOrder.totalWithTax
  const r = ok(await q(SET, { m: 'Happy birthday!' })).setOrderCustomFields
  assert(r.customFields.giftMessage === 'Happy birthday!', JSON.stringify(r))
})
await check('S1 change message replaces it', async () => {
  const r = ok(await q(SET, { m: 'Second version' })).setOrderCustomFields
  assert(r.customFields.giftMessage === 'Second version', JSON.stringify(r))
})
await check('S1/S2 whitespace-only clears the message (null)', async () => {
  const r = ok(await q(SET, { m: '   \n ' })).setOrderCustomFields
  assert(r.customFields.giftMessage === null, JSON.stringify(r))
})
await check('S2 Hebrew + English + emoji + newline round-trip exactly', async () => {
  ok(await q(SET, { m: HE }))
  const back = ok(await q(`{ activeOrder { customFields { giftMessage } } }`)).activeOrder.customFields.giftMessage
  assert(back === HE, JSON.stringify(back))
})
await check('S2 exactly 200 characters (Hebrew + emoji graphemes) accepted', async () => {
  const m = 'א'.repeat(150) + '🎂'.repeat(50)
  const r = ok(await q(SET, { m })).setOrderCustomFields
  assert(r.customFields.giftMessage === m, 'not stored')
})
await check('S2 201 characters refused with the limit, previous value kept', async () => {
  const b = await q(SET, { m: 'a'.repeat(201) })
  assert(b.errors && /limited to 200 characters \(got 201\)/.test(b.errors[0].message), JSON.stringify(b).slice(0, 200))
  const back = ok(await q(`{ activeOrder { customFields { giftMessage } } }`)).activeOrder.customFields.giftMessage
  assert(back === 'א'.repeat(150) + '🎂'.repeat(50), 'previous value changed')
  return b.errors[0].message
})
await check('S2 control character refused', async () => {
  const b = await q(SET, { m: 'bell\u0007' })
  assert(b.errors?.length, 'accepted')
  return b.errors[0].message
})
await check('S2 HTML-like text stored as typed', async () => {
  const r = ok(await q(SET, { m: '<3 <b>love</b>' })).setOrderCustomFields
  assert(r.customFields.giftMessage === '<3 <b>love</b>', JSON.stringify(r))
})
await check('S5 message does not change totals', async () => {
  ok(await q(SET, { m: HE }))
  const after = ok(await q(`{ activeOrder { totalWithTax } }`)).activeOrder.totalWithTax
  assert(after === totalBefore, `${totalBefore} -> ${after}`)
  return `total ${after}`
})

// ---------- checkout: persists through ArrangingPayment and placement
let code
await check('S1 message persists into ArrangingPayment and is editable there', async () => {
  ok(await q(`mutation{ setOrderShippingAddress(input:{ fullName:"Gift Tester", streetLine1:"1 Dizengoff", city:"Tel Aviv", postalCode:"61000", countryCode:"IL" }){ __typename } }`))
  ok(await q(`mutation($i:CreateCustomerInput!){ setCustomerForOrder(input:$i){ __typename } }`, { i: { firstName: 'Gift', lastName: 'Tester', emailAddress: `gift-${run}@example.com` } }))
  const m = ok(await q(`{ eligibleShippingMethods { id code } }`)).eligibleShippingMethods.find((s) => s.code === 'standard-shipping')
  ok(await q(`mutation($id:[ID!]!){ setOrderShippingMethod(shippingMethodId:$id){ __typename } }`, { id: [m.id] }))
  const t = ok(await q(`mutation{ transitionOrderToState(state:"ArrangingPayment"){ __typename ... on Order { state } } }`)).transitionOrderToState
  assert(t.state === 'ArrangingPayment', JSON.stringify(t))
  ok(await q(SET, { m: HE }))
  const back = ok(await q(`{ activeOrder { state customFields { giftMessage } } }`)).activeOrder
  assert(back.customFields.giftMessage === HE, JSON.stringify(back))
})
await check('Checkout completes with the message (Apple Pay simulated)', async () => {
  const r = ok(await q(`mutation{ addPaymentToOrder(input:{ method:"apple-pay-simulated", metadata:{} }){ __typename ... on Order { code state customFields { giftMessage } } } }`)).addPaymentToOrder
  assert(r.state === 'PaymentSettled' && r.customFields.giftMessage === HE, JSON.stringify(r))
  code = r.code
  return `${code} PaymentSettled`
})
await check('S3 owner session sees the message via orderByCode', async () => {
  const r = ok(await q(`query($c:String!){ orderByCode(code:$c){ customFields { giftMessage } } }`, { c: code })).orderByCode
  assert(r.customFields.giftMessage === HE, JSON.stringify(r))
})
await check('S3 customer can no longer change it after placement', async () => {
  const r = ok(await q(SET, { m: 'too late' })).setOrderCustomFields
  assert(r.__typename === 'NoActiveOrderError', JSON.stringify(r))
  return r.__typename
})
await check('S3 (rule 7 amended) a not-signed-in holder of the order code can read it within 2 hours', async () => {
  const b = await session(SHOP)(`query($c:String!){ orderByCode(code:$c){ customFields { giftMessage } } }`, { c: code })
  assert(b.data?.orderByCode?.customFields?.giftMessage === HE, JSON.stringify(b).slice(0, 200))
  return 'readable by code-holder (accepted Vendure behavior)'
})

// ---------- Story 4: staff
const a = session(ADMIN)
await check('Admin login (demo-only superadmin)', async () => {
  const r = ok(await a(`mutation($u:String!,$p:String!){ login(username:$u, password:$p){ __typename } }`, { u: cred.identifier, p: cred.password })).login
  assert(r.__typename === 'CurrentUser', JSON.stringify(r))
})
await check('S3 another signed-in customer cannot read the message', async () => {
  // Test customer created by the demo admin with a generated password (verified immediately).
  const email = `other-${run}@example.com`
  const pw = `t-${Math.random().toString(36).slice(2)}${Date.now()}`
  const c = ok(await a(`mutation($i:CreateCustomerInput!,$p:String){ createCustomer(input:$i, password:$p){ __typename ... on Customer { id } ... on ErrorResult { message } } }`, { i: { firstName: 'Other', lastName: 'Customer', emailAddress: email }, p: pw })).createCustomer
  assert(c.__typename === 'Customer', JSON.stringify(c))
  const other = session(SHOP)
  const l = ok(await other(`mutation($u:String!,$p:String!){ login(username:$u, password:$p){ __typename } }`, { u: email, p: pw })).login
  assert(l.__typename === 'CurrentUser', JSON.stringify(l))
  const b = await other(`query($c:String!){ orderByCode(code:$c){ customFields { giftMessage } } }`, { c: code })
  assert(!JSON.stringify(b).includes('מזל טוב'), JSON.stringify(b).slice(0, 200))
  return b.errors ? b.errors[0].message : 'null'
})
let orderId, lineId
await check('S4 staff see the message exactly as written', async () => {
  const r = ok(await a(`query($c:String!){ orders(options:{ filter:{ code:{ eq:$c } } }){ items { id state lines { id quantity } customFields { giftMessage } } } }`, { c: code })).orders.items[0]
  orderId = r.id; lineId = r.lines[0].id
  assert(r.customFields.giftMessage === HE, JSON.stringify(r.customFields))
  return `order ${orderId} ${r.state}`
})
const ASET = `mutation($id:ID!,$m:String){ setOrderCustomFields(input:{ id:$id, customFields:{ giftMessage:$m } }){ __typename ... on Order { customFields { giftMessage } } } }`
await check('S4 staff can correct the message before shipment', async () => {
  const r = ok(await a(ASET, { id: orderId, m: 'מזל טוב! (תוקן ע"י הצוות)' })).setOrderCustomFields
  assert(r.customFields.giftMessage === 'מזל טוב! (תוקן ע"י הצוות)', JSON.stringify(r))
})
await check('S4/S2 the 200 limit applies to staff too', async () => {
  const b = await a(ASET, { id: orderId, m: 'a'.repeat(201) })
  assert(b.errors?.length, 'accepted')
})
await check('S4 ship the order (manual fulfillment -> Shipped)', async () => {
  const f = ok(await a(`mutation($l:ID!){ addFulfillmentToOrder(input:{ lines:[{ orderLineId:$l, quantity:1 }], handler:{ code:"manual-fulfillment", arguments:[{ name:"method", value:"Courier" },{ name:"trackingCode", value:"T-1" }] } }){ __typename ... on Fulfillment { id state } ... on ErrorResult { message } } }`, { l: lineId })).addFulfillmentToOrder
  assert(f.__typename === 'Fulfillment', JSON.stringify(f))
  const s = ok(await a(`mutation($id:ID!){ transitionFulfillmentToState(id:$id, state:"Shipped"){ __typename ... on Fulfillment { state } ... on ErrorResult { message } } }`, { id: f.id })).transitionFulfillmentToState
  assert(s.state === 'Shipped', JSON.stringify(s))
  const o = ok(await a(`query($id:ID!){ order(id:$id){ state } }`, { id: orderId })).order
  return `order ${o.state}`
})
await check('S4 staff edit refused after shipment, message unchanged', async () => {
  const b = await a(ASET, { id: orderId, m: 'changed after shipping' })
  assert(b.errors && /after the order has shipped/.test(b.errors[0].message), JSON.stringify(b).slice(0, 200))
  const o = ok(await a(`query($id:ID!){ order(id:$id){ customFields { giftMessage } } }`, { id: orderId })).order
  assert(o.customFields.giftMessage === 'מזל טוב! (תוקן ע"י הצוות)', JSON.stringify(o))
  return b.errors[0].message
})
await check('S4 still refused after the shipped order moves to Modifying', async () => {
  const t = ok(await a(`mutation($id:ID!){ transitionOrderToState(id:$id, state:"Modifying"){ __typename ... on Order { state } ... on OrderStateTransitionError { transitionError } } }`, { id: orderId })).transitionOrderToState
  assert(t.state === 'Modifying', JSON.stringify(t))
  const b = await a(ASET, { id: orderId, m: 'changed while modifying' })
  assert(b.errors && /after the order has shipped/.test(b.errors[0].message), JSON.stringify(b).slice(0, 200))
  return 'Modifying -> refused'
})

const pass = results.filter((r) => r.ok).length
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.note ? `  — ${r.note}` : ''}`)
console.log(`\n${pass}/${results.length} passed`)
process.exitCode = pass === results.length ? 0 : 1
