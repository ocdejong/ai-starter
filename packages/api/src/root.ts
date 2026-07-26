import { announcementRouter } from "./routers/announcement";
import { groupRouter } from "./routers/group";
import { createCallerFactory, createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  announcement: announcementRouter,
  group: groupRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
