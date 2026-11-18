import { DatabaseAnswers } from "@danielfgray/stompbox/http/server";

// What a database refusal means to a client. The services map the codes they react to
// (`onSqlState`); every other refusal reaches this table, whose standard answers carry
// fixed text. The discussion's SQL raises no custom SQLSTATE and has no unique constraint
// a visitor can hit, so the table holds no data of its own yet.
export const toHttpError = DatabaseAnswers.make({
  codes: {},
  constraints: {},
});
