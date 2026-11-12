# Product Finder Quiz for Shopify (saves answers to Klaviyo)

A product quiz for any Shopify theme. Shoppers answer a few questions, one per screen, share their email for a discount, and get a "Your stack" page with their top picks and an Add to cart on each. Every answer lands on their Klaviyo profile so you can segment and email them.

It's one file. No app, no monthly fee, and you set up the questions in the theme editor.

**Using Claude Code, Cursor or another AI coding tool?** Point it at this repo and say what you want, like "install this in my theme" or "add a question about budget". [AGENTS.md](AGENTS.md) tells it how everything works and how to change it without breaking it in other themes.

Built with Claude Code on camera for the BS&Co YouTube channel.

## What it does

- **As many questions as you need.** Each question is one block in the theme editor. Add, remove and reorder them.
- **Single or multiple choice.** Single-choice questions move on as soon as the shopper taps. Multiple-choice questions show a Continue button.
- **Progress bar.** "Question 2 of 5" with a bar that fills as they go, plus a Back link.
- **Email step with a discount.** "Share your email & get 15% off", with a Skip link. On submit the shopper joins your Klaviyo list, every answer is saved on their profile, and the discount code goes on their cart automatically.
- **Your stack.** The top picks (3 by default) with a "Matches: Energy · Gummies" line and a one-sentence description, an Add to cart on each, and an Add all button with the total. If they shared their email, the total shows the discounted price.
- **Full page.** The quiz hides your theme's header and footer and fills the screen, with a slim bar on top: your logo (or store name) linking home, and a "Cart (2)" link. Both are settings.
- **Shows the cart.** Every Add to cart opens the theme's cart drawer so shoppers see everything in their cart. Themes without a drawer go to the cart page.
- **Remembers progress** if the shopper reloads or comes back from the cart in the same visit.
- **Made for phones.** Full-width answer buttons, one column of results.
- **Easy to rebrand.** Colors, button shape, border width and uppercase headings in the theme editor. Every word is a setting.

## Before you start

You need:

- A Shopify theme that supports sections on every page ("Online Store 2.0"). Every free Shopify theme since 2021 does, including Horizon and Dawn.
- Products tagged so the answers can find them. For example a sleep product tagged `goal-sleep` and `format-gummies`. Use any tags you like.
- For the email step: a Klaviyo account. You don't need the Klaviyo Shopify app.

**Tip:** install on a copy of your theme first. In **Online Store > Themes**, click **...** next to your theme and choose **Duplicate**.

## Install it

### Step 1: Add the section file

1. Open [`sections/product-quiz.liquid`](sections/product-quiz.liquid) here on GitHub and click **Copy raw file**.
2. In your Shopify admin, go to **Online Store > Themes**. Next to your theme, click **...** then **Edit code**.
3. Find the **Sections** folder and click **Add a new section**. Name it `product-quiz`.
4. Delete everything in the new file, paste what you copied, and click **Save**.

### Step 2: Make a collection of quiz products

**Products > Collections > Create collection.** Set it to add products automatically when the product tag is `quiz` (or pick products by hand). The quiz recommends from this collection, up to 50 products.

### Step 3: Create the discount code (optional)

**Discounts > Create discount > Amount off order.** Percentage 15, code `QUIZ15` (or your own). We use **Limit to one use per customer**.

Make sure the email step's text matches how you set the code up. The default text says "15% off your order". If you limit the code to first-time customers, say so.

### Step 4: Make the page

1. In the theme editor, open the page templates dropdown, click **Create template**, name it `quiz`, and add the **Product quiz** section. It comes with five sample questions.
2. Go to **Online Store > Pages > Add page**, call it "Take the quiz", and pick the `quiz` template.
3. Add it to your menu in **Online Store > Navigation**.

### Step 5: Set it up

Click the **Product quiz** section and fill in:

