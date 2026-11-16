--! Previous: sha1:674b6dd803811a3b4e3900f79c5b70a0dd084366
--! Hash: sha1:5edd4450cb10ab6289f5543057a12af6c06fb110
--! Message: top posts as definer

--! split: 1-current.sql
-- Enter migration here

--! split: 0030-top-posts-definer.sql
-- top_posts reads hidden.likes, and the visitor role has no usage on schema hidden, so the
-- function failed for every request. It runs as its owner, as get_likes and like_post do.
alter function public.top_posts() security definer set search_path = hidden, public, pg_catalog;
