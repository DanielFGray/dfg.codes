begin;

create extension if not exists plpgsql with schema pg_catalog;
create extension if not exists citext with schema public;
create extension if not exists pgcrypto with schema public;

grant all on database :DATABASE_NAME to :DATABASE_OWNER;
grant connect on database :DATABASE_NAME to :DATABASE_AUTHENTICATOR;
alter database :DATABASE_NAME owner to :DATABASE_OWNER;

commit;
