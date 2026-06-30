// ─────────────────────────────────────────────────────────────────────────
// Legal document TEMPLATES.
//
// IMPORTANT: This is starter/placeholder language only. It is NOT legal advice
// and is NOT sufficient for use with real patients. A licensed healthcare
// attorney must review and finalize these before launch. Bracketed items like
// [Clinic Legal Name] are placeholders you must complete.
// ─────────────────────────────────────────────────────────────────────────

export interface LegalSection { heading?: string; paragraphs?: string[]; bullets?: string[]; }
export interface LegalDoc {
  id: string;          // also used as the consent docId
  slug: string;        // URL: /legal/<slug>
  title: string;
  version: string;
  effective: string;
  summary: string;
  sections: LegalSection[];
}

const CLINIC = "Drip Vitals LLC";

export const TELEHEALTH_CONSENT: LegalDoc = {
  id: "telehealth", slug: "telehealth-consent",
  title: "Telehealth Informed Consent", version: "v2.1", effective: "Effective [Date]",
  summary: "Your understanding and agreement to receive medical care remotely (by phone, video, or secure messaging) through this platform.",
  sections: [
    { heading: "1. What telehealth is", paragraphs: [
      `Telehealth is the delivery of healthcare services using secure electronic communications — including video, phone, secure messaging, and online questionnaires — when you and your provider are not in the same physical location. ${CLINIC} ("we," "the Practice") uses telehealth to evaluate whether treatment is appropriate for you, to prescribe when clinically indicated, and to follow your progress over time.`,
    ]},
    { heading: "2. Nature of the service", paragraphs: [
      "Your care may be provided through asynchronous (store-and-forward) review of the health information you submit, and/or through live video or phone visits. A licensed provider will review your information before any prescription is issued. Not every person who completes an intake will qualify for treatment.",
    ]},
    { heading: "3. Benefits and limitations", paragraphs: [
      "Potential benefits of telehealth include improved access to care and convenience. However, telehealth has limitations: your provider cannot physically examine you, and a diagnosis or treatment plan is based on the information you provide and any records available. Incomplete or inaccurate information may affect the care you receive.",
    ], bullets: [
      "A provider may determine that telehealth is not appropriate for your situation and recommend in-person care.",
      "Technical failures may occur and could delay evaluation or treatment.",
      "You are responsible for the accuracy of the information you submit.",
    ]},
    { heading: "4. Prescriptions and medical eligibility", paragraphs: [
      "Submitting an intake or payment does not guarantee that you will be prescribed any medication. A provider licensed in your state will determine medical appropriateness. Prescriptions are issued only when clinically indicated and consistent with applicable law. We do not prescribe controlled substances except where lawful and clinically appropriate.",
    ]},
    { heading: "5. Risks of GLP-1 and related therapies", paragraphs: [
      "If treatment is prescribed, your provider will review the specific risks, benefits, and alternatives with you. Medications in the GLP-1 class may cause side effects including, but not limited to, nausea, vomiting, diarrhea, constipation, and injection-site reactions, and carry warnings you should discuss with your provider. You should seek emergency care for severe or concerning symptoms.",
    ]},
    { heading: "6. Emergencies", paragraphs: [
      "Telehealth is not for emergencies. If you are experiencing a medical emergency, call 911 or go to the nearest emergency room. This platform is not monitored for urgent or emergency messages.",
    ]},
    { heading: "7. Privacy and records", paragraphs: [
      "Information shared during telehealth is protected under applicable privacy laws and our Privacy Policy / Notice of Privacy Practices. Telehealth interactions and the resulting records are maintained as part of your medical record.",
    ]},
    { heading: "8. Your rights and consent", paragraphs: [
      "You may withhold or withdraw consent to telehealth at any time without affecting your right to future care. You have the right to ask questions and to request an in-person referral. By agreeing, you acknowledge that you have read and understood this consent, that your questions have been answered, and that you consent to receive care via telehealth.",
    ]},
  ],
};

