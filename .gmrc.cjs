// graphile-migrate settings. A JavaScript file, because the owner role differs per instance:
// the platform's migration login is a new role each release that only acts as the owner, so
// graphile-migrate cannot take the owner from the connection's user name. cartridge.json names
// the owner with a database role entry, and .env names the local one.
const databaseOwner = process.env.DATABASE_OWNER;
if (!databaseOwner) throw new Error("DATABASE_OWNER is not set");

module.exports = {
  databaseOwner,
  pgSettings: {
    search_path: "public,auth,hidden",
  },
  placeholders: {
    ":DATABASE_VISITOR": "!ENV",
  },
  afterReset: ["!afterReset.sql"],
  afterAllMigrations: [
    { _: "command", shadow: false, command: "bun db:types --url 'env(GM_DBURL)'" },
  ],
  afterCurrent: [
    { _: "command", shadow: false, command: "bun db:types --url 'env(GM_DBURL)'" },
  ],
};
