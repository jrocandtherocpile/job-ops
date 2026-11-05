// Temporary: renders the v0.13.1 theme with the ansible-jobops override.
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ResumeRenderDocument } from "./types";
import { renderTypstPdf } from "./typst";

const baseDocument: ResumeRenderDocument = {
  name: "Jane Doe",
  headline: "Principal Engineer",
  picture: null,
  contactItems: [
    { text: "jane@example.com", url: "mailto:jane@example.com" },
    { text: "555 0100", url: "" },
  ],
  profileItems: [
    { network: "LinkedIn", username: "janedoe", url: "https://linkedin.com/in/janedoe" },
  ],
  customFieldItems: [],
  summary: "Builds resilient platform systems.",
  experience: [
    {
      title: "Acme",
      subtitle: "Platform Engineer",
      date: "2023 -- Present",
      bullets: ["Improved API reliability"],
      url: "",
      linkLabel: "",
    },
  ],
  education: [],
  projects: [],
  skillGroups: [{ name: "Backend", keywords: ["TypeScript"] }],
  languages: [],
  interests: [],
  awards: [],
  certifications: [],
  publications: [],
  volunteer: [],
  references: [],
};

async function header(
  name: string,
  overrides: Partial<ResumeRenderDocument>,
): Promise<{ text: string; separators: number }> {
  const dir = await mkdtemp(join(tmpdir(), "render-proof-"));
  const path = join(dir, `${name}.pdf`);
  await renderTypstPdf({
    document: { ...baseDocument, ...overrides },
    outputPath: path,
    jobId: `proof-${name}`,
    typstTheme: "clean-print-cv",
  });
  const out = process.env.RENDER_PROOF_DIR;
  if (out) {
    await mkdir(out, { recursive: true });
    await copyFile(path, join(out, `${name}.pdf`));
  }
  const result = spawnSync("pdftotext", ["-f", "1", "-l", "1", path, "-"], {
    encoding: "utf8",
  });
  expect(result.status).toBe(0);
  const text = result.stdout.split("PROFESSIONAL SUMMARY")[0] ?? "";
  const separators = (text.match(/[|∣│❘]/g) ?? []).length;
  console.log(`${name}: ${separators} separators: ${JSON.stringify(text)}`);
  return { text, separators };
}

describe("clean-print-cv contact row", () => {
  it("email, phone and LinkedIn only has no stray separators", async () => {
    const { text, separators } = await header("no-location", {});
    expect(separators).toBe(2);
    for (const item of ["jane@example.com", "555 0100", "janedoe"]) {
      expect(text).toContain(item);
    }
  });

  it("all fields keep every separator", async () => {
    const { text, separators } = await header("all-fields", {
      location: "Calgary, AB",
      profileItems: [
        ...baseDocument.profileItems,
        { network: "GitHub", username: "janegh", url: "https://github.com/janegh" },
        { network: "Website", username: "jane.dev", url: "https://jane.dev" },
      ],
    });
    expect(separators).toBe(5);
    for (const item of ["Calgary, AB", "janegh", "jane.dev"]) {
      expect(text).toContain(item);
    }
  });

  it("location added, nothing else optional", async () => {
    const { separators } = await header("with-location", {
      location: "Calgary, AB",
    });
    expect(separators).toBe(3);
  });

  it("email only has no separators", async () => {
    const { text, separators } = await header("email-only", {
      contactItems: [baseDocument.contactItems[0]],
      profileItems: [],
    });
    expect(separators).toBe(0);
    expect(text).toContain("jane@example.com");
  });
});
