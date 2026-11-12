// Test helpers: pull the pure logic out of the section file and load the demo data.
import { readFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

const NAMES = [
  'parseAnswers',
  'normalizeQuestions',
  'normalizeProducts',
  'firstSentence',
  'formatMoney',
  'hiddenAnswers',
  'prunePicks',
  'toggleMulti',
  'pickStack',
  'profileProperties',
  'discountedTotal',
  'sanitizeState',
  'subscriptionBody',
  'eventBody',
  'eventProperties',
];

// The section keeps its pure functions between these two comment lines inside {% javascript %}.
export function loadLogic() {
  const src = read('sections/product-quiz.liquid');
  const match = src.match(/\/\/ pqz:logic:start([\s\S]*?)\/\/ pqz:logic:end/);
  if (!match) throw new Error('pqz:logic markers not found in sections/product-quiz.liquid');
  return new Function(`${match[1]}\nreturn { ${NAMES.join(', ')} };`)();
}

// Minimal CSV parser: quoted fields may contain commas and doubled quotes; no embedded newlines.
function parseCsvLine(line) {
  const out = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      out.push(field);
      field = '';
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out;
}

// DAYLINE products from demo/products.csv, shaped like the raw config the section renders.
export function readDemoProductsRaw() {
  const [header, ...rows] = read('demo/products.csv').trim().split('\n').map(parseCsvLine);
  const col = (name) => header.indexOf(name);
  return rows.map((r, i) => ({
    id: i + 1,
    title: r[col('Title')],
    url: `/products/${r[col('Handle')]}`,
    image: '',
    price: Math.round(Number(r[col('Variant Price')]) * 100),
    variantId: 1000 + i + 1,
    available: true,
    tags: r[col('Tags')].split(','),
    blurb: r[col('Body (HTML)')].replace(/<[^>]+>/g, ''),
  }));
}

export function readDemoProducts() {
  const { normalizeProducts } = loadLogic();
  return normalizeProducts(readDemoProductsRaw());
}

// Raw questions from demo/page.quiz.json in block_order, shaped like the section's config JSON.
export function readDemoQuestions() {
  const tpl = JSON.parse(read('demo/page.quiz.json'));
  const main = tpl.sections.main;
  return main.block_order.map((id) => {
    const s = main.blocks[id].settings;
    return {
      id,
      heading: s.heading || '',
      subheading: s.subheading || '',
      answers: s.answers || '',
      multi: Boolean(s.multi),
      role: s.role || 'rank',
      weight: s.weight,
      field: s.field || '',
    };
  });
}
