// Run: node --experimental-strip-types --no-warnings tests/logic.test.mjs
import assert from "node:assert/strict";
import { buildOrder } from "../supabase/functions/_shared/checkout.ts";
import { handleEvent } from "../supabase/functions/_shared/webhook.ts";
let n = 0; const ok = m => { n++; console.log("  ok ", m); };

const cards = [{ id: "birthday-1", title: "Midnight confetti", occasion: "Birthday", price_cents: 99, published: true }, { id: "old-1", title: "Old", occasion: "X", price_cents: 99, published: false }];
let r = buildOrder([{ cardId: "birthday-1", message: "Hi", price_cents: 1, price: 0, total: 0 }], cards);
assert.equal(r.total, 99); ok("a price sent by the browser is ignored (total stays 99)");
for (const [k, want] of [[1, 99], [2, 198], [3, 297]]) { assert.equal(buildOrder(Array(k).fill({ cardId: "birthday-1", message: "Hi" }), cards).total, want); } ok("1, 2, 3 cards = 99, 198, 297 cents");
assert.deepEqual(Object.keys(buildOrder([{ cardId: "birthday-1", message: " Hi ", to: " Mia ", from: "Sam" }], cards).lines[0]).sort(), ["card_id", "message", "price_cents", "recipient_name", "sender_name", "title"]); ok("order line has the expected fields");
assert.equal(buildOrder([{ cardId: "birthday-1", message: " Hi ", to: " Mia " }], cards).lines[0].message, "Hi"); ok("text is trimmed");
assert.ok(buildOrder([{ cardId: "old-1", message: "x" }], cards).error); ok("unpublished card refused");
assert.ok(buildOrder([{ cardId: "nope", message: "x" }], cards).error); ok("unknown card refused");
assert.ok(buildOrder([{ cardId: "birthday-1", message: "   " }], cards).error); ok("empty message refused");
assert.ok(buildOrder([{ cardId: "birthday-1", message: "x".repeat(401) }], cards).error); ok("401-character message refused");
assert.ok(buildOrder([{ cardId: "birthday-1", message: "x", to: "y".repeat(41) }], cards).error); ok("41-character name refused");
assert.ok(buildOrder([{ cardId: "birthday-1", message: 5 }], cards).error); ok("non-text message refused");
assert.ok(buildOrder([], cards).error && buildOrder("x", cards).error && buildOrder([null], cards).error); ok("empty or malformed cart refused");
assert.ok(buildOrder(Array(21).fill({ cardId: "birthday-1", message: "x" }), cards).error); ok("more than 20 cards refused");
const withFree = [...cards, { id: "love-2", title: "Winking kitten", occasion: "Love", price_cents: 0, published: true }];
assert.equal(buildOrder([{ cardId: "love-2", message: "Hi" }], withFree).total, 0); ok("a free card totals 0");
assert.equal(buildOrder([{ cardId: "love-2", message: "Hi" }, { cardId: "birthday-1", message: "Hi" }], withFree).total, 99); ok("a free card next to a paid one only costs the paid one");

const calls = []; const deps = { fulfil: async (...a) => (calls.push(["fulfil", ...a]), "paid"), close: async (...a) => (calls.push(["close", ...a]), "x") };
const ev = (type, o) => ({ type, data: { object: o } });
await handleEvent(ev("checkout.session.completed", { id: "cs_1", payment_status: "unpaid", amount_total: 99, currency: "eur" }), deps);
assert.equal(calls.length, 0); ok("webhook: unpaid 'completed' session (delayed method) is not fulfilled");
await handleEvent(ev("checkout.session.completed", { id: "cs_1", payment_status: "paid", payment_intent: "pi_9", amount_total: 99, currency: "eur" }), deps);
assert.deepEqual(calls.pop(), ["fulfil", "cs_1", "pi_9", 99, "eur"]); ok("webhook: paid session is fulfilled with its amount and currency");
await handleEvent(ev("checkout.session.async_payment_succeeded", { id: "cs_2", payment_status: "paid", amount_total: 99, currency: "eur" }), deps);
assert.equal(calls.pop()[0], "fulfil"); ok("webhook: delayed payment success is fulfilled");
await handleEvent(ev("checkout.session.async_payment_failed", { id: "cs_3" }), deps); assert.deepEqual(calls.pop(), ["close", "cs_3", "failed"]); ok("webhook: delayed payment failure marks the order failed");
await handleEvent(ev("checkout.session.expired", { id: "cs_4" }), deps); assert.deepEqual(calls.pop(), ["close", "cs_4", "expired"]); ok("webhook: abandoned session marks the order expired");
assert.equal(await handleEvent(ev("customer.created", {}), deps), "ignored"); ok("webhook: unrelated events are ignored");
console.log(`${n} logic checks passed`);
