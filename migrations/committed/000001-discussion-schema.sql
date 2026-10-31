--! Previous: -
--! Hash: sha1:4729b170a799ca7749f3470a3bf1d5b0e0b5aae2
--! Message: discussion schema

--! split: 0010-discussion.sql
create schema if not exists auth;
create schema if not exists hidden;

grant usage on schema public to :DATABASE_VISITOR;
grant usage on schema auth to :DATABASE_VISITOR;

alter default privileges for role :DATABASE_OWNER in schema public
  grant select, insert, update, delete on tables to :DATABASE_VISITOR;

alter default privileges for role :DATABASE_OWNER in schema public
  grant usage, select on sequences to :DATABASE_VISITOR;

alter default privileges for role :DATABASE_OWNER in schema public
  grant execute on functions to :DATABASE_VISITOR;

alter default privileges for role :DATABASE_OWNER in schema auth
  grant select on tables to :DATABASE_VISITOR;

alter default privileges for role :DATABASE_OWNER in schema auth
  grant execute on functions to :DATABASE_VISITOR;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  username citext not null unique,
  avatar_url text
);

create table if not exists auth.oauth_accounts (
  provider text not null,
  provider_user_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (provider, provider_user_id),
  unique (user_id, provider)
);

create or replace function auth.current_session_id() returns text as $$
  select nullif(current_setting('dfgcodes.session_id', true), '')
$$ language sql stable;

grant execute on function auth.current_session_id() to :DATABASE_VISITOR;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  username citext not null unique check (char_length(username) between 3 and 32),
  avatar_url text,
  user_id uuid not null unique references auth.users(id) on delete cascade
);

create table if not exists hidden.sessions (
  id uuid primary key default gen_random_uuid(),
  cookie_id text not null unique,
  secret_hash text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null
);

create or replace function auth.uid() returns uuid as $$
  select sessions.user_id
  from hidden.sessions sessions
  where sessions.cookie_id = auth.current_session_id()
    and sessions.expires_at > now()
  order by sessions.expires_at desc
  limit 1
$$ language sql stable security definer set search_path = pg_catalog, pg_temp;

grant execute on function auth.uid() to :DATABASE_VISITOR;

create or replace function public.create_profile() returns trigger as $$
begin
  insert into public.profiles (user_id, username, avatar_url)
  values (new.id, new.username, new.avatar_url);

  return new;
end;
$$ language plpgsql security definer set search_path = public, auth, pg_catalog;

drop trigger if exists create_profile on auth.users;

create trigger create_profile
  after insert on auth.users
  for each row
  execute function public.create_profile();

