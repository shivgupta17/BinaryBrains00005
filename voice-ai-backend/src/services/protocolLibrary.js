/**
 * Clinician-Reviewed Approved Protocol Library (MoHFW / ASHA Guidelines 2024)
 * Ground Truth for First-Aid Assistance & Medication Safety Gate
 */

const APPROVED_PROTOCOLS = [
  {
    protocolId: 'PROTO_WOUND_001',
    title: '🩹 Minor Wound & Laceration Care Protocol',
    category: 'wound',
    source: 'MoHFW / ASHA Guidelines · Revision 2024',
    version: '2.4',
    keywords: ['cut', 'wound', 'laceration', 'bleed', 'bleeding', 'injury', 'abrasion', 'scratch', 'hand laceration', 'skin tear'],
    steps: [
      { step: 1, instruction: 'Screen for immediate escalation criteria.', sub: 'Deep laceration, arterial bleeding, pus, extreme redness beyond wound margins → escalate to RED immediately.' },
      { step: 2, instruction: 'Clean hands thoroughly with soap or sanitiser. Wear sterile gloves if available.' },
      { step: 3, instruction: 'Irrigate wound with clean running water or saline for 2–3 minutes.', sub: 'Do not apply raw iodine or unapproved chemicals directly into deep tissue. Remove visible debris gently.' },
      { step: 4, instruction: 'Apply appropriate sterile dressing.', sub: 'Dry sterile gauze dressing for clean wounds · Non-adherent for moist or open abrasions.' },
      { step: 5, instruction: 'Monitor for warning signs every 30 minutes.', sub: 'Increased throbbing pain, localized heat, swelling, purulent discharge, or fever spike → re-escalate to Doctor.' },
      { step: 6, instruction: 'Record treatment in patient encounter log with timestamp and steps followed.' }
    ],
    redFlags: [
      'Pulsatile or heavy arterial bleeding not controlled by 5 mins direct pressure',
      'Wound depth extending into tendon, muscle, or bone',
      'Foreign object embedded deeply in tissue',
      'Numbness or loss of motor function distal to injury site'
    ],
    escalationCriteria: [
      'Tetanus immunization unconfirmed or > 5 years ago for dirty wound',
      'Signs of localized infection (pus, spreading erythema > 2 cm)',
      'Patient with diabetes or severe immunocompromise'
    ],
    allowedMedications: [
      {
        name: 'Antiseptic Solution / Ointment (Povidone-Iodine 5%)',
        type: 'Topical OTC',
        reason: 'Prevent superficial microbial colonisation on closed wound margins',
        dosage: 'Apply thin layer 1-2 times daily after saline cleaning'
      }
    ]
  },
  {
    protocolId: 'PROTO_FEVER_002',
    title: '🌡️ Acute Febrile & Fever Management Protocol',
    category: 'fever',
    source: 'National Vector Borne Disease Control Programme / MoHFW 2024',
    version: '3.1',
    keywords: ['fever', 'temperature', 'bukhar', 'febrile', 'pyrexia', 'hot body', 'chills', 'rigors'],
    steps: [
      { step: 1, instruction: 'Ensure continuous hydration — ORS or clean drinking water (2–3 Litres/day).' },
      { step: 2, instruction: 'Tepid sponging with room-temperature water if temperature exceeds 102°F.' },
      { step: 3, instruction: 'Do not administer unapproved antipyretics without safety gate verification & doctor sign-off.' },
      { step: 4, instruction: 'Monitor vital signs (temperature, pulse, SpO2) every 60 minutes.' },
      { step: 5, instruction: 'Escalate immediately if temperature exceeds 104°F, or patient exhibits seizure, stiff neck, or altered consciousness.' }
    ],
    redFlags: [
      'High grade fever > 104°F resistant to tepid sponging',
      'Altered mental state, extreme lethargy, or convulsion',
      'Petechial rash, mucosal bleeding, or severe abdominal pain',
      'Persistent vomiting preventing oral fluid intake'
    ],
    escalationCriteria: [
      'Fever duration > 3 consecutive days without clear focus',
      'SpO2 dropping below 94% on room air',
      'Co-morbid elderly or pediatric patient (< 5 years)'
    ],
    allowedMedications: [
      {
        name: 'Paracetamol 500mg (Acetaminophen)',
        type: 'Antipyretic / Analgesic (List O OTC)',
        reason: 'Symptomatic reduction of fever ≥ 100.4°F and associated body aches',
        dosage: '1 tablet (500mg) orally as needed every 6 hours (Max 2g/day in rural clinic setting)'
      },
      {
        name: 'ORS Sachet (WHO Low-Osmolality Formula)',
        type: 'Oral Rehydration',
        reason: 'Maintain fluid balance and electrolyte levels during acute fever',
        dosage: '1 sachet dissolved in 1 Litre of clean water, sip continuously (2-3 L/day)'
      }
    ]
  },
  {
    protocolId: 'PROTO_GI_003',
    title: '💧 Acute Diarrhea & Dehydration Protocol',
    category: 'dehydration',
    source: 'WHO / UNICEF Diarrhoeal Disease Control Guidelines',
    version: '2.0',
    keywords: ['diarrhea', 'vomiting', 'loose motion', 'dehydration', 'dizziness', 'stomach infection', 'nausea', 'fluid loss'],
    steps: [
      { step: 1, instruction: 'Assess clinical degree of dehydration (skin turgor, dry mouth, sunken eyes, urine output).' },
      { step: 2, instruction: 'Initiate WHO oral rehydration solution (ORS) immediately after every loose stool.' },
      { step: 3, instruction: 'Encourage continued feeding and oral fluids; avoid sugary carbonated drinks.' },
      { step: 4, instruction: 'Re-evaluate vitals and hydration status every 2 hours.' }
    ],
    redFlags: [
      'Severe dehydration (unable to drink, lethargic, weak rapid pulse)',
      'Blood in stool (dysentery)',
      'Intractable vomiting preventing fluid retention'
    ],
    escalationCriteria: [
      'Anuria / no urine output for > 8 hours',
      'High fever accompanying severe diarrheal episodes'
    ],
    allowedMedications: [
      {
        name: 'ORS Sachet (WHO Formula)',
        type: 'Oral Rehydration',
        reason: 'Replenish fluid and essential electrolytes lost through gastrointestinal distress',
        dosage: 'Reconstitute 1 sachet in 1 Litre boiled clean water; drink 200ml after each loose stool'
      },
      {
        name: 'Zinc Sulfate 20mg Tablets',
        type: 'Nutritional Supplement',
        reason: 'Reduce duration and severity of diarrheal episode',
        dosage: '1 tablet daily for 14 days'
      }
    ]
  },
  {
    protocolId: 'PROTO_RESP_004',
    title: '🫁 Acute Upper Respiratory & Cough Protocol',
    category: 'respiratory',
    source: 'MoHFW National Respiratory Health Guidelines 2024',
    version: '1.8',
    keywords: ['cough', 'cold', 'sore throat', 'runny nose', 'breathlessness', 'chest congestion', 'phlegm', 'wheezing'],
    steps: [
      { step: 1, instruction: 'Measure resting SpO2 and respiratory rate immediately.' },
      { step: 2, instruction: 'Ensure patient rests in an upright / semi-Fowler position.' },
      { step: 3, instruction: 'Provide steam inhalation and warm saline gargles for upper throat comfort.' },
      { step: 4, instruction: 'Monitor oxygen saturation continuously if SpO2 < 95%.' }
    ],
    redFlags: [
      'SpO2 < 92% on room air',
      'Severe intercostal retractions or nasal flaring',
      'Cyanosis (bluish lips or fingernails)',
      'Inability to speak in full sentences'
    ],
    escalationCriteria: [
      'Pre-existing asthma, COPD, or cardiac failure history',
      'High fever accompanied by purulent sputum and pleuritic chest pain'
    ],
    allowedMedications: [
      {
        name: 'Warm Saline Steam Inhalation',
        type: 'Non-pharmacological Support',
        reason: 'Soothe inflamed upper airway mucous membranes and loosen secretions',
        dosage: 'Inhale steam for 10 minutes 2-3 times daily'
      }
    ]
  },
  {
    protocolId: 'PROTO_INJURY_005',
    title: '🦶 Minor Musculoskeletal Injury & Sprain Protocol',
    category: 'injury_sprain',
    source: 'First Aid Manual · Indian Red Cross / MoHFW',
    version: '2.1',
    keywords: ['sprain', 'twist', 'ankle injury', 'swelling', 'joint pain', 'fall', 'bruise', 'strain'],
    steps: [
      { step: 1, instruction: 'Apply PRICE principle: Protect, Rest, Ice, Compression, Elevation.' },
      { step: 2, instruction: 'Apply cold ice pack wrapped in cloth for 15-20 minutes every 2 hours.' },
      { step: 3, instruction: 'Immobilize affected joint using crepe bandage; do not wrap excessively tight.' },
      { step: 4, instruction: 'Elevate injured limb above heart level when resting.' }
    ],
    redFlags: [
      'Inability to bear weight immediately following injury',
      'Visible deformity, bone protrusion, or gross joint displacement',
      'Loss of sensation or pulse in injured extremity'
    ],
    escalationCriteria: [
      'Severe unremitting pain despite immobilization',
      'Rapidly spreading hematoma or compartment swelling'
    ],
    allowedMedications: [
      {
        name: 'Topical Pain Relief Gel (Diclofenac 1.16%)',
        type: 'Topical Analgesic',
        reason: 'Localized anti-inflammatory relief for joint sprain or muscle bruise',
        dosage: 'Gently apply thin layer over intact skin 3 times daily (Do NOT apply over open wounds)'
      }
    ]
  }
];

