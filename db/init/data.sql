do $$
begin
  create role anon nologin;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create role authenticated nologin;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create role visitor nologin;
exception
  when duplicate_object then null;
end;
$$;

grant anon to current_user;
grant authenticated to current_user;
grant visitor to current_user;

create schema if not exists auth;
grant usage on schema auth to anon;
grant usage on schema auth to authenticated;
grant usage on schema auth to visitor;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function auth.uid() returns uuid as $$
  select nullif(current_setting('my.user_id', true), '')::uuid
$$ language sql stable;

grant execute on function auth.uid() to anon;
grant execute on function auth.uid() to authenticated;
grant execute on function auth.uid() to visitor;

alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on tables from authenticated;
alter default privileges in schema public revoke all on tables from visitor;
alter default privileges in schema public revoke all on functions from anon;
alter default privileges in schema public revoke all on functions from authenticated;
alter default privileges in schema public revoke all on functions from visitor;

revoke usage on all tables in schema public from anon;
revoke usage on all tables in schema public from authenticated;
revoke usage on all tables in schema public from visitor;
revoke usage on all sequences in schema public from anon;
revoke usage on all sequences in schema public from authenticated;
revoke usage on all sequences in schema public from visitor;
revoke execute on all functions in schema public from anon;
revoke execute on all functions in schema public from authenticated;
revoke execute on all functions in schema public from visitor;

create schema if not exists hidden;
revoke all privileges on schema hidden to anon;
revoke all privileges on schema hidden to authenticated;
revoke all privileges on schema hidden to visitor;

create function hidden.tg__timestamps() returns trigger as $$
begin
  NEW.created_at = (case when TG_OP = 'INSERT' then NOW() else OLD.created_at end);
  NEW.updated_at = (case when TG_OP = 'UPDATE' and OLD.updated_at >= NOW() then OLD.updated_at + interval '1 millisecond' else NOW() end);
  return NEW;
end;
$$ language plpgsql volatile;

create extension if not exists citext;
create extension if not exists pgcrypto;
create domain url as text check (value ~ '^https?://\S+$');

