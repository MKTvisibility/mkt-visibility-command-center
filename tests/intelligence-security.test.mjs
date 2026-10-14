import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const ws = "c8748032-cdd3-443b-8c56-2e846cc9bf31",
  editor = "11111111-1111-4111-8111-111111111111",
  viewer = "22222222-2222-4222-8222-222222222222",
  stranger = "33333333-3333-4333-8333-333333333333",
  b = "44444444-4444-4444-8444-444444444444";
test("BI migration preserves existing data and enforces workspace isolation, approval and suppression", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role authenticated;create role anon;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`,
    );
    for (const name of [
      "202610110001_command_center.sql",
      "202610110002_business_profiles.sql",
      "202610110003_message_types.sql",
      "20261011083117_task_completion.sql",
    ])
      await db.exec(
        readFileSync(
          new URL("../supabase/migrations/" + name, import.meta.url),
          "utf8",
        ),
      );
    await db.exec(
      `insert into auth.users values('${editor}'),('${viewer}'),('${stranger}');insert into cc_members values('${ws}','${editor}','Michelle','owner',true),('${ws}','${viewer}','Tim','viewer',true);insert into cc_businesses(id,name) values('${b}','Existing business');insert into cc_tasks(title,status) values('Existing completed task','Open');`,
    );
    await db.exec(
      readFileSync(
        new URL(
          "../supabase/migrations/20261014023756_business_intelligence.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(readFileSync(new URL('../supabase/migrations/20261014030107_business_intelligence_consistency.sql',import.meta.url),'utf8'));
    const q = async (s) => (await db.query(s)).rows;
    const as = async (id, role = "authenticated") =>
      db.exec(
        `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role ${role};`,
      );
    assert.equal(
      (await q("select count(*) as n from cc_bi_private.backup_20261014"))[0].n,
      2,
    );
    assert.equal((await q("select count(*) as n from cc_bi_profiles"))[0].n, 1);
    await as("", "anon");
    await assert.rejects(
      () => db.exec("select * from cc_bi_profiles"),
      /permission denied/,
    );
    await as(stranger);
    assert.equal((await q("select * from cc_bi_profiles")).length, 0);
    await as(viewer);
    await assert.rejects(
      () =>
        db.exec(
          `select cc_bi_command('crm','{"workspace_id":"${ws}","business_id":"${b}","crm":{"stage":"Contacted"}}')`,
        ),
      /editor access/,
    );
    await as(editor);
    await assert.rejects(
      () =>
        db.exec(
          `update cc_bi_profiles set approved='{"platforms":{"Website":{"score":1}}}'`,
        ),
      /explanations/,
    );
    await db.exec(
      `select cc_bi_command('approve','{"workspace_id":"${ws}","business_id":"${b}","assessment":{"platforms":{"Website":{"score":3,"explanation":"Observed source","evidence":[{"url":"https://example.com"}]}}}}')`,
    );
    assert.equal(
      (await q("select approved_by from cc_bi_profiles"))[0].approved_by,
      editor,
    );
    await db.exec(
      `select cc_bi_command('crm','{"workspace_id":"${ws}","business_id":"${b}","crm":{"stage":"Closed / Not a Fit","do_not_contact":true}}')`,
    );
    await assert.rejects(
      () => db.exec(`update cc_bi_profiles set crm='{"do_not_contact":false}'`),
      /permanent/,
    );
    await db.exec(
      `select cc_bi_command('suggest','{"workspace_id":"${ws}","business_id":"${b}","key":"review","title":"Review research"}')`,
    );
    const s = (await q("select id from cc_bi_suggestions"))[0];
    const accept = `select cc_bi_command('suggestion','{"workspace_id":"${ws}","business_id":"${b}","id":"${s.id}","decision":"Accept"}')`;
    await db.exec(accept);
    await db.exec(accept);
    assert.equal(
      (
        await q(
          "select count(*) as n from cc_tasks where title='Review research'",
        )
      )[0].n,
      1,
    );
    await db.exec(
      `insert into cc_tasks(title,due_date,details) values('Weekly check','2026-10-14','{"recurrence":"Weekly","company":"MKT Visibility"}');update cc_tasks set status='Done' where title='Weekly check';`,
    );
    assert.equal(
      (
        await q(
          "select due_date::text from cc_tasks where title='Weekly check' and status='Open'",
        )
      )[0].due_date,
      "2026-10-21",
    );
    await assert.rejects(
      () =>
        db.exec(
          `insert into cc_tasks(title,details) values('Invalid dependency','{"dependencies":["${b}"]}')`,
        ),
      /Invalid dependency/,
    );
    await as(viewer);
    await assert.rejects(
      () =>
        db.exec(
          `insert into cc_bi_jobs(workspace_id,business_id) values('${ws}','${b}')`,
        ),
      /row-level security/,
    );
  } finally {
    await db.close();
  }
});
