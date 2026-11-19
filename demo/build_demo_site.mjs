// Builds the public demo page: the real section, rendered with the DAYLINE demo quiz and products.
//   node demo/build_demo_site.mjs [outDir]   (default _site)
// The markup, CSS and JS come straight from sections/product-quiz.liquid, so the demo always matches the code.
// Shopify and Klaviyo are faked in the browser: a pretend cart (with a cart drawer) and a Klaviyo stand-in
// that shows what would be saved instead of sending it. Nothing leaves the page.
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const outDir = process.argv[2] || '_site';
const REPO_URL = 'https://github.com/BeauchampAndrew/shopify-product-quiz-klaviyo';

// ---- the section ----
const liquid = read('sections/product-quiz.liquid');
const grab = (tag) => {
  const m = liquid.match(new RegExp(`\\{% ${tag} %\\}([\\s\\S]*?)\\{% end${tag} %\\}`));
  if (!m) throw new Error(`{% ${tag} %} block not found in the section`);
  return m[1];
};
const css = grab('stylesheet');
const js = grab('javascript');
const schema = JSON.parse(grab('schema'));

// Settings as Shopify would have them: schema defaults, then the demo template's values.
const template = JSON.parse(read('demo/page.quiz.json'));
const main = template.sections.main;
const s = {};
for (const x of schema.settings) if (x.id) s[x.id] = x.default ?? null;
Object.assign(s, main.settings);
// The demo template leaves Klaviyo blank on purpose; any value turns the email step on, and the fetch shim catches the calls.
s.klaviyo_public_key = 'DEMO00';
s.klaviyo_list_id = 'DEMO00';

const blockDefaults = {};
for (const x of schema.blocks[0].settings) if (x.id) blockDefaults[x.id] = x.default ?? null;
const questions = main.block_order.map((id) => {
  const b = { ...blockDefaults, ...main.blocks[id].settings };
  return {
    id,
    heading: b.heading ?? null,
    subheading: b.subheading ?? null,
    answers: b.answers ?? null,
    multi: Boolean(b.multi),
    role: b.role ?? null,
    weight: b.weight ?? 0,
    field: b.field ?? null,
  };
});

// ---- the products (demo/products.csv, the same file merchants import) ----
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
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      out.push(field);
      field = '';
    } else field += ch;
  }
  out.push(field);
  return out;
}
const [header, ...rows] = read('demo/products.csv').trim().split('\n').map(parseCsvLine);
const col = (name) => header.indexOf(name);
const stripHtml = (h) => h.replace(/<[^>]+>/g, '').replace(/\s*\n\s*/g, '').trim();
const products = rows
  .map((r, i) => ({
    id: 9000 + i + 1,
    title: r[col('Title')],
    url: `#${r[col('Handle')]}`,
    image: `product-images/${r[col('Handle')]}.png`,
    price: Math.round(Number(r[col('Variant Price')]) * 100),
    variantId: 1000 + i + 1,
    available: true,
    tags: r[col('Tags')].split(',').map((t) => t.trim()),
    blurb: stripHtml(r[col('Body (HTML)')]).slice(0, 400),
  }))
  // The template's collection is a smart collection on the `quiz` tag.
  .filter((p) => p.tags.includes(main.settings.collection || 'quiz'));

