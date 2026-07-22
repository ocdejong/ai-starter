import type { db } from "@t3-test/db";

export type TRPCSession = {
  user: {
    id: string;
  };
} | null;

export type TRPCContext = {
  db: typeof db;
  headers: Headers;
  session: TRPCSession;
};

export const createTRPCContext = (context: TRPCContext) => context;
