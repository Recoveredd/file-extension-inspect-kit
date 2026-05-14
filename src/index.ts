export type CaseMode = "lower" | "preserve";
export type DotfilePolicy = "name" | "extension" | "empty";
export type ExtensionlessPolicy = "empty" | "name";

export type FileExtensionDiagnostic =
  | "empty-input"
  | "blank-input"
  | "path-ends-with-separator"
  | "dotfile-treated-as-name"
  | "dotfile-treated-as-extension"
  | "extensionless-treated-as-name"
  | "compound-extension-matched";

export interface InspectFileExtensionOptions {
  caseMode?: CaseMode;
  dotfile?: DotfilePolicy;
  extensionless?: ExtensionlessPolicy;
  compoundExtensions?: readonly string[];
}

export interface FileExtensionInfo {
  ok: true;
  input: string;
  fileName: string;
  stem: string;
  effectiveStem: string;
  extension: string;
  compoundExtension: string;
  effectiveExtension: string;
  segments: string[];
  diagnostics: FileExtensionDiagnostic[];
}

export interface FileExtensionError {
  ok: false;
  input: unknown;
  code: "invalid-input" | "empty-input" | "path-ends-with-separator";
  message: string;
  diagnostics: FileExtensionDiagnostic[];
}

export type FileExtensionResult = FileExtensionInfo | FileExtensionError;

export interface FileExtensionInspector {
  inspect(input: unknown, options?: InspectFileExtensionOptions): FileExtensionResult;
  get(input: unknown, options?: InspectFileExtensionOptions): string;
  has(input: unknown, expected: string | readonly string[], options?: InspectFileExtensionOptions): boolean;
  split(input: unknown, options?: InspectFileExtensionOptions): Pick<
    FileExtensionInfo,
    "stem" | "effectiveStem" | "extension" | "effectiveExtension"
  > | null;
}

const DEFAULT_OPTIONS: Required<InspectFileExtensionOptions> = {
  caseMode: "lower",
  dotfile: "name",
  extensionless: "empty",
  compoundExtensions: []
};

export function inspectFileExtension(
  input: unknown,
  options: InspectFileExtensionOptions = {}
): FileExtensionResult {
  const settings = normalizeOptions(options);

  if (typeof input !== "string") {
    return {
      ok: false,
      input,
      code: "invalid-input",
      message: "Expected a string filename or path-like value.",
      diagnostics: []
    };
  }

  if (input.length === 0) {
    return {
      ok: false,
      input,
      code: "empty-input",
      message: "Expected a non-empty filename or path-like value.",
      diagnostics: ["empty-input"]
    };
  }

  if (input.trim().length === 0) {
    return {
      ok: false,
      input,
      code: "empty-input",
      message: "Expected a filename or path-like value with non-blank characters.",
      diagnostics: ["blank-input"]
    };
  }

  const fileName = lastPathSegment(input);
  if (fileName.length === 0) {
    return {
      ok: false,
      input,
      code: "path-ends-with-separator",
      message: "The path-like value ends with a separator and has no filename segment.",
      diagnostics: ["path-ends-with-separator"]
    };
  }

  const diagnostics: FileExtensionDiagnostic[] = [];
  const normalizedFileName = normalizeCase(fileName, settings.caseMode);
  const rawSegments = fileName.split(".");

  if (fileName.startsWith(".") && rawSegments.length === 2) {
    return inspectDotfile(input, fileName, settings, diagnostics);
  }

  if (!fileName.includes(".")) {
    if (settings.extensionless === "name") {
      diagnostics.push("extensionless-treated-as-name");
      return createInfo(input, fileName, "", normalizeCase(fileName, settings.caseMode), "", diagnostics);
    }

    return createInfo(input, fileName, fileName, "", "", diagnostics);
  }

  const extension = normalizedFileName.slice(normalizedFileName.lastIndexOf(".") + 1);
  const stem = fileName.slice(0, fileName.lastIndexOf("."));
  const compoundExtension = findCompoundExtension(fileName, settings.compoundExtensions, settings.caseMode);
  const effectiveExtension = compoundExtension || extension;
  const effectiveStem =
    compoundExtension.length > 0 ? fileName.slice(0, fileName.length - compoundExtension.length - 1) : stem;

  if (compoundExtension.length > 0) {
    diagnostics.push("compound-extension-matched");
  }

  return {
    ok: true,
    input,
    fileName,
    stem,
    effectiveStem,
    extension,
    compoundExtension,
    effectiveExtension,
    segments: effectiveExtension.length > 0 ? effectiveExtension.split(".") : [],
    diagnostics
  };
}

export function getFileExtension(input: unknown, options: InspectFileExtensionOptions = {}): string {
  const result = inspectFileExtension(input, options);
  return result.ok ? result.extension : "";
}