export const PRIVACY_POLICY: LegalDoc = {
  id: "privacy", slug: "privacy",
  title: "Privacy Policy & Notice of Privacy Practices", version: "v1.4", effective: "Effective [Date]",
  summary: "How we collect, use, protect, and share your information, including your protected health information (PHI), and your rights regarding it.",
  sections: [
    { heading: "Our commitment", paragraphs: [
      `${CLINIC} is committed to protecting the privacy and security of your information. This notice describes how medical and personal information about you may be used and disclosed and how you can get access to this information. We are required by law to maintain the privacy of your protected health information (PHI) and to provide you with this notice of our legal duties and privacy practices.`,
    ]},
    { heading: "Information we collect", bullets: [
      "Identifiers and contact details (name, date of birth, address, email, phone).",
      "Health information you provide (medical history, symptoms, measurements, medications, allergies).",
      "Payment information necessary to process your order (handled by our payment processor).",
      "Technical and usage data (device, log, and cookie information) when you use our platform.",
    ]},
    { heading: "How we use your information", paragraphs: [
      "We use your information for treatment, payment, and healthcare operations — for example, to evaluate your eligibility, provide care, coordinate with pharmacies and laboratories, process payments, and improve our services. We may use your contact information to send you service, clinical, and account communications.",
    ]},
    { heading: "How we may share your information", bullets: [
      "With licensed providers and clinical staff involved in your care.",
      "With pharmacies and laboratories to fulfill prescriptions and orders.",
      "With service providers (\"business associates\") who support our operations under written agreements requiring them to protect your information.",
      "When required by law, or to prevent a serious threat to health or safety.",
    ]},
    { heading: "Information we do not sell", paragraphs: [
      "We do not sell your protected health information. We do not use your PHI for third-party advertising without your authorization.",
    ]},
    { heading: "Your rights", bullets: [
      "Access and obtain a copy of your records.",
      "Request corrections to your information.",
      "Request restrictions on certain uses and disclosures.",
      "Request confidential communications.",
      "Receive an accounting of certain disclosures.",
      "Receive a paper copy of this notice and file a complaint without retaliation.",
    ]},
    { heading: "Data security and retention", paragraphs: [
      "We use administrative, technical, and physical safeguards designed to protect your information, including encryption in transit. We retain records for the period required by applicable law. No method of transmission or storage is completely secure.",
    ]},
    { heading: "Contact and complaints", paragraphs: [
      "To exercise your rights or ask questions, contact our Privacy Officer at [privacy@clinic-domain]. You may also file a complaint with the U.S. Department of Health and Human Services. We will not retaliate against you for filing a complaint.",
    ]},
  ],
};

export const TERMS_OF_SERVICE: LegalDoc = {
  id: "terms", slug: "terms",
  title: "Terms of Service", version: "v1.0", effective: "Effective [Date]",
  summary: "The rules and terms that govern your use of this platform and the services offered through it.",
  sections: [
    { heading: "1. Acceptance of terms", paragraphs: [
      `By creating an account, completing an intake, or using the services offered by ${CLINIC} ("we," "us"), you agree to these Terms of Service and to our Privacy Policy. If you do not agree, do not use the services.`,
    ]},
    { heading: "2. Eligibility", paragraphs: [
      "You must be at least 18 years old and physically located in a state where we operate to use the services. You agree to provide accurate, current, and complete information and to keep it up to date.",
    ]},
    { heading: "3. Not a substitute for emergency care", paragraphs: [
      "The services do not provide emergency medical care. If you have a medical emergency, call 911 or go to the nearest emergency department.",
    ]},
    { heading: "4. The medical services", paragraphs: [
      "Clinical services are provided by licensed providers who exercise independent professional judgment. Completing an intake or making a payment does not guarantee a prescription or any particular outcome. We may decline to provide services where treatment is not clinically appropriate.",
    ]},
    { heading: "5. Payments, subscriptions, and refunds", bullets: [
      "Prices are shown before checkout. By providing a payment method you authorize charges for the products and services you select.",
      "Subscription plans renew automatically until cancelled in accordance with the plan terms.",
      "Refund eligibility (for example, if you are not approved for treatment) is described at checkout and in our refund policy.",
    ]},
    { heading: "6. Your responsibilities", bullets: [
      "Keep your account credentials confidential.",
      "Use the services only for lawful purposes and only for yourself.",
      "Do not misuse, copy, or attempt to disrupt the platform.",
    ]},
    { heading: "7. Disclaimers and limitation of liability", paragraphs: [
      "Except for the clinical services provided by licensed providers, the platform is provided \"as is\" without warranties of any kind. To the maximum extent permitted by law, our aggregate liability is limited as described in this section. Nothing in these terms limits liability that cannot be limited under applicable law.",
    ]},
    { heading: "8. Changes and termination", paragraphs: [
      "We may update these terms from time to time; material changes will be posted with a new effective date. We may suspend or terminate access for violations of these terms. The governing law and dispute-resolution terms are set out here: [governing law / arbitration provisions to be completed by counsel].",
    ]},
    { heading: "9. Contact", paragraphs: [
      "Questions about these terms may be directed to [support@clinic-domain].",
    ]},
  ],
};

