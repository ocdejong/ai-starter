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

/** One announcement, as the group it belongs to may read it. */
export type AnnouncementRecord = Readonly<{
  id: string;
  title: string;
  /** Whether this is the announcement the group is currently showing. */
  isCurrent: boolean;
}>;

/**
 * The announcement reads and writes this layer needs, shaped by the use cases
 * rather than by the table behind them.
 *
 * Every operation is keyed by a group. There is no "read an announcement" call
 * that skips one, so a procedure cannot accidentally reach outside the group the
 * request was made in — `rename` answers `null` for an identifier that belongs to
 * a different group, which is the same shape `findMembership` uses to refuse.
 */
export type AnnouncementRepository = Readonly<{
  listByGroup: (groupId: string) => Promise<AnnouncementRecord[]>;
  publish: (input: {
    createdById: string;
    groupId: string;
    title: string;
  }) => Promise<AnnouncementRecord>;
  rename: (input: {
    announcementId: string;
    groupId: string;
    title: string;
  }) => Promise<AnnouncementRecord | null>;
}>;

export type TRPCContext = {
  announcements: AnnouncementRepository;
  groups: GroupRepository;
  headers: Headers;
  session: TRPCSession;
};

export const createTRPCContext = (context: TRPCContext) => context;
