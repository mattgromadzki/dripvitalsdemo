import type { BaskTreatment, BaskIntakeForm, BaskClient, BaskRule, BaskFormSettings, BaskFormNotifications } from "@/lib/types/treatmentsIntake";

// Default rules — first applied to the GLP-1 form. Other forms can have empty
// rule lists or admin can add via the Logic tab.
export const SEED_HARD_RULES: BaskRule[] = [
  { id: "h1",  icon: "🦋", title: "Medullary Thyroid Carcinoma (MTC) or MEN2",         desc: "GLP-1 agonists carry a black box warning for thyroid C-cell tumors. Any personal or family history is an absolute contraindication.", active: true },
  { id: "h2",  icon: "🔥", title: "History of Pancreatitis",                            desc: "Active or prior acute/chronic pancreatitis is a contraindication for all GLP-1 medications.", active: true },
  { id: "h3",  icon: "🤰", title: "Currently Pregnant or Breastfeeding",                desc: "GLP-1 agonists have not been studied in pregnancy. All pregnant or nursing patients are auto-disqualified.", active: true },
  { id: "h4",  icon: "👶", title: "Under 18 Years of Age",                              desc: "GLP-1 treatment is approved for adults only. Patients under 18 are automatically denied.", active: true },
  { id: "h5",  icon: "🫃", title: "Gastroparesis / Severe GI Motility Disorder",        desc: "GLP-1 agents slow gastric emptying, worsening gastroparesis. Hard contraindication.", active: true },
  { id: "h6",  icon: "💉", title: "Currently on Sulfonylureas",                          desc: "High risk of severe hypoglycemia when combined with GLP-1 agonists.", active: true },
  { id: "h7",  icon: "🔄", title: "Currently on Another GLP-1 Agonist",                  desc: "Combining GLP-1 agents (e.g. Ozempic + Semaglutide) is contraindicated.", active: true },
  { id: "h8",  icon: "🚫", title: "Currently on DPP-4 Inhibitors (Sitagliptin)",         desc: "DPP-4 inhibitors and GLP-1 agonists work on overlapping mechanisms.", active: true },
];
export const SEED_DRUG_RULES: BaskRule[] = [
  { id: "d1", icon: "⚡", title: "Sulfonylureas",                desc: "Glipizide, Glyburide, Glimepiride — severe hypoglycemia risk",                   level: "disq",   active: true },
  { id: "d2", icon: "🔄", title: "DPP-4 Inhibitors",             desc: "Sitagliptin, Saxagliptin, Linagliptin — overlapping mechanism",                level: "disq",   active: true },
  { id: "d3", icon: "💉", title: "Existing GLP-1 Agonists",      desc: "Ozempic, Victoza, Byetta, Trulicity — cannot combine agents",                   level: "disq",   active: true },
  { id: "d4", icon: "🧪", title: "Cyclosporine",                  desc: "Immunosuppressant — significant PK interaction",                                level: "disq",   active: true },
  { id: "d5", icon: "⚖️", title: "Insulin",                       desc: "Any insulin type — increased hypoglycemia risk, requires provider management", level: "review", active: true },
  { id: "d6", icon: "🩸", title: "Warfarin / Blood Thinners",     desc: "GLP-1 slows absorption; may affect anticoagulation levels — monitor INR",       level: "review", active: true },
  { id: "d7", icon: "💊", title: "Oral Contraceptives",           desc: "Gastric emptying delay may reduce OCP absorption — recommend barrier backup",   level: "review", active: true },
  { id: "d8", icon: "🩺", title: "Metformin",                     desc: "No significant interaction — often co-prescribed; compatible",                  level: "ok",     active: true },
];
export const SEED_REVIEW_RULES: BaskRule[] = [
  { id: "r1", icon: "💉", title: "Patient Takes Insulin",                  desc: "GLP-1 + insulin requires dose reduction protocol. Provider must review.", active: true },
  { id: "r2", icon: "🫀", title: "Cardiovascular History (> 3 months ago)", desc: "Stable CAD, prior MI, or heart failure > 3 mo ago — review required.",   active: true },
  { id: "r3", icon: "🩺", title: "Diabetic Retinopathy",                    desc: "Rapid glycemic control with GLP-1 can worsen retinopathy acutely.",       active: true },
  { id: "r4", icon: "🧠", title: "History of Major Depressive Disorder",    desc: "Monitor for mood changes. Provider discretion required.",                 active: true },
  { id: "r5", icon: "🤱", title: "Planning Pregnancy Within 12 Months",      desc: "GLP-1 should be stopped 2 mo before conception. Requires counseling.",   active: true },
];

