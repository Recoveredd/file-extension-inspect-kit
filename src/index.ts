export type CaseMode = "lower" | "preserve";
export type DotfilePolicy = "name" | "extension" | "empty";
export type ExtensionlessPolicy = "empty" | "name";

export type FileExtensionDiagnostic =
  | "empty-input"
  | "blank-input"
  | "input-trimmed"
  | "path-ends-with-separator"
  | "dotfile-treated-as-name"
  | "dotfile-treated-as-extension"
  | "extensionless-treated-as-name"
  | "compound-extension-matched";

export interface InspectFileExtensionOptions {
  caseMode?: CaseMode;
  caseSensitive?: boolean;
  trim?: boolean;
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
  caseSensitive: false,
  trim: true,
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

  const inspectedInput = settings.trim ? input.trim() : input;
  const diagnostics: FileExtensionDiagnostic[] = [];

  if (inspectedInput.length === 0 && input.length === 0) {
    return {
      ok: false,
      input,
      code: "empty-input",
      message: "Expected a non-empty filename or path-like value.",
      diagnostics: ["empty-input"]
    };
  }

  if (inspectedInput.length === 0) {
    return {
      ok: false,
      input,
      code: "empty-input",
      message: "Expected a filename or path-like value with non-blank characters.",
      diagnostics: ["blank-input"]
    };
  }

  if (inspectedInput !== input) {
    diagnostics.push("input-trimmed");
  }

  const fileName = lastPathSegment(inspectedInput);
  if (fileName.length === 0) {
    return {
      ok: false,
      input: inspectedInput,
      code: "path-ends-with-separator",
      message: "The path-like value ends with a separator and has no filename segment.",
      diagnostics: [...diagnostics, "path-ends-with-separator"]
    };
  }

  const normalizedFileName = normalizeCase(fileName, settings.caseMode);
  const rawSegments = fileName.split(".");

  if (fileName.startsWith(".") && rawSegments.length === 2) {
    return inspectDotfile(inspectedInput, fileName, settings, diagnostics);
  }

  if (!fileName.includes(".")) {
    if (settings.extensionless === "name") {
      diagnostics.push("extensionless-treated-as-name");
      return createInfo(inspectedInput, fileName, "", normalizeCase(fileName, settings.caseMode), "", diagnostics);
    }

    return createInfo(inspectedInput, fileName, fileName, "", "", diagnostics);
  }

  const extension = normalizedFileName.slice(normalizedFileName.lastIndexOf(".") + 1);
  const stem = fileName.slice(0, fileName.lastIndexOf("."));
  const compoundExtension = findCompoundExtension(
    fileName,
    settings.compoundExtensions,
    settings.caseMode,
    settings.caseSensitive
  );
  const effectiveExtension = compoundExtension || extension;
  const effectiveStem =
    compoundExtension.length > 0 ? fileName.slice(0, fileName.length - compoundExtension.length - 1) : stem;

  if (compoundExtension.length > 0) {
    diagnostics.push("compound-extension-matched");
  }

  return {
    ok: true,
    input: inspectedInput,
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
  const normalizedExpected = expectedValues.map((value) =>
    normalizeExpectedExtension(value, settings.caseSensitive)
  );
  const extension = normalizeForComparison(result.extension, settings.caseSensitive);
  const effectiveExtension = normalizeForComparison(result.effectiveExtension, settings.caseSensitive);
  const compoundExtension = normalizeForComparison(result.compoundExtension, settings.caseSensitive);

  return normalizedExpected.some((value) => {
    if (value.includes(".")) {
      return effectiveExtension === value || compoundExtension === value;
    }

    return extension === value || effectiveExtension === value;
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

function normalizeForComparison(value: string, caseSensitive: boolean): string {
  return caseSensitive ? value : value.toLowerCase();
}

function normalizeExpectedExtension(value: string, caseSensitive: boolean): string {
  return normalizeForComparison(value.trim().replace(/^\./, ""), caseSensitive);
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
  caseMode: CaseMode,
  caseSensitive: boolean
): string {
  const comparableFileName = normalizeForComparison(fileName, caseSensitive);

  const matches = compoundExtensions
    .map((extension) => extension.trim().replace(/^\./, ""))
    .filter((extension) => extension.includes("."))
    .filter((extension) =>
      comparableFileName.endsWith(`.${normalizeForComparison(extension, caseSensitive)}`)
    )
    .sort((a, b) => b.length - a.length);

  const match = matches[0];
  return match === undefined ? "" : normalizeCase(fileName.slice(fileName.length - match.length), caseMode);
}
