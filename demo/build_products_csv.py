"""Generate a Shopify product import CSV for the quiz demo catalog (fictional supplement brand DAYLINE).

12 products = 4 goals (energy, sleep, gut, calm) x 3 formats (drink mix, capsules, gummies).
Tags carry what the quiz matches on: goal-*, format-* and timing-* (when it's meant to be taken),
so the answer-to-product mapping in the theme editor is easy to set up and to explain on camera.

Images are the packshots from build_product_images.py, uploaded to the store's Content > Files.
Files are served at <store>/cdn/shop/files/<filename>, which is what Image Src points at.
Run: python3 demo/build_products_csv.py [store-domain]  ->  demo/products.csv
"""
import csv
import sys
from pathlib import Path

STORE = sys.argv[1] if len(sys.argv) > 1 else "lookbook-build.myshopify.com"
IMG = f"https://{STORE}/cdn/shop/files/{{}}.png"
VENDOR = "DAYLINE"
PRICES = {"drink-mix": 39.00, "capsules": 34.00, "gummies": 29.00}
TYPES = {"drink-mix": "Drink Mix", "capsules": "Capsules", "gummies": "Gummies"}

# handle, title, timing tags, extra tags, description
PRODUCTS = [
    ("energy-drink-mix", "Energy Drink Mix", "morning", "bestseller",
     "Citrus drink mix with green tea caffeine and B vitamins for steady morning energy, no crash. 30 servings."),
    ("energy-capsules", "Energy Capsules", "morning, afternoon", "",
     "Green tea caffeine, L-theanine and B12 in two capsules. Take them before the afternoon dip. 60 capsules."),
    ("energy-gummies", "Energy Gummies", "afternoon", "",
     "Orange gummies with natural caffeine and B vitamins for a quick lift when the 3pm slump hits. 60 gummies."),
    ("sleep-drink-mix", "Sleep Drink Mix", "night", "bestseller",
     "Tart cherry and magnesium in a warm or cold drink to wind down before bed. 30 servings."),
    ("sleep-capsules", "Sleep Capsules", "night", "",
     "Magnesium glycinate, L-theanine and chamomile to help you fall asleep and stay asleep. Melatonin-free. 60 capsules."),
    ("sleep-gummies", "Sleep Gummies", "night", "",
     "Blackberry gummies with magnesium and lemon balm for the last 30 minutes of your night. Melatonin-free. 60 gummies."),
    ("gut-drink-mix", "Gut Drink Mix", "morning", "bestseller",
     "Prebiotic fiber and ginger in a light lemon drink to keep digestion regular. 30 servings."),
    ("gut-capsules", "Gut Capsules", "morning, afternoon", "",
     "Probiotics and digestive enzymes to take with your biggest meal of the day. 60 capsules."),
    ("gut-gummies", "Gut Gummies", "afternoon, night", "",
     "Ginger and apple cider vinegar gummies for after-meal bloating. 60 gummies."),
    ("calm-drink-mix", "Calm Drink Mix", "afternoon", "",
     "Ashwagandha and L-theanine in a mixed berry drink for busy, wired afternoons. 30 servings."),
    ("calm-capsules", "Calm Capsules", "morning, afternoon", "bestseller",
     "Ashwagandha, rhodiola and magnesium to take the edge off stressful days. 60 capsules."),
    ("calm-gummies", "Calm Gummies", "night", "",
     "Lavender lemon gummies with L-theanine for a calm moment at the end of the day. 60 gummies."),
]

HEADERS = [
    "Handle", "Title", "Body (HTML)", "Vendor", "Type", "Tags", "Published",
    "Option1 Name", "Option1 Value", "Variant SKU", "Variant Grams",
    "Variant Inventory Tracker", "Variant Inventory Qty", "Variant Inventory Policy",
    "Variant Fulfillment Service", "Variant Price", "Variant Compare At Price",
    "Variant Requires Shipping", "Variant Taxable", "Image Src", "Image Position",
    "Image Alt Text", "Status",
]


def rows():
    for handle, title, timing, extra, desc in PRODUCTS:
        goal, fmt = handle.split("-", 1)
        tags = ["dayline", "quiz", f"goal-{goal}", f"format-{fmt}"] + [f"timing-{t.strip()}" for t in timing.split(",")]
        if extra:
            tags.append(extra)
        yield {
            "Handle": handle,
            "Title": title,
            "Body (HTML)": f"<p>{desc}</p>",
            "Vendor": VENDOR,
            "Type": TYPES[fmt],
            "Tags": ", ".join(tags),
            "Published": "TRUE",
            "Option1 Name": "Title",
            "Option1 Value": "Default Title",
            "Variant SKU": f"DL-{handle.upper()}",
            "Variant Grams": 400,
            "Variant Inventory Tracker": "shopify",
            "Variant Inventory Qty": 100,
            "Variant Inventory Policy": "deny",
            "Variant Fulfillment Service": "manual",
            "Variant Price": f"{PRICES[fmt]:.2f}",
            "Variant Compare At Price": "",
            "Variant Requires Shipping": "TRUE",
            "Variant Taxable": "TRUE",
            "Image Src": IMG.format(handle),
            "Image Position": 1,
            "Image Alt Text": f"DAYLINE {title}",
            "Status": "active",
        }


if __name__ == "__main__":
    out = Path(__file__).parent / "products.csv"
    with out.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=HEADERS)
        w.writeheader()
        w.writerows(rows())
    print(f"Wrote {out} ({len(PRODUCTS)} products)")