function matchProtocolForContext(patientContext) {
  if (!patientContext) return null;

  // Extract all text tokens from patient context
  const textCorpus = [
    patientContext.voiceIntake?.transcription?.original || '',
    patientContext.voiceIntake?.transcription?.english || '',
    patientContext.voiceIntake?.aiAnalysis?.clientProblem?.identifiedProblem || '',
    patientContext.voiceIntake?.aiAnalysis?.clientProblem?.problemSummary || '',
    ...(patientContext.voiceIntake?.aiAnalysis?.clientProblem?.keyIssues || []),
    ...(patientContext.aiSummary?.reportedProblems || []),
    ...(patientContext.aiSummary?.documentFindings || []),
    ...(patientContext.documents?.map(d => d.ocrText || '') || []),
    patientContext.aiSummary?.summary || ''
  ].join(' ').toLowerCase();

  if (!textCorpus.trim()) {
    return null;
  }

  let bestMatch = null;
  let maxScore = 0;

  for (const proto of APPROVED_PROTOCOLS) {
    let score = 0;
    for (const kw of proto.keywords) {
      if (textCorpus.includes(kw.toLowerCase())) {
        score += 2;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestMatch = proto;
    }
  }

  // Also check vitals for high temp fever match if score is 0
  if (!bestMatch) {
    const temp = patientContext.vitals?.temp || '';
    const tempNum = parseFloat(temp);
    if (!isNaN(tempNum) && tempNum >= 99.5) {
      bestMatch = APPROVED_PROTOCOLS.find(p => p.category === 'fever');
    }
  }

  return bestMatch;
}

module.exports = {
  APPROVED_PROTOCOLS,
  matchProtocolForContext
};
