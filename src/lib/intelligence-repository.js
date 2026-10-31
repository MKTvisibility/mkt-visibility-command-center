import { WORKSPACE_ID } from "./domain.js";
export function intelligenceRepository(client) {
  const query = async (promise) => {
    const { data, error } = await promise;
    if (error) throw error;
    return data;
  };
  async function rows(table) {
    const all = [];
    for (let offset = 0; ; offset += 500) {
      const r = await query(
        client
          .from(table)
          .select("*")
          .eq("workspace_id", WORKSPACE_ID)
          .order("created_at", { ascending: false })
          .order("id")
          .range(offset, offset + 499),
      );
      all.push(...r);
      if (r.length < 500) return all;
    }
  }
  return {
    async runVisibility(businessId,platforms){
      const {data,error}=await client.functions.invoke('research-business',{body:{action:'run',business_id:businessId,platforms}});
      if(error){
        let detail;
        try{detail=await error.context?.json()}catch{/* Use the transport error below. */}
        throw Error(detail?.error||error.message||'Automatic research could not start.');
      }
      if(data?.error)throw Error(data.error);
      return data;
    },
    async progressVisibility(businessId){const {data,error}=await client.functions.invoke('research-business',{body:{action:'progress',business_id:businessId}});if(error)throw error;return data},
    visibilityJob(businessId){return query(client.from('cc_bi_jobs').select('id,business_id,status,error,progress,started_at,created_at').eq('workspace_id',WORKSPACE_ID).eq('business_id',businessId).order('created_at',{ascending:false}).limit(1).maybeSingle())},
    visibilityRuns(businessId){return query(client.from('cc_visibility_research_runs').select('id,business_id,researched_at,status,research').eq('workspace_id',WORKSPACE_ID).eq('business_id',businessId).order('researched_at',{ascending:false}).limit(20))},
    profiles(){return rows("cc_bi_profiles")},
    profile(businessId){return query(client.from("cc_bi_profiles").select("*").eq("workspace_id",WORKSPACE_ID).eq("business_id",businessId).maybeSingle())},
    taskHistory(id) {
      return query(
        client
          .from("cc_audit_log")
          .select("id,action,created_at,changed_fields")
          .eq("workspace_id", WORKSPACE_ID)
          .eq("table_name", "cc_tasks")
          .eq("record_id", id)
          .order("created_at", { ascending: false })
          .limit(100),
      );
    },
    async load() {
      const values = await Promise.all(
        [
          "cc_bi_profiles",
          "cc_bi_research",
          "cc_bi_jobs",
          "cc_bi_suggestions",
          "cc_bi_settings",
        ].map(rows),
      );
      return Object.fromEntries(
        ["profiles", "research", "jobs", "suggestions", "settings"].map(
          (name, i) => [name, values[i]],
        ),
      );
    },
    command(action, input) {
      return query(
        client.rpc("cc_bi_command", {
          p_action: action,
          p_data: { ...input, workspace_id: WORKSPACE_ID },
        }),
      );
    },
    async queue(ids) {
      let count = 0;
      for (const business_id of [...new Set(ids)]) {
        const { error } = await client
          .from("cc_bi_jobs")
          .insert({ workspace_id: WORKSPACE_ID, business_id });
        if (error && error.code !== "23505") throw error;
        if (!error) count++;
      }
      return count;
    },
    async workerStatus() {
      const { data, error } = await client.functions.invoke(
        "research-business",
        { body: { action: "status" } },
      );
      if (error)
        throw Error(
          "Cloud research status unavailable. Check the deployed worker.",
        );
      return data;
    },
  };
}