export const GLP1_CONSENT: LegalDoc = {
  id: "glp1", slug: "glp1-informed-consent",
  title: "GLP-1 Treatment Informed Consent", version: "v1.0", effective: "Effective June 30, 2026",
  summary: "Your understanding of the benefits, risks, and alternatives of treatment with a GLP-1 (or GLP-1/GIP) medication such as semaglutide or tirzepatide, including important information about compounded medications.",
  sections: [
    { heading: "1. What this medication is", paragraphs: [
      `Your provider may prescribe a medication in the GLP-1 receptor agonist class (for example, semaglutide) or a combined GIP/GLP-1 receptor agonist (for example, tirzepatide). These medications mimic hormones your body makes to regulate appetite, blood sugar, and digestion. They are prescribed by ${CLINIC} to support weight management when clinically appropriate.`,
    ]},
    { heading: "2. Compounded medication disclosure", paragraphs: [
      "The medication you are prescribed may be a COMPOUNDED preparation prepared by a licensed compounding pharmacy. Compounded medications are NOT approved by the U.S. Food and Drug Administration (FDA). The FDA does not review compounded drugs for safety, effectiveness, or quality before they are marketed. Compounded semaglutide and tirzepatide are not the same as the brand-name products (such as Ozempic, Wegovy, Mounjaro, or Zepbound) and may differ in formulation, strength, inactive ingredients, or salt form.",
    ], bullets: [
      "Compounded medications are permitted to be prepared for an individual patient pursuant to a valid prescription.",
      "The safety and effectiveness data for brand-name products may not fully apply to compounded versions.",
      "You have the right to ask which pharmacy is preparing your medication and to discuss brand-name alternatives with your provider.",
    ]},
    { heading: "3. Intended benefits", paragraphs: [
      "When combined with a reduced-calorie diet and increased physical activity, GLP-1 medications can help reduce appetite and support weight loss. Individual results vary. No specific amount of weight loss — or any weight loss at all — is guaranteed.",
    ]},
    { heading: "4. Common side effects", paragraphs: [
      "Most side effects are gastrointestinal and tend to be greatest when starting or increasing the dose. They include:",
    ], bullets: [
      "Nausea, vomiting, diarrhea, constipation, and abdominal pain",
      "Indigestion, bloating, gas, and acid reflux",
      "Decreased appetite, fatigue, headache, and dizziness",
      "Injection-site reactions (redness, itching, or discomfort)",
    ]},
    { heading: "5. Serious risks and warnings", paragraphs: [
      "Less commonly, GLP-1 medications can cause serious problems. You should review each of the following with your provider and seek care promptly if symptoms occur:",
    ], bullets: [
      "Thyroid C-cell tumors: In animal studies, these medications caused thyroid tumors, including medullary thyroid carcinoma (MTC). They are contraindicated if you or a family member has had MTC or Multiple Endocrine Neoplasia syndrome type 2 (MEN 2). Report any neck mass, hoarseness, trouble swallowing, or shortness of breath.",
      "Pancreatitis (inflammation of the pancreas): Stop the medication and seek care for severe, persistent abdominal pain, with or without vomiting.",
      "Gallbladder disease and gallstones, which may require surgery.",
      "Low blood sugar (hypoglycemia), especially if you also take insulin or a sulfonylurea.",
      "Kidney injury, often related to dehydration from vomiting or diarrhea.",
      "Worsening of diabetic eye disease (retinopathy).",
      "Severe slowing of the stomach (gastroparesis) or, rarely, intestinal blockage (ileus).",
      "Increased risk of food or fluid entering the lungs during surgery or procedures requiring sedation — tell your anesthesia provider you take this medication, as it may need to be paused beforehand.",
      "Serious allergic reactions — seek emergency care for swelling, rash, or difficulty breathing.",
      "Mood changes, depression, or thoughts of self-harm — report these to your provider immediately.",
    ]},
    { heading: "6. Pregnancy, breastfeeding, and contraception", paragraphs: [
      "These medications are not recommended during pregnancy or while breastfeeding and may harm a developing baby. If you can become pregnant, you should use effective contraception. Stop the medication and notify your provider right away if you are or may be pregnant, or are planning pregnancy.",
    ]},
    { heading: "7. Alternatives to treatment", paragraphs: [
      "Alternatives include lifestyle changes alone (nutrition, physical activity, behavioral support), other prescription weight-management medications, FDA-approved brand-name GLP-1 products, surgical options such as bariatric surgery, and choosing no treatment. Your provider can discuss the risks and benefits of these alternatives with you.",
    ]},
    { heading: "8. Your responsibilities", bullets: [
      "Provide complete and accurate information about your health, medications, allergies, and history.",
      "Follow the prescribed dose and titration schedule, and do not share your medication with anyone.",
      "Store and self-administer the medication as instructed; ask for training if you are unsure.",
      "Stay hydrated, follow dietary guidance, and attend follow-up check-ins.",
      "Report side effects, and seek emergency care (call 911) for severe symptoms.",
    ]},
    { heading: "9. Results, discontinuation, and financial terms", paragraphs: [
      "Results are not guaranteed, and weight regain is common after stopping treatment. This is an elective, generally non-insurance service. Because medications are dispensed specifically for you, shipped prescription products are generally non-refundable. Payment and refund terms are described in our Terms of Service.",
    ]},
    { heading: "10. Acknowledgement and consent", paragraphs: [
      "By agreeing, you confirm that you have read and understood this consent; that the benefits, risks, serious warnings, compounded-medication disclosure, and alternatives have been explained; that you have had the opportunity to ask questions; and that you voluntarily consent to treatment with a GLP-1 or GLP-1/GIP medication if your provider determines it is appropriate. You may withdraw your consent at any time before the medication is dispensed.",
    ]},
  ],
};



