import "server-only";

export { createDatabaseClient, db, type Database } from "./client";
export { prismaPostRepository } from "./post-repository";
