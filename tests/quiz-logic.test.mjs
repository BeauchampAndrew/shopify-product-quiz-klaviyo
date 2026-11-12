import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLogic } from './helpers/load-logic.mjs';

const L = loadLogic();

// Fixture helpers
const q = (id, role, weight, lines, multi = false, field = '') => ({
  id,
  heading: id,
  subheading: '',
  answers: lines.join('\n'),
  multi,
  role,
  weight,
  field,
});
const qs = (...raw) => L.normalizeQuestions(raw);
let nextId = 1;
const p = (tags, extra = {}) => {
  const id = nextId++;
  return {
    id,
    title: `P${id}`,
    url: `/products/p${id}`,
    image: '',
    price: 1000,
    variantId: 100 + id,
    available: true,
    tags,
    blurb: '',
    ...extra,
  };
};
const ids = (stack) => stack.map((s) => s.product.id);
const OPTS = { count: 3, tieTag: 'bestseller' };

// ---- parseAnswers ----

test('parseAnswers splits label and tags, trims, lowercases tags and skips blank lines', () => {
  const text =
    'Energy | goal-energy\n\n  Sleep|Goal-Sleep , timing-night \nNothing else |\nWalmart & Target\nSupplement stores (GNC, Vitamin Shoppe) | ';
  assert.deepEqual(L.parseAnswers(text), [
    { label: 'Energy', tags: ['goal-energy'] },
    { label: 'Sleep', tags: ['goal-sleep', 'timing-night'] },
    { label: 'Nothing else', tags: [] },
    { label: 'Walmart & Target', tags: [] },
    { label: 'Supplement stores (GNC, Vitamin Shoppe)', tags: [] },
  ]);
});

test('parseAnswers handles empty and missing text', () => {
  assert.deepEqual(L.parseAnswers(''), []);
  assert.deepEqual(L.parseAnswers(undefined), []);
});

test('parseAnswers handles Windows line endings', () => {
  assert.deepEqual(L.parseAnswers('A | a\r\nB | b\r\n'), [
    { label: 'A', tags: ['a'] },
    { label: 'B', tags: ['b'] },
  ]);
});

// ---- normalizeQuestions ----

test('normalizeQuestions fills field, role and weight defaults', () => {
  const out = L.normalizeQuestions([
    { id: 'a', heading: 'A', answers: 'X | x', field: ' quiz_goal ', weight: 10 },
    { id: 'b', heading: 'B', answers: 'Y', field: '', role: 'profile', weight: 7 },
    { id: 'c', heading: 'C', answers: 'Z | z', role: 'rank' },
  ]);
  assert.equal(out[0].field, 'quiz_goal');
  assert.equal(out[0].role, 'rank');
  assert.equal(out[0].weight, 10);
  assert.equal(out[1].field, 'quiz_q2');
  assert.equal(out[1].weight, 0);
  assert.equal(out[2].weight, 5);
  assert.deepEqual(out[0].answers, [{ label: 'X', tags: ['x'] }]);
  assert.equal(out[1].multi, false);
  assert.equal(out[1].subheading, '');
});

// ---- normalizeProducts ----

test('normalizeProducts lowercases tags and shortens the blurb to its first sentence', () => {
  const [prod] = L.normalizeProducts([
    { id: 1, title: 'T', url: '/products/t', image: '//cdn/x.png', price: 3900, variantId: 9, available: true, tags: [' Goal-Energy', 'BestSeller '], blurb: 'Steady energy. 30 servings.' },
  ]);
  assert.deepEqual(prod.tags, ['goal-energy', 'bestseller']);
  assert.equal(prod.blurb, 'Steady energy.');
  assert.equal(prod.price, 3900);
});

// ---- firstSentence ----

test('firstSentence returns the first sentence, or the whole text without one', () => {
  assert.equal(L.firstSentence('Orange gummies for the 3pm slump. 60 gummies.'), 'Orange gummies for the 3pm slump.');
  assert.equal(L.firstSentence('No period here'), 'No period here');
  assert.equal(L.firstSentence('  Wow! Second.'), 'Wow!');
  assert.equal(L.firstSentence(''), '');
  assert.equal(L.firstSentence(undefined), '');
});