const DEFAULT_SETTINGS: BaskFormSettings = {
  applies: "All GLP-1 Treatments",
  autoMode: "ai_review",
  submissionLimitPerPatient: "Unlimited",
  autoCloseAfter: "Off",
  strictValidation: true,
};
const DEFAULT_NOTIFICATIONS: BaskFormNotifications = {
  qualifyEmail: "dr.rivera@dripvitals.health",
  disqualifyEmail: "admin@dripvitals.health",
  reviewEmail: "providers@dripvitals.health",
  patientConfirmationEnabled: true,
};

export const SEED_TREATMENTS: BaskTreatment[] = [
  { id:1, name:"1-Month Semaglutide Treatment", med:"Semaglutide", strength:"0.5mg/dose", duration:"1", billing:"monthly", price:"$189", compare:"$249", desc:"Month-to-month GLP-1 weight management program. Compounded semaglutide delivered to your door.", icon:"💉", color:"brand", active:true, compounded:true, featured:true, subscribers:84, includes:["Semaglutide 0.5mg/dose (4 units)","Async physician visit + monitoring","Free shipping via Partner Network"], pharmacy:"Partner Network FL", freq:"Once weekly" },
  { id:2, name:"3-Month Semaglutide Treatment", med:"Semaglutide", strength:"0.5–1.0mg", duration:"3", billing:"quarterly", price:"$499", compare:"$747", desc:"Quarterly bundle with dose escalation from 0.5mg to 1.0mg. Best value for committed weight management.", icon:"💉", color:"brand", active:true, compounded:true, featured:false, subscribers:142, includes:["Semaglutide with dose escalation protocol","3 physician visits included","Priority shipping","Progress check-ins & coaching"], pharmacy:"Partner Network FL", freq:"Once weekly" },
  { id:3, name:"1-Month Tirzepatide Treatment", med:"Tirzepatide", strength:"5mg/dose", duration:"1", billing:"monthly", price:"$298", compare:"$389", desc:"Monthly dual GIP/GLP-1 treatment. Tirzepatide offers superior weight loss for eligible clients.", icon:"🧬", color:"purple", active:true, compounded:true, featured:false, subscribers:56, includes:["Tirzepatide 5mg (4 units)","Async physician consultation","Medication delivered to door"], pharmacy:"Partner Network FL", freq:"Once weekly" },
  { id:4, name:"3-Month Tirzepatide Treatment", med:"Tirzepatide", strength:"5–10mg", duration:"3", billing:"quarterly", price:"$799", compare:"$1,167", desc:"Quarterly tirzepatide program with structured escalation. Billed quarterly for maximum savings.", icon:"🧬", color:"purple", active:true, compounded:true, featured:true, subscribers:98, includes:["Tirzepatide with escalation 5mg → 10mg","3 quarterly physician visits","Lab monitoring (A1C, lipids)","Nutrition coaching module"], pharmacy:"Partner Network FL", freq:"Once weekly" },
  { id:5, name:"6-Month Tirzepatide Treatment", med:"Tirzepatide", strength:"5–15mg", duration:"6", billing:"semi-annual", price:"$1,499", compare:"$2,100", desc:"Best-value 6-month program with full escalation to 15mg. Includes comprehensive lab panel and coaching.", icon:"🧬", color:"pink", active:true, compounded:true, featured:true, subscribers:67, includes:["Tirzepatide full escalation protocol","6 physician visits included","Full lab panel (A1C, lipids, CMP)","Dedicated care coordinator","Nutrition & lifestyle coaching"], pharmacy:"Partner Network FL", freq:"Once weekly" },
  { id:6, name:"1-Month NAD+ Injections", med:"NAD+", strength:"100mg/mL", duration:"1", billing:"monthly", price:"$249", compare:"", desc:"Monthly NAD+ injection program for cellular energy, cognitive function, and metabolic health.", icon:"⚡", color:"amber", active:true, compounded:true, featured:false, subscribers:38, includes:["NAD+ 100mg/mL (8 vials)","Injection training guide","Physician consultation","Cold-chain shipping included"], pharmacy:"Partner Network FL", freq:"Twice weekly" },
  { id:7, name:"3-Month NAD+ Injections", med:"NAD+", strength:"100mg/mL", duration:"3", billing:"quarterly", price:"$649", compare:"$747", desc:"Quarterly NAD+ program with loading dose protocol. Ideal for sustained cellular health benefits.", icon:"⚡", color:"amber", active:true, compounded:true, featured:false, subscribers:29, includes:["NAD+ 100mg/mL (24 vials)","Loading dose protocol weeks 1–2","Quarterly physician check-in","Metabolic panel included","Priority cold-chain shipping"], pharmacy:"Partner Network FL", freq:"Twice weekly" },
  { id:8, name:"12-Month Semaglutide Program", med:"Semaglutide", strength:"0.25–2.0mg", duration:"12", billing:"monthly", price:"$149", compare:"$189", desc:"Annual commitment program with the best per-month pricing. Full escalation protocol to maximum dose.", icon:"💪", color:"teal", active:true, compounded:true, featured:false, subscribers:44, includes:["Full-year semaglutide supply","Monthly physician visits","Quarterly labs included","Unlimited messaging","Body composition tracking"], pharmacy:"Partner Network FL", freq:"Once weekly" },
  { id:9, name:"3-Month Metformin + Lifestyle", med:"Metformin", strength:"500–1000mg", duration:"3", billing:"quarterly", price:"$129", compare:"$180", desc:"Metformin starter program combined with structured lifestyle coaching for blood sugar management.", icon:"🌿", color:"brand", active:false, compounded:false, featured:false, subscribers:12, includes:["Metformin 500mg BID (90-day supply)","Lifestyle coaching curriculum","Glucose tracking integration","Monthly check-in visit"], pharmacy:"CVS", freq:"Twice daily" },
];

