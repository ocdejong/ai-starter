export type TRPCSession = {
  user: {
    id: string;
  };
} | null;

export type PostRecord = Readonly<{
  createdAt: Date;
  createdById: string;
  id: string;
  name: string;
  updatedAt: Date;
}>;

export type PostRepository = Readonly<{
  create: (input: { createdById: string; name: string }) => Promise<PostRecord>;
  findLatestByUserId: (userId: string) => Promise<PostRecord | null>;
}>;

export type TRPCContext = {
  headers: Headers;
  posts: PostRepository;
  session: TRPCSession;
};

export const createTRPCContext = (context: TRPCContext) => context;
