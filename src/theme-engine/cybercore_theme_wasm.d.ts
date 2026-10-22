/* tslint:disable */
/* eslint-disable */

/**
 * JSON array of all embedded ThemeDocuments.
 */
export function builtin_themes(): string;

/**
 * Export a family from built-ins and the supplied custom ThemeDocument array.
 */
export function export_family(custom_json: string, family: string): string;

/**
 * Import with "reject", "skip", or "replace_custom". Return {report, themes},
 * where themes is the new custom-only collection to persist in browser storage.
 */
export function import_pack(custom_json: string, pack_json: string, policy: string): string;

/**
 * Validate a pack and return its built-in/custom collision lists as JSON.
 */
export function pack_conflicts(custom_json: string, pack_json: string): string;

/**
 * Generate CSS; appearance must be "dark" or "light".
 */
export function theme_css(theme_json: string, appearance: string): string;

/**
 * Validate a theme and return its quality report as JSON. Invalid input throws.
 */
export function validate_theme(theme_json: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly builtin_themes: () => [number, number, number, number];
    readonly export_family: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly import_pack: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
    readonly pack_conflicts: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly theme_css: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly validate_theme: (a: number, b: number) => [number, number, number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
