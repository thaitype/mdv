export type SubstituteResult =
  | { ok: true; output: string }
  | { ok: false; unknown: string };

export function substitute(
  source: string,
  config: { local: string; registry: string }
): SubstituteResult {
  if (source === "") {
    return { ok: true, output: "" };
  }

  let result = source
    .replaceAll("{{VISMD_LOCAL}}", config.local)
    .replaceAll("{{VISMD_REGISTRY}}", config.registry);

  const leftover = result.match(/\{\{[^}]*\}\}/);
  if (leftover) {
    return { ok: false, unknown: leftover[0] };
  }

  return { ok: true, output: result };
}
