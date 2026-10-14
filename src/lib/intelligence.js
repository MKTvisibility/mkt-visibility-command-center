export const PLATFORMS = [
  "Website",
  "Google Business Profile",
  "Facebook",
  "Instagram",
  "TikTok",
  "LinkedIn",
  "YouTube",
  "Pinterest",
  "Other",
];
export const CRITERIA = {
  Website: [
    "Design",
    "Mobile friendliness",
    "Navigation",
    "SEO",
    "Content quality",
    "Contact / booking",
    "Performance",
    "Freshness",
  ],
  "Google Business Profile": [
    "Completeness",
    "Accuracy",
    "Photos",
    "Reviews",
    "Owner responses",
    "Updates",
    "Customer interaction",
  ],
  Facebook: [
    "Completeness",
    "Branding",
    "Posting frequency",
    "Content quality",
    "Engagement",
    "Communication",
    "Calls to action",
  ],
  Instagram: [
    "Completeness",
    "Consistency",
    "Photo / video quality",
    "Engagement",
    "Branding",
    "Links / calls to action",
  ],
  TikTok: [
    "Completeness",
    "Relevance",
    "Consistency",
    "Video quality",
    "Engagement",
  ],
};
export const RATING_STATES = [
  "Not Researched",
  "Missing",
  "Not Applicable",
  "Unable to Verify",
];
export const PIPELINE = [
  "Researching",
  "Qualified",
  "Ready to Contact",
  "Contacted",
  "Interested",
  "Proposal Sent",
  "Client Won",
  "Closed / Not a Fit",
];
export const TASK_STATUSES = {
  Open: "Not Started",
  "In progress": "In Progress",
  "Awaiting Review": "Awaiting Review",
  "Waiting on Client": "Waiting on Client",
  Blocked: "Blocked",
  Done: "Completed",
  Cancelled: "Canceled",
};
export const CATEGORIES = [
  "Business Research",
  "Verification",
  "Website",
  "Google Business Profile",
  "Social Media",
  "Directory Listing",
  "Content Creation",
  "Outreach",
  "Follow-up",
  "Proposal",
  "Client Work",
  "Administrative",
  "Other",
];
export const DEFAULT_WEIGHTS = {
  need: 40,
  potential: 35,
  contact: 15,
  engagement: 10,
};
export const DEFAULT_PLATFORM_WEIGHTS = {
  Website: 40,
  "Google Business Profile": 35,
  Facebook: 10,
  Instagram: 10,
  TikTok: 5,
  LinkedIn: 5,
  YouTube: 5,
  Pinterest: 5,
  Other: 5,
};
export const SIGNALS = [
  "Service relevance",
  "Operating activity",
  "Ongoing service fit",
  "Expressed interest",
  "Confirmed budget fit",
];
export function weighted(values) {
  const known = values.filter((v) => Number.isFinite(v.value) && v.weight > 0);
  if (!known.length) return null;
  return Math.round(
    known.reduce((s, v) => s + v.value * v.weight, 0) /
      known.reduce((s, v) => s + v.weight, 0),
  );
}
export function leadScores(assessment = {}, crm = {}, settings = {}) {
  const platforms = assessment.platforms || {},
    weights = { ...DEFAULT_WEIGHTS, ...settings.weights },
    platformWeights = {
      ...DEFAULT_PLATFORM_WEIGHTS,
      ...settings.platformWeights,
    };
  const findings = [],
    inputs = [];
  for (const [name, p] of Object.entries(platforms)) {
    if (
      p.state === "Not Applicable" ||
      p.relevant === false ||
      p.review_status === "Rejected"
    )
      continue;
    let value = null;
    if (p.state === "Missing" && p.relevant === true) value = 100;
    else if (Number.isFinite(p.score) && p.score >= 1 && p.score <= 5)
      value = (5 - p.score) * 25;
    if (value !== null) {
      inputs.push({ value, weight: platformWeights[name] ?? 5 });
      findings.push(
        `${name}: ${p.state === "Missing" ? "verified missing" : `${p.score}/5`} → ${value}% service need. ${p.explanation || ""}`,
      );
    }
  }
  const need = weighted(inputs);
  const signals = assessment.signals || {};
  const potential = weighted(
    SIGNALS.map((name) => ({
      value: Number.isFinite(signals[name]?.value) ? signals[name].value : null,
      weight: 1,
    })),
  );
  const contact = Number.isFinite(signals["Contact readiness"]?.value)
    ? signals["Contact readiness"].value
    : null;
  const engagement = Number.isFinite(signals["Previous engagement"]?.value)
    ? signals["Previous engagement"].value
    : null;
  const components = { need, potential, contact, engagement };
  const priority = weighted(
    Object.entries(components).map(([name, value]) => ({
      value,
      weight: weights[name],
    })),
  );
  const coverage =
    Object.entries(components)
      .filter(([, value]) => value !== null)
      .reduce((s, [name]) => s + weights[name], 0) /
    Math.max(
      1,
      Object.values(weights).reduce((a, b) => a + b, 0),
    );
  const category =
    crm.do_not_contact || crm.stage === "Closed / Not a Fit"
      ? "Not Qualified"
      : need === null || potential === null || coverage < 0.65
        ? "Research Incomplete"
        : priority >= 70
          ? "High Priority"
          : priority >= 45
            ? "Medium Priority"
            : "Low Priority";
  return {
    ...components,
    priority,
    coverage: Math.round(coverage * 100),
    category,
    findings,
    provisional: assessment.review_status !== "Approved",
    formula:
      "Known weighted components ÷ known weights. Unknowns are omitted; not applicable platforms are excluded.",
    weights,
  };
}
export function emptyAssessment(business = {}) {
  return {
    fields: Object.fromEntries(
      ["name", "address", "phone", "email", "website"].map((k) => [
        k,
        {
          value: business[k] || "",
          verification: "Unverified",
          source: "",
          notes: "",
        },
      ]),
    ),
    platforms: Object.fromEntries(
      PLATFORMS.map((p) => [
        p,
        {
          url: p === "Website" ? business.website || "" : "",
          state: "Not Researched",
          score: null,
          relevant: null,
          explanation: "",
          evidence: [],
          criteria: {},
        },
      ]),
    ),
    signals: {},
    summary: "",
    services: "",
    first_contact: "",
    review_status: "Not Researched",
  };
}
export function normalizeStage(legacy) {
  return (
    {
      New: "Researching",
      Discovery: "Interested",
      Proposal: "Proposal Sent",
      Won: "Client Won",
      Lost: "Closed / Not a Fit",
      Contacted: "Contacted",
    }[legacy] || "Researching"
  );
}
export function ratingLabel(p = {}) {
  return Number.isFinite(p.score)
    ? `${"★".repeat(p.score)}${"☆".repeat(5 - p.score)} (${p.score}/5)`
    : p.state || "Not Researched";
}
export function researchNeeded(profile, days = 90) {
  return (
    !profile?.approved_at ||
    Date.parse(profile.approved_at) < Date.now() - days * 86400000
  );
}
export function validateAssessment(a) {
  if (!a || typeof a !== "object" || Array.isArray(a))
    throw Error("Assessment must be an object.");
  for (const [name, p] of Object.entries(a.platforms || {})) {
    if (
      p.score !== null &&
      p.score !== undefined &&
      (!Number.isInteger(p.score) || p.score < 1 || p.score > 5)
    )
      throw Error(`${name}: choose a score from 1–5.`);
    if (
      (Number.isFinite(p.score) || p.state === "Missing") &&
      (!p.explanation?.trim() ||
        !p.evidence?.some((e) => /^https?:\/\//.test(e.url || "")))
    )
      throw Error(
        `${name}: a rating or missing finding needs an explanation and a source URL.`,
      );
  }
  for (const [name, s] of Object.entries(a.signals || {}))
    if (
      s.value !== null &&
      s.value !== undefined &&
      (!Number.isFinite(s.value) ||
        s.value < 0 ||
        s.value > 100 ||
        !s.explanation?.trim())
    )
      throw Error(`${name}: a score needs a 0–100 value and explanation.`);
  return a;
}
