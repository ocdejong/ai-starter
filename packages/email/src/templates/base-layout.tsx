import { Body, Container, Head, Html, Preview } from "react-email";
import type { ReactNode } from "react";

export type BaseLayoutProps = {
  children: ReactNode;
  preview: string;
};

/**
 * The shared shell every transactional template renders inside. Kept
 * deliberately unstyled: visual design arrives with the token system in a later
 * stage, and email colors are inlined per-client rather than through the web
 * CSS variables, so there is nothing here for the theming stage to route.
 */
export function BaseLayout({ children, preview }: BaseLayoutProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body>
        <Container>{children}</Container>
      </Body>
    </Html>
  );
}
