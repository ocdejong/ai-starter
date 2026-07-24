import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  generatedThemeCssPath,
  renderThemeCss,
} from "../src/styles/theme-css.ts";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(appRoot, generatedThemeCssPath);

writeFileSync(target, renderThemeCss());
process.stdout.write(`Wrote ${generatedThemeCssPath}\n`);
