begin;

create extension if not exists plpgsql with schema pg_catalog;
create extension if not exists citext with schema public;
create extension if not exists pgcrypto with schema public;

grant all on database :DATABASE_NAME to :DATABASE_OWNER;
alter database :DATABASE_NAME owner to :DATABASE_OWNER;

commit;
