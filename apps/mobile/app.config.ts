import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const organization = process.env.SENTRY_ORG;
  const project = process.env.SENTRY_PROJECT;
  const plugins: NonNullable<ExpoConfig["plugins"]> = [
    ...(config.plugins ?? []),
  ];

  if (organization && project) {
    plugins.push([
      "@sentry/react-native/expo",
      {
        organization,
        project,
        url: "https://sentry.io/",
      },
    ]);
  }

  return {
    ...config,
    name: config.name ?? "ai-starter",
    plugins,
    slug: config.slug ?? "ai-starter",
  };
};
