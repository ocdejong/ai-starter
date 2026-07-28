-- Prisma applies each migration inside a transaction, so both timeouts are
-- transaction-local. Without them a schema change waits behind whatever is
-- already holding the table, for as long as that takes.
set lock_timeout = '1s';
set statement_timeout = '5s';

-- The scan the previous migration deliberately skipped. `VALIDATE CONSTRAINT`
-- takes a lock that lets reads and writes continue, which is the whole reason
-- this is a second migration rather than two statements in the first one.
ALTER TABLE "organization" VALIDATE CONSTRAINT "organization_name_not_blank";
