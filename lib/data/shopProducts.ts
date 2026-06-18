import type { ShopProduct } from "@/lib/types";

/* Seed catalog for the patient-portal Shop. Mirrors the live storefront 1:1.
   `clicks` are trailing-30-day Get Started clicks and drive the Top Performer
   KPI. Every product carries hand-authored longDesc / benefits / safety copy;
   FAQs fall back to the auto-generated defaults in the product detail view. */
export const SHOP_PRODUCTS: ShopProduct[] = [
  {
    id: "SHOP-001", name: "Compounded Semaglutide", cat: "weight", tag: "WEIGHT LOSS · RX",
    desc: "GLP-1 weekly injection for sustainable weight loss.",
    longDesc: "A once-weekly GLP-1 injection that curbs appetite and slows gastric emptying, helping you lose weight steadily without crash dieting.",
    price: 199, firstMonth: 99, img: "💉", cls: "green", url: "/intake-form/glp-1-medication", published: true, sort: 1, clicks: 128,
    benefits: ["Average 15–20% body-weight reduction in trials", "Once-weekly self-administered injection", "Dose titrated by your provider", "Free, discreet shipping every month"],
    safety: "Not for use with a personal or family history of medullary thyroid carcinoma or MEN 2. Tell your provider about pancreatitis, gallbladder disease, or pregnancy.",
  },
  {
    id: "SHOP-002", name: "Compounded Tirzepatide", cat: "weight", tag: "WEIGHT LOSS · RX",
    desc: "Dual GIP/GLP-1 injection — the most effective option.",
    longDesc: "A dual GIP and GLP-1 receptor agonist — the most effective compounded option we offer for appetite control and metabolic weight loss.",
    price: 297, firstMonth: 149, img: "💉", cls: "purple", url: "/intake-form/glp-1-medication", published: true, sort: 2, clicks: 142,
    benefits: ["Dual-agonist mechanism for maximum results", "Once-weekly injection", "Personalized titration schedule", "Cancel or adjust anytime"],
    safety: "Not for use with a personal or family history of medullary thyroid carcinoma or MEN 2. Discuss any history of pancreatitis or gallbladder disease with your provider.",
  },
  {
    id: "SHOP-003", name: "Oral Semaglutide", cat: "weight", tag: "WEIGHT LOSS · RX",
    desc: "Daily oral GLP-1 tablets — no needles needed.",
    longDesc: "A once-daily oral GLP-1 that helps curb appetite and support steady weight loss — no needles, no injections.",
    price: 149, firstMonth: 99, img: "💊", cls: "green", url: "/intake-form/glp-1-medication", published: true, sort: 3, clicks: 64,
    benefits: ["Needle-free daily tablet", "Appetite control backed by GLP-1 science", "Provider-personalized dosing", "Free, discreet monthly shipping"],
    safety: "Not for use with a personal or family history of medullary thyroid carcinoma or MEN 2. Tell your provider about pancreatitis, gallbladder disease, or pregnancy.",
  },
  {
    id: "SHOP-004", name: "Oral Tirzepatide", cat: "weight", tag: "WEIGHT LOSS · RX",
    desc: "Daily oral dual-agonist tablets for weight loss.",
    longDesc: "A once-daily oral dual GIP/GLP-1 tablet for appetite control and metabolic weight loss — a needle-free option for eligible clients.",
    price: 189, firstMonth: 99, img: "💊", cls: "purple", url: "/intake-form/glp-1-medication", published: true, sort: 4, clicks: 57,
    benefits: ["Dual-agonist appetite control, no needles", "Once-daily tablet", "Personalized titration by your provider", "Cancel or adjust anytime"],
    safety: "Not for use with a personal or family history of medullary thyroid carcinoma or MEN 2. Discuss pancreatitis, gallbladder disease, or pregnancy with your provider.",
  },
  {
    id: "SHOP-005", name: "Ozempic®", cat: "weight", tag: "WEIGHT LOSS · RX",
    desc: "Brand-name semaglutide injection for weight management.",
    longDesc: "Brand-name semaglutide, prescribed and managed by a licensed provider as part of a personalized weight-management plan.",
    price: 899, firstMonth: 899, img: "💉", cls: "blue", url: "/intake-form/glp-1-medication", published: true, sort: 5, clicks: 38,
    benefits: ["FDA-approved branded semaglutide", "Once-weekly injection", "Provider-guided dosing & monitoring", "Discreet delivery to your door"],
    safety: "Carries a boxed warning regarding thyroid C-cell tumors; not for use with a personal or family history of medullary thyroid carcinoma or MEN 2. Discuss pancreatitis, gallbladder disease, or pregnancy with your provider.",
  },
  {
    id: "SHOP-006", name: "Wegovy®", cat: "weight", tag: "WEIGHT LOSS · RX",
    desc: "Brand-name semaglutide for chronic weight management.",
    longDesc: "Brand-name semaglutide indicated for chronic weight management, prescribed and monitored by a licensed provider.",
    price: 1349, firstMonth: 1349, img: "💉", cls: "blue", url: "/intake-form/glp-1-medication", published: true, sort: 6, clicks: 29,
    benefits: ["FDA-approved for chronic weight management", "Once-weekly injection", "Structured dose escalation", "Ongoing provider support"],
    safety: "Carries a boxed warning regarding thyroid C-cell tumors; not for use with a personal or family history of medullary thyroid carcinoma or MEN 2. Tell your provider about pancreatitis, gallbladder disease, or pregnancy.",
  },
  {
    id: "SHOP-007", name: "Mounjaro®", cat: "weight", tag: "WEIGHT LOSS · RX",
    desc: "Brand-name tirzepatide for type 2 diabetes & weight loss.",
    longDesc: "Brand-name tirzepatide, a dual GIP/GLP-1 agonist prescribed and managed by a licensed provider.",
    price: 1023, firstMonth: 1023, img: "💉", cls: "amber", url: "/intake-form/glp-1-medication", published: true, sort: 7, clicks: 26,
    benefits: ["FDA-approved branded tirzepatide", "Dual-agonist mechanism", "Once-weekly injection", "Provider-guided dosing"],
    safety: "Carries a boxed warning regarding thyroid C-cell tumors; not for use with a personal or family history of medullary thyroid carcinoma or MEN 2. Discuss pancreatitis or gallbladder disease with your provider.",
  },
  {
    id: "SHOP-008", name: "Zepbound®", cat: "weight", tag: "WEIGHT LOSS · RX",
    desc: "Brand-name tirzepatide for chronic weight management.",
    longDesc: "Brand-name tirzepatide indicated for chronic weight management, prescribed and monitored by a licensed provider.",
    price: 1085, firstMonth: 1085, img: "💉", cls: "amber", url: "/intake-form/glp-1-medication", published: true, sort: 8, clicks: 31,
    benefits: ["FDA-approved for chronic weight management", "Dual GIP/GLP-1 mechanism", "Once-weekly injection", "Ongoing provider support"],
    safety: "Carries a boxed warning regarding thyroid C-cell tumors; not for use with a personal or family history of medullary thyroid carcinoma or MEN 2. Tell your provider about pancreatitis, gallbladder disease, or pregnancy.",
  },
  {
    id: "SHOP-009", name: "NAD+ Nasal Spray", cat: "anti-aging", tag: "ANTI AGING · RX",
    desc: "Fuel cellular energy, sharpen focus, and support healthy aging.",
    longDesc: "Needle-free intranasal NAD+ to support cellular energy, mental clarity, and healthy aging as part of your daily routine.",
    price: 199, firstMonth: 99, img: "💨", cls: "purple", url: "/intake-form/nad-topical-nasal", published: true, sort: 9, clicks: 41,
    benefits: ["Supports cellular energy & focus", "Needle-free daily spray", "Discreet, convenient routine", "Free shipping to your door"],
    safety: "Tell your provider about pregnancy, nursing, or any allergy to NAD+. This is a wellness therapy and is not a substitute for care from your primary provider.",
  },
  {
    id: "SHOP-010", name: "NAD+ Injection", cat: "anti-aging", tag: "ANTI AGING · RX",
    desc: "Direct NAD+ delivery for maximum cellular regeneration.",
    longDesc: "Subcutaneous NAD+ for direct cellular delivery — supporting energy, recovery, and healthy aging.",
    price: 249, firstMonth: 99, img: "💉", cls: "purple", url: "/intake-form/nad-wellness", published: true, sort: 10, clicks: 47,
    benefits: ["Direct cellular NAD+ delivery", "Supports energy & recovery", "Provider-guided protocol", "Cold-chain shipping included"],
    safety: "Tell your provider about kidney or liver disease, pregnancy, nursing, or any allergy to NAD+. May cause flushing or injection-site reactions.",
  },
  {
    id: "SHOP-011", name: "Sermorelin ODT", cat: "anti-aging", tag: "ANTI AGING · RX",
    desc: "Growth hormone stimulator — oral disintegrating tablets.",
    longDesc: "A growth-hormone-releasing peptide in a convenient oral disintegrating tablet to support sleep, recovery, and vitality.",
    price: 129, firstMonth: 99, img: "💊", cls: "silver", url: "/intake-form/sermorelin-therapy", published: true, sort: 11, clicks: 22,
    benefits: ["Supports sleep, recovery & vitality", "Convenient dissolvable tablet — no needles", "Stimulates your body's own growth hormone", "Provider-personalized protocol"],
    safety: "Not for use with active cancer or in pregnancy. Tell your provider about thyroid, diabetes, or pituitary conditions.",
  },
  {
    id: "SHOP-012", name: "Sermorelin Injection", cat: "anti-aging", tag: "ANTI AGING · RX",
    desc: "Daily growth hormone peptide for sleep, recovery, vitality.",
    longDesc: "A nightly sermorelin (GHRH) injection to support sleep quality, recovery, energy, and healthy aging.",
    price: 179, firstMonth: 99, img: "💉", cls: "silver", url: "/intake-form/sermorelin-therapy", published: true, sort: 12, clicks: 25,
    benefits: ["Supports deeper sleep & recovery", "Stimulates natural growth hormone release", "Nightly subcutaneous dose", "Cold-chain shipping included"],
    safety: "Not for use with active cancer or in pregnancy. Tell your provider about thyroid, diabetes, or pituitary conditions.",
  },
  {
    id: "SHOP-013", name: "Finasteride", cat: "hair", tag: "HAIR · RX",
    desc: "Daily oral tablet to slow and reverse hair loss.",
    longDesc: "A daily tablet that targets the hormone behind male-pattern hair loss to help slow shedding and support regrowth.",
    price: 29, firstMonth: 19, img: "💊", cls: "blue", url: "/intake-form/hair-loss-treatment", published: true, sort: 13, clicks: 73,
    benefits: ["Targets the root cause of male-pattern loss", "Simple once-daily tablet", "Clinically studied results", "Discreet monthly delivery"],
    safety: "Not for use by anyone who is or may become pregnant — finasteride can cause birth defects. Possible sexual side effects; discuss with your provider.",
  },
  {
    id: "SHOP-014", name: "Topical Minoxidil", cat: "hair", tag: "HAIR · RX",
    desc: "Promote regrowth with proven topical treatment.",
    longDesc: "A proven topical that revitalizes follicles and promotes thicker, fuller regrowth when applied daily.",
    price: 39, firstMonth: 19, img: "💧", cls: "amber", url: "/intake-form/hair-loss-treatment", published: true, sort: 14, clicks: 55,
    benefits: ["Stimulates dormant follicles", "Easy daily topical application", "Works for crown & hairline", "Discreet delivery"],
    safety: "For external scalp use only. May cause scalp irritation or dryness. Tell your provider about any heart condition.",
  },
  {
    id: "SHOP-015", name: "Hair Growth Formula", cat: "hair", tag: "HAIR · RX",
    desc: "Custom-compounded topical with minoxidil + finasteride.",
    longDesc: "A custom-compounded topical combining minoxidil, finasteride, and ketoconazole for an all-in-one daily hair routine.",
    price: 69, firstMonth: 39, img: "💧", cls: "green", url: "/intake-form/hair-loss-treatment", published: false, sort: 15, clicks: 0,
    benefits: ["Three actives in one application", "Targets multiple causes of hair loss", "Compounded for your needs", "Once-daily topical"],
    safety: "Not for use by anyone who is or may become pregnant — contains finasteride, which can cause birth defects. May cause scalp irritation.",
  },
  {
    id: "SHOP-016", name: "Sildenafil", cat: "sexual", tag: "SEXUAL HEALTH · RX",
    desc: "Generic ED treatment — 50-100mg as needed.",
    longDesc: "The active ingredient in Viagra® — an as-needed tablet for reliable erectile support, prescribed after a quick online visit.",
    price: 5, firstMonth: 5, img: "💊", cls: "blue", url: "/intake-form/ed-treatment", published: true, sort: 16, clicks: 88,
    benefits: ["Works in 30–60 minutes", "As-needed dosing", "Generic & affordable", "Discreet packaging"],
    safety: "Do not combine with nitrates. Tell your provider about heart conditions or blood-pressure medications. Seek care for an erection lasting more than 4 hours.",
  },
  {
    id: "SHOP-017", name: "Tadalafil", cat: "sexual", tag: "SEXUAL HEALTH · RX",
    desc: "Daily or as-needed ED treatment with longer duration.",
    longDesc: "The active ingredient in Cialis® — taken daily or as needed, with up to 36 hours of effect.",
    price: 6, firstMonth: 6, img: "💊", cls: "amber", url: "/intake-form/ed-treatment", published: true, sort: 17, clicks: 79,
    benefits: ["Up to 36 hours of effect", "Daily or as-needed options", "Generic & affordable", "Discreet packaging"],
    safety: "Do not combine with nitrates. Tell your provider about heart conditions or blood-pressure medications. Seek care for an erection lasting more than 4 hours.",
  },
  {
    id: "SHOP-018", name: "Tretinoin", cat: "skin", tag: "SKIN · RX",
    desc: "Prescription retinoid for anti-aging and acne.",
    longDesc: "A prescription retinoid that accelerates cell turnover to smooth fine lines, even skin tone, and clear acne.",
    price: 45, firstMonth: 29, img: "🧴", cls: "amber", url: "/intake-form/skin-treatment", published: true, sort: 18, clicks: 34,
    benefits: ["Reduces fine lines & wrinkles", "Improves tone & texture", "Helps clear and prevent acne", "Provider-personalized strength"],
    safety: "Not for use in pregnancy. Increases sun sensitivity — use sunscreen daily. May cause initial dryness or peeling.",
  },
  {
    id: "SHOP-019", name: "Custom Skin Formula", cat: "skin", tag: "SKIN · RX",
    desc: "Personalized topical blend for your skin concerns.",
    longDesc: "A personalized topical blend formulated by your provider to target your specific skin concerns, from aging to pigmentation.",
    price: 79, firstMonth: 49, img: "🧴", cls: "purple", url: "/intake-form/skin-treatment", published: false, sort: 19, clicks: 0,
    benefits: ["Formulated for your skin goals", "Multiple actives in one bottle", "Provider-personalized", "Discreet delivery"],
    safety: "Not for use in pregnancy if it contains a retinoid. Increases sun sensitivity — use sunscreen daily. Tell your provider about allergies and current skincare.",
  },
];

