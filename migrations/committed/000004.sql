--! Previous: sha1:5edd4450cb10ab6289f5543057a12af6c06fb110
--! Hash: sha1:da305fb0013037f9b196facb1f3f597939ea5cba

--! split: 1-current.sql
-- New functions the owner creates must not be executable by every role on the cluster.
-- A global entry (no IN SCHEMA) is the only form that removes PostgreSQL's built-in EXECUTE
-- grant to PUBLIC; the per-schema entries in 000001 add to it and cannot remove it.
alter default privileges for role :DATABASE_OWNER revoke execute on functions from public;

-- The functions that already exist keep that built-in grant, so revoke it one by one.
-- A blanket revoke over schema public would also reach the citext and pgcrypto functions,
-- which the visitor calls through PUBLIC.
revoke execute on function
  auth.current_session_id(),
  auth.uid(),
  hidden.tg__timestamps(),
  public.comment_tree(integer, integer, integer),
  public.comments_stats(),
  public.create_profile(),
  public.get_likes(text),
  public.like_post(text, integer),
  public.request_ip_address(),
  public.soft_delete_comment(),
  public.threaded_comments(text),
  public.top_posts()
from public;

-- Without an explicit pg_temp, PostgreSQL searches the session's temporary schema first for
-- relations, so a temporary table the visitor creates can shadow a name the body uses. Listing
-- pg_temp last makes the lookup reach it only after the schemas the function names.
alter function public.create_profile() set search_path = public, auth, pg_catalog, pg_temp;
alter function public.get_likes(text) set search_path = hidden, public, pg_catalog, pg_temp;
alter function public.like_post(text, integer) set search_path = hidden, public, pg_catalog, pg_temp;
alter function public.top_posts() set search_path = hidden, public, pg_catalog, pg_temp;
