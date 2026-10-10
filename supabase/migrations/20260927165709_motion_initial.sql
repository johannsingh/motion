-- Run once in Supabase SQL editor. All personal tables are protected by RLS.
create schema if not exists extensions;
create schema if not exists private;
grant usage on schema private to authenticated;
create extension if not exists pgcrypto with schema extensions;
create table public.profiles (id uuid primary key references auth.users on delete cascade, name text not null default 'Friend' check(char_length(name) between 1 and 60), colour text not null default 'sunrise' check(colour in ('sunrise','tide','bloom')), timezone text not null default 'Europe/London', onboarded boolean not null default false);
create table public.pairs (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now());
create table public.memberships (user_id uuid primary key references public.profiles on delete cascade, pair_id uuid not null references public.pairs on delete cascade);
create table public.invites (token_hash text primary key, pair_id uuid not null references public.pairs on delete cascade, owner_id uuid not null references public.profiles on delete cascade, expires_at timestamptz not null default now()+interval '7 days');
create table public.habits (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles on delete cascade, title text not null check(char_length(title) between 1 and 100), category text not null check(category in ('Fitness','Health','Routine','Career','Net worth')), period text not null check(period in ('daily','weekly','monthly')), kind text not null check(kind in ('minimum','maximum','boolean')), target numeric not null check(target>0 and target<=1000000000), unit text not null check(char_length(unit) between 1 and 30), icon text not null default 'circle-check', shared boolean not null default false, archived boolean not null default false, provider text not null default 'manual' check(provider in ('manual','whoop_sleep','whoop_run','whoop_gym')), versions jsonb not null default '[]'::jsonb check(jsonb_typeof(versions)='array'), created_at timestamptz not null default now(), unique(id,user_id));
create table public.entries (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles on delete cascade, habit_id uuid not null, day date not null, value numeric not null check(value>=0 and value<=1000000000), source_key text not null default 'manual', created_at timestamptz not null default now(), foreign key(habit_id,user_id) references public.habits(id,user_id) on delete cascade, unique(habit_id,day,source_key));
create table public.goals (id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles on delete cascade,title text not null check(char_length(title) between 1 and 120),category text not null check(category in ('Fitness','Health','Routine','Career','Net worth')),target numeric not null default 1 check(target>0),value numeric not null default 0 check(value>=0),unit text not null default 'milestones',due_date date,shared boolean not null default false,completed boolean not null default false,milestones jsonb not null default '[]',created_at timestamptz not null default now());
create table public.messages (id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles on delete cascade,pair_id uuid not null references public.pairs on delete cascade,body text not null check(char_length(body) between 1 and 500),created_at timestamptz not null default now());
create table public.reviews (id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles on delete cascade,week date not null,win text not null default '',adjustment text not null default '',created_at timestamptz not null default now(),unique(user_id,week));
-- Integration secrets are inaccessible through authenticated/anonymous Data API roles.
create table public.provider_connections (user_id uuid primary key references public.profiles on delete cascade,whoop_user_id bigint unique not null,tokens text not null,expires_at timestamptz not null,last_sync timestamptz,needs_reconnect boolean not null default false,lock_until timestamptz);
create table public.webhook_events (event_id text primary key,received_at timestamptz not null default now());
create index entries_user_day_idx on public.entries(user_id,day);
create index membership_pair_idx on public.memberships(pair_id);
create index messages_pair_idx on public.messages(pair_id,created_at);