/** Documents the patient must agree to during intake, in display order. */
export const INTAKE_CONSENTS: LegalDoc[] = [TELEHEALTH_CONSENT, PRIVACY_POLICY, TERMS_OF_SERVICE];

export const LEGAL_DOCS: LegalDoc[] = [TELEHEALTH_CONSENT, PRIVACY_POLICY, TERMS_OF_SERVICE, GLP1_CONSENT];

// Detects whether a treatment / form is GLP-1 (or GLP-1/GIP) based.
export function isGlp1(text: string): boolean {
  return /semaglutide|tirzepatide|glp[\s-]?1|gip|ozempic|wegovy|zepbound|mounjaro|liraglutide|saxenda|retatrutide/i.test(text || "");
}

// The consent set that applies to a given treatment. GLP-1 treatments get the
// GLP-1-specific informed consent in addition to the base three; everything
// else (e.g. NAD+, peptides) gets only the base three.
export function consentsFor(opts: { treatmentName?: string; medication?: string; formName?: string }): LegalDoc[] {
  const hay = `${opts.treatmentName || ""} ${opts.medication || ""} ${opts.formName || ""}`;
  return isGlp1(hay) ? [...INTAKE_CONSENTS, GLP1_CONSENT] : INTAKE_CONSENTS;
}

export const getLegalDoc = (slugOrId: string) =>
  LEGAL_DOCS.find((d) => d.slug === slugOrId || d.id === slugOrId);
