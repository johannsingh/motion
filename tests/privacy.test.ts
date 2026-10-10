import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync, readdirSync } from "node:fs";
const db = new PGlite({ extensions: { pgcrypto } });
const a = "00000000-0000-4000-a000-000000000001",
  b = "00000000-0000-4000-a000-000000000002",
  c = "00000000-0000-4000-a000-000000000003";
const shared = "10000000-0000-4000-a000-000000000001",
  privateId = "10000000-0000-4000-a000-000000000002";
async function asUser<T>(uid: string, fn: () => Promise<T>) {
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}
beforeAll(async () => {
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated,anon,service_role;grant execute on function auth.uid() to authenticated,anon,service_role;`,
  );
  for (const migration of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync("supabase/migrations/" + migration, "utf8"));
  await db.query("insert into auth.users(id) values ($1),($2),($3)", [a, b, c]);
  await db.query(
    "insert into habits(id,user_id,title,category,period,kind,target,unit,shared) values($1,$3,'Shared','Fitness','weekly','minimum',3,'sessions',true),($2,$3,'Private','Routine','daily','maximum',20,'minutes',false)",
    [shared, privateId, a],
  );
  await db.query(
    "insert into entries(user_id,habit_id,day,value) values($1,$2,'2026-09-27',1),($1,$3,'2026-09-27',10)",
    [a, shared, privateId],
  );
  await db.query(
    "insert into reviews(user_id,week,win) values($1,'2026-09-21','private note')",
    [a],
  );
});
afterAll(() => db.close());
it("invites pair two people and reject a third or reuse", async () => {
  const token = await asUser(a, async () =>
    String(
      (await db.query<{ create_invite: string }>("select create_invite()"))
        .rows[0].create_invite,
    ),
  );
  await asUser(b, () => db.query("select accept_invite($1)", [token]));
  await expect(
    asUser(c, () => db.query("select accept_invite($1)", [token])),
  ).rejects.toThrow();
});
it("friend reads only shared habits and entries, never reflections", async () => {
  await asUser(b, async () => {
    expect((await db.query("select * from habits")).rows).toHaveLength(1);
    expect((await db.query("select * from entries")).rows).toHaveLength(1);
    expect((await db.query("select * from reviews")).rows).toHaveLength(0);
  });
  await asUser(c, async () =>
    expect((await db.query("select * from habits")).rows).toHaveLength(0),
  );
});
it("friend cannot modify owner records or spoof imported data", async () => {
  await asUser(b, async () => {
    expect(
      (await db.query("update habits set shared=false returning *")).rows,
    ).toHaveLength(0);
    await expect(
      db.query(
        "insert into entries(user_id,habit_id,day,value) values($1,$2,'2026-09-26',5)",
        [b, shared],
      ),
    ).rejects.toThrow();
  });
  await asUser(a, async () => {
    await expect(
      db.query(
        "insert into entries(user_id,habit_id,day,value,source_key) values($1,$2,'2026-09-26',5,'whoop:fake')",
        [a, shared],
      ),
    ).rejects.toThrow();
    await expect(
      db.query("select * from provider_connections"),
    ).rejects.toThrow();
    await expect(
      db.query("select claim_whoop_sync($1)", [a]),
    ).rejects.toThrow();
  });
});
it("hiding a habit immediately hides its history", async () => {
  await asUser(a, () =>
    db.query("update habits set shared=false where id=$1", [shared]),
  );
  await asUser(b, async () =>
    expect((await db.query("select * from entries")).rows).toHaveLength(0),
  );
});
it("leaving revokes mutual access while keeping personal records", async () => {
  await asUser(b, () => db.query("select leave_pair()"));
  await asUser(b, async () =>
    expect((await db.query("select * from profiles")).rows).toHaveLength(1),
  );
  await asUser(a, async () =>
    expect((await db.query("select * from entries")).rows).toHaveLength(2),
  );
});
it("replayed WHOOP imports stay idempotent and preserve manual overrides", async () => {
  const rows = [
    { habit_id: shared, day: "2026-09-25", value: 1, source_key: "whoop:test" },
  ];
  await db.query("update habits set provider='whoop_gym' where id=$1", [
    shared,
  ]);
  await db.exec("set role service_role");
  try {
    for (let i = 0; i < 2; i++)
      await db.query(
        "select apply_whoop_entries($1,$2::jsonb,$3::date,$4::date,$5::text[])",
        [a, JSON.stringify(rows), "2026-09-25", "2026-09-25", []],
      );
    expect(
      (await db.query("select * from entries where source_key='whoop:test'"))
        .rows,
    ).toHaveLength(1);
    expect(
      (await db.query("select * from entries where source_key='manual'")).rows,
    ).toHaveLength(2);
    await db.query(
      "select apply_whoop_entries($1,$2::jsonb,null,null,$3::text[])",
      [a, "[]", ["whoop:test"]],
    );
    expect(
      (await db.query("select * from entries where source_key='whoop:test'"))
        .rows,
    ).toHaveLength(0);
  } finally {
    await db.exec("reset role");
  }
});