// ---- render the markup the way the Liquid does ----
const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
const btnRadius = { pill: '999px', rounded: '10px' }[s.button_shape] || '0px';
const shopName = 'DAYLINE';
const label = (on, off) => (s.offer_discount ? s[on] : s[off]);
const attrs = {
  class: `pqz${s.uppercase_headings ? ' pqz--upper' : ''}${s.full_page ? ' pqz--fullpage' : ''}`,
  'data-section-id': 'demo-quiz',
  style: `--pqz-bg: ${s.color_bg}; --pqz-ink: ${s.color_ink}; --pqz-accent: ${s.color_accent}; --pqz-btn-fg: ${s.color_button_text}; --pqz-btn-radius: ${btnRadius}; --pqz-border: ${s.border_width}px; --pqz-max-width: ${s.max_width}em; --pqz-pad-top: ${s.padding_top}px; --pqz-pad-bottom: ${s.padding_bottom}px;`,
  'data-money-sample': '$1,234,567.89',
  'data-currency': 'USD',
  'data-root-url': './',
  'data-cart-url': '/cart',
  'data-cart-add-url': '/cart/add',
  'data-cart-update-url': '/cart/update',
  'data-picks': s.picks,
  'data-tie-tag': String(s.tie_tag || '').trim(),
  'data-klaviyo-key': s.klaviyo_public_key,
  'data-klaviyo-list': s.klaviyo_list_id,
  'data-klaviyo-source': s.klaviyo_source,
  'data-klaviyo-event': s.klaviyo_event,
  'data-discount-code': s.offer_discount ? String(s.discount_code || '').trim() : '',
  'data-discount-percent': s.discount_percent,
  'data-label-intro-heading': s.intro_heading,
  'data-label-intro-text': s.intro_text,
  'data-label-progress': s.label_progress,
  'data-label-back': s.label_back,
  'data-label-continue': s.label_continue,
  'data-label-email-heading': label('email_heading', 'email_heading_plain'),
  'data-label-email-text': label('email_text', 'email_text_plain'),
  'data-label-email-placeholder': s.email_placeholder,
  'data-label-email-button': label('email_button', 'email_button_plain'),
  'data-label-email-skip': s.email_skip,
  'data-label-email-invalid': s.email_invalid,
  'data-second-chance': s.offer_discount && s.second_chance ? 'true' : 'false',
  'data-label-second-heading': s.second_heading,
  'data-label-second-text': s.second_text,
  'data-label-second-button': s.second_button,
  'data-label-results-heading': s.results_heading,
  'data-label-results-intro': s.results_intro,
  'data-label-matches': s.label_matches,
  'data-label-add': s.label_add,
  'data-label-adding': s.label_adding,
  'data-label-added': s.label_added,
  'data-label-add-all': s.label_add_all,
  'data-label-total': s.label_total,
  'data-label-discount': s.label_discount,
  'data-label-retake': s.label_retake,
  'data-label-error': s.label_error,
  'data-label-empty': s.label_empty,
};
const attrHtml = Object.entries(attrs)
  .map(([k, v]) => `  ${k}="${esc(v)}"`)
  .join('\n');
const bar =
  s.full_page && s.show_bar
    ? `<div class="pqz__bar"><a class="pqz__brand" href="./">${esc(shopName)}</a><a class="pqz__cart-link" href="/cart" data-pqz-cart-link>${esc(s.label_cart)} (<span data-pqz-cart-count>0</span>)</a></div>`
    : '';
