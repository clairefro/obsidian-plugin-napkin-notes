export const CODE_BLOCK_LANGUAGE = "napkin-notes";

/**
 * Server configuration
 */
export const DEFAULT_PORT_START = 8080;
export const DEFAULT_PORT_END = 8090;
export const SERVER_TIMEOUT_MS = 300000; // 5 minutes

/**
 * File configuration
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/svg+xml",
  "image/webp",
  "image/bmp",
  "image/avif",
];
export const FILE_PREFIX = "napkin-note";

/**
 * UI configuration
 */
export const MODAL_TITLE = "Insert Napkin Notes";
export const TAB_DIRECT_UPLOAD = "Direct Upload";
export const TAB_CAMERA = "From Camera";
