--! Previous: sha1:4729b170a799ca7749f3470a3bf1d5b0e0b5aae2
--! Hash: sha1:5c81e595b4b1590544bb0560fd83c55fe7434117
--! Message: authenticator grants

--! split: 1-current.sql
-- Enter migration here

--! split: 0020-authenticator-grants.sql
-- The web process signs users in and out with the authenticator login, not the owner.
-- It needs direct access to the identity tables; request-scoped work still runs as the visitor role.
grant usage on schema auth to :DATABASE_AUTHENTICATOR;
grant usage on schema hidden to :DATABASE_AUTHENTICATOR;
grant select, insert, update, delete on auth.users, auth.oauth_accounts, hidden.sessions to :DATABASE_AUTHENTICATOR;
