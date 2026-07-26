import { AnchorMissingError } from "./source-edits.ts";

/**
 * Inserts a model above the first one already in the schema, so a product's own
 * models stay at the top and the authentication tables below them.
 */
export function addPrismaModel(
  file: string,
  content: string,
  model: string,
  block: string,
): string {
  if (new RegExp(`^model ${model} \\{`, "m").test(content)) {
    return content;
  }

  const index = content.search(/^model /m);
  if (index === -1) {
    throw new AnchorMissingError(
      file,
      "any model",
      `Add the ${model} model by hand.`,
    );
  }

  return `${content.slice(0, index)}${block}\n\n${content.slice(index)}`;
}

/**
 * Adds a field to an existing model, after its last field and before the block
 * attributes. Column alignment is left to `prisma format`, which the generator
 * runs afterwards.
 */
export function addPrismaField(
  file: string,
  content: string,
  model: string,
  field: string,
): string {
  const opener = new RegExp(`^model ${model} \\{$`, "m").exec(content);
  if (opener === null) {
    throw new AnchorMissingError(
      file,
      `model ${model}`,
      `Add "${field}" to it by hand.`,
    );
  }

  const start = opener.index + opener[0].length + 1;
  const end = content.indexOf("\n}", start);
  if (end === -1) {
    throw new AnchorMissingError(
      file,
      `the end of model ${model}`,
      `Add "${field}" to it by hand.`,
    );
  }

  const body = content.slice(start, end).split("\n");
  const name = field.trim().split(/\s+/)[0] ?? field;
  if (body.some((line) => line.trim().split(/\s+/)[0] === name)) {
    return content;
  }

  let last = body.length;
  for (const [index, line] of body.entries()) {
    const trimmed = line.trim();
    if (trimmed.startsWith("@@") || trimmed.length === 0) {
      last = index;
      break;
    }
  }

  body.splice(last, 0, `  ${field}`);
  return `${content.slice(0, start)}${body.join("\n")}${content.slice(end)}`;
}