export function splitFileExtension(
  input: unknown,
  options: InspectFileExtensionOptions = {}
): Pick<FileExtensionInfo, "stem" | "effectiveStem" | "extension" | "effectiveExtension"> | null {
  const result = inspectFileExtension(input, options);
  return result.ok
    ? {
        stem: result.stem,
        effectiveStem: result.effectiveStem,
        extension: result.extension,
        effectiveExtension: result.effectiveExtension
      }
    : null;
}

export function hasFileExtension(
  input: unknown,
  expected: string | readonly string[],
  options: InspectFileExtensionOptions = {}
): boolean {
  const result = inspectFileExtension(input, options);
  if (!result.ok) {
    return false;
  }

  const settings = normalizeOptions(options);
  const expectedValues = Array.isArray(expected) ? expected : [expected];
  const normalizedExpected = expectedValues.map((value) => normalizeExpectedExtension(value, settings.caseMode));

  return normalizedExpected.some((value) => {
    if (value.includes(".")) {
      return result.effectiveExtension === value || result.compoundExtension === value;
    }

    return result.extension === value || result.effectiveExtension === value;
  });
}

export function createFileExtensionInspector(defaultOptions: InspectFileExtensionOptions = {}): FileExtensionInspector {
  return {
    inspect(input, options) {
      return inspectFileExtension(input, mergeOptions(defaultOptions, options));
    },
    get(input, options) {
      return getFileExtension(input, mergeOptions(defaultOptions, options));
    },
    has(input, expected, options) {
      return hasFileExtension(input, expected, mergeOptions(defaultOptions, options));
    },
    split(input, options) {
      return splitFileExtension(input, mergeOptions(defaultOptions, options));
    }
  };
}

function inspectDotfile(
  input: string,
  fileName: string,
  settings: Required<InspectFileExtensionOptions>,
  diagnostics: FileExtensionDiagnostic[]
): FileExtensionInfo {
  if (settings.dotfile === "extension") {
    diagnostics.push("dotfile-treated-as-extension");
    const extension = normalizeCase(fileName.slice(1), settings.caseMode);
    return createInfo(input, fileName, "", extension, "", diagnostics);
  }

  if (settings.dotfile === "empty") {
    return createInfo(input, fileName, "", "", "", diagnostics);
  }

  diagnostics.push("dotfile-treated-as-name");
  return createInfo(input, fileName, fileName, "", "", diagnostics);
}

function createInfo(
  input: string,
  fileName: string,
  stem: string,
  extension: string,
  compoundExtension: string,
  diagnostics: FileExtensionDiagnostic[]
): FileExtensionInfo {
  const effectiveExtension = compoundExtension || extension;

  return {
    ok: true,
    input,
    fileName,
    stem,
    effectiveStem: stem,
    extension,
    compoundExtension,
    effectiveExtension,
    segments: effectiveExtension.length > 0 ? effectiveExtension.split(".") : [],
    diagnostics
  };
}

function normalizeOptions(options: InspectFileExtensionOptions): Required<InspectFileExtensionOptions> {
  return {
    ...DEFAULT_OPTIONS,
    ...options,
    compoundExtensions: options.compoundExtensions ?? DEFAULT_OPTIONS.compoundExtensions
  };
}

function lastPathSegment(input: string): string {
  const slashIndex = input.lastIndexOf("/");
  const backslashIndex = input.lastIndexOf("\\");
  const separatorIndex = Math.max(slashIndex, backslashIndex);
  return separatorIndex === -1 ? input : input.slice(separatorIndex + 1);
}

function normalizeCase(value: string, caseMode: CaseMode): string {
  return caseMode === "lower" ? value.toLowerCase() : value;
}

function normalizeExpectedExtension(value: string, caseMode: CaseMode): string {
  return normalizeCase(value.trim().replace(/^\./, ""), caseMode);
}

function mergeOptions(
  defaultOptions: InspectFileExtensionOptions,
  options: InspectFileExtensionOptions | undefined
): InspectFileExtensionOptions {
  return options === undefined ? { ...defaultOptions } : { ...defaultOptions, ...options };
}

function findCompoundExtension(
  fileName: string,
  compoundExtensions: readonly string[],
  caseMode: CaseMode
): string {
  const normalizedFileName = normalizeCase(fileName, caseMode);

  const matches = compoundExtensions
    .map((extension) => normalizeCase(extension.replace(/^\./, ""), caseMode))
    .filter((extension) => extension.includes("."))
    .filter((extension) => normalizedFileName.endsWith(`.${extension}`))
    .sort((a, b) => b.length - a.length);

  return matches[0] ?? "";
}
