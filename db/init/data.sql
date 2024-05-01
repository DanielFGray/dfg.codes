alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on tables from authenticated;
alter default privileges in schema public revoke all on functions from anon;
alter default privileges in schema public revoke all on functions from authenticated;

revoke usage on all tables in schema public from anon;
revoke usage on all tables in schema public from authenticated;
revoke usage on all sequences in schema public from anon;
revoke usage on all sequences in schema public from authenticated;
revoke execute on all functions in schema public from anon;
revoke execute on all functions in schema public from authenticated;

create schema if not exists hidden;
revoke all privileges on schema hidden to anon;
revoke all privileges on schema hidden to authenticated;

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

create table profiles (
  user_id uuid not null primary key references auth.users,
  username citext unique check (length(username) between 3 and 60),
  avatar_url url,
  website url
);
alter table profiles enable row level security;
grant select on profiles to anon;
grant
  select,
  insert (username, avatar_url, website),
  update (username, avatar_url, website),
  delete
on profiles to authenticated;
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
grant select on comments to anon;
grant
  select,
  insert (body, slug, parent_id),
  update (body),
  delete
on comments to authenticated;
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

create or replace function _600_soft_delete_comments() returns trigger as $$
begin
    NEW.deleted_at = now();
    return NEW;
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

create function comments_stats() returns json as $$
  select
    coalesce(json_object(
      array_agg(slug),
      array_agg(count::text)
    ), '{}')
  from (
    select
      slug,
      count(slug) as count
    from comments
    group by slug
  ) as get_counts
$$ language sql stable;
grant execute on function comments_stats to anon;
grant execute on function comments_stats to authenticated;

drop table hidden.likes cascade;
create table hidden.likes (
  id text not null default encode(digest(current_setting('request.headers', true)::json ->> 'cf-connecting-ip', 'sha256'), 'hex'),
  slug text not null,
  votes int not null check (votes between 0 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id, slug)
);
alter table hidden.likes enable row level security;

revoke all on hidden.likes from anon;
revoke all on hidden.likes from authenticated;

create trigger _100_timestamp
  before insert or update
  on hidden.likes
  for each row
  execute procedure hidden.tg__timestamps();

drop function get_likes;
create or replace function get_likes(
  slug text
) returns json as $$
  select json_build_object(
    'total', coalesce(sum(votes), 0),
    'available', 10 - coalesce((
      select votes
      from hidden.likes
      where likes.slug = get_likes.slug
        and id = encode(digest(current_setting('request.headers', true)::json ->> 'cf-connecting-ip', 'sha256'), 'hex')
    ), 0),
    'max', 10
  )
  from hidden.likes
  where likes.slug = get_likes.slug
$$ language sql stable security definer;
grant execute on function get_likes to anon;
grant execute on function get_likes to authenticated;

drop function like_post;
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

grant execute on top_posts to anon;
grant execute on top_posts to authenticated;
explain analyze select * from top_posts();

begin;
  set local enable_seqscan = off;
  explain analyze select * from get_likes('backend-faq');
rollback;

vacuum analyze;
