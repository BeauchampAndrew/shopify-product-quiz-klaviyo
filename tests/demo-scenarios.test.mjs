// Runs every answer combination of the demo quiz (demo/page.quiz.json) against the DAYLINE products
// (demo/products.csv) and checks the stack always keeps the shopper's main goal on top.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLogic, readDemoProducts, readDemoQuestions } from './helpers/load-logic.mjs';

const L = loadLogic();
const products = readDemoProducts();
const qs = L.normalizeQuestions(readDemoQuestions());
const byId = Object.fromEntries(qs.map((q) => [q.id, q]));
const OPTS = { count: 3, tieTag: 'bestseller' };

const idx = (qid, label) => {
  const i = byId[qid].answers.findIndex((a) => a.label === label);
  assert.notEqual(i, -1, `${qid} has no answer "${label}"`);
  return i;
};
const handle = (p) => p.url.replace('/products/', '');
const run = (goal, timing, format, also, shop = 'Amazon') => {
  const picks = {
    q_goal: [idx('q_goal', goal)],
    q_timing: [idx('q_timing', timing)],
    q_format: [idx('q_format', format)],
    q_also: also.length ? also.map((g) => idx('q_also', g)) : [idx('q_also', 'Nothing else')],
    q_shop: [idx('q_shop', shop)],
  };
  return { picks, stack: L.pickStack(products, qs, L.prunePicks(qs, picks), OPTS) };
};

const GOALS = { Energy: 'goal-energy', Sleep: 'goal-sleep', Digestion: 'goal-gut', Stress: 'goal-calm' };
const TIMINGS = ['Mornings', 'Afternoon crash', 'At night'];
const FORMATS = { 'Drink mix': 'format-drink-mix', Capsules: 'format-capsules', Gummies: 'format-gummies' };

// Every ordered subset of the other goals is too many; every subset in a fixed tap order is enough.
const subsets = (items) => items.reduce((acc, item) => acc.concat(acc.map((s) => [...s, item])), [[]]);

test('the demo has 12 DAYLINE products and 5 questions', () => {
  assert.equal(products.length, 12);
  assert.deepEqual(
    qs.map((q) => q.field),
    ['quiz_goal', 'quiz_timing', 'quiz_format', 'quiz_also', 'quiz_shop']
  );
});

test('every combination keeps the main goal on top and gives each extra goal a spot', () => {
  let combos = 0;
  for (const [goal, goalTag] of Object.entries(GOALS)) {
    const others = Object.keys(GOALS).filter((g) => g !== goal);
    for (const timing of TIMINGS) {
      for (const [format, formatTag] of Object.entries(FORMATS)) {
        for (const also of subsets(others)) {
          combos++;
          const label = `${goal} / ${timing} / ${format} / [${also.join(', ')}]`;
          const { stack } = run(goal, timing, format, also);
          const tags = stack.map((s) => s.product.tags);
          assert.equal(stack.length, 3, label);
          assert.equal(new Set(stack.map((s) => s.product.id)).size, 3, `${label}: duplicates`);
          assert.ok(tags[0].includes(goalTag) && tags[0].includes(formatTag), `${label}: top pick is ${handle(stack[0].product)}`);
          also.slice(0, 2).forEach((g) => {
            assert.ok(tags.some((t) => t.includes(GOALS[g])), `${label}: no ${g} product`);
          });
          const mainCount = tags.filter((t) => t.includes(goalTag)).length;
          assert.equal(mainCount, 3 - Math.min(also.length, 2), `${label}: ${mainCount} main-goal products`);
          const other = run(goal, timing, format, also, "I don't buy supplements yet").stack;
          assert.deepEqual(other.map((s) => s.product.id), stack.map((s) => s.product.id), `${label}: shop answer changed the stack`);
        }
      }
    }
  }
  assert.equal(combos, 288);
});

test('worked example: Energy, Mornings, Gummies, Nothing else', () => {
  const { stack } = run('Energy', 'Mornings', 'Gummies', []);
  assert.deepEqual(stack.map((s) => handle(s.product)), ['energy-gummies', 'energy-drink-mix', 'energy-capsules']);
});

test('worked example: Energy, Mornings, Gummies, Sleep', () => {
  const { stack } = run('Energy', 'Mornings', 'Gummies', ['Sleep']);
  assert.deepEqual(stack.map((s) => handle(s.product)), ['energy-gummies', 'sleep-gummies', 'energy-drink-mix']);
});

test('worked example: Energy, At night, Capsules, Sleep + Stress', () => {
  const { stack, picks } = run('Energy', 'At night', 'Capsules', ['Sleep', 'Stress']);
  assert.deepEqual(stack.map((s) => handle(s.product)), ['energy-capsules', 'sleep-capsules', 'calm-capsules']);
  assert.deepEqual(L.profileProperties(qs, picks), {
    quiz_goal: 'Energy',
    quiz_timing: 'At night',
    quiz_format: 'Capsules',
    quiz_also: ['Sleep', 'Stress'],
    quiz_shop: 'Amazon',
  });
});

test('Q4 hides the goal already picked in Q1', () => {
  const hidden = L.hiddenAnswers(qs, { q_goal: [idx('q_goal', 'Sleep')] }, 3);
  assert.deepEqual([...hidden], [idx('q_also', 'Sleep')]);
});