const config = JSON.stringify({ questions, products }, null, 2).replace(/<\//g, '<\\/');

const quizHtml = `<product-quiz
${attrHtml}
>
  ${bar}
  <div class="pqz__inner">
    <div class="pqz__stage" data-pqz-stage></div>
    <noscript><p class="pqz__empty">${esc(s.label_empty)}</p></noscript>
  </div>
  <script type="application/json" data-pqz-config>
${config}
  </script>
</product-quiz>`;

// ---- demo-only pieces: the banner, a cart drawer, and the Klaviyo stand-in ----
const demoCss = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body { background: ${s.color_bg}; color: ${s.color_ink}; font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; }
  .demo-banner { display: flex; flex-wrap: wrap; gap: 4px 16px; align-items: center; justify-content: center; padding: 10px 16px; background: #222; color: #fff; font-size: 14px; text-align: center; }
  .demo-banner a { color: #fff; font-weight: 600; }
  .demo-klaviyo { max-width: 46em; margin: 0 auto; padding: 32px 16px 64px; }
  .demo-klaviyo[hidden] { display: none; }
  .demo-klaviyo h2 { font-size: 1.25em; margin: 0 0 4px; }
  .demo-klaviyo p { margin: 0 0 16px; color: #555; }
  .demo-klaviyo table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #ddd; font-size: 14px; }
  .demo-klaviyo th, .demo-klaviyo td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #eee; vertical-align: top; }
  .demo-klaviyo th { width: 40%; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 500; color: #333; overflow-wrap: anywhere; }
  .demo-klaviyo td { overflow-wrap: anywhere; }
  .demo-jump { position: fixed; right: 16px; bottom: 16px; z-index: 20; padding: 10px 18px; border: 0; border-radius: 999px; background: #222; color: #fff; font: inherit; font-size: 14px; cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,.2); }
  .demo-jump[hidden] { display: none; }
  theme-drawer { position: fixed; inset: 0; z-index: 30; display: none; }
  theme-drawer[open] { display: block; }
  .demo-cart__scrim { position: absolute; inset: 0; background: rgba(0,0,0,.35); }
  .demo-cart__panel { position: absolute; top: 0; right: 0; bottom: 0; width: min(420px, 100%); background: #fff; display: flex; flex-direction: column; box-shadow: -8px 0 24px rgba(0,0,0,.15); }
  .demo-cart__head { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #eee; font-weight: 700; }
  .demo-cart__close { border: 0; background: none; font-size: 28px; line-height: 1; cursor: pointer; padding: 4px 8px; }
  .demo-cart__items { flex: 1; overflow: auto; padding: 8px 20px; }
  .demo-cart__item { display: grid; grid-template-columns: 64px 1fr auto; gap: 12px; align-items: center; padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-size: 15px; }
  .demo-cart__item img { width: 64px; height: 64px; object-fit: cover; background: #f4f3f1; }
  .demo-cart__qty { color: #666; font-size: 13px; }
  .demo-cart__foot { padding: 16px 20px; border-top: 1px solid #eee; font-size: 15px; }
  .demo-cart__row { display: flex; justify-content: space-between; margin-bottom: 6px; }
  .demo-cart__row--total { font-weight: 700; font-size: 17px; margin-top: 4px; }
  .demo-cart__save { color: #1e7a3c; }
  .demo-cart__checkout { width: 100%; margin-top: 12px; padding: 14px; border: 0; background: #ccc; color: #555; font: inherit; font-weight: 600; cursor: not-allowed; }
  .demo-cart__note { margin: 8px 0 0; font-size: 13px; color: #666; text-align: center; }
  .demo-cart__empty { color: #666; padding: 24px 0; }
`;

const demoJs = `
(() => {
  const PRODUCTS = ${JSON.stringify(products.map(({ variantId, title, price, image }) => ({ variantId, title, price, image })))};
  const DISCOUNT_PERCENT = ${Number(s.discount_percent) || 0};
  const byVariant = new Map(PRODUCTS.map((p) => [p.variantId, p]));
  const cart = { lines: [], codes: [] };
  const money = (cents) => '$' + (cents / 100).toFixed(2);

  function cartJson() {
    const items = cart.lines.map((l) => {
      const p = byVariant.get(l.id);
      return { key: 'demo:' + l.id, id: l.id, title: p.title, image: p.image, quantity: l.quantity, price: p.price, final_line_price: p.price * l.quantity };
    });
    const item_count = items.reduce((n, i) => n + i.quantity, 0);
    const subtotal = items.reduce((n, i) => n + i.final_line_price, 0);
    const discount_codes = cart.codes.map((code) => ({ code, applicable: item_count > 0 }));
    const off = item_count > 0 && cart.codes.length ? Math.round((subtotal * DISCOUNT_PERCENT) / 100) : 0;
    return { token: 'demo', currency: 'USD', items, item_count, items_subtotal_price: subtotal, total_discount: off, total_price: subtotal - off, discount_codes };
  }
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  // Stand-ins for Shopify's cart endpoints and Klaviyo's client API. Anything else goes to the real network.
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    const body = init.body ? JSON.parse(init.body) : null;
    if (url.hostname === 'a.klaviyo.com') {
      klaviyoCalls.push({ path: url.pathname.replace('/client/', ''), body });
      return new Response('', { status: 202 });
    }
    const path = url.pathname;
    if (path.endsWith('/cart/add.js')) {
      for (const { id, quantity } of body.items) {
        const line = cart.lines.find((l) => l.id === Number(id));
        if (line) line.quantity += quantity;
        else cart.lines.push({ id: Number(id), quantity });
      }
      return json({ items: body.items, sections: {} });
    }
    if (path.endsWith('/cart/update.js')) {
      if (body && typeof body.discount === 'string') cart.codes = body.discount.split(',').map((c) => c.trim()).filter(Boolean);
      return json(cartJson());
    }
    if (path.endsWith('/cart.js')) return json(cartJson());
    if (path.includes('/discount/')) {
      const code = decodeURIComponent(path.split('/discount/')[1] || '');
      if (code && !cart.codes.includes(code)) cart.codes.push(code);
      return json(cartJson());
    }
    return realFetch(input, init);
  };

  // A cart drawer shaped like Horizon's <theme-drawer id="cart-drawer">, which the quiz opens after every add.
  class DemoCartDrawer extends HTMLElement {
    get isOpen() { return this.hasAttribute('open'); }
    open() { this.render(); this.setAttribute('open', ''); }
    close() { this.removeAttribute('open'); }
    connectedCallback() {
      this.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) this.close(); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.close(); });
    }
    render() {
      const c = cartJson();
      const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
      this.replaceChildren();
      const scrim = el('div', 'demo-cart__scrim'); scrim.dataset.close = '';
      const panel = el('div', 'demo-cart__panel');
      panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Cart');
      const head = el('div', 'demo-cart__head', 'Your cart (' + c.item_count + ')');
      const x = el('button', 'demo-cart__close', '×'); x.type = 'button'; x.dataset.close = ''; x.setAttribute('aria-label', 'Close cart');
      head.append(x);
      const list = el('div', 'demo-cart__items');
      if (!c.items.length) list.append(el('p', 'demo-cart__empty', 'Your cart is empty.'));
      for (const i of c.items) {
        const row = el('div', 'demo-cart__item');
        const img = el('img'); img.src = i.image; img.alt = '';
        const name = el('div'); name.append(el('div', null, i.title), el('div', 'demo-cart__qty', 'Qty ' + i.quantity));
        row.append(img, name, el('div', null, money(i.final_line_price)));
        list.append(row);
      }
      const foot = el('div', 'demo-cart__foot');
      const line = (a, b, cls) => { const r = el('div', 'demo-cart__row' + (cls ? ' ' + cls : '')); r.append(el('span', null, a), el('span', null, b)); return r; };
      foot.append(line('Subtotal', money(c.items_subtotal_price)));
      if (c.total_discount) foot.append(line('Discount (' + c.discount_codes.map((d) => d.code).join(', ') + ')', '−' + money(c.total_discount), 'demo-cart__save'));
      foot.append(line('Total', money(c.total_price), 'demo-cart__row--total'));
      const checkout = el('button', 'demo-cart__checkout', 'Checkout'); checkout.type = 'button'; checkout.disabled = true;
      foot.append(checkout, el('p', 'demo-cart__note', 'Demo store: checkout is turned off.'));
      panel.append(head, list, foot);
      this.append(scrim, panel);
    }
  }
  customElements.define('theme-drawer', DemoCartDrawer);

  // Show what the quiz would have sent to Klaviyo, under the quiz.
  const klaviyoCalls = [];
  document.addEventListener('product-quiz:completed', () => {
    const panel = document.querySelector('[data-demo-klaviyo]');
    const sub = klaviyoCalls.find((c) => c.path === 'subscriptions');
    const evt = klaviyoCalls.find((c) => c.path === 'events');
    const props = sub?.body?.data?.attributes?.profile?.data?.attributes?.properties || {};
    const eventName = evt?.body?.data?.attributes?.metric?.data?.attributes?.name;
    const value = evt?.body?.data?.attributes?.value;
    const rows = [];
    if (eventName) rows.push(['Event', eventName + (value != null ? ' (value ' + money(Math.round(value * 100)) + ')' : '')]);
    for (const [k, v] of Object.entries(props)) rows.push([k, Array.isArray(v) ? v.join(', ') : String(v)]);
    const tbody = panel.querySelector('tbody');
    tbody.replaceChildren(...rows.map(([k, v]) => { const tr = document.createElement('tr'); const th = document.createElement('th'); th.textContent = k; const td = document.createElement('td'); td.textContent = v; tr.append(th, td); return tr; }));
    panel.hidden = false;
    const jump = document.querySelector('[data-demo-jump]');
    jump.hidden = false;
    jump.onclick = () => { panel.scrollIntoView({ behavior: 'smooth' }); jump.hidden = true; };
    new IntersectionObserver((entries, obs) => { if (entries.some((e) => e.isIntersecting)) { jump.hidden = true; obs.disconnect(); } }).observe(panel);
  });
  document.addEventListener('click', (e) => { if (e.target.closest('[data-pqz-retake]')) { document.querySelector('[data-demo-klaviyo]').hidden = true; document.querySelector('[data-demo-jump]').hidden = true; klaviyoCalls.length = 0; } });
})();
`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Product Quiz Demo</title>
<meta name="description" content="Live demo of a free Shopify product finder quiz that saves every answer to Klaviyo. One section file, no app.">
<style>${demoCss}</style>
<style>${css}</style>
</head>
<body>
<div class="demo-banner">
  <span>Demo of a free Shopify product quiz (fictional brand). Nothing you enter is saved or sent.</span>
  <a href="${REPO_URL}">Get the code on GitHub</a>
</div>
${quizHtml}
<section class="demo-klaviyo" data-demo-klaviyo hidden>
  <h2>What Klaviyo gets</h2>
  <p>In a real store, the email step adds the shopper to your list and saves these on their Klaviyo profile, so every flow after it can use their answers. In this demo nothing was sent.</p>
  <table><tbody></tbody></table>
</section>
<button type="button" class="demo-jump" data-demo-jump hidden>See what Klaviyo gets ↓</button>
<theme-drawer id="cart-drawer"></theme-drawer>
<script>${demoJs}</script>
<script>${js}</script>
</body>
</html>
`;

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'index.html'), html);
cpSync(new URL('demo/product-images/', root), join(outDir, 'product-images'), { recursive: true });
console.log(`Built ${join(outDir, 'index.html')}: ${questions.length} questions, ${products.length} products`);