create or replace function public.request_ip_address() returns text as $$
  select coalesce(
    nullif(current_setting('request.headers', true)::jsonb ->> 'cf-connecting-ip', ''),
    nullif(split_part(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', ',', 1), ''),
    nullif(current_setting('my.ip_address', true), ''),
    '127.0.0.1'
  )
$$ language sql stable;

create table profiles (
  user_id uuid not null primary key references auth.users,
  username citext unique check (length(username) between 3 and 60),
  avatar_url url,
  website url
);
alter table profiles enable row level security;
alter table profiles force row level security;
grant select on profiles to anon;
grant select on profiles to visitor;
grant
  select,
  insert (username, avatar_url, website),
  update (username, avatar_url, website),
  delete
on profiles to authenticated;
grant
  select,
  insert (username, avatar_url, website),
  update (username, avatar_url, website),
  delete
on profiles to visitor;
create policy select_own on profiles
  for select using (true);
create policy insert_own on profiles
  for insert with check (user_id = auth.uid());
create policy update_own on profiles
  for update using (user_id = auth.uid());

create function public.create_profile() returns trigger as $$
begin
  insert into public.profiles (user_id, username, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'preferred_username',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger
  create_profile_on_signup
  after insert on auth.users
  for each row
  execute procedure public.create_profile();

create table comments (
  comment_id integer primary key generated always as identity,
  user_id uuid default auth.uid() references profiles,
  parent_id integer references comments,
  slug text not null check (length(slug) between 3 and 100),
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table comments enable row level security;
alter table comments force row level security;
grant select on comments to anon;
grant select on comments to visitor;
grant
  select,
  insert (body, slug, parent_id),
  update (body),
  delete
on comments to authenticated;
grant
  select,
  insert (body, slug, parent_id),
  update (body),
  delete
on comments to visitor;
create policy select_not_deleted on comments
  for select using (deleted_at is null);
create policy insert_own on comments
  for insert with check (user_id = auth.uid());
create policy update_own on comments
  for update using (user_id = auth.uid());
create policy delete_own on comments
  for delete using (user_id = auth.uid());

create index comments_parent_id_idx on comments(parent_id);
create index comments_slug_idx on comments(slug);
create index comments_slug_not_deleted_idx on comments(slug) where deleted_at is null;
create index comments_created_at_idx on comments(created_at desc);

create trigger _100_timestamps
  before insert or update
  on comments
  for each row
execute procedure hidden.tg__timestamps();

create or replace function soft_delete_comments() returns trigger as $$
begin
  update comments
  set deleted_at = now()
  where comment_id = old.comment_id;

  return null;
end;
$$ language plpgsql;

create trigger comments_soft_delete
  before delete
  on comments for each row
  execute function soft_delete_comments();

drop function if exists comment_tree;
-- TODO: pagination
create or replace function comment_tree(
  comment_id int,
  depth int default 0,
  depth_limit int default 6
) returns json as $$
  select json_build_object(
    'comment_id', c.comment_id,
    'user', case when c.deleted_at is null then json_build_object(
      'username', u.username,
      'avatar_url', u.avatar_url,
      'user_id', u.user_id
    ) end,
    'body', case when c.deleted_at is null then c.body end,
    'created_at', c.created_at,
    'children', children,
    'commentCount', comment_count
  )
  from comments c
  left join profiles u using(user_id),
  lateral (
    select
      coalesce(json_agg(
        comment_tree(comments.comment_id)
        order by created_at
      ), '[]') as children,
      count(comments.comment_id) as comment_count
    from comments
    where parent_id = c.comment_id and depth < depth_limit
  ) as get_children
  where c.comment_id = comment_tree.comment_id
$$ language sql stable security definer set search_path to public, pg_catalog;
grant execute on function comment_tree to anon;
grant execute on function comment_tree to authenticated;
grant execute on function comment_tree to visitor;

create or replace function threaded_comments(
  slug text
) returns json as $$
  select
    coalesce(json_agg(
      comment_tree(comment_id)
      order by c.created_at desc
    ), '[]') as comments
  from comments c
  where c.parent_id is null
    and c.slug = threaded_comments.slug
$$ language sql stable security definer set search_path to public, pg_catalog;
grant execute on function threaded_comments to anon;
grant execute on function threaded_comments to authenticated;
grant execute on function threaded_comments to visitor;

create function comments_stats() returns json as $$
  select
    coalesce(jsonb_object_agg(slug, count), '{}'::jsonb)
  from (
    select
      slug,
      count(slug) as count
    from comments
    where deleted_at is null
    group by slug
  ) as get_counts
$$ language sql stable;
grant execute on function comments_stats to anon;
grant execute on function comments_stats to authenticated;
grant execute on function comments_stats to visitor;

drop table if exists hidden.likes cascade;
create table hidden.likes (
  id text not null default encode(digest(request_ip_address(), 'sha256'), 'hex'),
  slug text not null,
  votes int not null check (votes between 0 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id, slug)
);
alter table hidden.likes enable row level security;
alter table hidden.likes force row level security;

revoke all on hidden.likes from anon;
revoke all on hidden.likes from authenticated;
revoke all on hidden.likes from visitor;

create trigger _100_timestamp
  before insert or update
  on hidden.likes
  for each row
  execute procedure hidden.tg__timestamps();

drop function if exists get_likes(text);
create or replace function get_likes(
  slug text
) returns json as $$
  select json_build_object(
    'total', coalesce(sum(votes), 0),
    'available', 10 - coalesce((
      select votes
      from hidden.likes
      where likes.slug = get_likes.slug
        and id = encode(digest(request_ip_address(), 'sha256'), 'hex')
    ), 0),
    'max', 10
  )
  from hidden.likes
  where likes.slug = get_likes.slug
$$ language sql stable security definer;
grant execute on function get_likes to anon;
grant execute on function get_likes to authenticated;
grant execute on function get_likes to visitor;

drop function if exists like_post(text, int);
create or replace function like_post(
  post text,
  requested_votes int default 1
) returns json as $$
declare
  likes json;
begin

  insert into hidden.likes (slug, votes)
  values (post, requested_votes)
  on conflict (id, slug) do update set votes = requested_votes;

  /*
  merge into hidden.likes target
  using (values (post, requested_votes))
    on (target.slug = post)
  when matched and requested_votes != 0 then
  update set votes = requested_votes
  when matched and requested_votes = 0 then
  delete
  when not matched then
  insert (slug, votes) values (post, requested_votes);
  */

  likes := get_likes(post);
  return likes;
end;
$$ language plpgsql volatile security definer;
grant execute on function like_post to anon;
grant execute on function like_post to authenticated;
grant execute on function like_post to visitor;

drop function if exists top_posts();
create or replace function top_posts() returns json as $$
  with comment_counts as (
    select
      comments.slug,
      count(comments.comment_id)::int as comment_count
    from comments
    where comments.deleted_at is null
    group by comments.slug
  ),
  like_totals as (
    select
      hidden.likes.slug,
      coalesce(sum(hidden.likes.votes), 0)::int as total_votes
    from hidden.likes
    group by hidden.likes.slug
  ),
  latest_comments as (
    select distinct on (comments.slug)
      comments.slug,
      comments.comment_id,
      comments.body,
      comments.created_at,
      comments.updated_at,
      profiles.username,
      coalesce(profiles.avatar_url::text, '') as avatar_url,
      coalesce(reply_to.username::text, '') as replying_to_username,
      coalesce(reply_to.avatar_url::text, '') as replying_to_avatar_url
    from comments
    join profiles on profiles.user_id = comments.user_id
    left join comments parent on parent.comment_id = comments.parent_id
    left join profiles reply_to on reply_to.user_id = parent.user_id
    where comments.deleted_at is null
    order by comments.slug, comments.created_at desc
  )
  select coalesce(json_agg(
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
  ), '[]'::json)
  from comment_counts
  left join like_totals on like_totals.slug = comment_counts.slug
  left join latest_comments on latest_comments.slug = comment_counts.slug
$$ language sql stable security definer set search_path to public, hidden, pg_catalog;
grant execute on function top_posts() to anon;
grant execute on function top_posts() to authenticated;
grant execute on function top_posts() to visitor;
explain analyze select * from top_posts();

begin;
  set local enable_seqscan = off;
  explain analyze select * from get_likes('backend-faq');
rollback;

vacuum analyze;
