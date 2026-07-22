import { z } from "zod";

export const helloInputSchema = z.object({
  text: z.string(),
});

export const createPostInputSchema = z.object({
  name: z.string().trim().min(1),
});
