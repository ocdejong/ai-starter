import "server-only";

export { createDatabaseClient, db, type Database } from "./client";
export { createPrismaGroupRepository } from "./group-repository";
export { prismaPostRepository } from "./post-repository";