export const SEED_FORMS: BaskIntakeForm[] = [
  {
    id: 1, name: "GLP-1 Medication Intake", slug: "glp-1-medication",
    desc: "Primary intake form for weight-management clients seeking semaglutide or tirzepatide.",
    active: true, treatmentIds: [1,2,3,4,5,8], submissions: 284, qualified: 198,
    hardRules: SEED_HARD_RULES, drugRules: SEED_DRUG_RULES, reviewRules: SEED_REVIEW_RULES,
    settings: DEFAULT_SETTINGS, notifications: DEFAULT_NOTIFICATIONS,
    questions: [
      // Engagement first — matches the Figma flow ("What's your weight loss goal?")
      { id:110, type:"section",  text:"Goals", helper:"", sectionIcon:"💪", impact:"none", required:false },
      { id:111, type:"multiple", text:"What's your weight loss goal?", helper:"This helps us match you with the right treatment", impact:"none", required:true, options:["Up to 20 lbs","21 to 50 lbs","50+ lbs","Not sure yet"] },
      { id:112, type:"multiple", text:"What are you hoping to improve by losing weight?", helper:"", impact:"none", required:true, options:["My physical health","My appearance","My mental health","All of the above"] },
      { id:115, type:"yesno",    text:"Have you taken a GLP-1 medication in the past 2 months?", helper:"Examples: Ozempic, Wegovy, Zepbound, or Mounjaro", impact:"none", required:true },

      // Physical screening
      { id:116, type:"section",  text:"Physical", helper:"", sectionIcon:"📏", impact:"none", required:false },
      { id:103, type:"bmi",      text:"What is your weight and height?", helper:"We use your BMI to determine which medications you're eligible for.", impact:"qualify", required:true },
      { id:105, type:"multiple", text:"What is your gender?", helper:"Used for clinical dosing guidelines", impact:"none", required:true, options:["Male","Female","Prefer not to say"] },

      // Medical history
      { id:106, type:"section",  text:"Medical History", helper:"", sectionIcon:"🏥", impact:"none", required:false },
      { id:107, type:"checkbox", text:"Do any of these apply to you?", helper:"Select all that apply.", impact:"disqualifier", required:true, options:[
        { label:"None of these apply",                              flag:"ok"   },
        { label:"Hypertension (high blood pressure)",               flag:"ok"   },
        { label:"Type 2 Diabetes or Prediabetes",                   flag:"ok"   },
        { label:"Obesity (BMI ≥ 30)",                               flag:"ok"   },
        { label:"Sleep apnea",                                      flag:"ok"   },
        { label:"Hypothyroidism, Hyperthyroidism, or Thyroid Issues", flag:"ok" },
        { label:"History of pancreatitis",                          flag:"disq" },
        { label:"Medullary thyroid carcinoma (MTC) or MEN2",        flag:"disq" },
        { label:"Gastroparesis / severe GI motility disorder",      flag:"disq" },
      ] },
      { id:108, type:"yesno",    text:"Have you ever been diagnosed with thyroid cancer?", helper:"Including any family history of medullary thyroid carcinoma", impact:"disqualifier", required:true },
      { id:109, type:"yesno",    text:"Are you currently pregnant, planning to become pregnant, or breastfeeding?", helper:"GLP-1 medications are contraindicated during pregnancy", impact:"disqualifier", required:true },

      // Identity (intentionally near the end — Figma shows DOB and contact info AFTER the screening questions)
      { id:100, type:"section",  text:"About you", helper:"", sectionIcon:"👤", impact:"none", required:false },
      { id:101, type:"personal_info", text:"Personal Information", helper:"Your name and contact details", impact:"none", required:true },
      { id:102, type:"date",     text:"What is your date of birth?", helper:"You must be 18 or older to enroll", impact:"disqualifier", required:true },
      { id:119, type:"text",     text:"What is your ZIP code?", helper:"For shipping and provider matching", impact:"none", required:true },
      { id:120, type:"address",  text:"If prescribed, where should we ship your order?", helper:"", impact:"none", required:true },

      // Consent
      { id:113, type:"section",  text:"Consent", helper:"", sectionIcon:"✍", impact:"none", required:false },
      { id:114, type:"checkbox", text:"Please confirm the following before submitting:", helper:"", impact:"qualify", required:true, options:[
        { label:"I certify that all information provided is accurate", flag:"ok" },
        { label:"I understand GLP-1 medications may have side effects", flag:"ok" },
        { label:"I authorize DripVitals providers to review my intake", flag:"ok" },
      ] },
    ],
  },
  {
    id: 2, name: "NAD+ Wellness Intake", slug: "nad-wellness",
    desc: "Intake screening for clients interested in NAD+ injection therapy.",
    active: true, treatmentIds: [6,7], submissions: 48, qualified: 42,
    questions: [
      // Engagement first
      { id:203, type:"multiple", text:"What are your primary wellness goals?", helper:"", impact:"none", required:true, options:["Energy & focus","Anti-aging","Athletic recovery","Cognitive performance","General wellness"] },
      { id:206, type:"yesno",    text:"Are you comfortable with self-injection?", helper:"NAD+ is delivered via subcutaneous injection", impact:"none", required:true },
      // Screening
      { id:204, type:"section",  text:"Health Screening", helper:"", sectionIcon:"🏥", impact:"none", required:false },
      { id:205, type:"yesno",    text:"Do you have any kidney or liver disease?", helper:"NAD+ is metabolized by these organs", impact:"review", required:true },
      // Identity at the end
      { id:200, type:"section",  text:"About you", helper:"", sectionIcon:"👤", impact:"none", required:false },
      { id:201, type:"personal_info", text:"Personal Information", helper:"Your name and contact details", impact:"none", required:true },
      { id:202, type:"date",     text:"What is your date of birth?", helper:"Must be 18 or older", impact:"disqualifier", required:true },
    ],
  },
  {
    id: 3, name: "Metabolic Health Intake", slug: "metabolic-health",
    desc: "For clients seeking metformin and lifestyle-based metabolic care.",
    active: false, treatmentIds: [9], submissions: 6, qualified: 5,
    questions: [
      { id:302, type:"yesno",    text:"Have you been diagnosed with pre-diabetes or insulin resistance?", helper:"", impact:"none", required:true },
      { id:300, type:"section",  text:"About you", helper:"", sectionIcon:"👤", impact:"none", required:false },
      { id:301, type:"personal_info", text:"Personal Information", helper:"Your name and contact details", impact:"none", required:true },
    ],
  },
];

