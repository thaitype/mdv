import { describe, it, expect } from "vitest";
import { substitute } from "./placeholders.js";

const config = {
  local: "http://localhost:3000",
  registry: "https://vismd.thaitype.dev",
};

describe("substitute", () => {
  it("substitutes both placeholders in a single source", () => {
    const source = `import A from "{{VISMD_LOCAL}}/A"\nimport B from "{{VISMD_REGISTRY}}/B"`;
    const result = substitute(source, config);
    expect(result).toEqual({
      ok: true,
      output: `import A from "http://localhost:3000/A"\nimport B from "https://vismd.thaitype.dev/B"`,
    });
  });

  it("substitutes multiple occurrences of the same placeholder", () => {
    const source = "{{VISMD_LOCAL}}/A and {{VISMD_LOCAL}}/B";
    const result = substitute(source, config);
    expect(result).toEqual({
      ok: true,
      output: "http://localhost:3000/A and http://localhost:3000/B",
    });
  });

  it("returns ok: true unchanged when no placeholders present", () => {
    const source = "# Hello world";
    const result = substitute(source, config);
    expect(result).toEqual({ ok: true, output: "# Hello world" });
  });

  it("treats case-mismatch {{VISMD_LOCAl}} as unknown", () => {
    const source = "{{VISMD_LOCAl}}/foo";
    const result = substitute(source, config);
    expect(result).toEqual({ ok: false, unknown: "{{VISMD_LOCAl}}" });
  });

  it("returns unknown for an unrecognised placeholder like {{VISMD_FOO}}", () => {
    const source = "{{VISMD_FOO}}";
    const result = substitute(source, config);
    expect(result).toEqual({ ok: false, unknown: "{{VISMD_FOO}}" });
  });

  it("reports unknown when a known placeholder is followed by an unknown one", () => {
    const source = `import A from "{{VISMD_LOCAL}}/A"\nimport B from "{{VISMD_FOO}}/B"`;
    const result = substitute(source, config);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.unknown).toBe("{{VISMD_FOO}}");
    }
  });

  it("returns ok: true with empty output for empty source", () => {
    const result = substitute("", config);
    expect(result).toEqual({ ok: true, output: "" });
  });
});
