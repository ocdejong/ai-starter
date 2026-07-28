import type { RouterOutputs } from "@ai-starter/api/client";
import { createAnnouncementInputSchema } from "@ai-starter/domain";
import { spacing } from "@ai-starter/tokens";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslations } from "use-intl";

import { useTheme } from "../../theme/theme-provider";
import { Notice } from "../auth/notice";
import { SubmitButton } from "../auth/submit-button";
import { TextField } from "../auth/text-field";
import { AnnouncementRenameForm } from "./announcement-rename-form";
import { useAnnouncementFieldError } from "./use-announcement-field-error";

/**
 * The record the interface renders, derived from what the procedure returns
 * rather than restated — a narrower projection upstream becomes a type error
 * here instead of an empty element.
 */
export type Announcement = RouterOutputs["announcement"]["list"][number];

/** The two outcomes a reader can act on differently. */
export type AnnouncementFailure = "network" | "unexpected";

/**
 * Everything the announcements tab shows, given the data.
 *
 * It takes records and callbacks rather than reaching for the API itself, so the
 * transport lives in one place above it and this stays provable without one —
 * which matters more on native, where the API client cannot even load under the
 * jest preset.
 */
export function AnnouncementPanel({
  announcements,
  failure,
  isCreating,
  isRenaming,
  onCreate,
  onRename,
  renameSaved,
}: {
  announcements: readonly Announcement[];
  failure: AnnouncementFailure | null;
  isCreating: boolean;
  isRenaming: boolean;
  onCreate: (title: string) => void;
  onRename: (input: { announcementId: string; title: string }) => void;
  renameSaved: boolean;
}) {
  const t = useTranslations("app.announcements");
  const { theme } = useTheme();
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const fieldError = useAnnouncementFieldError();

  const current = announcements.find((entry) => entry.isCurrent) ?? null;
  const earlier = announcements.filter((entry) => !entry.isCurrent);

  function create(): void {
    const parsed = createAnnouncementInputSchema.safeParse({ title: draft });
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? null);
      return;
    }
    setMessage(null);
    setDraft("");
    onCreate(parsed.data.title);
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={[styles.count, { color: theme["muted-foreground"] }]}>
        {t("count", { count: announcements.length })}
      </Text>

      {failure === null ? null : (
        <Notice message={t(`errors.${failure}`)} tone="error" />
      )}

      <Section title={t("current.title")}>
        {current === null ? (
          <Text style={[styles.body, { color: theme["muted-foreground"] }]}>
            {t("current.empty")}
          </Text>
        ) : (
          // Keyed by the announcement it is about, so a newly published one
          // reseeds the field instead of leaving the previous title in it.
          <AnnouncementRenameForm
            isSaving={isRenaming}
            key={current.id}
            onRename={(title) => {
              onRename({ announcementId: current.id, title });
            }}
            saved={renameSaved}
            title={current.title}
          />
        )}
      </Section>

      <Section title={t("create.title")}>
        <Text style={[styles.body, { color: theme["muted-foreground"] }]}>
          {t("create.description")}
        </Text>
        <TextField
          error={fieldError(message)}
          label={t("create.label")}
          onChangeText={setDraft}
          value={draft}
        />
        <SubmitButton
          label={t("create.submit")}
          onPress={create}
          pending={isCreating}
          pendingLabel={t("create.submitting")}
        />
      </Section>

      <Section title={t("earlier.title")}>
        {earlier.length === 0 ? (
          <Text style={[styles.body, { color: theme["muted-foreground"] }]}>
            {t("earlier.empty")}
          </Text>
        ) : (
          earlier.map((entry) => (
            <Text
              key={entry.id}
              style={[styles.body, { color: theme.foreground }]}
            >
              {entry.title}
            </Text>
          ))
        )}
      </Section>
    </ScrollView>
  );
}

/** A titled block. Native has no page chrome, so each block names itself. */
function Section({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.section,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: theme.foreground }]}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    padding: spacing.lg,
  },
  count: {
    fontSize: 14,
  },
  section: {
    borderRadius: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    padding: spacing.lg,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
});
