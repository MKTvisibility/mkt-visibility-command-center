import test from "node:test";
import assert from "node:assert/strict";
import { leadScores, validateAssessment } from "../src/lib/intelligence.js";
import {
  normalizeResearch,
  suggestionsFor,
} from "../supabase/functions/research-business/research.mjs";
test("unknown and irrelevant presence is not penalized; evidence-based need is weighted", () => {
  assert.equal(leadScores().need, null);
  assert.equal(leadScores().category, "Research Incomplete");
  const a = {
    platforms: {
      Website: { score: 2, explanation: "Content issues" },
      TikTok: { state: "Not Applicable", score: null },
    },
    signals: {
      "Service relevance": { value: 80 },
      "Operating activity": { value: 80 },
      "Contact readiness": { value: 100 },
    },
    review_status: "Approved",
  };
  const s = leadScores(a);
  assert.equal(s.need, 75);
  assert.equal(s.potential, 80);
  assert.equal(s.priority, 81);
  assert.equal(s.coverage, 90);
  assert.equal(s.category, "High Priority");
  assert.equal(
    leadScores(a, { do_not_contact: true }).category,
    "Not Qualified",
  );
  assert.equal(
    leadScores({ platforms: { Website: { state: "Missing", relevant: null } } })
      .need,
    null,
  );
  assert.equal(
    leadScores({ platforms: { Website: { state: "Missing", relevant: true } } })
      .need,
    100,
  );
});
test("review requires scores, explanations and source evidence", () => {
  assert.throws(
    () => validateAssessment({ platforms: { Website: { score: 6 } } }),
    /1–5/,
  );
  assert.throws(
    () => validateAssessment({ platforms: { Website: { score: 2 } } }),
    /source/,
  );
  assert.throws(
    () =>
      validateAssessment({
        signals: { "Confirmed budget fit": { value: 80 } },
      }),
    /explanation/,
  );
});
test("research refuses incomplete provider output and strips fabricated source evidence", () => {
  assert.throws(
    () => normalizeResearch({ status: "incomplete" }),
    /incomplete/,
  );
  assert.throws(
    () => normalizeResearch({ status: "completed", output: [] }),
    /No successful/,
  );
  const result = normalizeResearch({
    status: "completed",
    output: [
      {
        type: "web_search_call",
        status: "completed",
        action: { sources: [{ url: "https://official.example/" }] },
      },
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text: JSON.stringify({
              assessment: {
                platforms: {
                  Website: {
                    score: 1,
                    state: "Rated",
                    explanation: "Invented",
                    evidence: [{ url: "https://invented.example/" }],
                  },
                },
                fields: {
                  email: {
                    value: "x@y.com",
                    verification: "Verified",
                    source: "https://invented.example/",
                  },
                },
                signals: {},
              },
              limitations: [],
            }),
          },
        ],
      },
    ],
  });
  assert.equal(result.status, "Partial");
  assert.equal(result.assessment.platforms.Website.score, null);
  assert.equal(result.assessment.fields.email.verification, "Uncertain");
  assert.equal(
    suggestionsFor(result.assessment).filter(
      (x) => x.key === "assessment-review",
    ).length,
    1,
  );
});
