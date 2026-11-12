# Agent guide: Product Finder Quiz for Shopify

Instructions for AI coding agents (Claude Code, Cursor, Codex, etc.) installing, rebranding or extending this section. Humans should start with [README.md](README.md).

## What this is

A single Shopify theme section, `sections/product-quiz.liquid`, that renders a product quiz:

1. **Questions** (blocks of type `question`), one per screen, with a progress bar. Single-select advances on tap; multi-select has a Continue button.
2. **Email step** (only when the Klaviyo public key and list ID are set): subscribes the shopper to a Klaviyo list, saves every answer on their profile, sends a "Completed Product Quiz" event, and (when `offer_discount` is on) applies the discount code to the cart.
3. **Results ("Your stack")**: the top picks from one collection, each with a "Matches:" line, a one-sentence blurb and Add to cart, plus Add all with the total. Every add opens the theme's cart drawer (or the cart page).

It drops into **any** Online Store 2.0 theme with no other changes. The discount is a normal Shopify code the merchant creates in admin. The section never creates discounts and only ever uses Klaviyo's **public** key.

```
sections/product-quiz.liquid       The product. Markup, CSS, JS and schema in one file.
tests/quiz-logic.test.mjs          Unit tests for the pure logic in the section's JS
tests/demo-scenarios.test.mjs      Runs every answer combination of the demo quiz against the demo products
tests/helpers/load-logic.mjs       Pulls the logic out of the section file; loads the demo data
demo/page.quiz.json                The 5-question demo template (Klaviyo key and list left blank on purpose)
demo/build_product_images.py       Draws the 12 DAYLINE packshots (Pillow) into demo/product-images/
demo/build_products_csv.py         Writes demo/products.csv for Products > Import
docs/superpowers/                  Design doc and build plan
```

## Installing into a theme

Ask the human for: the store, which theme (always an unpublished copy first), the questions and answers, which tags their products use, the Klaviyo public key and list ID, and the discount code.

