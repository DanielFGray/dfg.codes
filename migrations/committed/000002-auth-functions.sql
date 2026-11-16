--! Previous: sha1:4729b170a799ca7749f3470a3bf1d5b0e0b5aae2
--! Hash: sha1:674b6dd803811a3b4e3900f79c5b70a0dd084366
--! Message: auth functions

--! split: 1-current.sql
-- Enter migration here

--! split: 0020-auth-functions.sql
-- The web process's login holds no rights of its own and runs every query as the visitor role.
-- The visitor cannot touch the identity tables, so signing in, finding a session and signing out
-- run as these functions, which execute with the rights of the owner role that defines them.

-- Finds or creates the user of a GitHub account and starts a session for that user.
-- input_username is already normalized; when it is taken, the user gets -2, -3, ... appended
-- within the 32-character limit.
create function auth.sign_in_github(
  input_provider_user_id text,
  input_username text,
  input_avatar_url text,
  input_cookie_id text,
  input_secret_hash text,
  input_expires_at timestamptz
) returns json as $$
declare
  signed_in auth.users;
  attempt integer := 1;
  suffix text := '';
begin
  select users.* into signed_in
  from auth.oauth_accounts oauth
  join auth.users users on users.id = oauth.user_id
  where oauth.provider = 'github'
    and oauth.provider_user_id = input_provider_user_id;

  if not found then
    while exists (
      select 1 from auth.users
      where users.username = (left(input_username, 32 - length(suffix)) || suffix)::citext
    ) loop
      attempt := attempt + 1;
      suffix := '-' || attempt;
    end loop;

    insert into auth.users (username, avatar_url)
    values (left(input_username, 32 - length(suffix)) || suffix, input_avatar_url)
    returning * into signed_in;

    insert into auth.oauth_accounts (provider, provider_user_id, user_id)
    values ('github', input_provider_user_id, signed_in.id);
  end if;

  insert into hidden.sessions (cookie_id, secret_hash, user_id, expires_at)
  values (input_cookie_id, input_secret_hash, signed_in.id, input_expires_at);

  return json_build_object(
    'user_id', signed_in.id,
    'username', signed_in.username,
    'avatar_url', signed_in.avatar_url
  );
end;
$$ language plpgsql volatile security definer set search_path = pg_catalog, public, pg_temp;

-- The user of an unexpired session whose secret hashes to input_secret_hash, or null. The
-- stored value is a SHA-256 of a random secret, so comparing hashes leaks nothing usable.
create function auth.find_session(input_cookie_id text, input_secret_hash text) returns json as $$
  select json_build_object(
    'user_id', users.id,
    'username', users.username,
    'avatar_url', users.avatar_url
  )
  from hidden.sessions sessions
  join auth.users users on users.id = sessions.user_id
  where sessions.cookie_id = input_cookie_id
    and sessions.secret_hash = input_secret_hash
    and sessions.expires_at > now()
$$ language sql stable security definer set search_path = pg_catalog, public, pg_temp;

create function auth.sign_out(input_cookie_id text) returns void as $$
  delete from hidden.sessions where cookie_id = input_cookie_id
$$ language sql volatile security definer set search_path = pg_catalog, public, pg_temp;

revoke all on function auth.sign_in_github(text, text, text, text, text, timestamptz) from public;
revoke all on function auth.find_session(text, text) from public;
revoke all on function auth.sign_out(text) from public;
grant execute on function auth.sign_in_github(text, text, text, text, text, timestamptz) to :DATABASE_VISITOR;
grant execute on function auth.find_session(text, text) to :DATABASE_VISITOR;
grant execute on function auth.sign_out(text) to :DATABASE_VISITOR;

-- 000001's default privileges let the visitor read every table in schema auth. Nothing that
-- runs as the visitor needs these two; public.profiles holds the public name and avatar.
revoke select on auth.users, auth.oauth_accounts from :DATABASE_VISITOR;