export const SHOP_CATEGORY_LABEL: Record<ShopProduct["cat"], string> = {
  weight: "Weight Loss",
  "anti-aging": "Anti Aging",
  hair: "Hair Growth",
  sexual: "Sexual Health",
  skin: "Skin",
};

// Default benefit bullets / FAQs applied to products that don't define their
// own — kept identical to the patient-portal fallbacks so the editor preview
// matches what patients actually see.
export const DEFAULT_BENEFITS: string[] = [
  "Personalized by a licensed provider",
  "Discreet, free shipping to your door",
  "Adjustments at any time",
  "Cancel anytime",
];

export const DEFAULT_FAQS = [
  {
    q: "How does it work?",
    a: "Complete a quick online intake. A licensed provider reviews and approves your treatment within 24 hours.",
  },
  {
    q: "Will my insurance cover it?",
    a: "Our pricing is cash-pay and includes everything — no insurance required.",
  },
];

export const SHOP_THUMB_OPTIONS = ["💉", "💊", "🧴", "💧", "🩹", "🧪"] as const;
export const SHOP_COLOR_OPTIONS = ["purple", "green", "silver", "blue", "amber"] as const;

// Thumbnail gradient styles, shared by the table rows, editor preview, and swatches.
export const SHOP_THUMB_STYLE: Record<ShopProduct["cls"], { background: string; color: string }> = {
  purple: { background: "linear-gradient(135deg, #e8dfee, #cbb4dd)", color: "#6b4ea8" },
  green: { background: "linear-gradient(135deg, #d7eedd, #b1d8b8)", color: "#2e7d54" },
  silver: { background: "linear-gradient(135deg, #e8e8e8, #c8c8c8)", color: "#6b6b6b" },
  blue: { background: "linear-gradient(135deg, #d4e4f0, #b8d2e5)", color: "#3a7ab0" },
  amber: { background: "linear-gradient(135deg, #f7e5cc, #e8c9a1)", color: "#b86e1e" },
};
