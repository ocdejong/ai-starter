export type TRPCSession = {
  user: {
    id: string;
  };
  /**
   * The group the session last switched to. It is a *preference*, never a
   * permission: it travels in the session, a cookie cache can serve a stale
   * value after a switch, and the member it names may since have been removed.
   * `groupProcedure` re-derives the membership from the database on every call
   * and nothing else may read this to decide access.
   */
  activeGroupId: string | null;
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

/** A user's confirmed place in one group: the group, and what they may do in it. */
export type GroupMembership = Readonly<{
  groupId: string;
  name: string;
  slug: string;
  role: string;
}>;

/** One member of a group, as the group's other members may see them. */
export type GroupMember = Readonly<{
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
}>;

/**
 * The group reads this layer needs. `findMembership` is the authorization
 * primitive: it answers for one (user, group) pair and returns `null` for every
 * other combination, so a caller cannot be handed a group they do not belong to.
 */
export type GroupRepository = Readonly<{
  findMembership: (input: {
    userId: string;
    groupId: string;
  }) => Promise<GroupMembership | null>;
  listMemberships: (userId: string) => Promise<GroupMembership[]>;
  listMembers: (groupId: string) => Promise<GroupMember[]>;
}>;

export type TRPCContext = {
  groups: GroupRepository;
  headers: Headers;
  posts: PostRepository;
  session: TRPCSession;
};

export const createTRPCContext = (context: TRPCContext) => context;
