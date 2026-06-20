// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
type AiConformityDetail = {
  requirementLabel: string;
  required: boolean;
  weight: number;
  matched: boolean;
  score: number;
  evidence: string | null;
  comment: string | null;
};

type AiConformityResult = {
  offerItemId: string;
  requestedProductName: string;
  proposedProductName: string | null;
  proposedProductCode: string | null;
  proposedBrand: string | null;
  quantityRequested: number | null;
  quantityOffered: number | null;
  conformityPercentage: number;
  isTechnicallyCompliant: boolean;
  mandatoryMissingCount: number;
  details: AiConformityDetail[];
  summary: string;
  recommendation: string;
};
export const genericEquivalenceGroups = [
  // HÉMODIALYSE
  [
    "acide citrique",
    "citrate",
    "solution acide",
    "concentré acide",
    "concentre acide",
    "acid concentrate",
    "acidic concentrate",
  ],
  [
    "bicarbonate de sodium",
    "bicarbonate",
    "cartouche bicarbonate",
    "poudre bicarbonate",
    "sodium bicarbonate",
  ],
  [
    "dialyseur",
    "rein artificiel",
    "filtre dialyse",
    "filtre hémodialyse",
    "filtre hemodialyse",
    "dialyzer",
  ],
  [
    "ligne artérielle",
    "ligne arterielle",
    "tubulure artérielle",
    "tubulure arterielle",
    "arterial blood line",
  ],
  ["ligne veineuse", "tubulure veineuse", "venous blood line"],
  [
    "aiguille fistule",
    "aiguille av fistula",
    "aiguille fistule artério veineuse",
    "aiguille fistule arterio veineuse",
    "fistula needle",
  ],

  // CONSOMMABLES GÉNÉRAUX
  ["seringue", "syringe"],
  [
    "perfuseur",
    "tubulure perfusion",
    "set de perfusion",
    "iv set",
    "infusion set",
  ],
  [
    "cathéter",
    "catheter",
    "cathéter périphérique",
    "catheter peripherique",
    "iv cannula",
  ],
  ["gants", "gant médical", "gant medical", "medical gloves", "gloves"],
  ["compresse", "compresses", "gaze", "gauze"],

  // MONITORING
  [
    "moniteur multiparamétrique",
    "moniteur multiparametrique",
    "moniteur patient",
    "patient monitor",
    "multi parameter monitor",
    "multiparameter monitor",
  ],
  [
    "oxymètre de pouls",
    "oxymetre de pouls",
    "saturomètre",
    "saturometre",
    "pulse oximeter",
    "spo2 monitor",
  ],

  // CARDIO
  [
    "défibrillateur",
    "defibrillateur",
    "dae",
    "aed",
    "automated external defibrillator",
  ],
  [
    "électrocardiographe",
    "electrocardiographe",
    "ecg",
    "appareil ecg",
    "electrocardiograph",
  ],
];

function getGenericCanonicalHits(value: string) {
  const text = normalizeText(value);
  const hits = new Set<string>();

  for (const group of genericEquivalenceGroups) {
    const normalizedGroup = group.map(normalizeText);
    const canonical = normalizedGroup[0];

    if (normalizedGroup.some((alias) => text.includes(alias))) {
      hits.add(canonical);
    }
  }

  return hits;
}

export function canonicalizeGenericText(value: string) {
  let text = normalizeText(value);

  for (const group of genericEquivalenceGroups) {
    const normalizedGroup = group.map(normalizeText);
    const canonical = normalizedGroup[0];

    for (const alias of normalizedGroup) {
      if (alias && text.includes(alias)) {
        text = text.split(alias).join(canonical);
      }
    }
  }

  return text;
}

export function genericEquivalenceScore(a: string, b: string) {
  const aHits = getGenericCanonicalHits(a);
  const bHits = getGenericCanonicalHits(b);

  const hasCommonGeneric = [...aHits].some((hit) => bHits.has(hit));

  const canonicalA = canonicalizeGenericText(a);
  const canonicalB = canonicalizeGenericText(b);

  const lexicalScore = Math.max(
    similarityScore(canonicalA, canonicalB),
    similarityScore(canonicalB, canonicalA),
  );

  if (hasCommonGeneric) {
    return Math.max(0.75, lexicalScore);
  }

  return lexicalScore;
}

