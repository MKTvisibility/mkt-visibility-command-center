// Pure validation shared by the worker and tests. Web pages are untrusted data.
export function normalizeResearch(result, business) {
  if (result.status !== "completed")
    throw Error("Research response was incomplete.");
  const searches = (result.output || []).filter(
    (x) => x.type === "web_search_call" && x.status === "completed",
  );
  if (!searches.length)
    throw Error("No successful web research was performed.");
  const sources = new Set(
    searches.flatMap((x) => x.action?.sources || []).map((x) => x.url),
  );
  const contents = (result.output || [])
    .filter((x) => x.type === "message")
    .flatMap((x) => x.content || []);
  contents
    .flatMap((x) => x.annotations || [])
    .forEach((a) => {
      if (a.type === "url_citation") sources.add(a.url);
    });
  const text = contents
    .filter((x) => x.type === "output_text")
    .map((x) => x.text)
    .join("\n")
    .trim()
    .replace(/^```(?:json)?\s*/, "")
    .replace(/\s*```$/, "");
  const parsed = JSON.parse(text),
    a = parsed.assessment;
  if (!a || typeof a !== "object" || !a.platforms)
    throw Error("Research did not return an assessment.");
  if (business && a.business_id !== business.id)
    throw Error('Research identity did not match the requested business. No report was saved.');
  if (business && a.fields?.name?.value) {
    const name=value=>String(value).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
    if(name(a.fields.name.value)!==name(business.name))
      throw Error('Research returned a different business name. No report was saved.');
  }
  const limits = Array.isArray(parsed.limitations)
    ? parsed.limitations.map(String)
    : [];
  for (const [name, p] of Object.entries(a.platforms)) {
    p.evidence = (p.evidence || []).filter(
      (e) => sources.has(e.url) && /^https?:\/\//.test(e.url),
    );
    if ((p.score !== null && p.score !== undefined) || p.state === "Missing") {
      if (
        !p.evidence.length ||
        !p.explanation ||
        (p.score !== null &&
          p.score !== undefined &&
          (!Number.isInteger(p.score) || p.score < 1 || p.score > 5))
      ) {
        p.score = null;
        p.state = "Unable to Verify";
        limits.push(
          `${name}: rating could not be backed by retrieved sources.`,
        );
      }
    }
    // Empty platforms must never become an assumed missing presence.
    if (!p.state) p.state = "Not Researched";
  }
  for (const f of Object.values(a.fields || {}))
    if (f.verification === "Verified" && !sources.has(f.source)) {
      f.verification = "Uncertain";
      limits.push("A proposed fact lacked a retrieved supporting source.");
    }
  for (const [name, s] of Object.entries(a.signals || {}))
    if (
      s.value !== null &&
      s.value !== undefined &&
      (!Number.isFinite(s.value) ||
        s.value < 0 ||
        s.value > 100 ||
        !sources.has(s.source))
    ) {
      s.value = null;
      limits.push(`${name}: signal remains unknown without source evidence.`);
    }
  a.review_status = "Awaiting Review";
  a.researched_at = new Date().toISOString();
  a.sources = [...sources]
    .filter((s) => /^https?:\/\//.test(s))
    .map((url) => ({ url, date: a.researched_at }));
  a.third_party_mentions=(a.third_party_mentions||[]).filter(m=>sources.has(m.url));
  return {
    assessment: a,
    limitations: [...new Set(limits)],
    status: limits.length ? "Partial" : "Awaiting Review",
  };
}

export function visibilityRun(business,normalized,job){
 const a=normalized.assessment;
 const seen=new Set();
 const mentions=(a.third_party_mentions||[]).filter(m=>{
  try{const host=new URL(m.url).hostname.replace(/^www\./,'');
   if(seen.has(host)||host===new URL(business.website||'https://invalid.local').hostname.replace(/^www\./,''))return false;
   seen.add(host);return true;
  }catch{return false;}
 });
 return {workspace_id:job.workspace_id,business_id:business.id,researched_at:a.researched_at,status:'draft',method:'ai_public_web_search',research:{
  business_id:business.id,business:business.name,job_id:job.id,website:business.website,
  assessment:a,summary:a.summary||'',findings:a.opportunities||[],
  platform_notes:Object.fromEntries(Object.entries(a.platforms||{}).map(([name,p])=>[name,p.explanation||''])),
  social_accounts:Object.entries(a.platforms||{}).filter(([name,p])=>!['Website','Other','Google Business Profile'].includes(name)&&p.url).map(([name,p])=>({platform:name,url:p.url,verification:p.state})),
  tiktok_status:a.platforms?.TikTok?.explanation||'Recent activity unavailable.',
  third_party_mentions:mentions,backlink_reference_count:mentions.length,
  sources:a.sources,canvas_strengths:a.strengths||[],canvas_weaknesses:a.opportunities||[],
  action_plan:a.action_plan||[],limitations:normalized.limitations.join(' ')
 }};
}
export function suggestionsFor(a) {
  const tasks = [
    {
      key: "assessment-review",
      title: "Review and Approve Assessment",
      category: "Business Research",
      execution: "Human Review",
      reason:
        "Review source-backed facts and provisional ratings before approving.",
    },
  ];
  for (const [name, f] of Object.entries(a.fields || {}))
    if (!f.value || f.verification !== "Verified")
      tasks.push({
        key: `verify:${name}`,
        title: `Verify ${name === "email" ? "Contact Information" : name}`,
        category: "Verification",
        execution: "Human Review",
        reason: `${name} is missing or not verified. Missing data is not evidence of a business weakness.`,
      });
  for (const [name, p] of Object.entries(a.platforms || {}))
    if (
      p.relevant === true &&
      (p.state === "Missing" || (Number.isFinite(p.score) && p.score <= 2))
    )
      tasks.push({
        key: `opportunity:${name}`,
        title: `${name} Optimization Opportunity`,
        category:
          name === "Website"
            ? "Website"
            : name === "Google Business Profile"
              ? name
              : "Social Media",
        execution: "Human Review",
        reason: p.explanation || "Review the identified opportunity.",
      });
  return tasks;
}