1. **Copy the section** into the theme's `sections/` folder, unchanged.
2. **Collection (human does this in admin):** a collection of the products to recommend, usually a smart collection on a tag like `quiz`. Shopify CLI can't create collections.
3. **Discount code (human does this in admin, only if they offer one):** `offer_discount` is off by default. When it's off, Liquid renders an empty `data-discount-code`, `data-second-chance="false"` and the `*_plain` email copy, so the JS never applies a code or promises one. For the demo, **Amount off order**, 15%, one use per customer. Any code type works; the section only applies it and shows `discount_percent` off the stack total. The CLI can't create discounts.
4. **Page template:** copy `demo/page.quiz.json` to `templates/page.quiz.json` and edit the blocks. `collection` takes a collection **handle**. Fill in `klaviyo_public_key` and `klaviyo_list_id` in the theme's copy only; never commit a client's key to this repo.
5. **Push to an unpublished theme:** `shopify theme push --unpublished --theme "With product quiz"`, or `--only sections/product-quiz.liquid --only templates/page.quiz.json` against an existing theme ID. Ask the human before touching the live theme (`--allow-live`).
6. **The human creates the page** with the `quiz` template. The template dropdown only lists templates from the **published** theme; to preview before that, open any page with `?view=quiz&preview_theme_id=<theme id>`.
7. **Klaviyo list opt-in:** check the list. Double opt-in means profiles only join after confirming by email. Profile fields and the event land either way.
8. Run the [checks](#before-you-hand-back).

## Hard rules when changing the section

These keep it portable. Breaking one usually works in the theme you're testing and fails in every other theme.

1. **Stay one file.** CSS in `{% stylesheet %}`, JS in `{% javascript %}`. No new files in `assets/` or `snippets/`. Those two blocks can't contain Liquid; pass values in through CSS variables or `data-` attributes on `<product-quiz>`.
2. **No theme dependencies for core behavior.** No theme classes, CSS variables or JS. Theme hooks are optional extras, feature-detected, like the branches in `openThemeCart()` and `notifyTheme()`. **Full page** (`full_page`, on by default) hides the header and footer with `body:has(.pqz--fullpage)` on Shopify's own section-group classes (`.shopify-section-group-header-group`, `-footer-group`) plus the classic `#shopify-section-header/footer/announcement-bar` IDs. That only works when the theme renders its cart drawer outside those groups (Horizon and Dawn do, in `layout/theme.liquid`). If a theme keeps its drawer inside the header section, turn `full_page` off or render the drawer elsewhere. The bar's cart link opens the drawer via `hasThemeCart()` / `openThemeCart()` and falls back to the cart page.
3. **Prefix everything.** Classes `pqz__*` (BEM) and modifiers `pqz--*`. Data attributes `data-pqz-*`. CSS variables `--pqz-*`. Custom element `<product-quiz>`. Events `product-quiz:*`. Every rule is scoped under `.pqz`.
4. **Size text in `em`.** Themes set different root sizes. Use `px` only for borders, hit targets and gaps.
5. **Colors come from settings** (`--pqz-*`). Don't hard-code colors except neutral overlays and the error red.
6. **Every shopper-facing string is a setting** under "Text and translations", passed as `data-label-*` and read with `this.t('camelCaseKey', { placeholder: value })`. Placeholders use `[brackets]`.
7. **Render text with `textContent`,** never `innerHTML`. Question, answer and product text come from merchants and products.
8. **Guard the element definition:** `if (customElements.get('product-quiz')) return;`.
9. **Keep the logic pure.** Everything between `// pqz:logic:start` and `// pqz:logic:end` is plain functions with no DOM or network access. Tests load that region straight from the file. New decision logic goes there, with a test.
10. **Never block the shopper on the network.** `claim()` shows results first, then calls Klaviyo and the discount in the background. Failures are `console.warn('[product-quiz] ...')`, never an error screen.
11. **Klaviyo public key only.** Client endpoints `https://a.klaviyo.com/client/subscriptions` and `/client/events` with `?company_id=<public key>` and `revision: 2026-10-15`. Never add a private key.

## How it works

### Data shapes

```text
Answer    = { label, tags[] }                       // tags lowercased
Question  = { id, heading, subheading, multi, role: 'rank'|'extra'|'profile', weight, field, answers[] }
Product   = { id, title, url, image, price (cents), variantId, available, tags[], blurb }
Picks     = { [questionId]: answerIndex[] }          // tap order
State     = { step, picks, claimed }                 // step 0..n-1 questions, n email, n+1 results
StackItem = { product, matches[] }
```

Liquid renders a JSON config in `<script type="application/json" data-pqz-config>`: each question's raw answer text, and the collection's products (first 50). JS parses it with `normalizeQuestions()` and `normalizeProducts()` and renders every screen.

### Picking the stack (`pickStack`)

1. Score each available product: for every chosen answer in a **rank** question, add the question's `weight` if the product has any of the answer's tags.
2. Sort by score, then the tie-break tag, then collection order.
3. The top product is pick #1.
4. Each chosen answer with tags in an **extra** question (in tap order, at most `count - 1`) reserves a spot: the best-ranked unused product with one of its tags.
5. Fill the rest from the ranking. Zero-score products fill in as a fallback.

`hiddenAnswers()` hides extra-question answers whose tags match an answer chosen earlier; `prunePicks()` drops those picks before scoring. **profile** questions never affect products.

### State

`this.state` is saved to sessionStorage under `pqz:<section id>:<path>` after every change. `restore()` runs `sanitizeState()`, which drops unknown questions and out-of-range answers and moves the shopper back to the first unanswered question, so editing the quiz in the theme editor never strands a shopper. Every action changes state and calls `render()`, which redraws the current screen.

### JavaScript (`ProductQuiz`)

| Method | Job |
|---|---|
| `connectedCallback` | Read config, restore state, wire click/submit/`shopify:block:select`/`pageshow`, render |
| `go(step)` / `next()` / `back()` / `retake()` | Navigation. `next()` from the last question goes to the email step when `emailEnabled`, else results |
| `answer(index)` | Single-select: save, show pressed, advance after 200ms (ignores taps meanwhile). Multi-select: `toggleMulti` |
| `render` / `renderQuestion` / `renderEmail` / `renderResults` | Draw the current screen |
| `onBlockSelect` | Theme editor: selecting a question block shows that question |
| `emailForm(id, buttonText)` | Builds the email form used by the email step and the results box. Any `form[data-pqz-email-form]` goes through `onSubmit` |
| `secondChance()` | The "Still want 15% off?" box on results, shown when `!claimed`, `emailEnabled` and `second_chance` is on. Its form carries `data-pqz-second` |
| `onSubmit` / `claim(email, { stay })` | Validate the email, show results, then `sendToKlaviyo` and `linkDiscount` + `applyCode`. `stay` (from the results box) redraws in place and focuses the discount line instead of jumping to the top |
| `sendToKlaviyo(email)` | POST subscription (profile properties included), then the event. Dispatches `product-quiz:completed` |
| `linkDiscount()` | GET `/discount/<code>?redirect=/cart.js` so Shopify's checkout cookie carries the code |
| `applyCode()` | Add the code to the cart's codes via `/cart/update.js`, keeping other codes. Runs on claim and on every add |
| `addToCart(items, button)` | Standard `shopify:cart:lines-update` event, `/cart/add.js`, re-apply code, refresh theme, open the drawer or go to the cart |
| `notifyTheme` / `openThemeCart` | Theme integration, below |

### Klaviyo data

On submit: the profile gets one property per question (`field` setting; single = string, multi = list) plus `quiz_completed_at`, and joins the list with `custom_source` "Product Quiz". The event (`klaviyo_event`, default "Completed Product Quiz") carries `answers`, `products` (title, absolute url, absolute image, price in dollars), `product_titles` and `discount_code`, with `value` = stack total. A recommendations flow triggers on the event and loops over `event.products`.

## Theme integration

| Theme family | After add | How |
|---|---|---|
| **Horizon** (and the 2025 themes built on it) | Drawer opens | Standard `shopify:cart:lines-update` event, then `theme-drawer#cart-drawer`.`open()`. Tested on the demo store |
| **Dawn** family | Drawer opens | `cart-drawer`.`renderContents()` with the drawer's own sections. Written against Dawn's source, not yet run on a live Dawn store |
| **Everything else** | Cart page | `openThemeCart()` returns false and the shopper goes to `routes.cart_url` |

To support another theme's drawer, find what its product form does after adding to cart (search its `assets/` for `cart/add`, `cart:refresh`, `renderContents`, `CartDrawer`), add a feature-detected branch to `openThemeCart()` that returns `true`, and add a row here and in the README.

## Common changes

- **New question:** a new `question` block. No code change.
- **New setting:** add it to `{% schema %}`, pass it as a `--pqz-*` variable (CSS) or `data-*` attribute (JS).
- **Branching questions** (a different next question per answer): add a `next` value to the answer line format in `parseAnswers()`, test it, and use it in `next()`.
- **Answer images:** extend the answer line (e.g. `Label | tags | image-url`) in `parseAnswers()` and render an `<img>` in `renderQuestion()`.
- **Variant pickers on result cards:** render the variants in the config, add a `<select>` to the card, and swap `data-variant-id`.

## Before you hand back

1. **Tests pass:** `node --test tests/`
2. **Schema is valid JSON:**
   ```bash
   python3 -c "import re,json;s=open('sections/product-quiz.liquid').read();json.loads(re.search(r'{% schema %}(.*?){% endschema %}',s,re.S).group(1));print('ok')"
   ```
3. **JS parses:**
   ```bash
   python3 -c "import re,os;s=open('sections/product-quiz.liquid').read();open(os.environ.get('TMPDIR','/tmp')+'/pqz.js','w').write(re.search(r'{% javascript %}(.*?){% endjavascript %}',s,re.S).group(1))" && node --check "${TMPDIR:-/tmp}/pqz.js"
   ```
4. **Theme check** inside a full theme: `shopify theme check`, looking only at `product-quiz` files.
5. **Push succeeds** without schema errors.
6. **Manual test on a dev store,** desktop and phone width: every question, the multi-select "Nothing else", Back, reload mid-quiz, the email step (invalid, valid, Skip), the Klaviyo profile fields, list membership and event, Add to cart and Add all (drawer opens, code applied in `/cart.js`), Retake.
7. **Keep the docs in sync:** README.md for merchants, this file for agents.