// ---- formatMoney ----

test('formatMoney follows the shop money format sample', () => {
  assert.equal(L.formatMoney(10200, '$1,234,567.89'), '$102.00');
  assert.equal(L.formatMoney(8670, '€1.234.567,89 EUR'), '€86,70 EUR');
  assert.equal(L.formatMoney(123456, '$1,234,567.89'), '$1,234.56');
  assert.equal(L.formatMoney(500, '¥1,234,568'), '¥5');
});

// ---- toggleMulti ----

test('toggleMulti toggles answers and treats a tagless answer as "none of these"', () => {
  const ans = L.parseAnswers('A | a\nB | b\nNothing else');
  assert.deepEqual(L.toggleMulti(ans, [], 0), [0]);
  assert.deepEqual(L.toggleMulti(ans, [0], 1), [0, 1]);
  assert.deepEqual(L.toggleMulti(ans, [0, 1], 0), [1]);
  assert.deepEqual(L.toggleMulti(ans, [0, 1], 2), [2]);
  assert.deepEqual(L.toggleMulti(ans, [2], 0), [0]);
  assert.deepEqual(L.toggleMulti(ans, [2], 2), []);
});

// ---- hiddenAnswers / prunePicks ----

const goalQs = () =>
  qs(
    q('q1', 'rank', 10, ['Energy | goal-energy', 'Sleep | goal-sleep']),
    q('q2', 'extra', 0, ['Energy | goal-energy', 'Sleep | goal-sleep', 'Nothing else'], true)
  );

test('hiddenAnswers hides extra-question answers already chosen earlier', () => {
  const qq = goalQs();
  assert.deepEqual([...L.hiddenAnswers(qq, { q1: [0] }, 1)], [0]);
  assert.deepEqual([...L.hiddenAnswers(qq, { q1: [0] }, 0)], []);
  assert.deepEqual([...L.hiddenAnswers(qq, {}, 1)], []);
});

test('hiddenAnswers never hides tagless answers', () => {
  const qq = qs(q('q1', 'profile', 0, ['Nope']), q('q2', 'extra', 0, ['Nope', 'A | a'], true));
  assert.deepEqual([...L.hiddenAnswers(qq, { q1: [0] }, 1)], []);
});

test('prunePicks drops picks that are now hidden', () => {
  assert.deepEqual(L.prunePicks(goalQs(), { q1: [1], q2: [1, 0] }), { q1: [1], q2: [0] });
  assert.deepEqual(L.prunePicks(goalQs(), { q1: [0], q2: [2] }), { q1: [0], q2: [2] });
});

// ---- pickStack ----

test('pickStack returns [] when there are no products', () => {
  assert.deepEqual(L.pickStack([], goalQs(), { q1: [0] }, OPTS), []);
});

test('pickStack returns fewer picks when the collection is small, and skips sold-out products', () => {
  const a = p(['goal-energy']);
  const b = p(['goal-sleep']);
  const c = p(['goal-energy'], { available: false });
  const stack = L.pickStack([a, b, c], goalQs(), { q1: [0] }, OPTS);
  assert.deepEqual(ids(stack), [a.id, b.id]);
});

test('pickStack ranks by summed weights, then tie tag, then input order', () => {
  const qq = qs(
    q('goal', 'rank', 10, ['Energy | goal-energy']),
    q('format', 'rank', 4, ['Gummies | format-gummies'])
  );
  const plain = p(['goal-energy']);
  const best = p(['goal-energy'], { tags: ['goal-energy', 'bestseller'] });
  const gummy = p(['goal-energy', 'format-gummies']);
  const other = p(['goal-sleep', 'format-gummies']);
  const stack = L.pickStack([plain, best, gummy, other], qq, { goal: [0], format: [0] }, OPTS);
  assert.deepEqual(ids(stack), [gummy.id, best.id, plain.id]);
});