create function private.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$begin insert into public.profiles(id,name) values(new.id,coalesce(nullif(left(new.raw_user_meta_data->>'name',60),''),'Friend'));return new;end;$$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure private.handle_new_user();
create function private.are_paired(other uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from memberships a join memberships b using(pair_id) where a.user_id=auth.uid() and b.user_id=other and a.user_id<>b.user_id);$$;
create function private.in_pair(pair uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from memberships where pair_id=pair and user_id=auth.uid());$$;
revoke all on function private.are_paired(uuid),private.in_pair(uuid) from public;
grant execute on function private.are_paired(uuid),private.in_pair(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.pairs enable row level security;
alter table public.memberships enable row level security;
alter table public.invites enable row level security;
alter table public.habits enable row level security;
alter table public.entries enable row level security;
alter table public.goals enable row level security;
alter table public.messages enable row level security;
alter table public.reviews enable row level security;
alter table public.provider_connections enable row level security;
alter table public.webhook_events enable row level security;
revoke all on public.provider_connections,public.webhook_events from anon,authenticated;
create policy profile_read on public.profiles for select to authenticated using(id=auth.uid() or private.are_paired(id));
create policy profile_update on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy pair_read on public.pairs for select to authenticated using(private.in_pair(id));
create policy member_read on public.memberships for select to authenticated using(private.in_pair(pair_id));
create policy habits_read on public.habits for select to authenticated using(user_id=auth.uid() or (shared and private.are_paired(user_id)));
create policy habits_insert on public.habits for insert to authenticated with check(user_id=auth.uid());
create policy habits_update on public.habits for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy habits_delete on public.habits for delete to authenticated using(user_id=auth.uid());
create policy entries_read on public.entries for select to authenticated using(user_id=auth.uid() or (private.are_paired(user_id) and exists(select 1 from public.habits h where h.id=habit_id and h.shared)));
create policy entries_insert on public.entries for insert to authenticated with check(user_id=auth.uid() and source_key='manual');
create policy entries_update on public.entries for update to authenticated using(user_id=auth.uid() and source_key='manual') with check(user_id=auth.uid() and source_key='manual');
create policy entries_delete on public.entries for delete to authenticated using(user_id=auth.uid() and source_key='manual');
create policy goals_read on public.goals for select to authenticated using(user_id=auth.uid() or (shared and private.are_paired(user_id)));
create policy goals_insert on public.goals for insert to authenticated with check(user_id=auth.uid());
create policy goals_update on public.goals for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy goals_delete on public.goals for delete to authenticated using(user_id=auth.uid());
create policy messages_read on public.messages for select to authenticated using(private.in_pair(pair_id));
create policy messages_insert on public.messages for insert to authenticated with check(user_id=auth.uid() and private.in_pair(pair_id));
create policy messages_delete on public.messages for delete to authenticated using(user_id=auth.uid());
create policy reviews_owner on public.reviews for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

-- Pair operations are atomic. User locks prevent concurrent memberships; pair lock prevents a third member.
create function public.create_invite() returns text language plpgsql security definer set search_path=public,extensions as $$declare p uuid; t text;begin
 if auth.uid() is null then raise exception 'Sign in first';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select pair_id into p from memberships where user_id=auth.uid();
 if p is null then insert into pairs default values returning id into p;insert into memberships(user_id,pair_id) values(auth.uid(),p);end if;
 perform 1 from pairs where id=p for update;
 if (select count(*) from memberships where pair_id=p)>1 then raise exception 'You are already paired';end if;
 delete from invites where pair_id=p;
 t=encode(gen_random_bytes(24),'hex');insert into invites(token_hash,pair_id,owner_id) values(encode(digest(t,'sha256'),'hex'),p,auth.uid());return t;
end;$$;
create function public.accept_invite(token text) returns uuid language plpgsql security definer set search_path=public,extensions as $$declare p uuid;owner uuid;begin
 if auth.uid() is null then raise exception 'Sign in first';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select pair_id,owner_id into p,owner from invites where token_hash=encode(digest(token,'sha256'),'hex') and expires_at>now();
 if p is null then raise exception 'Invitation expired or already used';end if;
 perform 1 from pairs where id=p for update;
 if not exists(select 1 from invites where pair_id=p and token_hash=encode(digest(token,'sha256'),'hex') and expires_at>now()) then raise exception 'Invitation expired or already used';end if;
 if owner=auth.uid() then raise exception 'Share this invitation with your friend';end if;
 if exists(select 1 from memberships where user_id=auth.uid()) then raise exception 'Leave your current circle before joining';end if;
 if (select count(*) from memberships where pair_id=p)>=2 then raise exception 'This circle is full';end if;
 insert into memberships(user_id,pair_id) values(auth.uid(),p);delete from invites where pair_id=p;return p;
end;$$;
create function public.leave_pair() returns void language plpgsql security definer set search_path=public as $$declare p uuid;begin
 if auth.uid() is null then raise exception 'Sign in first';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));select pair_id into p from memberships where user_id=auth.uid();
 if p is not null then perform 1 from pairs where id=p for update;delete from pairs where id=p;end if;
end;$$;
revoke all on function public.create_invite(),public.accept_invite(text),public.leave_pair() from public;
grant execute on function public.create_invite(),public.accept_invite(text),public.leave_pair() to authenticated;
-- Lock is acquired atomically before refreshing rotating WHOOP tokens.
create function public.claim_whoop_sync(uid uuid) returns boolean language plpgsql security definer set search_path=public as $$declare n int;begin update provider_connections set lock_until=now()+interval '5 minutes' where user_id=uid and (lock_until is null or lock_until<now());get diagnostics n=row_count;return n=1;end;$$;
revoke all on function public.claim_whoop_sync(uuid) from public,anon,authenticated;
grant execute on function public.claim_whoop_sync(uuid) to service_role;

-- Explicit privileges: RLS remains the authorization boundary.
revoke all on public.invites from anon,authenticated;
grant select,update on public.profiles to authenticated;
grant select on public.pairs,public.memberships to authenticated;
grant select,insert,update,delete on public.habits,public.entries,public.goals,public.reviews to authenticated;
grant select,insert,delete on public.messages to authenticated;
grant all on all tables in schema public to service_role;
revoke all on function private.handle_new_user() from public,anon,authenticated;
-- Transactional replacement makes updates, deletions and retries idempotent.
create function public.apply_whoop_entries(uid uuid,rows jsonb,from_day date,to_day date,source_keys text[]) returns void language plpgsql security definer set search_path=public as $$begin
 delete from entries where user_id=uid and source_key like 'whoop:%' and (source_key=any(source_keys) or (from_day is not null and day between from_day and to_day and habit_id in(select id from habits where user_id=uid and provider<>'manual' and not archived)) or exists(select 1 from jsonb_array_elements(rows) x where x->>'source_key'=entries.source_key and (x->>'habit_id')::uuid=entries.habit_id));
 insert into entries(user_id,habit_id,day,value,source_key) select uid,(x->>'habit_id')::uuid,(x->>'day')::date,(x->>'value')::numeric,x->>'source_key' from jsonb_array_elements(rows) x;
end;$$;
revoke all on function public.apply_whoop_entries(uuid,jsonb,date,date,text[]) from public,anon,authenticated;
grant execute on function public.apply_whoop_entries(uuid,jsonb,date,date,text[]) to service_role;
