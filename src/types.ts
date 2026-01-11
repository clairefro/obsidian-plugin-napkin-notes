import { TFile } from 'obsidian';

/**
 * Annotation data for a single image
 */
export interface ImageAnnotation {
	keywords: string[];
	description?: string;
}

/**
 * Image data with its annotation
 */
export interface ImageData {
	file?: File;                    // Browser File object (for direct upload)
	buffer?: ArrayBuffer;           // Raw image data (for QR upload)
	filename: string;               // Original filename
	annotation: ImageAnnotation;    // Metadata
	dataUrl?: string;               // Data URL for preview
}

/**
 * Image with saved vault file
 */
export interface ImageWithFile {
	vaultFile: TFile;
	annotation: ImageAnnotation;
}

/**
 * Plugin settings
 */
export interface PhysicalNoteScannerSettings {
	uploadFolder: string;                  // Custom folder path or empty for default
	serverPortRange: [number, number];     // Port range for upload server
	defaultKeywords: string[];             // Template keywords for suggestions
	enableCarousel: boolean;               // Show carousel in reading view
}

/**
 * Default settings
 */
export const DEFAULT_SETTINGS: PhysicalNoteScannerSettings = {
	uploadFolder: '',
	serverPortRange: [8080, 8090],
	defaultKeywords: ['meeting', 'notes', 'diagram', 'sketch'],
	enableCarousel: true,
};

/**
 * Server connection info
 */
export interface ServerInfo {
	port: number;
	token: string;
	url: string;
}

/**
 * Upload event data
 */
export interface UploadEvent {
	buffer: ArrayBuffer;
	filename: string;
}