test('pickStack reserves a spot per extra answer, placed after the top pick', () => {
  const qq = qs(
    q('goal', 'rank', 10, ['Energy | goal-energy', 'Sleep | goal-sleep']),
    q('format', 'rank', 4, ['Gummies | format-gummies']),
    q('also', 'extra', 0, ['Energy | goal-energy', 'Sleep | goal-sleep', 'Calm | goal-calm', 'Nothing else'], true)
  );
  const e1 = p(['goal-energy', 'format-gummies']);
  const e2 = p(['goal-energy']);
  const e3 = p(['goal-energy']);
  const s1 = p(['goal-sleep']);
  const s2 = p(['goal-sleep', 'format-gummies']);
  const c1 = p(['goal-calm']);
  const all = [e1, e2, e3, s1, s2, c1];
  const one = L.pickStack(all, qq, { goal: [0], format: [0], also: [1] }, OPTS);
  assert.deepEqual(ids(one), [e1.id, s2.id, e2.id]);
  const two = L.pickStack(all, qq, { goal: [0], format: [0], also: [2, 1] }, OPTS);
  assert.deepEqual(ids(two), [e1.id, c1.id, s2.id]);
  const none = L.pickStack(all, qq, { goal: [0], format: [0], also: [3] }, OPTS);
  assert.deepEqual(ids(none), [e1.id, e2.id, e3.id]);
});

test('pickStack caps extra picks at count - 1', () => {
  const qq = qs(
    q('goal', 'rank', 10, ['Energy | goal-energy']),
    q('also', 'extra', 0, ['Sleep | goal-sleep', 'Calm | goal-calm', 'Gut | goal-gut'], true)
  );
  const e = p(['goal-energy']);
  const s = p(['goal-sleep']);
  const c = p(['goal-calm']);
  const g = p(['goal-gut']);
  const all = [e, s, c, g];
  assert.deepEqual(ids(L.pickStack(all, qq, { goal: [0], also: [0, 1, 2] }, OPTS)), [e.id, s.id, c.id]);
  assert.deepEqual(ids(L.pickStack(all, qq, { goal: [0], also: [0] }, { count: 1, tieTag: '' })), [e.id]);
});

test('pickStack fills remaining spots with zero-score products as a fallback', () => {
  const qq = qs(q('goal', 'rank', 10, ['Energy | goal-energy']));
  const x = p(['other']);
  const y = p(['other', 'bestseller']);
  const e = p(['goal-energy']);
  assert.deepEqual(ids(L.pickStack([x, y, e], qq, { goal: [0] }, OPTS)), [e.id, y.id, x.id]);
  assert.deepEqual(ids(L.pickStack([x, y], qq, {}, OPTS)), [y.id, x.id]);
});

test('pickStack lists matching chosen answer labels per product, never profile answers', () => {
  const qq = qs(
    q('goal', 'rank', 10, ['Energy | goal-energy']),
    q('format', 'rank', 4, ['Gummies | format-gummies']),
    q('shop', 'profile', 0, ['Amazon | goal-energy'])
  );
  const e = p(['goal-energy', 'format-gummies']);
  const [top] = L.pickStack([e], qq, { goal: [0], format: [0], shop: [0] }, OPTS);
  assert.deepEqual(top.matches, ['Energy', 'Gummies']);
});

// ---- profileProperties ----

test('profileProperties maps single to a label, multi to a list, and omits unanswered', () => {
  const qq = qs(
    q('goal', 'rank', 10, ['Energy | goal-energy', 'Sleep | goal-sleep'], false, 'quiz_goal'),
    q('also', 'extra', 0, ['Energy | goal-energy', 'Sleep | goal-sleep', 'Calm | goal-calm'], true, 'quiz_also'),
    q('shop', 'profile', 0, ['Amazon'], false, '')
  );
  assert.deepEqual(L.profileProperties(qq, { goal: [1], also: [2, 0] }), {
    quiz_goal: 'Sleep',
    quiz_also: ['Calm', 'Energy'],
  });
});

// ---- discountedTotal ----

test('discountedTotal takes the percent off and rounds to the cent', () => {
  assert.equal(L.discountedTotal(10200, 15), 8670);
  assert.equal(L.discountedTotal(3333, 15), 2833);
  assert.equal(L.discountedTotal(10200, 0), 10200);
});

// ---- sanitizeState ----

