import { updateProfileInputSchema } from "@ai-starter/domain";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { authClient } from "../../auth/client";
import { fieldValidationCodes } from "../../auth/request";
import { Notice } from "../auth/notice";
import { SubmitButton } from "../auth/submit-button";
import { TextField } from "../auth/text-field";
import { useFieldError } from "../auth/use-field-error";
import { SettingsBlock } from "./settings-block";
import { settingsOutcome, type SettingsErrorKey } from "./settings-failure";

/** The name the account shows, which is the whole of the profile today. */
export function ProfileForm({ name }: { name: string }) {
  const t = useTranslations("app.settings.profile");
  const tErrors = useTranslations("app.settings.errors");
  const tFields = useTranslations("auth.fields");
  const [value, setValue] = useState(name);
  const [codes, setCodes] = useState(fieldValidationCodes([]));
  const [errorKey, setErrorKey] = useState<SettingsErrorKey | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const fieldError = useFieldError(codes);

  async function submit() {
    const parsed = updateProfileInputSchema.safeParse({ name: value });
    if (!parsed.success) {
      setCodes(fieldValidationCodes(parsed.error.issues));
      setErrorKey(null);
      setSaved(false);
      return;
    }

    setCodes(fieldValidationCodes([]));
    setErrorKey(null);
    setSaved(false);
    setPending(true);
    const failure = await settingsOutcome(() =>
      authClient.updateUser({ name: parsed.data.name }),
    );
    setPending(false);

    if (failure !== null) {
      setErrorKey(failure);
      return;
    }
    setValue(parsed.data.name);
    setSaved(true);
  }

  return (
    <SettingsBlock description={t("description")} title={t("title")}>
      <TextField
        autoComplete="name"
        error={fieldError("name")}
        label={tFields("name")}
        onChangeText={setValue}
        value={value}
      />
      {errorKey === null ? null : (
        <Notice message={tErrors(errorKey)} tone="error" />
      )}
      {saved ? <Notice message={t("saved")} tone="info" /> : null}
      <SubmitButton
        label={t("submit")}
        onPress={() => void submit()}
        pending={pending}
        pendingLabel={t("submitting")}
      />
    </SettingsBlock>
  );
}