- **Products to recommend:** the collection from step 2.
- **Klaviyo public API key** and **List ID** (see [Klaviyo](#klaviyo)). Leave them blank to skip the email step.
- **Discount code** and **Discount percent** from step 3.

Then edit the questions (below).

## Writing the questions

Each question block has:

- **Question** and **Subheading.**
- **Answers:** one per line. The text before the `|` is what the shopper sees. After it, the product tags that answer points to, separated by commas. Leave the tags off for answers that don't pick products.
  ```
  Energy | goal-energy
  Digestion | goal-gut
  Afternoon crash | timing-afternoon
  Nothing else
  ```
- **Let shoppers pick more than one.** Turns on multiple choice. An answer with no tags (like "Nothing else") clears the others when tapped.
- **What the answer does:**
  - **Ranks products.** Every product with a matching tag gets points equal to the question's **Importance**. Products are ranked by total points.
  - **Adds a pick for each answer.** Each answer the shopper picks gets its own spot in the stack: the best-ranked product with that answer's tag. Answers they already chose in an earlier question are hidden.
  - **Saved to Klaviyo only.** Doesn't change the products. Use it for things like "Where do you usually shop?"
- **Klaviyo field name:** the profile field the answer is saved to, like `quiz_goal`.

### How the picks work

The top pick is always the best match for the "Ranks products" questions. Extra picks come next, then the next-best matches. Ties go to products tagged with the **Tie-break tag** (default `bestseller`).

Give your most important question a big Importance. In the demo, the goal question is 10, format is 4 and time of day is 2, so the goal always decides the product line:

| Answers | Your stack |
|---|---|
| Energy, Mornings, Gummies, Nothing else | Energy Gummies, Energy Drink Mix, Energy Capsules |
| Energy, Mornings, Gummies, also Sleep | Energy Gummies, Sleep Gummies, Energy Drink Mix |
| Energy, At night, Capsules, also Sleep and Stress | Energy Capsules, Sleep Capsules, Calm Capsules |

## Klaviyo

1. In Klaviyo, go to **Settings > Account > API keys** and copy your **Public API Key / Site ID** (6 characters). Never paste a private key into the theme.
2. Create a list (we call it "Quiz") and copy its **List ID** from the list's settings.
3. **Check the list's opt-in setting.** With double opt-in, shoppers only join the list after clicking a confirmation email. With single opt-in they join right away.

When a shopper submits their email, the quiz:

- subscribes them to the list (source "Product Quiz")
- saves every answer on their profile, plus `quiz_completed_at`. Multiple-choice answers are saved as a list, so a segment like "quiz_also contains Sleep" works.
- sends a **Completed Product Quiz** event with their answers, the recommended products (title, URL, image, price) and the discount code

Use the event to trigger a flow that emails them their recommendations. In the email, loop over `event.products` to show each product.

Shoppers who skip the email step send nothing to Klaviyo.

## Change the words

Every word is a setting under **Text and translations**: the progress text ("Question [current] of [total]"), the email step, the results heading, the buttons and the error messages. Words in [brackets] are filled in for you.

## Works with your theme

| Theme | After Add to cart |
|---|---|
| Horizon and the 2025 themes built on it | Cart drawer opens |
| Dawn and Dawn-based themes (Refresh, Sense, Craft, Studio...) | Cart drawer opens if the theme's cart type is Drawer |
| Everything else | Goes to the cart page |

## Troubleshooting

- **No products on the results page:** the collection isn't set, is empty, or none of its products have the tags in your answers.
- **The email step doesn't show:** fill in both the Klaviyo public key and the List ID.
- **Shoppers aren't on the list:** the list is probably double opt-in. They join after confirming.
- **The code isn't applied at checkout:** check it's active, typed the same in the section, and not blocked by an automatic discount that doesn't combine. A one-use code won't apply twice for the same customer.

## Limits

- Up to 50 products in the collection and 50 questions.
- Products with options (sizes, flavors) add their first available variant.

## Try the demo

[`demo/`](demo) has the fictional supplement brand DAYLINE we built the video with: 12 products (4 goals × 3 formats), a CSV for **Products > Import**, the packshots, and [`demo/page.quiz.json`](demo/page.quiz.json), the 5-question quiz template. Fill in your own Klaviyo key and list ID after you install it.

## Install with Shopify CLI

```
cp sections/product-quiz.liquid <your-theme>/sections/
cp demo/page.quiz.json <your-theme>/templates/
shopify theme push --unpublished --theme "With product quiz"
```

## License

MIT. Use it on your store or your clients' stores, change it, ship it.
