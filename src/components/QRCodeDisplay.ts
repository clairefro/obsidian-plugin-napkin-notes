import * as QRCode from "qrcode";
import { ServerInfo } from "../types";

/**
 * Component for displaying QR code and server info
 */
export class QRCodeDisplay {
  private container: HTMLElement;
  private serverInfo: ServerInfo | null = null;
  private qrCanvas?: HTMLCanvasElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /**
   * Display the QR code and server info
   */
  async display(serverInfo: ServerInfo): Promise<void> {
    this.serverInfo = serverInfo;
    this.container.empty();

    // Status message
    const statusDiv = this.container.createEl("div", {
      cls: "napkin-qr-status",
    });
    statusDiv.createEl("div", {
      text: "✓ Ready to connect",
      cls: "napkin-qr-status-active",
    });

    // QR code container
    const qrContainer = this.container.createEl("div", { cls: "qr-container" });

    // Generate and display QR code
    this.qrCanvas = qrContainer.createEl("canvas", { cls: "napkin-qr-code" });
    await QRCode.toCanvas(this.qrCanvas, serverInfo.url, {
      width: 200,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });

    // Server info
    const infoDiv = qrContainer.createEl("div", { cls: "napkin-qr-info" });
    infoDiv.createEl("div", {
      text: "Scan with your phone camera",
      cls: "napkin-qr-info-title",
    });
    infoDiv.createEl("div", {
      text: "Phone must be on the same wifi network",
      cls: "napkin-qr-info-subtitle",
    });

    const urlDiv = infoDiv.createEl("div", { cls: "napkin-qr-info-url" });
    urlDiv.setText(serverInfo.url);

    // Copy button
    const copyBtn = infoDiv.createEl("button", {
      text: "Copy URL",
      cls: "napkin-qr-copy-btn",
    });

    copyBtn.addEventListener("click", async () => {
      await navigator.clipboard.writeText(serverInfo.url);
      copyBtn.setText("Copied!");
      setTimeout(() => {
        copyBtn.setText("Copy URL");
      }, 2000);
    });

    // Upload counter
    this.container.createEl("div", {
      text: "0 images received",
      cls: "napkin-qr-upload-count",
    });
    this.container.dataset.counter = "0";
  }

  /**
   * Update upload counter
   */
  updateCounter(count: number): void {
    const counterDiv = this.container.querySelector<HTMLElement>(
      ".napkin-qr-upload-count"
    );
    if (counterDiv) {
      counterDiv.textContent = `${count} image${
        count !== 1 ? "s" : ""
      } received`;
    }
  }

  /**
   * Show error message
   */
  showError(message: string): void {
    this.container.empty();

    const errorDiv = this.container.createEl("div", {
      cls: "napkin-qr-status",
    });
    errorDiv.createEl("div", {
      text: `✗ ${message}`,
      cls: "napkin-qr-error",
    });
  }

  /**
   * Clear display
   */
  clear(): void {
    this.container.empty();
    this.serverInfo = null;
    this.qrCanvas = undefined;
  }
}
