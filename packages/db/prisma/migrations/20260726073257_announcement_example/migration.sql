-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "groupId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Announcement_groupId_createdAt_idx" ON "Announcement"("groupId", "createdAt");

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
-- Hand-written: Prisma cannot express a partial index, and "at most one current
-- announcement per group" is an invariant the application checks inside a
-- transaction but cannot enforce against a second concurrent writer.
CREATE UNIQUE INDEX "Announcement_groupId_current_key" ON "Announcement"("groupId") WHERE "isCurrent";

-- AddCheckConstraint
-- Hand-written as well: Prisma has no CHECK syntax, and the domain schema's
-- `.trim().min(1)` protects the forms, not the table. VARCHAR(120) covers the
-- upper bound; this covers the half a column type cannot express.
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_title_length_check" CHECK (char_length(btrim("title")) BETWEEN 1 AND 120);
