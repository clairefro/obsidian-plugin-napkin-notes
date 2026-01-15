/**
 * Platform-aware module loader for Node.js modules
 * Safely imports Node modules only on desktop (Electron) platform
 */

import { Platform } from "obsidian";

/**
 * Conditionally import http module (desktop only)
 */
export async function getHttpModule(): Promise<typeof import("http") | null> {
  if (Platform.isMobileApp) {
    return null;
  }
  try {
    // In Electron/Obsidian, we need to use require for Node.js built-ins
    // Dynamic import() doesn't work for externalized modules
    return require("http");
  } catch (e) {
    console.warn("[Napkin Notes] Failed to load http module:", e);
    return null;
  }
}

/**
 * Conditionally import crypto module (desktop only)
 */
export async function getCryptoModule(): Promise<typeof import("crypto") | null> {
  if (Platform.isMobileApp) {
    return null;
  }
  try {
    // In Electron/Obsidian, we need to use require for Node.js built-ins
    // Dynamic import() doesn't work for externalized modules
    return require("crypto");
  } catch (e) {
    console.warn("[Napkin Notes] Failed to load crypto module:", e);
    return null;
  }
}

/**
 * Conditionally import os module (desktop only)
 */
export async function getOsModule(): Promise<typeof import("os") | null> {
  if (Platform.isMobileApp) {
    return null;
  }
  try {
    // In Electron/Obsidian, we need to use require for Node.js built-ins
    // Dynamic import() doesn't work for externalized modules
    return require("os");
  } catch (e) {
    console.warn("[Napkin Notes] Failed to load os module:", e);
    return null;
  }
}

/**
 * Check if Node.js modules are available (i.e., running on desktop)
 */
export function isNodeModulesAvailable(): boolean {
  return !Platform.isMobileApp;
}
