import { useEffect, useState } from "react";
import {
  BRANDS,
  safeUrl,
  toCsv,
  WORKSPACE_ID,
  messageSummary,
} from "./lib/domain.js";
import { isTown, brandOf } from "./lib/portfolio.js";
import {
  PLATFORMS,
  CRITERIA,
  RATING_STATES,
  SIGNALS,
  PIPELINE,
  DEFAULT_WEIGHTS,
  DEFAULT_PLATFORM_WEIGHTS,
  emptyAssessment,
  leadScores,
  ratingLabel,
  validateAssessment,
  researchNeeded,
  normalizeStage,
} from "./lib/intelligence.js";
import "./intelligence.css";
const REPORTS = [
  "Top MKT Visibility Prospects",
  "Businesses Needing Research",
  "Website Improvement Opportunities",
  "Google Business Profile Opportunities",
  "Social Media Opportunities",
  "Warm Leads and Follow-ups",
  "Sales Pipeline",
  "Team Productivity",
  "Research Progress",
];
function Select({ label, value, onChange, options }) {
  return (
    <label>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>
    </label>
  );
}
function exportCsv(rows, name) {
  const u = URL.createObjectURL(
    new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
function Source({ url, label }) {
  return safeUrl(url) ? (
    <a href={safeUrl(url)} target="_blank" rel="noreferrer">
      {label || url} ↗
    </a>
  ) : null;
}
function Scores({ scores }) {
  return (
    <div className="bi-scores">
      {[
        ["need", "Service need"],
        ["potential", "Client potential"],
        ["priority", "Lead priority"],
      ].map(([key, label]) => (
        <div key={key}>
          <small>{label}</small>
          <strong>
            {scores[key] ?? "—"}
            {scores[key] !== null && "/100"}
          </strong>
        </div>
      ))}
      <div>
        <small>Research coverage</small>
        <strong>{scores.coverage}%</strong>
        <span>
          {scores.category} · {scores.provisional ? "Provisional" : "Approved"}
        </span>
      </div>
    </div>
  );
}
function ClientReport({ business, a, onClose }) {
  return (
    <section className="card bi-client-report">
      <div className="actions bi-no-print">
        <button onClick={() => window.print()}>Print / Save PDF</button>
        <button onClick={onClose}>Close report</button>
      </div>
      <h2>Visibility Check · {business.name}</h2>
      <p>MKT Visibility · We Keep Your Business Visible.</p>
      <p>
        Prepared {new Date().toLocaleDateString()} ·{" "}
        {a.review_status === "Approved"
          ? "Reviewed assessment"
          : "Draft — review findings before sharing"}
      </p>
      <p>{a.client_summary || "This Visibility Check summarizes the online presence we could assess from the supporting public sources."}</p>
      {Object.entries(a.platforms || {})
        .filter(
          ([, p]) =>
            p.state !== "Not Applicable" &&
            (Number.isFinite(p.score) || p.state === "Missing"),
        )
        .map(([name, p]) => (
          <article key={name}>
            <h3>{name}</h3>
            <p>{ratingLabel(p)}</p>
            <p>{p.client_explanation || "Review the source links below and discuss practical improvements with MKT Visibility."}</p>
            {(p.evidence || []).map((e, i) => (
              <p key={i}>
                <Source url={e.url} />
              </p>
            ))}
          </article>
        ))}
      <h3>Recommended next steps</h3>
      <p>
        {a.client_services ||
          "A conversation about your business goals can help identify the most useful next steps."}
      </p>
      <p>
        Findings reflect accessible information on the research date.
        Information that could not be verified has been excluded from this
        report.
      </p>
    </section>
  );
}
function Assessment({
  business,
  profile,
  runs,
  command,
  writable,
  settings,
  onQueue,
  onView,
}) {
  const latest = runs[0],
    approved = profile?.approved;
  const [which, setWhich] = useState(latest ? "proposal" : "approved"),
    [draft, setDraft] = useState(
      latest?.assessment || (approved && Object.keys(approved).length)
        ? latest?.assessment || approved
        : emptyAssessment(business),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [report, setReport] = useState(false),
    [platformName, setPlatformName] = useState("");
  const change = (key, value) => setDraft((d) => ({ ...d, [key]: value }));
  function choose(value) {
    setWhich(value);
    setDraft(
      structuredClone(
        value === "proposal" && latest
          ? latest.assessment
          : approved && Object.keys(approved).length
            ? approved
            : emptyAssessment(business),
      ),
    );
  }
  const platforms = draft.platforms || {},
    scores = leadScores(draft, profile?.crm, settings);
  async function save(approve) {
    setBusy(true);
    setError("");
    try {
      validateAssessment(draft);
      await command(approve ? "approve" : "research_save", {
        business_id: business.id,
        assessment: draft,
        version: profile?.updated_at,
        research_id: which === "proposal" ? latest?.id : undefined,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (report)
    return (
      <ClientReport
        business={business}
        a={draft}
        onClose={() => setReport(false)}
      />
    );
  return (
    <section className="card bi-assessment">
      <div className="section-head">
        <div>
          <h2>{business.name}</h2>
          <p>{business.city} · Assessment and manual review</p>
        </div>
        <div className="actions">
          <button onClick={onView}>Business profile / publishing</button>
          <button onClick={() => setReport(true)}>
            Visibility Check report
          </button>
          {writable && (
            <button onClick={() => onQueue([business.id])}>
              {latest ? "Research Again" : "Research Business"}
            </button>
          )}
        </div>
      </div>
      <p className="info">
        AI proposals and approved internal assessments are separate. Approving
        here does not publish or replace directory content. Use the existing
        business editor to apply factual corrections to public business records.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="filters">
        <Select
          label="Assessment version"
          value={which}
          onChange={choose}
          options={latest ? ["proposal", "approved"] : ["approved"]}
        />
        <span>
          Approved:{" "}
          {profile?.approved_at
            ? new Date(profile.approved_at).toLocaleString()
            : "Never"}
          <br />
          Latest research:{" "}
          {latest
            ? new Date(latest.created_at).toLocaleString()
            : "Not researched"}{" "}
          · {latest?.status}
        </span>
      </div>
      {latest?.limitations && (
        <p className="info">Research limits: {latest.limitations}</p>
      )}
      <Scores scores={scores} />
      <details>
        <summary>Why these scores?</summary>
        <p>{scores.formula}</p>
        <p>
          Weights: {JSON.stringify(scores.weights)}. Priority needs both service
          need and client potential, with at least 65% component coverage.
        </p>
        <ul>
          {scores.findings.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
        {Object.entries(draft.signals || {}).map(([n, s]) => (
          <p key={n}>
            {n}: {s.value ?? "Unknown"} · {s.explanation}
          </p>
        ))}
      </details>
      <fieldset disabled={!writable || busy}>
        <legend>Verify business facts</legend>
        <div className="bi-grid">
          {[
            "name",
            "alternate_names",
            "address",
            "service_area",
            "city",
            "state",
            "zip",
            "phone",
            "email",
            "website",
            "contact_name",
            "contact_position",
            "categories",
            "subcategories",
            "description",
            "story",
            "logo_url",
            "information_source",
            "last_verification",
          ].map((key) => {
            const f = draft.fields?.[key] || {
              value: business[key] || "",
              verification: "Unverified",
            };
            return (
              <article key={key}>
                <strong>{key}</strong>
                <label>
                  Proposed / reviewed value
                  <input
                    value={f.value || ""}
                    onChange={(e) =>
                      change("fields", {
                        ...draft.fields,
                        [key]: { ...f, value: e.target.value },
                      })
                    }
                  />
                </label>
                <Select
                  label="Verification"
                  value={f.verification || "Unverified"}
                  options={[
                    "Unverified",
                    "Verified",
                    "Uncertain",
                    "Unavailable",
                    "Rejected",
                  ]}
                  onChange={(v) =>
                    change("fields", {
                      ...draft.fields,
                      [key]: { ...f, verification: v },
                    })
                  }
                />
                <label>
                  Source URL
                  <input
                    type="url"
                    value={f.source || ""}
                    onChange={(e) =>
                      change("fields", {
                        ...draft.fields,
                        [key]: { ...f, source: e.target.value },
                      })
                    }
                  />
                </label>
                {approved?.fields?.[key] &&
                  f.value !== approved.fields[key].value && (
                    <small>
                      Changed since review: {approved.fields[key].value}
                    </small>
                  )}
              </article>
            );
          })}
        </div>
        <h3>Platform ratings</h3>
        <p>
          1 Poor · 2 Needs Improvement · 3 Average · 4 Good · 5 Excellent.
          Choose Not Applicable for irrelevant platforms.
        </p>
        <div className="actions">
          <label>Additional platform name<input value={platformName} maxLength={80} onChange={e=>setPlatformName(e.target.value)}/></label>
          <button type="button" disabled={!platformName.trim()||Object.hasOwn(platforms,platformName.trim())} onClick={()=>{const name=platformName.trim();change('platforms',{...platforms,[name]:{state:'Not Researched',score:null,relevant:null,url:'',explanation:'',evidence:[],criteria:{}}});setPlatformName('')}}>Add platform</button>
        </div>
        {[...new Set([...PLATFORMS,...Object.keys(platforms)])].map((name) => {
          const p = platforms[name] || {};
          const edit = (v) =>
            change("platforms", { ...platforms, [name]: { ...p, ...v } });
          return (
            <details key={name} className="bi-platform">
              <summary>
                {name} · {ratingLabel(p)}
                {approved?.platforms?.[name] &&
                ratingLabel(p) !== ratingLabel(approved.platforms[name])
                  ? " · Changed since review"
                  : ""}
              </summary>
              <div className="filters">
                <label>
                  Account URL
                  <input
                    type="url"
                    value={p.url || ""}
                    onChange={(e) => edit({ url: e.target.value })}
                  />
                </label>
                <Select
                  label="Rating / state"
                  value={
                    Number.isFinite(p.score)
                      ? String(p.score)
                      : p.state || "Not Researched"
                  }
                  options={[...RATING_STATES, "1", "2", "3", "4", "5"]}
                  onChange={(v) =>
                    edit(
                      /^\d$/.test(v)
                        ? { score: Number(v), state: "Rated", relevant: true }
                        : {
                            score: null,
                            state: v,
                            relevant:
                              v === "Not Applicable" ? false : p.relevant,
                          },
                    )
                  }
                />
                <Select
                  label="Relevant to this business?"
                  value={
                    p.relevant === true
                      ? "Yes"
                      : p.relevant === false
                        ? "No"
                        : "Unknown"
                  }
                  options={["Unknown", "Yes", "No"]}
                  onChange={(v) =>
                    edit({ relevant: v === "Unknown" ? null : v === "Yes" })
                  }
                />
              </div>
              <Select
                label="Field review status"
                value={p.review_status || "Awaiting Review"}
                options={["Awaiting Review", "Approved", "Rejected"]}
                onChange={(v) =>
                  edit({
                    review_status: v,
                    reviewed_at: new Date().toISOString(),
                  })
                }
              />
                <label>
                  Client-facing explanation (safe to share)
                  <textarea value={p.client_explanation || ""} onChange={(e) => edit({client_explanation:e.target.value})}/>
                </label>
                <label>
                  Explanation / reviewer notes
                <textarea
                  value={p.explanation || ""}
                  onChange={(e) => edit({ explanation: e.target.value })}
                />
              </label>
              <label>
                Evidence URL
                <input
                  type="url"
                  value={p.evidence?.[0]?.url || ""}
                  onChange={(e) =>
                    edit({
                      evidence: [
                        {
                          url: e.target.value,
                          note: p.evidence?.[0]?.note || "",
                          date: new Date().toISOString(),
                        },
                      ],
                    })
                  }
                />
              </label>
              {(p.evidence || []).map((e, i) => (
                <p key={i}>
                  <Source url={e.url} />
                  {e.note && ` · ${e.note}`}
                </p>
              ))}
              <div className="bi-grid">
                {(
                  settings.criteria?.[name] ||
                  CRITERIA[name] || [
                    "Completeness",
                    "Content quality",
                    "Activity",
                    "Branding",
                    "Calls to action",
                  ]
                ).map((c) => (
                  <label key={c}>
                    {c}
                    <select
                      value={p.criteria?.[c]?.score ?? ""}
                      onChange={(e) =>
                        edit({
                          criteria: {
                            ...p.criteria,
                            [c]: {
                              ...p.criteria?.[c],
                              score: e.target.value
                                ? Number(e.target.value)
                                : null,
                            },
                          },
                        })
                      }
                    >
                      <option value="">Unknown / not observed</option>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n}>{n}</option>
                      ))}
                    </select>
                    <input
                      aria-label={`${c} evidence / notes`}
                      placeholder="Evidence / notes"
                      value={p.criteria?.[c]?.notes || ""}
                      onChange={(e) =>
                        edit({
                          criteria: {
                            ...p.criteria,
                            [c]: { ...p.criteria?.[c], notes: e.target.value },
                          },
                        })
                      }
                    />
                  </label>
                ))}
              </div>
            </details>
          );
        })}
        <h3>Client suitability and contact signals</h3>
        <p>
          Only rate signals with evidence. Budget, willingness to pay, and
          unobserved engagement stay unknown.
        </p>
        <div className="bi-grid">
          {[...SIGNALS, "Contact readiness", "Previous engagement"].map(
            (name) => {
              const s = draft.signals?.[name] || {};
              return (
                <article key={name}>
                  <label>
                    {name} (0–100; blank = unknown)
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={s.value ?? ""}
                      onChange={(e) =>
                        change("signals", {
                          ...draft.signals,
                          [name]: {
                            ...s,
                            value:
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                          },
                        })
                      }
                    />
                  </label>
                  <label>
                    Evidence / explanation
                    <input
                      value={s.explanation || ""}
                      onChange={(e) =>
                        change("signals", {
                          ...draft.signals,
                          [name]: { ...s, explanation: e.target.value },
                        })
                      }
                    />
                  </label>
                </article>
              );
            },
          )}
        </div>
        {[
          ["summary", "Internal opportunity summary"],
          ["services", "Recommended services"],
          ["first_contact", "Suggested first contact approach"],
          ["client_summary", "Client-facing summary (safe to share)"],
          ["client_services", "Client-facing recommended next steps (safe to share)"],
          ["notes", "Reviewer notes"],
        ].map(([key, label]) => (
          <label key={key}>
            {label}
            <textarea
              value={draft[key] || ""}
              onChange={(e) => change(key, e.target.value)}
            />
          </label>
        ))}
      </fieldset>
      {writable && (
        <div className="actions">
          <button disabled={busy} onClick={() => save(false)}>
            Save review draft
          </button>
          <button
            className="primary"
            disabled={busy}
            onClick={() => save(true)}
          >
            Approve assessment
          </button>
          {latest && (
            <button
              disabled={busy}
              onClick={() =>
                command("research_reject", {
                  business_id: business.id,
                  id: latest.id,
                }).catch(() => {})
              }
            >
              Reject latest research
            </button>
          )}
        </div>
      )}
      <details>
        <summary>Research history ({runs.length})</summary>
        {runs.map((r) => (
          <article key={r.id}>
            <strong>
              {r.status} · {r.method} ·{" "}
              {new Date(r.created_at).toLocaleString()}
            </strong>
            <p>{r.assessment.summary}</p>
            <small>{r.limitations}</small>
          </article>
        ))}
      </details>
    </section>
  );
}
function CRMEditor({ business, profile, writable, command }) {
  const [crm, setCrm] = useState({
      ...profile?.crm,
      stage: profile?.crm?.stage || normalizeStage(business.stage),
    }),
    [error, setError] = useState("");
  const set = (k, v) => setCrm((c) => ({ ...c, [k]: v }));
  return (
    <section className="card">
      <h3>Sales pipeline · {business.name}</h3>
      {error && <p className="error">{error}</p>}
      <fieldset disabled={!writable}>
        <div className="bi-grid">
          <Select
            label="Pipeline stage"
            value={crm.stage}
            options={PIPELINE}
            onChange={(v) => set("stage", v)}
          />
          {[
            ["assignee", "Assigned person", "text"],
            ["last_contact", "Last contact", "date"],
            ["next_follow_up", "Next follow-up", "date"],
            ["potential_value", "Potential contract value", "number"],
            ["actual_value", "Actual contract value", "number"],
            ["proposal_status", "Proposal status", "text"],
          ].map(([key, label, type]) => (
            <label key={key}>
              {label}
              <input
                type={type}
                min={type === "number" ? 0 : undefined}
                value={crm[key] || ""}
                onChange={(e) => set(key, e.target.value)}
              />
            </label>
          ))}
        </div>
        {["services", "replies", "notes"].map((key) => (
          <label key={key}>
            {key}
            <textarea
              value={crm[key] || ""}
              onChange={(e) => set(key, e.target.value)}
            />
          </label>
        ))}
        <label>
          <input
            type="checkbox"
            checked={!!crm.do_not_contact}
            disabled={!!profile?.crm?.do_not_contact}
            onChange={(e) =>
              setCrm((c) => ({
                ...c,
                do_not_contact: e.target.checked,
                stage: e.target.checked ? "Closed / Not a Fit" : c.stage,
              }))
            }
          />
          Permanent Do Not Contact
        </label>
        <button
          onClick={async () => {
            try {
              await command("crm", {
                business_id: business.id,
                crm,
                version: profile?.updated_at,
              });
              setError("");
            } catch (e) {
              setError(e.message);
            }
          }}
        >
          Save pipeline details
        </button>
      </fieldset>
    </section>
  );
}
export default function Intelligence({
  repository,
  data,
  member,
  writable,
  onView,
  onRefresh,
  initialView,
}) {
  const [bi, setBi] = useState(null),
    [refresh, setRefresh] = useState(0),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [view, setView] = useState(initialView || "All Businesses"),
    [search, setSearch] = useState(""),
    [town, setTown] = useState("All"),
    [category, setCategory] = useState("All"),
    [site, setSite] = useState("All"),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [sort, setSort] = useState("Lead priority"),
    [stageFilter, setStageFilter] = useState("All"),
    [company, setCompany] = useState("All"),
    [selected, setSelected] = useState([]),
    [businessId, setBusinessId] = useState(null),
    [reportPage, setReportPage] = useState(1),
    [status, setStatus] = useState(null),
    [busy, setBusy] = useState(false),
    [settingsOpen, setSettingsOpen] = useState(false),
    [config, setConfig] = useState({
      weights: DEFAULT_WEIGHTS,
      platformWeights: DEFAULT_PLATFORM_WEIGHTS,
    });
  useEffect(() => {
    if (!repository.intelligence) return;
    let active = true;
    async function load() {
      try {
        const r = await repository.intelligence.load();
        if (active) {
          setBi(r);
          setConfig(
            r.settings[0]?.config || {
              weights: DEFAULT_WEIGHTS,
              platformWeights: DEFAULT_PLATFORM_WEIGHTS,
            },
          );
          setError("");
        }
      } catch (e) {
        if (active) setError(e.message);
      }
    }
    load();
    const id = setInterval(load, 15000);
    repository.intelligence
      .workerStatus()
      .then((s) => active && setStatus(s))
      .catch((e) => active && setStatus({ error: e.message }));
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [repository, refresh]);
  if (!repository.intelligence)
    return (
      <section className="card">
        <h2>Business Intelligence</h2>
        <p>
          Connect and sign in to the live workspace to research real businesses.
          Research is unavailable in practice mode.
        </p>
      </section>
    );
  async function command(action, input) {
    setBusy(true);
    try {
      const r = await repository.intelligence.command(action, input);
      setRefresh((n) => n + 1);
      onRefresh();
      setNotice("Saved.");
      return r;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  async function queue(ids) {
    setBusy(true);
    try {
      const n = await repository.intelligence.queue(ids);
      setNotice(
        `${n} businesses queued for cloud research. Existing active jobs were skipped.`,
      );
      setRefresh((n) => n + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!bi)
    return (
      <section className="card">
        <h2>Business Intelligence</h2>
        {error ? (
          <p className="error">{error}</p>
        ) : (
          <p>Loading protected research records…</p>
        )}
      </section>
    );
  const settings = bi.settings[0]?.config || {},
    profiles = new Map(bi.profiles.map((p) => [p.business_id, p])),
    latest = new Map();
  bi.research.forEach((r) => {
    if (
      !latest.has(r.business_id) &&
      r.status !== "Rejected" &&
      r.method !== "Previous approved assessment"
    )
      latest.set(r.business_id, r);
  });
  let rows = data.businesses
    .filter((b) => !isTown(b) && b.kind !== "Partner-owned Business")
    .map((b) => {
      const profile = profiles.get(b.id),
        run = latest.get(b.id),
        a = profile?.approved_at ? profile.approved : run?.assessment || {};
      return { b, profile, run, a, s: leadScores(a, profile?.crm, settings) };
    })
    .filter(({ b, profile, run, a, s }) => {
      if (
        stageFilter !== "All" &&
        (profile?.crm?.stage || normalizeStage(b.stage)) !== stageFilter
      )
        return false;
      if (
        search &&
        !`${b.name} ${b.city} ${b.email} ${b.categories?.join(" ")}`
          .toLowerCase()
          .includes(search.toLowerCase())
      )
        return false;
      if (
        (town !== "All" && b.city !== town) ||
        (category !== "All" && !b.categories?.includes(category)) ||
        (site !== "All" &&
          !data.listings.some((l) => l.business_id === b.id && l.site === site))
      )
        return false;
      const date = run?.created_at?.slice(0, 10);
      if (
        view !== "Team Productivity" &&
        ((start && (!date || date < start)) || (end && (!date || date > end)))
      )
        return false;
      if (["Research Queue", "Businesses Needing Research"].includes(view))
        return researchNeeded(profile);
      if (view === "Awaiting Approval")
        return run && ["Awaiting Review", "Partial"].includes(run.status);
      if (["Lead Rankings", "Top MKT Visibility Prospects"].includes(view))
        return ["High Priority", "Medium Priority"].includes(s.category);
      if (view === "Website Improvement Opportunities")
        return (
          a.platforms?.Website?.score <= 2 ||
          a.platforms?.Website?.state === "Missing"
        );
      if (view === "Google Business Profile Opportunities")
        return (
          a.platforms?.["Google Business Profile"]?.score <= 2 ||
          a.platforms?.["Google Business Profile"]?.state === "Missing"
        );
      if (view === "Social Media Opportunities")
        return PLATFORMS.slice(2).some(
          (p) =>
            a.platforms?.[p]?.relevant === true &&
            (a.platforms[p].score <= 2 || a.platforms[p].state === "Missing"),
        );
      if (view === "Warm Leads and Follow-ups")
        return (
          ["Interested", "Proposal Sent"].includes(profile?.crm?.stage) ||
          profile?.crm?.next_follow_up ||
          data.emails.some(
            (e) =>
              e.business_id === b.id &&
              e.direction === "Inbound" &&
              e.message_type === "Human",
          )
        );
      if (view === "Prospects") return b.kind === "Prospect";
      if (view === "Clients")
        return b.kind === "Client" || profile?.crm?.stage === "Client Won";
      if (view === "Proposals") return profile?.crm?.stage === "Proposal Sent";
      if (view === "Outreach")
        return (
          ["Ready to Contact", "Contacted"].includes(profile?.crm?.stage) &&
          !profile?.crm?.do_not_contact
        );
      if (view === "Follow-ups")
        return !!profile?.crm?.next_follow_up && !profile?.crm?.do_not_contact;
      return true;
    });
  rows.sort((x, y) =>
    sort === "Name"
      ? x.b.name.localeCompare(y.b.name)
      : sort === "Service need"
        ? (y.s.need ?? -1) - (x.s.need ?? -1)
        : (y.s.priority ?? -1) - (x.s.priority ?? -1),
  );
  const business = data.businesses.find((b) => b.id === businessId),
    profile = profiles.get(businessId);
  const reportIds = new Set(rows.map((r) => r.b.id));
  const productivity = [
    ...new Set(data.tasks.map((t) => t.assignee || "Unassigned")),
  ].flatMap((person) =>
    BRANDS.map((brand) => {
      const ts = data.tasks.filter(
        (t) =>
          (t.assignee || "Unassigned") === person &&
          (t.details?.company || brandOf(t, data)) === brand &&
          (company === "All" || company === brand) &&
          (!t.business_id || reportIds.has(t.business_id)) &&
          (!start || t.created_at?.slice(0, 10) >= start) &&
          (!end || t.created_at?.slice(0, 10) <= end),
      );
      return ts.length
        ? [
            {
              person,
              company: brand,
              assigned: ts.length,
              overdue: ts.filter(
                (t) =>
                  !["Done", "Cancelled"].includes(t.status) &&
                  t.due_date &&
                  t.due_date < new Date().toISOString().slice(0, 10),
              ).length,
              completed: ts.filter((t) => t.status === "Done").length,
            },
          ]
        : [];
    }),
  );
  const csv = rows.map(({ b, profile, run, a, s }) => ({
    business: b.name,
    city: b.city,
    category: b.categories?.join("; "),
    service_need: s.need,
    client_potential: s.potential,
    lead_priority: s.priority,
    research_coverage: s.coverage,
    priority: s.category,
    review: s.provisional ? "Provisional" : "Approved",
    stage: profile?.crm?.stage || normalizeStage(b.stage),
    do_not_contact: !!profile?.crm?.do_not_contact,
    reason: s.findings.join(" | "),
    next_follow_up: profile?.crm?.next_follow_up || "",
    potential_value: profile?.crm?.potential_value || "",
    researched_at: run?.created_at || "",
    approved_at: profile?.approved_at || "",
    verified_fields: Object.values(a.fields || {}).filter(
      (f) => f.verification === "Verified",
    ).length,
    summary: a.summary || "",
  }));
  return (
    <div className="bi">
      <section className="card bi-no-print">
        <div className="section-head">
          <div>
            <h2>Business Intelligence</h2>
            <p>
              {bi.profiles.length} central records connected ·{" "}
              {bi.research.length} research assessments ·{" "}
              {bi.profiles.filter((p) => p.approved_at).length} approved
            </p>
          </div>
          <button onClick={() => setSettingsOpen(!settingsOpen)}>
            Scoring settings
          </button>
        </div>
        <p className="info">
          Cloud research:{" "}
          {status?.configured
            ? "Connected"
            : status?.error ||
              "AI research key not configured — jobs will be marked Blocked. Manual research and review are available."}
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
        <div className="bi-tabs">
          {[
            "All Businesses",
            "Research Queue",
            "Awaiting Approval",
            "Lead Rankings",
            "Sales Pipeline",
            "Prospects",
            "Outreach",
            "Follow-ups",
            "Proposals",
            "Clients",
            "Opportunity Reports",
            "Suggested Tasks",
          ].map((v) => (
            <button
              className={view === v ? "primary" : ""}
              key={v}
              onClick={() => {
                setView(v);
                setBusinessId(null);
              }}
            >
              {v}
            </button>
          ))}
        </div>
        {settingsOpen && (
          <fieldset disabled={!writable || busy}>
            <legend>Explainable scoring configuration</legend>
            <div className="bi-grid">
              {Object.keys(DEFAULT_WEIGHTS).map((key) => (
                <label key={key}>
                  {key} weight %
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={config.weights?.[key] ?? DEFAULT_WEIGHTS[key]}
                    onChange={(e) =>
                      setConfig((c) => ({
                        ...c,
                        weights: {
                          ...c.weights,
                          [key]: Number(e.target.value),
                        },
                      }))
                    }
                  />
                </label>
              ))}
            </div>
            <p>
              Weights must total 100. Unknown components are omitted. A priority
              category requires service need, client potential, and 65%
              coverage. Platform relevance is judged per business.
            </p>
            <div className="bi-grid">
              {PLATFORMS.map((p) => (
                <label key={p}>
                  {p} service-need weight
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={
                      config.platformWeights?.[p] ?? DEFAULT_PLATFORM_WEIGHTS[p]
                    }
                    onChange={(e) =>
                      setConfig((c) => ({
                        ...c,
                        platformWeights: {
                          ...c.platformWeights,
                          [p]: Number(e.target.value),
                        },
                      }))
                    }
                  />
                </label>
              ))}
            </div>
            <label>
              Additional platform criteria (one platform: comma-separated
              criteria per line)
              <textarea
                value={config.criteriaText || ""}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    criteriaText: e.target.value,
                    criteria: Object.fromEntries(
                      e.target.value
                        .split("\n")
                        .filter((l) => l.includes(":"))
                        .map((l) => {
                          const [p, ...rest] = l.split(":");
                          return [
                            p.trim(),
                            rest
                              .join(":")
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          ];
                        }),
                    ),
                  }))
                }
              />
            </label>
            <button
              onClick={() =>
                command("settings", {
                  config,
                  workspace_id: WORKSPACE_ID,
                }).catch(() => {})
              }
            >
              Save scoring settings
            </button>
          </fieldset>
        )}
        <div className="filters">
          <label>
            Search
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <Select
            label="Town"
            value={town}
            onChange={setTown}
            options={[
              "All",
              ...new Set(data.businesses.map((b) => b.city).filter(Boolean)),
            ].sort()}
          />
          <Select
            label="Category"
            value={category}
            onChange={setCategory}
            options={[
              "All",
              ...new Set(data.businesses.flatMap((b) => b.categories || [])),
            ].sort()}
          />
          <Select
            label="Directory"
            value={site}
            onChange={setSite}
            options={["All", "Loving Longmont", "MKT Colorado"]}
          />
          <Select
            label="Pipeline stage"
            value={stageFilter}
            onChange={setStageFilter}
            options={["All", ...PIPELINE]}
          />
          <Select
            label="Company (team report)"
            value={company}
            onChange={setCompany}
            options={["All", ...BRANDS]}
          />
          <Select
            label="Sort"
            value={sort}
            onChange={setSort}
            options={["Lead priority", "Service need", "Name"]}
          />
          <label>
            Research from
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label>
            Through
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
        </div>
        <div className="actions">
          <button
            onClick={() =>
              exportCsv(
                view === "Team Productivity" ? productivity : csv,
                view === "Team Productivity"
                  ? "team-productivity.csv"
                  : "business-opportunities.csv",
              )
            }
          >
            Export filtered CSV
          </button>
          <button onClick={() => window.print()}>Print / Save PDF</button>
          {writable && (
            <>
              <button
                disabled={busy || !selected.length}
                onClick={() => queue(selected)}
              >
                Research selected ({selected.length})
              </button>
              <button
                disabled={busy || !rows.length}
                onClick={() =>
                  queue(
                    rows
                      .filter((r) => researchNeeded(r.profile))
                      .slice(0, 50)
                      .map((r) => r.b.id),
                  )
                }
              >
                Queue up to 50 needing research
              </button>
              <button onClick={() => setSelected(rows.map((r) => r.b.id))}>
                Select filtered businesses
              </button>
            </>
          )}
        </div>
      </section>
      {business ? (
        <>
          <button className="bi-no-print" onClick={() => setBusinessId(null)}>
            ← Back to results
          </button>
          <Assessment
            key={`${business.id}-${profile?.updated_at || ""}-${latest.get(business.id)?.id || ""}`}
            business={business}
            profile={profile}
            runs={bi.research.filter((r) => r.business_id === business.id)}
            writable={writable}
            command={command}
            settings={settings}
            onQueue={queue}
            onView={() => onView(business.id)}
          />
          <CRMEditor
            key={`${business.id}-${profile?.updated_at || ""}`}
            business={business}
            profile={profile}
            command={command}
            writable={writable}
          />
          <section className="card">
            <h3>Communication history</h3>
            {data.emails
              .filter((e) => e.business_id === business.id)
              .map((e) => (
                <article key={e.id}>
                  <strong>
                    {e.occurred_on || "Date unknown"} · {e.subject}
                  </strong>
                  <p>{messageSummary(e).summary}</p>
                  <small>
                    {e.direction} · {e.status}
                  </small>
                </article>
              ))}
          </section>
        </>
      ) : view === "Suggested Tasks" ? (
        <section className="card">
          <h3>Suggested tasks · approve before activation</h3>
          {bi.suggestions
            .filter((s) => s.status === "Suggested")
            .map((s) => (
              <article key={s.id}>
                <strong>
                  {s.title} ·{" "}
                  {data.businesses.find((b) => b.id === s.business_id)?.name}
                </strong>
                <p>{s.reason}</p>
                <small>
                  {s.category} · {s.execution}
                </small>
                {writable && (
                  <div className="actions">
                    {["Accept", "Reject"].map((decision) => (
                      <button
                        disabled={busy}
                        key={decision}
                        onClick={() =>
                          command("suggestion", {
                            id: s.id,
                            business_id: s.business_id,
                            decision,
                          }).catch(() => {})
                        }
                      >
                        {decision}
                      </button>
                    ))}
                  </div>
                )}
              </article>
            ))}
          {!bi.suggestions.some((s) => s.status === "Suggested") && (
            <p>No pending suggestions.</p>
          )}
        </section>
      ) : (
        <section className="card">
          <div className="section-head">
            <h3>
              {view} · {rows.length} businesses
            </h3>
            {view === "Opportunity Reports" && (
              <Select
                label="Report"
                value={view}
                options={["Opportunity Reports", ...REPORTS]}
                onChange={setView}
              />
            )}
          </div>
          {REPORTS.includes(view) && (
            <Select
              label="Report"
              value={view}
              options={REPORTS}
              onChange={setView}
            />
          )}
          {view === "Team Productivity" ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Person / company</th>
                    <th>Assigned</th>
                    <th>Overdue</th>
                    <th>Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {productivity.map((r) => (
                    <tr key={r.person + r.company}>
                      <td>
                        {r.person} · {r.company}
                      </td>
                      <td>{r.assigned}</td>
                      <td>{r.overdue}</td>
                      <td>{r.completed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th className="bi-no-print">Select</th>
                    <th>Business</th>
                    <th>Digital presence</th>
                    <th>Scores</th>
                    <th>Reason / next action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice((Math.min(reportPage,Math.max(1,Math.ceil(rows.length/25)))-1)*25,Math.min(reportPage,Math.max(1,Math.ceil(rows.length/25)))*25).map(({ b, profile, run, a, s }) => (
                    <tr key={b.id}>
                      <td className="bi-no-print">
                        <input
                          type="checkbox"
                          aria-label={`Select ${b.name}`}
                          checked={selected.includes(b.id)}
                          onChange={(e) =>
                            setSelected((v) =>
                              e.target.checked
                                ? [...v, b.id]
                                : v.filter((id) => id !== b.id),
                            )
                          }
                        />
                      </td>
                      <td>
                        <button
                          className="text-button"
                          onClick={() => onView(b.id)}
                        >
                          {b.name}
                        </button>
                        <small>
                          {b.city} · {b.categories?.join(", ")}
                        </small>
                        <small>
                          {profile?.crm?.stage || normalizeStage(b.stage)}
                          {profile?.crm?.do_not_contact
                            ? " · DO NOT CONTACT"
                            : ""}
                        </small>
                        <small>
                          Research: {run?.status || "Not researched"}
                        </small>
                      </td>
                      <td>
                        {PLATFORMS.slice(0, 5).map((p) => (
                          <small key={p}>
                            {p}: {ratingLabel(a.platforms?.[p])}
                          </small>
                        ))}
                      </td>
                      <td>
                        <strong>{s.priority ?? "—"}/100 priority</strong>
                        <small>
                          Need {s.need ?? "—"} · Potential {s.potential ?? "—"}
                        </small>
                        <small>
                          {s.category} · {s.coverage}% coverage
                        </small>
                        <small>
                          {s.provisional ? "Provisional" : "Approved"}
                        </small>
                      </td>
                      <td>
                        <p>
                          {a.summary ||
                            "Research is needed before recommending services."}
                        </p>
                        <small>
                          {profile?.crm?.next_follow_up
                            ? `Follow up ${profile.crm.next_follow_up}`
                            : a.first_contact || ""}
                        </small>
                        <button onClick={() => onView(b.id)}>
                          Review / rate
                        </button>
                        <button className="text-button" onClick={()=>setBusinessId(b.id)}>Advanced research</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {view!=='Team Productivity'&&rows.length>25&&<div className="actions bi-no-print"><button disabled={reportPage<=1} onClick={()=>setReportPage(p=>p-1)}>Previous businesses</button><span>Page {Math.min(reportPage,Math.ceil(rows.length/25))} of {Math.ceil(rows.length/25)}</span><button disabled={reportPage>=Math.ceil(rows.length/25)} onClick={()=>setReportPage(p=>p+1)}>Next businesses</button></div>}

        </section>
      )}
      <details className="card bi-no-print">
        <summary>Cloud research jobs ({bi.jobs.length})</summary>
        <p>
          {bi.jobs.filter((j) => j.status === "Queued").length} queued ·{" "}
          {bi.jobs.filter((j) => j.status === "Running").length} running ·{" "}
          {
            bi.jobs.filter((j) =>
              ["Awaiting Review", "Partial"].includes(j.status),
            ).length
          }{" "}
          returned for review ·{" "}
          {
            bi.jobs.filter((j) => ["Failed", "Blocked"].includes(j.status))
              .length
          }{" "}
          blocked or failed. Jobs run on the server one at a time. Sources
          requiring login are flagged. Blocked / failed jobs can be retried with
          Research Again.
        </p>
        {bi.jobs.slice(0, 50).map((j) => (
          <p key={j.id}>
            {data.businesses.find((b) => b.id === j.business_id)?.name} ·{" "}
            {j.status} · {j.error}
          </p>
        ))}
      </details>
      <p className="fine bi-no-print">
        Signed in as {member.display_name}. Internal scores and sales notes are
        private. No email is sent by this system.
      </p>
    </div>
  );
}
