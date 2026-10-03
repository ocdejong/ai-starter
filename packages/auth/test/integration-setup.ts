import { beforeAll, inject } from "vitest";

import { createDatabaseClient } from "@ai-starter/db";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

// Files share one database and not every file cleans up after itself, so each
// starts from empty tables whichever file ran before it.
beforeAll(async () => {
  const client = createDatabaseClient(inject("databaseUrl"));
  try {
    await client.$executeRaw`
      DO $$
      DECLARE statement text;
      BEGIN
        SELECT 'TRUNCATE TABLE ' || string_agg(format('%I.%I', schemaname, tablename), ', ') || ' CASCADE'
          INTO statement
          FROM pg_tables
          WHERE schemaname = 'public' AND tablename <> '_prisma_migrations';
        EXECUTE statement;
      END
      $$`;
  } finally {
    await client.$disconnect();
  }
});
