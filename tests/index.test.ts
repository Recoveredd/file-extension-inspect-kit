import { describe, expect, it } from "vitest";
import {
  createFileExtensionInspector,
  getFileExtension,
  hasFileExtension,
  inspectFileExtension,
  splitFileExtension
} from "../src/index.js";

describe("inspectFileExtension", () => {
  it("extracts a simple lowercase extension", () => {
    expect(inspectFileExtension("report.PDF")).toMatchObject({
      ok: true,
      fileName: "report.PDF",
      stem: "report",
      effectiveStem: "report",
      extension: "pdf",
      compoundExtension: "",
      effectiveExtension: "pdf",
      segments: ["pdf"]
    });
  });

  it("preserves case when requested", () => {
    expect(getFileExtension("photo.JPEG", { caseMode: "preserve" })).toBe("JPEG");
  });

  it("trims pasted input by default and can preserve whitespace when requested", () => {
    expect(inspectFileExtension("  report.PDF  ")).toMatchObject({
      ok: true,
      input: "report.PDF",
      fileName: "report.PDF",
      extension: "pdf",
      diagnostics: ["input-trimmed"]
    });

    expect(inspectFileExtension("  report.PDF  ", { trim: false })).toMatchObject({
      ok: true,
      input: "  report.PDF  ",
      fileName: "  report.PDF  ",
      extension: "pdf  ",
      diagnostics: []
    });
  });

  it("handles path-like strings without Node path APIs", () => {
    expect(inspectFileExtension("C:\\Users\\me\\archive.tar.gz")).toMatchObject({
      ok: true,
      fileName: "archive.tar.gz",
      stem: "archive.tar",
      extension: "gz"
    });
  });

  it("matches known compound extensions", () => {
    expect(
      inspectFileExtension("archive.tar.gz", {
        compoundExtensions: ["tar.gz", "module.css"]
      })
    ).toMatchObject({
      ok: true,
      stem: "archive.tar",
      effectiveStem: "archive",
      extension: "gz",
      compoundExtension: "tar.gz",
      effectiveExtension: "tar.gz",
      segments: ["tar", "gz"],
      diagnostics: ["compound-extension-matched"]
    });
  });

  it("matches compound extensions case-insensitively while preserving output case", () => {
    expect(
      inspectFileExtension("archive.TAR.GZ", {
        caseMode: "preserve",
        compoundExtensions: ["tar.gz"]
      })
    ).toMatchObject({
      ok: true,
      extension: "GZ",
      compoundExtension: "TAR.GZ",
      effectiveExtension: "TAR.GZ"
    });

    expect(
      inspectFileExtension("archive.TAR.GZ", {
        caseMode: "preserve",
        caseSensitive: true,
        compoundExtensions: ["tar.gz"]
      })
    ).toMatchObject({
      ok: true,
      extension: "GZ",
      compoundExtension: "",
      effectiveExtension: "GZ"
    });
  });

  it("treats dotfiles as names by default", () => {
    expect(inspectFileExtension(".env")).toMatchObject({
      ok: true,
      stem: ".env",
      extension: "",
      diagnostics: ["dotfile-treated-as-name"]
    });
  });

  it("can treat dotfiles as extensions", () => {
    expect(inspectFileExtension(".Dockerfile", { dotfile: "extension" })).toMatchObject({
      ok: true,
      stem: "",
      extension: "dockerfile",
      diagnostics: ["dotfile-treated-as-extension"]
    });
  });

  it("can treat extensionless names as extensions", () => {
    expect(inspectFileExtension("Makefile", { extensionless: "name" })).toMatchObject({
      ok: true,
      stem: "",
      extension: "makefile",
      diagnostics: ["extensionless-treated-as-name"]
    });
  });

  it("returns structured errors for invalid inputs", () => {
    expect(inspectFileExtension(null)).toMatchObject({
      ok: false,
      code: "invalid-input"
    });
    expect(inspectFileExtension("   ")).toMatchObject({
      ok: false,
      code: "empty-input",
      diagnostics: ["blank-input"]
    });
    expect(inspectFileExtension("/tmp/")).toMatchObject({
      ok: false,
      code: "path-ends-with-separator"
    });
  });
});

describe("helpers", () => {
  it("returns an empty string for missing extensions", () => {
    expect(getFileExtension("README")).toBe("");
  });

  it("splits stem and extension", () => {
    expect(splitFileExtension("index.test.ts")).toEqual({
      stem: "index.test",
      effectiveStem: "index.test",
      extension: "ts",
      effectiveExtension: "ts"
    });
  });

  it("checks one or many expected extensions", () => {
    expect(hasFileExtension("avatar.PNG", [".jpg", "png"])).toBe(true);
    expect(hasFileExtension("avatar.PNG", "jpg")).toBe(false);
    expect(
      hasFileExtension("archive.tar.gz", "tar.gz", {
        compoundExtensions: ["tar.gz"]
      })
    ).toBe(true);
    expect(hasFileExtension("avatar.PNG", "png", { caseMode: "preserve" })).toBe(true);
    expect(hasFileExtension("avatar.PNG", "png", { caseMode: "preserve", caseSensitive: true })).toBe(
      false
    );
  });
});

describe("createFileExtensionInspector", () => {
  it("reuses default policies and accepts per-call overrides", () => {
    const inspector = createFileExtensionInspector({
      caseMode: "preserve",
      compoundExtensions: ["d.ts", "tar.gz"]
    });

    expect(inspector.get("index.D.TS")).toBe("TS");
    expect(inspector.has("archive.tar.gz", "tar.gz")).toBe(true);
    expect(inspector.split("index.d.ts")).toEqual({
      stem: "index.d",
      effectiveStem: "index",
      extension: "ts",
      effectiveExtension: "d.ts"
    });
    expect(inspector.get("photo.JPEG", { caseMode: "lower" })).toBe("jpeg");
  });
});
