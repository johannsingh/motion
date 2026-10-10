-- DRAFT — not yet applied to the live Supabase project. Review before running.
-- Adds competitive habit-matching on top of the existing pairing/Together feature,
-- without touching pairs/memberships/habits/entries semantics already in production.

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles on delete cascade,
  title text not null check(char_length(title) between 1 and 100),
  category text not null check(category in ('Fitness','Health','Routine','Career','Net worth')),
  period text not null check(period in ('daily','weekly','monthly')),
  kind text not null check(kind in ('minimum','maximum','boolean')),
  target numeric not null check(target > 0 and target <= 1000000000),
  unit text not null check(char_length(unit) between 1 and 30),
  icon text not null default 'trophy',
  starts_on date not null default current_date,
  ends_on date,
  created_at timestamptz not null default now()
);

create table public.challenge_members (
  challenge_id uuid not null references public.challenges on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  habit_id uuid not null references public.habits on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

create table public.challenge_invites (
  token_hash text primary key,
  challenge_id uuid not null references public.challenges on delete cascade,
  owner_id uuid not null references public.profiles on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days'
);

create index challenge_members_user_idx on public.challenge_members(user_id);
create index challenge_members_challenge_idx on public.challenge_members(challenge_id);
create index challenge_invites_challenge_idx on public.challenge_invites(challenge_id);

alter table public.challenges enable row level security;
alter table public.challenge_members enable row level security;
alter table public.challenge_invites enable row level security;

create function private.in_challenge(c uuid) returns boolean language sql stable security definer set search_path=public as
  $$select exists(select 1 from challenge_members where challenge_id = c and user_id = (select auth.uid()));$$;
revoke all on function private.in_challenge(uuid) from public;
grant execute on function private.in_challenge(uuid) to authenticated;

-- Members can see the challenge and roster of any challenge they belong to.
create policy challenges_read on public.challenges for select to authenticated
  using (private.in_challenge(id));
create policy challenges_insert on public.challenges for insert to authenticated
  with check (creator_id = (select auth.uid()));
create policy challenge_members_read on public.challenge_members for select to authenticated
  using (private.in_challenge(challenge_id));
create policy challenge_invites_read on public.challenge_invites for select to authenticated
  using (owner_id = (select auth.uid()));

-- Leaderboard entries piggyback on the existing habits/entries RLS: a challenge member's
-- habit row must become readable to the rest of the challenge, not just a paired friend.
drop policy habits_read on public.habits;
create policy habits_read on public.habits for select to authenticated
  using (
    user_id = (select auth.uid())
    or (shared and private.are_paired(user_id))
    or exists (
      select 1 from challenge_members cm
      where cm.habit_id = habits.id and private.in_challenge(cm.challenge_id)
    )
  );
drop policy entries_read on public.entries;
create policy entries_read on public.entries for select to authenticated
  using (
    user_id = (select auth.uid())
    or (private.are_paired(user_id) and exists (select 1 from public.habits h where h.id = habit_id and h.shared))
    or exists (
      select 1 from challenge_members cm
      where cm.habit_id = entries.habit_id and private.in_challenge(cm.challenge_id)
    )
  );

-- Atomic join: clones the challenge's habit definition for the joining member.
-- Follows the hardened pattern from 20260927172350 (private schema + thin public
-- security-invoker wrapper), not the pre-hardening pattern from the initial migration.
create function private.join_challenge(token text) returns uuid language plpgsql security definer set search_path=public,extensions as $$
declare c uuid; ch record; h uuid; begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select challenge_id into c from challenge_invites
    where token_hash = encode(digest(token,'sha256'),'hex') and expires_at > now();
  if c is null then raise exception 'Invitation expired or already used'; end if;
  if exists (select 1 from challenge_members where challenge_id = c and user_id = auth.uid()) then
    raise exception 'Already in this challenge';
  end if;
  select * into ch from challenges where id = c;
  insert into habits(user_id, title, category, period, kind, target, unit, icon, shared, provider, versions)
    values (auth.uid(), ch.title, ch.category, ch.period, ch.kind, ch.target, ch.unit, ch.icon, true, 'manual',
      jsonb_build_array(jsonb_build_object('effective_on', ch.starts_on, 'target', ch.target)))
    returning id into h;
  insert into challenge_members(challenge_id, user_id, habit_id) values (c, auth.uid(), h);
  return c;
end;$$;
create function private.create_challenge_invite(challenge uuid) returns text language plpgsql security definer set search_path=public,extensions as $$
declare t text; begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if not exists (select 1 from challenges where id = challenge and creator_id = auth.uid()) then
    raise exception 'Only the creator can invite';
  end if;
  t = encode(gen_random_bytes(24),'hex');
  insert into challenge_invites(token_hash, challenge_id, owner_id)
    values (encode(digest(t,'sha256'),'hex'), challenge, auth.uid());
  return t;
end;$$;
revoke all on function private.join_challenge(text), private.create_challenge_invite(uuid) from public, anon;
grant execute on function private.join_challenge(text), private.create_challenge_invite(uuid) to authenticated;

create function public.join_challenge(token text) returns uuid language sql security invoker set search_path='' as
  $$select private.join_challenge(token);$$;
create function public.create_challenge_invite(challenge uuid) returns text language sql security invoker set search_path='' as
  $$select private.create_challenge_invite(challenge);$$;
revoke all on function public.join_challenge(text), public.create_challenge_invite(uuid) from public, anon;
grant execute on function public.join_challenge(text), public.create_challenge_invite(uuid) to authenticated;

grant select, insert on public.challenges to authenticated;
grant select on public.challenge_members to authenticated;
grant select on public.challenge_invites to authenticated;
revoke all on public.challenge_invites from anon;
