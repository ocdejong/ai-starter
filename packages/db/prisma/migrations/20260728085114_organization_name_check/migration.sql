-- Prisma applies each migration inside a transaction, so both timeouts are
-- transaction-local. Without them a schema change waits behind whatever is
-- already holding the table, for as long as that takes.
set lock_timeout = '1s';
set statement_timeout = '5s';

-- A group with no name is a row nothing can render and nobody can pick out of a
-- switcher. `personalGroupName` already refuses one — it falls back to the
-- address when a person's name is blank — and `groupNamePolicy` refuses one at
-- the form. This is that rule where it cannot be written around, which is what
-- the contract means by a persisted invariant belonging in PostgreSQL as well as
-- in application validation.
--
-- It also gives `database.integration.test.ts` a CHECK on a table this
-- repository always has. Its previous one was on the example slice, so removing
-- the example took the proof with it.
-- `NOT VALID` means new and updated rows are checked from here on, and the rows
-- already stored are not scanned — so this takes no lock worth naming. The scan
-- happens in the migration after this one, because Prisma wraps each migration
-- in a transaction and `VALIDATE` in that same transaction would hold the strong
-- lock anyway. Two migrations is what "a separate transaction" means here, and
-- `pnpm db:lint` rejects every shorter version.
--
-- A generated slice's CHECK needs none of this: its table is created in the same
-- file, so there is nothing to scan and nothing to block.
ALTER TABLE "organization" ADD CONSTRAINT "organization_name_not_blank" CHECK (char_length(btrim("name")) > 0) NOT VALID;
