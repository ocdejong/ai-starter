-- Prisma applies each migration inside a transaction, so both timeouts are
-- transaction-local. Without them a schema change waits behind whatever is
-- already holding the table, for as long as that takes.
set lock_timeout = '1s';
set statement_timeout = '5s';

-- The example slice's title is bounded by the CHECK constraint its own
-- migration added, so `varchar(120)` was a second copy of the same rule — and
-- the one `pnpm db:lint` rejects, because widening a `varchar(n)` later needs a
-- lock that stops every read and write. A generated feature inherited that
-- shape and its first migration could not pass the gate.
--
-- The ignore below covers this one statement and only this one: PostgreSQL
-- treats varchar(n) to text as binary-coercible and does not rewrite the table,
-- so the rule's stated harm cannot occur here. Excluding the rule in
-- .squawk.toml would give it up for every future column instead.
-- squawk-ignore changing-column-type
ALTER TABLE "Announcement" ALTER COLUMN "title" SET DATA TYPE TEXT;
