import { App, TFile, Vault, FileManager, normalizePath } from "obsidian";
import { NapkinNotesSettings } from "../types";
import { FILE_PREFIX } from "../constants";

export class ImageProcessor {
  constructor(private app: App, private settings: NapkinNotesSettings) {}

  /**
   * Save an image to the vault
   * @param imageData ArrayBuffer containing the image
   * @param originalFilename Original filename from upload
   * @returns The created TFile
   */
  async saveImage(
    imageData: ArrayBuffer,
    originalFilename: string
  ): Promise<TFile> {
    const folder = await this.getUploadFolder();
    const filename = this.generateFilename(originalFilename);
    const path = await this.getAvailablePath(filename, folder);

    // Create the file in the vault
    const file = await this.app.vault.createBinary(path, imageData);
    return file;
  }

  /**
   * Get the upload folder path
   */
  private async getUploadFolder(): Promise<string> {
    if (
      this.settings.uploadFolder &&
      this.settings.uploadFolder.trim() !== ""
    ) {
      // Use custom folder
      const folder = normalizePath(this.settings.uploadFolder);

      // Create folder if it doesn't exist
      const folderExists = await this.app.vault.adapter.exists(folder);
      if (!folderExists) {
        await this.app.vault.createFolder(folder);
      }

      return folder;
    } else {
      // Use vault's default attachment folder
      const attachmentFolder = (this.app.vault as any).getConfig(
        "attachmentFolderPath"
      );

      if (attachmentFolder && attachmentFolder !== "/") {
        const folder = normalizePath(attachmentFolder);
        const folderExists = await this.app.vault.adapter.exists(folder);
        if (!folderExists) {
          await this.app.vault.createFolder(folder);
        }
        return folder;
      }

      // Fall back to vault root
      return "";
    }
  }

  /**
   * Generate a unique filename for the image
   */
  private generateFilename(originalFilename: string): string {
    // Get file extension
    const ext = originalFilename.split(".").pop()?.toLowerCase() || "jpg";

    // Generate timestamp
    const now = new Date();
    const timestamp = now
      .toISOString()
      .replace(/T/, "-")
      .replace(/:/g, "-")
      .replace(/\..+/, "");

    return `${FILE_PREFIX}-${timestamp}.${ext}`;
  }

  /**
   * Get an available path for the file (handles name conflicts)
   */
  private async getAvailablePath(
    filename: string,
    folder: string
  ): Promise<string> {
    const basePath = folder ? `${folder}/${filename}` : filename;
    let path = normalizePath(basePath);
    let counter = 1;

    // Check if file exists and increment counter if needed
    while (await this.app.vault.adapter.exists(path)) {
      const nameParts = filename.split(".");
      const ext = nameParts.pop();
      const name = nameParts.join(".");
      const newFilename = `${name}-${counter}.${ext}`;
      path = normalizePath(folder ? `${folder}/${newFilename}` : newFilename);
      counter++;
    }

    return path;
  }

  /**
   * Convert File to ArrayBuffer
   */
  async fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Create a data URL from ArrayBuffer for preview
   */
  createDataUrl(buffer: ArrayBuffer, mimeType: string): string {
    const blob = new Blob([buffer], { type: mimeType });
    return URL.createObjectURL(blob);
  }
}
