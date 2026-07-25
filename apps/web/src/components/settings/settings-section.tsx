import { type ReactNode } from "react";

/**
 * One titled block of the account page. Every section is labelled by its own
 * heading, so the page reads as a list of named things a screen reader can jump
 * between rather than one undifferentiated form.
 */
export function SettingsSection({
  children,
  description,
  id,
  title,
  tone = "default",
}: {
  children: ReactNode;
  description: string;
  id: string;
  title: string;
  tone?: "default" | "danger";
}) {
  return (
    <section
      aria-labelledby={id}
      className={`rounded-xl border p-6 ${
        tone === "danger" ? "border-destructive/40" : "border-border"
      }`}
    >
      {/* One level below the page's own "Account" heading, so the sections read
          as parts of it rather than as siblings of it. */}
      <h3
        className={`text-lg font-semibold ${
          tone === "danger" ? "text-destructive" : ""
        }`}
        id={id}
      >
        {title}
      </h3>
      <p className="text-muted-foreground mt-1 text-sm">{description}</p>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}
