/**
 * Physical notes code block language
 */
export const CODE_BLOCK_LANGUAGE = "physical-note-viewer";

/**
 * Metadata field names
 */
export const METADATA_KEYWORDS = "keywords";
export const METADATA_DESCRIPTION = "description";

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
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/tiff",
  "image/svg+xml",
  "image/x-icon", // For .ico files
];
export const FILE_PREFIX = "physical-note";

/**
 * UI configuration
 */
export const MODAL_TITLE = "Insert Physical Notes";
export const TAB_DIRECT_UPLOAD = "Direct Upload";
export const TAB_CAMERA = "From Camera";
