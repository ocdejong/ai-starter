"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { api } from "~/trpc/react";

export function LatestPost() {
  const t = useTranslations("post");
  const [latestPost] = api.post.getLatest.useSuspenseQuery();

  const utils = api.useUtils();
  const [name, setName] = useState("");
  const createPost = api.post.create.useMutation({
    onSuccess: async () => {
      await utils.post.invalidate();
      setName("");
    },
  });

  return (
    <div className="w-full max-w-xs">
      {latestPost ? (
        <p className="truncate">{t("latest", { name: latestPost.name })}</p>
      ) : (
        <p>{t("empty")}</p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          createPost.mutate({ name });
        }}
        className="flex flex-col gap-2"
      >
        <input
          type="text"
          placeholder={t("titlePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-input text-foreground w-full rounded-full px-4 py-2"
        />
        <button
          type="submit"
          className="bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-full px-10 py-3 font-semibold transition"
          disabled={createPost.isPending}
        >
          {createPost.isPending ? t("submitting") : t("submit")}
        </button>
      </form>
    </div>
  );
}
