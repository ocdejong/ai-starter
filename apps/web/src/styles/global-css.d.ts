/**
 * TypeScript 6 rejects a side-effect import that resolves to nothing it can
 * type (TS2882), and Next's own declarations stop at `*.module.css` — the
 * CSS-Modules shape, whose default export is a class-name map. A global
 * stylesheet is the other shape: the bundler consumes it and no binding is
 * ever imported from it.
 *
 * The empty body is the point. It resolves `import "~/styles/globals.css"` in
 * `app/layout.tsx` while still making `import styles from "…​.css"` a compile
 * error, which a shorthand `declare module "*.css";` would silently type as
 * `any`. Delete this the day Next ships a declaration for global stylesheets.
 */
declare module "*.css" {}
