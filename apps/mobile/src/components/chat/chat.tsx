import { useChat } from "@ai-sdk/react";
import { spacing } from "@ai-starter/tokens";
import { type UIMessage } from "ai";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTranslations } from "use-intl";

import { chatErrorCode, chatNotConfiguredCode } from "../../chat/error";
import { chatTransport } from "../../chat/transport";
import { useTheme } from "../../theme/theme-provider";

export type ChatProps = {
  /** Seeds the transcript. Used by tests; the real chat starts empty. */
  readonly initialMessages?: UIMessage[];
};

/**
 * The same conversation as the web dashboard's, in native views.
 *
 * Two states the web component takes as props are read from the server here
 * instead. There is no signed-out state, because the tab layout sits behind the
 * session gate; and whether a provider key exists is something only the server
 * knows, so an unconfigured deployment is recognised from its refusal rather than
 * from a second copy of the configuration shipped into the app.
 */
export function Chat({ initialMessages }: ChatProps) {
  const t = useTranslations("chat");
  const { theme } = useTheme();
  const [input, setInput] = useState("");
  const { error, messages, sendMessage, status, stop } = useChat({
    ...(initialMessages === undefined ? {} : { messages: initialMessages }),
    transport: chatTransport,
  });

  const isBusy = status === "submitted" || status === "streaming";
  const isUnconfigured = chatErrorCode(error) === chatNotConfiguredCode;

  function send() {
    const text = input.trim();
    if (text === "" || isBusy) {
      return;
    }
    setInput("");
    void sendMessage({ text });
  }

  return (
    <View style={styles.chat}>
      <Text style={[styles.title, { color: theme.foreground }]}>
        {t("title")}
      </Text>

      <ScrollView contentContainerStyle={styles.transcript}>
        {messages.length === 0 ? (
          <Text style={[styles.hint, { color: theme["muted-foreground"] }]}>
            {t("empty")}
          </Text>
        ) : null}
        {messages.map((message) => (
          <View key={message.id} style={styles.message}>
            <Text style={[styles.author, { color: theme["muted-foreground"] }]}>
              {message.role === "user" ? t("you") : t("assistant")}
            </Text>
            {message.parts.map((part, index) =>
              part.type === "text" ? (
                <Text
                  key={`${message.id}-${String(index)}`}
                  style={[styles.body, { color: theme.foreground }]}
                >
                  {part.text}
                </Text>
              ) : null,
            )}
          </View>
        ))}
      </ScrollView>

      {error === undefined ? null : (
        <Text
          style={[
            styles.hint,
            {
              color: isUnconfigured
                ? theme["muted-foreground"]
                : theme.destructive,
            },
          ]}
        >
          {isUnconfigured ? t("notConfigured") : t("error")}
        </Text>
      )}

      <View style={styles.composer}>
        <TextInput
          accessibilityLabel={t("placeholder")}
          editable={!isUnconfigured}
          onChangeText={setInput}
          onSubmitEditing={send}
          placeholder={t("placeholder")}
          placeholderTextColor={theme["muted-foreground"]}
          style={[
            styles.input,
            {
              backgroundColor: theme.card,
              borderColor: theme.input,
              color: theme.foreground,
              opacity: isUnconfigured ? 0.5 : 1,
            },
          ]}
          value={input}
        />
        <Pressable
          accessibilityRole="button"
          disabled={isUnconfigured}
          onPress={isBusy ? () => void stop() : send}
          style={[
            styles.action,
            {
              backgroundColor: isBusy ? theme.secondary : theme.primary,
              opacity: isUnconfigured ? 0.5 : 1,
            },
          ]}
        >
          <Text
            style={[
              styles.actionLabel,
              {
                color: isBusy
                  ? theme["secondary-foreground"]
                  : theme["primary-foreground"],
              },
            ]}
          >
            {isBusy ? t("stop") : t("send")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chat: {
    flex: 1,
    gap: spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  hint: {
    fontSize: 14,
  },
  transcript: {
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  message: {
    gap: spacing.xs,
  },
  author: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  body: {
    fontSize: 16,
  },
  composer: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  input: {
    borderRadius: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    fontSize: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  action: {
    alignItems: "center",
    borderRadius: spacing.sm,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
});