export function areGenericEquivalent(a: string, b: string) {
  return genericEquivalenceScore(a, b) >= 0.65;
}
// ─────────────────────────────────────────────
// PROMPT BUILDER
// ─────────────────────────────────────────────

export function buildConformityPrompt(params: {
  requestedItem: {
    id: string;
    name: string;
    requestedQuantity: number;
    technicalRequirements: unknown;
  };
  proformaText: string;
  technicalText: string;
}): string {
  const requirements = Array.isArray(params.requestedItem.technicalRequirements)
    ? params.requestedItem.technicalRequirements
    : [];

  const requirementsText = requirements
    .map((req: any, index) => {
      return [
        `${index + 1}. ${req.label ?? ""}`,
        `   Obligatoire: ${req.required === false ? "non" : "oui"}`,
        `   Poids: ${req.weight ?? 5}`,
        req.value ? `   Valeur attendue: ${req.value}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  return `
Tu es un expert biomédical et achat public.

Ta mission:
Comparer le produit proposé par le fournisseur avec les exigences du cahier des charges.

IMPORTANT:
Tu dois comparer CHAQUE exigence technique du cahier des charges avec:
1. la proforma du fournisseur
2. la fiche technique / catalogue du fournisseur

IMPORTANT SUR LES NOMS GÉNÉRIQUES / ÉQUIVALENTS:
- Le produit proposé peut avoir un nom commercial, générique, DCI ou une désignation équivalente différente du cahier des charges.
- Ne rejette pas un produit uniquement parce que son nom est différent.
- Si le nom proposé est un générique ou une désignation équivalente du produit demandé, considère que l'identité produit est acceptable.
- Exemple:
  - "ACIDE CITRIQUE" peut correspondre à "solution acide pour hémodialyse" si le contexte confirme l'usage.
  - "BICARBONATE DE SODIUM" peut correspondre à "cartouche bicarbonate" ou "poudre bicarbonate".
  - "DIALYSEUR" peut correspondre à "rein artificiel", "filtre de dialyse" ou "dialyzer".
- L'équivalence du nom ne suffit pas pour être conforme:
  - les caractéristiques techniques obligatoires doivent rester vérifiées.
  - la quantité proposée doit rester suffisante.
  - toute contradiction technique doit rendre l'article non conforme ou partiellement conforme.
  
Produit demandé:
- ID: ${params.requestedItem.id}
- Nom: ${params.requestedItem.name}
- Quantité demandée: ${params.requestedItem.requestedQuantity}

EXIGENCES TECHNIQUES DU CAHIER DES CHARGES:
${requirementsText || "Aucune exigence technique structurée fournie."}

PROFORMA FOURNISSEUR:
${params.proformaText}

FICHE TECHNIQUE / CATALOGUE FOURNISSEUR:
${params.technicalText}

Retourne uniquement un JSON valide.
Ne jamais ajouter de markdown.

Format obligatoire:
{
  "offerItemId": "${params.requestedItem.id}",
  "requestedProductName": "${params.requestedItem.name}",
  "proposedProductName": null,
  "proposedProductCode": null,
  "proposedBrand": null,
  "quantityRequested": ${params.requestedItem.requestedQuantity},
  "quantityOffered": null,
  "conformityPercentage": 0,
  "isTechnicallyCompliant": false,
  "mandatoryMissingCount": 0,
  "details": [
    {
      "requirementLabel": "",
      "required": true,
      "weight": 0,
      "matched": false,
      "score": 0,
      "evidence": null,
      "comment": null
    }
  ],
  "summary": "",
  "recommendation": ""
}

RÈGLES DE QUANTITÉ:
- quantityRequested = ${params.requestedItem.requestedQuantity}
- quantityOffered = quantité proposée dans la proforma.
- Si la quantité est absente de la proforma, mets null.
- Si quantityOffered < quantityRequested, isTechnicallyCompliant doit être false.
- Les quantités peuvent apparaître dans le titre sous forme:
  "Quantité Quatre (04)", "Quantité Dix (10)", "Quantité 10", "Qté 04".
- Si le nombre entre parenthèses existe, utilise ce nombre.
- Exemple: "Quantité Dix (10)" => requestedQuantity = 10.
- Exemple: "Quantité Quatre (04)" => requestedQuantity = 4.
- Si aucune quantité n'est visible pour un article, mets requestedQuantity = 1 et baisse confidence.
RÈGLES DE CONFORMITÉ:
- Tu dois créer un élément dans "details" pour chaque exigence technique du cahier des charges.
- requirementLabel doit reprendre exactement le label de l'exigence.
- Ne valide une exigence que si elle est prouvée dans la proforma ou la fiche technique.
- Chaque exigence validée doit avoir une preuve courte dans "evidence".
- Ne jamais inventer une caractéristique.
- Si une caractéristique est absente, score = 0.
- Si elle est partiellement conforme, donne un score partiel.
- score doit être entre 0 et weight.
- conformityPercentage doit être calculé selon:
  somme(score) / somme(weight) * 100.
- isTechnicallyCompliant = false si conformityPercentage < 70.
- isTechnicallyCompliant = false si une exigence obligatoire importante est absente.
- mandatoryMissingCount = nombre d'exigences obligatoires avec score = 0.

Retourne uniquement le JSON brut.
`;
}

// ─────────────────────────────────────────────
// SAFE PARSE
// ─────────────────────────────────────────────
export function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
export function safeParseConformity(
  content: string,
): AiConformityResult | null {
  try {
    const cleaned = content
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    return JSON.parse(cleaned) as AiConformityResult;
  } catch (error) {
    console.error("Failed to parse conformity JSON:", error);

    return null;
  }
}
export type ProductFamily =
  | "defibrillator"
  | "ecg"
  | "mobile_monitoring_kit"
  | "patient_monitor"
  | "unknown";
export function detectProductFamily(value: string): ProductFamily {
  const text = normalizeText(value);

  if (
    text.includes("dae") ||
    text.includes("aed") ||
    text.includes("defibrillateur")
  ) {
    return "defibrillator";
  }

  if (text.includes("ecg") || text.includes("electrocardiogramme")) {
    return "ecg";
  }

  if (
    text.includes("kit") ||
    text.includes("mallette") ||
    text.includes("tablette") ||
    text.includes("android") ||
    text.includes("ios") ||
    text.includes("bluetooth") ||
    text.includes("application")
  ) {
    return "mobile_monitoring_kit";
  }

  if (
    text.includes("moniteur") ||
    text.includes("surveillance") ||
    text.includes("spo2") ||
    text.includes("nibp") ||
    text.includes("temp") ||
    text.includes("pression arterielle")
  ) {
    return "patient_monitor";
  }

  return "unknown";
}

export function normalizeToken(token: string) {
  const synonyms: Record<string, string> = {
    // =========================
    // URGENCE / RÉANIMATION
    // =========================
    aed: "dae",
    dae: "dae",
    défibrillateur: "defibrillateur",
    defibrillateur: "defibrillateur",
    defibrillateurs: "defibrillateur",
    defibrillation: "defibrillateur",
    choc: "defibrillateur",
    choc_electrique: "defibrillateur",
    cardioversion: "defibrillateur",
    resuscitation: "urgence",
    réanimation: "urgence",
    reanimation: "urgence",
    urgence: "urgence",
    urgences: "urgence",
    triage: "urgence",

    // =========================
    // CARDIOLOGIE / ECG
    // =========================
    ecg: "ecg",
    electrocardiogramme: "ecg",
    électrocardiogramme: "ecg",
    electrocardiogrammes: "ecg",
    cardiogramme: "ecg",
    cardiographe: "ecg",
    rythme_cardiaque: "ecg",
    arythmie: "ecg",
    fibrillation: "ecg",
    tachycardie: "ecg",
    bradycardie: "ecg",
    qt: "ecg",
    segment_st: "ecg",

    // =========================
    // MONITORING
    // =========================
    moniteur: "moniteur",
    moniteurs: "moniteur",
    monitor: "moniteur",
    monitoring: "moniteur",
    scope: "moniteur",
    cardioscope: "moniteur",
    surveillance: "moniteur",
    surveillance_patient: "moniteur",
    alarme: "moniteur",

    // =========================
    // SIGNES VITAUX
    // =========================
    spo2: "spo2",
    saturation: "spo2",
    oxygene: "spo2",
    oxygène: "spo2",
    sat: "spo2",

    pr: "pr",
    pouls: "pr",
    bpm: "pr",
    heart_rate: "pr",
    frequence_cardiaque: "pr",
    fréquence_cardiaque: "pr",
    pulse: "pr",

    temp: "temp",
    temperature: "temp",
    température: "temp",
    fièvre: "temp",
    fever: "temp",

    nibp: "nibp",
    tension: "nibp",
    pression: "nibp",
    pression_arterielle: "nibp",
    pression_artérielle: "nibp",
    bp: "nibp",

    resp: "resp",
    respiration: "resp",
    respiratoire: "resp",
    frequence_respiratoire: "resp",
    fréquence_respiratoire: "resp",
    rr: "resp",

    // =========================
    // RESPIRATOIRE / AIRWAY
    // =========================
    ventilation: "ventilation",
    ventilateur: "ventilation",
    ventilator: "ventilation",
    intubation: "airway",
    extubation: "airway",
    airway: "airway",
    oxygeneotherapie: "spo2",
    oxygénotherapie: "spo2",

    // =========================
    // IMAGERIE
    // =========================
    imagerie: "imagerie",
    radiographie: "imagerie",
    radio: "imagerie",
    rx: "imagerie",
    scanner: "imagerie",
    ct: "imagerie",
    irm: "imagerie",
    mri: "imagerie",
    echographie: "imagerie",
    échographie: "imagerie",
    ultrasound: "imagerie",

    // =========================
    // LABORATOIRE
    // =========================
    lab: "lab",
    laboratoire: "lab",
    analyse: "lab",
    analyses: "lab",
    sang: "lab",
    blood: "lab",
    glycemie: "lab",
    glycémie: "lab",
    glucose: "lab",
    hemoglobine: "lab",
    hémoglobine: "lab",
    hb: "lab",
    wbc: "lab",
    rbc: "lab",

    // =========================
    // DISPOSITIFS / MATÉRIEL
    // =========================
    perfusion: "perfusion",
    iv: "perfusion",
    intraveineux: "perfusion",
    catheter: "catheter",
    cathéter: "catheter",
    sonde: "dispositif",
    tube: "dispositif",
    masque: "consommable",
    gants: "consommable",
    compresses: "consommable",
    seringue: "consommable",
    syringe: "consommable",
    perfuseur: "perfusion",

    // =========================
    // GÉNÉRAL HOSPITALIER
    // =========================
    patient: "patient",
    malade: "patient",
    dossier: "patient",
    dossier_medical: "patient",
    hospitalisation: "soin",
    soins: "soin",
    soin: "soin",
    infirmier: "soin",
    infirmiere: "soin",
    medical: "soin",
    paramedical: "soin",
    parametres: "parametre",
    paramètres: "parametre",
  };
  const normalized = normalizeText(token);

  if (synonyms[normalized]) {
    return synonyms[normalized];
  }

  if (normalized.length > 4 && normalized.endsWith("s")) {
    return normalized.slice(0, -1);
  }

  return normalized;
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(" ")
    .map(normalizeToken)
    .filter((token) => token.length >= 2);
}
export function similarityScore(source: string, target: string) {
  const sourceTokens = new Set(tokenize(source));
  const targetTokens = tokenize(target);

  if (targetTokens.length === 0) {
    return 0;
  }

  const matched = targetTokens.filter((token) => sourceTokens.has(token));

  return matched.length / targetTokens.length;
}
