import {
  createGroupInputSchema,
  groupErrorFor,
  groupSlug,
  parseGroupValidationCode,
  renameGroupInputSchema,
  type GroupErrorCode,
} from "@ai-starter/domain";
import { spacing } from "@ai-starter/tokens";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslations } from "use-intl";

import { useGroupErrorMessage, useGroupFieldError } from "./use-group-labels";
import { authClient } from "../../auth/client";
import { Notice } from "../auth/notice";
import { SubmitButton } from "../auth/submit-button";
import { TextField } from "../auth/text-field";
import { useTheme } from "../../theme/theme-provider";

/**
 * Renames the active group, for whoever may.
 *
 * A reader who may not rename it sees the name and the reason instead of a
 * disabled field: a control that cannot be used is a worse answer than a
 * sentence saying why.
 */
export function GroupNameForm({
  canRename,
  name,
  onRenamed,
}: {
  canRename: boolean;
  name: string;
  onRenamed: () => void;
}) {
  const t = useTranslations("app.settings.groups.current");
  const { theme } = useTheme();
  const form = useNameForm(
    renameGroupInputSchema,
    async (value) => {
      const { error } = await authClient.organization.update({
        data: { name: value },
      });
      return error;
    },
    onRenamed,
  );
  const [draft, setDraft] = useState(name);

  if (!canRename) {
    return (
      <View style={styles.section}>
        <Text style={[styles.heading, { color: theme.foreground }]}>
          {t("title")}
        </Text>
        <Text style={[styles.body, { color: theme.foreground }]}>{name}</Text>
        <Text style={[styles.body, { color: theme["muted-foreground"] }]}>
          {t("readOnly")}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: theme.foreground }]}>
        {t("title")}
      </Text>
      <TextField
        error={form.fieldError}
        label={t("nameLabel")}
        onChangeText={setDraft}
        value={draft}
      />
      <SubmitButton
        label={t("submit")}
        onPress={() => {
          form.submit(draft);
        }}
        pending={form.pending}
        pendingLabel={t("submitting")}
      />
      {form.failure === null ? null : (
        <Notice message={form.failure} tone="error" />
      )}
      {form.done ? <Notice message={t("saved")} tone="info" /> : null}
    </View>
  );
}

/**
 * Creates a group and switches to it.
 *
 * Slugs are unique across the installation rather than per account, so the
 * random suffix is what keeps two groups of the same name apart while the
 * readable half still says what it is.
 */
export function CreateGroupForm({ onCreated }: { onCreated: () => void }) {
  const t = useTranslations("app.settings.groups.create");
  const { theme } = useTheme();
  const [draft, setDraft] = useState("");
  const form = useNameForm(
    createGroupInputSchema,
    async (value) => {
      const { error } = await authClient.organization.create({
        name: value,
        slug: groupSlug(value, crypto.randomUUID().slice(0, 8)),
      });
      return error;
    },
    () => {
      setDraft("");
      onCreated();
    },
  );

  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: theme.foreground }]}>
        {t("title")}
      </Text>
      <TextField
        error={form.fieldError}
        label={t("nameLabel")}
        onChangeText={setDraft}
        value={draft}
      />
      <SubmitButton
        label={t("submit")}
        onPress={() => {
          form.submit(draft);
        }}
        pending={form.pending}
        pendingLabel={t("submitting")}
      />
      {form.failure === null ? null : (
        <Notice message={form.failure} tone="error" />
      )}
    </View>
  );
}

/** The shared behaviour of the two one-field group forms. */
function useNameForm(
  schema: typeof createGroupInputSchema,
  send: (name: string) => Promise<{ code?: string | undefined } | null>,
  onDone: () => void,
) {
  const fieldErrorFor = useGroupFieldError();
  const errorMessage = useGroupErrorMessage();
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [error, setError] = useState<GroupErrorCode | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  function submit(name: string): void {
    setError(null);
    setDone(false);
    const parsed = schema.safeParse({ name });
    if (!parsed.success) {
      setFieldError(
        fieldErrorFor(
          parseGroupValidationCode(parsed.error.issues[0]?.message),
        ),
      );
      return;
    }

    setFieldError(undefined);
    setPending(true);
    void (async () => {
      try {
        const failure = await send(parsed.data.name);
        if (failure) {
          setError(groupErrorFor(failure.code));
          return;
        }
        setDone(true);
        onDone();
      } catch {
        setError("unexpected");
      } finally {
        setPending(false);
      }
    })();
  }

  return { done, failure: errorMessage(error), fieldError, pending, submit };
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  heading: {
    fontSize: 20,
    fontWeight: "700",
  },
  body: {
    fontSize: 14,
  },
});