export const SEED_CLIENTS: BaskClient[] = [
  { id:1, first:"Maria", last:"Gonzalez", email:"maria.g@email.com", phone:"(305) 555-0142",
    formId:1, formName:"GLP-1 Medication Intake", formSlug:"glp-1-medication",
    treatmentId:2, status:"paid", startedAt:"2026-05-14 09:12", paidAt:"2026-05-14 09:38",
    address:{ line1:"1240 Brickell Ave", apt:"4B", city:"Miami", state:"FL", zip:"33131" },
    lastFour:"4242", cardBrand:"Visa", reminders:[], answers:{} },
  { id:2, first:"James", last:"Thompson", email:"jthompson@email.com", phone:"(786) 555-0177",
    formId:1, formName:"GLP-1 Medication Intake", formSlug:"glp-1-medication",
    treatmentId:4, status:"unpaid", startedAt:"2026-05-17 14:41", paidAt:null,
    address:{ line1:"", apt:"", city:"", state:"", zip:"" }, lastFour:null, cardBrand:null,
    reminders:[{ at:"2026-05-18 10:02", channel:"email" }], answers:{} },
  { id:3, first:"Aisha", last:"Patel", email:"aisha.patel@email.com", phone:"(305) 555-0918",
    formId:1, formName:"GLP-1 Medication Intake", formSlug:"glp-1-medication",
    treatmentId:null, status:"unpaid", startedAt:"2026-05-18 19:23", paidAt:null,
    address:{ line1:"", apt:"", city:"", state:"", zip:"" }, lastFour:null, cardBrand:null,
    reminders:[], answers:{} },
  { id:4, first:"Daniel", last:"Kim", email:"dkim@email.com", phone:"(954) 555-0210",
    formId:2, formName:"NAD+ Wellness Intake", formSlug:"nad-wellness",
    treatmentId:null, status:"disqualified", startedAt:"2026-05-16 11:55", paidAt:null,
    disqReason:"Kidney disease screening",
    address:{ line1:"", apt:"", city:"", state:"", zip:"" }, lastFour:null, cardBrand:null,
    reminders:[], answers:{} },
  { id:5, first:"Sarah", last:"Mitchell", email:"smitchell@email.com", phone:"(305) 555-0144",
    formId:1, formName:"GLP-1 Medication Intake", formSlug:"glp-1-medication",
    treatmentId:5, status:"paid", startedAt:"2026-05-09 08:30", paidAt:"2026-05-09 08:55",
    address:{ line1:"2847 Coral Way", apt:"4B", city:"Miami", state:"FL", zip:"33145" },
    lastFour:"1881", cardBrand:"Mastercard", reminders:[], answers:{} },
];