const qs3 = () => qs(q('q1', 'rank', 1, ['A | a', 'B | b']), q('q2', 'rank', 1, ['C | c']), q('q3', 'profile', 0, ['D']));

test('sanitizeState rejects non-objects and steps outside the quiz', () => {
  assert.equal(L.sanitizeState(qs3(), null), null);
  assert.equal(L.sanitizeState(qs3(), 'x'), null);
  assert.equal(L.sanitizeState(qs3(), { step: 9, picks: {}, claimed: false }), null);
  assert.equal(L.sanitizeState(qs3(), { step: -1, picks: {}, claimed: false }), null);
  assert.equal(L.sanitizeState(qs3(), { step: 1.5, picks: {}, claimed: false }), null);
});

test('sanitizeState drops unknown questions and clamps to the first unanswered question', () => {
  assert.deepEqual(L.sanitizeState(qs3(), { step: 4, picks: { q1: [0], gone: [0] }, claimed: true }), {
    step: 1,
    picks: { q1: [0] },
    claimed: true,
  });
});

test('sanitizeState drops out-of-range answer indexes', () => {
  assert.deepEqual(L.sanitizeState(qs3(), { step: 1, picks: { q1: [7] }, claimed: false }), {
    step: 0,
    picks: {},
    claimed: false,
  });
});

test('sanitizeState keeps a fully answered quiz on results', () => {
  assert.deepEqual(L.sanitizeState(qs3(), { step: 4, picks: { q1: [1], q2: [0], q3: [0] }, claimed: false }), {
    step: 4,
    picks: { q1: [1], q2: [0], q3: [0] },
    claimed: false,
  });
});

// ---- Klaviyo payloads ----

test('subscriptionBody builds the client subscription payload', () => {
  assert.deepEqual(
    L.subscriptionBody({ email: 'a@b.co', listId: 'L1', source: 'Product Quiz', properties: { quiz_goal: 'Energy' } }),
    {
      data: {
        type: 'subscription',
        attributes: {
          custom_source: 'Product Quiz',
          profile: {
            data: {
              type: 'profile',
              attributes: {
                email: 'a@b.co',
                properties: { quiz_goal: 'Energy' },
                subscriptions: { email: { marketing: { consent: 'SUBSCRIBED' } } },
              },
            },
          },
        },
        relationships: { list: { data: { type: 'list', id: 'L1' } } },
      },
    }
  );
});

test('eventBody builds the client event payload', () => {
  assert.deepEqual(
    L.eventBody({
      email: 'a@b.co',
      eventName: 'Completed Product Quiz',
      properties: { x: 1 },
      profileProperties: { quiz_goal: 'Energy' },
      value: 102,
      currency: 'USD',
    }),
    {
      data: {
        type: 'event',
        attributes: {
          properties: { x: 1 },
          metric: { data: { type: 'metric', attributes: { name: 'Completed Product Quiz' } } },
          profile: { data: { type: 'profile', attributes: { email: 'a@b.co', properties: { quiz_goal: 'Energy' } } } },
          value: 102,
          value_currency: 'USD',
        },
      },
    }
  );
});

test('eventProperties carries answers, absolute product links and the code', () => {
  const qq = qs(q('goal', 'rank', 10, ['Energy | goal-energy'], false, 'quiz_goal'));
  const prod = p(['goal-energy'], { title: 'Energy Gummies', url: '/products/energy-gummies', image: '//cdn.shopify.com/x.png', price: 2900 });
  const stack = [{ product: prod, matches: ['Energy'] }];
  assert.deepEqual(
    L.eventProperties({ questions: qq, picks: { goal: [0] }, stack, code: 'QUIZ15', origin: 'https://shop.test' }),
    {
      answers: { quiz_goal: 'Energy' },
      products: [
        { title: 'Energy Gummies', url: 'https://shop.test/products/energy-gummies', image: 'https://cdn.shopify.com/x.png', price: 29 },
      ],
      product_titles: ['Energy Gummies'],
      discount_code: 'QUIZ15',
    }
  );
  assert.equal(L.eventProperties({ questions: qq, picks: {}, stack: [], code: '', origin: 'https://shop.test' }).discount_code, null);
});