create table if not exists public.comments (
  comment_id integer generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles(user_id) on delete cascade,
  slug text not null check (char_length(slug) > 0),
  body text not null check (char_length(body) between 1 and 10000),
  parent_id integer references public.comments(comment_id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create or replace function hidden.tg__timestamps() returns trigger as $$
begin
  new.updated_at = case
    when tg_op = 'update' and old.updated_at >= now()
      then old.updated_at + interval '1 millisecond'
    else now()
  end;

  return new;
end;
$$ language plpgsql;

drop trigger if exists comments_updated_at on public.comments;

create trigger comments_updated_at
  before update on public.comments
  for each row
  execute function hidden.tg__timestamps();

create or replace function public.soft_delete_comment() returns trigger as $$
begin
  update public.comments
  set deleted_at = now()
  where comment_id = old.comment_id
    and deleted_at is null;

  return null;
end;
$$ language plpgsql;

drop trigger if exists comments_soft_delete_trigger on public.comments;

create trigger comments_soft_delete_trigger
before delete on public.comments
for each row
execute function public.soft_delete_comment();

create or replace function public.request_ip_address() returns text as $$
  select coalesce(
    nullif(current_setting('dfgcodes.headers', true)::jsonb ->> 'cf-connecting-ip', ''),
    nullif(split_part(current_setting('dfgcodes.headers', true)::jsonb ->> 'x-forwarded-for', ',', 1), ''),
    nullif(current_setting('dfgcodes.ip_address', true), ''),
    '127.0.0.1'
  )
$$ language sql stable;

create or replace function public.comment_tree(
  root_comment_id integer,
  depth integer default 0,
  depth_limit integer default 6
) returns json as $$
  select json_build_object(
    'comment_id', c.comment_id,
    'user', json_build_object(
      'username', p.username,
      'avatar_url', p.avatar_url,
      'user_id', p.user_id
    ),
    'body', case when c.deleted_at is null then c.body else '' end,
    'created_at', c.created_at,
    'children', coalesce(
      (
        select json_agg(child_comment_tree order by created_at)
        from (
          select
            comments.created_at,
            public.comment_tree(comments.comment_id, depth + 1, depth_limit) as child_comment_tree
          from public.comments
          where comments.parent_id = c.comment_id
            and depth < depth_limit
        ) child_comments
        where child_comment_tree is not null
      ),
      '[]'::json
    )
  )
  from public.comments c
  join public.profiles p on p.user_id = c.user_id
  where c.comment_id = root_comment_id
$$ language sql stable;

create or replace function public.threaded_comments(
  input_slug text
) returns json as $$
  select coalesce(
    (
      select json_agg(comment_tree order by created_at desc)
      from (
        select
          c.created_at,
          public.comment_tree(c.comment_id) as comment_tree
        from public.comments c
        where c.slug = input_slug
          and c.parent_id is null
      ) root_comments
      where comment_tree is not null
    ),
    '[]'::json
  )
$$ language sql stable;

create or replace function public.comments_stats() returns json as $$
  select coalesce(jsonb_object_agg(slug, count), '{}'::jsonb)
  from (
    select
      slug,
      count(*)::integer as count
    from public.comments
    where deleted_at is null
    group by slug
  ) as per_post
$$ language sql stable;

create table if not exists hidden.likes (
  id text not null default encode(digest(public.request_ip_address(), 'sha256'), 'hex'),
  slug text not null,
  votes integer not null check (votes between 0 and 10),
  primary key (id, slug)
);

create or replace function public.get_likes(input_slug text) returns json as $$
  select json_build_object(
    'total', coalesce(sum(votes), 0),
    'available', 10 - coalesce((
      select votes
      from hidden.likes
      where likes.slug = input_slug
        and id = encode(digest(public.request_ip_address(), 'sha256'), 'hex')
    ), 0),
    'max', 10
  )
  from hidden.likes
  where likes.slug = input_slug
$$ language sql stable security definer set search_path = hidden, public, pg_catalog;

create or replace function public.like_post(
  input_post_id text,
  requested_votes integer default 1
) returns json as $$
declare
  likes json;
begin
  insert into hidden.likes (slug, votes)
  values (input_post_id, requested_votes)
  on conflict (id, slug) do update
    set votes = requested_votes;

  likes := public.get_likes(input_post_id);
  return likes;
end;
$$ language plpgsql volatile security definer set search_path = hidden, public, pg_catalog;

create or replace function public.top_posts()
returns json
language sql
stable
as $$
  with comment_counts as (
    select
      c.slug,
      count(*)::integer as comment_count
    from public.comments c
    where c.deleted_at is null
    group by c.slug
  ),
  like_totals as (
    select
      l.slug,
      coalesce(sum(l.votes), 0)::integer as total_votes
    from hidden.likes l
    group by l.slug
  ),
  latest_comments as (
    select distinct on (c.slug)
      c.slug,
      c.comment_id,
      c.body,
      c.created_at,
      c.updated_at,
      p.username,
      coalesce(p.avatar_url::text, '') as avatar_url,
      coalesce(reply_to.username::text, '') as replying_to_username,
      coalesce(reply_to.avatar_url::text, '') as replying_to_avatar_url
    from public.comments c
    join public.profiles p on p.user_id = c.user_id
    left join public.comments parent on parent.comment_id = c.parent_id
    left join public.profiles reply_to on reply_to.user_id = parent.user_id
    where c.deleted_at is null
    order by c.slug, c.created_at desc
  )
  select coalesce(
    json_agg(
      json_build_object(
        'slug', comment_counts.slug,
        'comment_count', comment_counts.comment_count,
        'total_votes', coalesce(like_totals.total_votes, 0),
        'latest_comment', case
          when latest_comments.comment_id is null then null
          else json_build_object(
            'comment_id', latest_comments.comment_id,
            'user', json_build_object(
              'username', latest_comments.username,
              'avatarUrl', latest_comments.avatar_url
            ),
            'replying_to', json_build_object(
              'username', latest_comments.replying_to_username,
              'avatarUrl', latest_comments.replying_to_avatar_url
            ),
            'slug', latest_comments.slug,
            'body', latest_comments.body,
            'created_at', latest_comments.created_at,
            'updated_at', latest_comments.updated_at
          )
        end
      )
      order by comment_counts.comment_count desc, coalesce(like_totals.total_votes, 0) desc, comment_counts.slug asc
    ),
    '[]'::json
  )
  from comment_counts
  left join like_totals on like_totals.slug = comment_counts.slug
  left join latest_comments on latest_comments.slug = comment_counts.slug
$$;

grant select, insert, update on public.profiles to :DATABASE_VISITOR;
grant select, insert, update, delete on public.comments to :DATABASE_VISITOR;
grant usage, select on sequence public.comments_comment_id_seq to :DATABASE_VISITOR;
grant execute on function public.threaded_comments(text) to :DATABASE_VISITOR;
grant execute on function public.comments_stats() to :DATABASE_VISITOR;
grant execute on function public.get_likes(text) to :DATABASE_VISITOR;
grant execute on function public.like_post(text, integer) to :DATABASE_VISITOR;
grant execute on function public.top_posts() to :DATABASE_VISITOR;

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to :DATABASE_VISITOR
  using (true);

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert
  to :DATABASE_VISITOR
  with check (auth.uid() = user_id);

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update
  to :DATABASE_VISITOR
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists profiles_owner_manage on public.profiles;
create policy profiles_owner_manage on public.profiles
  for all to :DATABASE_OWNER
  using (true)
  with check (true);

alter table public.comments enable row level security;
alter table public.comments force row level security;

drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments
  for select to :DATABASE_VISITOR
  using (true);

drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments
  for insert to :DATABASE_VISITOR
  with check (auth.uid() = user_id);

drop policy if exists comments_update on public.comments;
create policy comments_update on public.comments
  for update to :DATABASE_VISITOR
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments
  for delete to :DATABASE_VISITOR
  using (auth.uid() = user_id);

drop policy if exists comments_owner_manage on public.comments;
create policy comments_owner_manage on public.comments
  for all to :DATABASE_OWNER
  using (true)
  with check (true);

commit;
