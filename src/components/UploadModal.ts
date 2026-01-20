import { App, Modal, Notice, Editor, Platform } from "obsidian";
import NapkinNotesPlugin from "../../main";
import {
  ImageData,
  UploadEvent,
  ImageWithFile,
  ImageAnnotation,
} from "../types";
import { CarouselViewer, CarouselImage } from "./CarouselViewer";
import { ImageProcessor } from "../services/ImageProcessor";
import { MarkdownGenerator } from "../services/MarkdownGenerator";
import type { UploadServer } from "../server/UploadServer"; // lazy-loaded at runtime to avoid importing Node-only modules on mobile
import { QRCodeDisplay } from "./QRCodeDisplay";
import {
  MODAL_TITLE,
  TAB_FILESYSTEM,
  TAB_CAMERA,
  // ALLOWED_MIME_TYPES,
} from "../constants";

export class UploadModal extends Modal {
  private plugin: NapkinNotesPlugin;
  private editor?: Editor;
  private images: ImageData[] = [];
  private currentTab: "direct" | "camera" = "direct";

  // Optional callback when the modal is used in 'return results' mode
  private onComplete?: (saved: ImageWithFile[]) => void;

  // Components
  private carouselViewer?: CarouselViewer;
  private imageProcessor: ImageProcessor;
  private markdownGenerator: MarkdownGenerator;
  private uploadServer?: UploadServer;
  private qrDisplay?: QRCodeDisplay;

  // UI Elements
  private tabContainer?: HTMLElement;
  private contentContainer?: HTMLElement;
  private reviewSection?: HTMLElement;
  private carouselContainer?: HTMLElement;
  private imageCountEl?: HTMLElement;
  private insertBtn?: HTMLButtonElement;

  constructor(
    app: App,
    plugin: NapkinNotesPlugin,
    editor?: Editor,
    onComplete?: (
      saved: {
        vaultFile: import("obsidian").TFile;
        annotation?: ImageAnnotation;
      }[]
    ) => void
  ) {
    super(app);
    this.plugin = plugin;
    this.editor = editor;
    this.onComplete = onComplete;

    this.imageProcessor = new ImageProcessor(app, plugin.settings);
    this.markdownGenerator = new MarkdownGenerator();
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("napkin-notes-upload-modal");

    // On mobile, force direct upload tab (camera tab requires Node.js)
    if (Platform.isMobileApp && this.currentTab === "camera") {
      this.currentTab = "direct";
    }

    // Title
    contentEl.createEl("h2", { text: MODAL_TITLE });

    // ========== UPLOAD SECTION ==========
    const uploadSection = contentEl.createEl("div", {
      cls: "napkin-modal-section napkin-upload-section",
    });

    const uploadHeader = uploadSection.createEl("div", {
      cls: "napkin-section-header",
    });
    uploadHeader.createEl("h3", { text: "Upload" });

    // Tabs for upload method
    this.tabContainer = uploadSection.createEl("div", {
      cls: "napkin-notes-tabs",
    });
    this.renderTabs();

    // Upload content area
    this.contentContainer = uploadSection.createEl("div", {
      cls: "napkin-notes-content",
    });
    this.renderContent();

    // ========== REVIEW SECTION ==========
    this.reviewSection = contentEl.createEl("div", {
      cls: "napkin-modal-section napkin-review-section",
    });

    const reviewHeader = this.reviewSection.createEl("div", {
      cls: "napkin-section-header",
    });
    reviewHeader.createEl("h3", { text: "Review" });
    this.imageCountEl = reviewHeader.createEl("span", {
      cls: "napkin-image-count",
      text: "No images",
    });

    // Empty state message
    const emptyState = this.reviewSection.createEl("div", {
      cls: "review-empty-state",
    });
    emptyState.createEl("p", {
      text: "Upload images to review them here",
      cls: "napkin-empty-state-text",
    });

    // Carousel section
    this.carouselContainer = this.reviewSection.createEl("div", {
      cls: "napkin-notes-carousel-section",
    });

    const carouselDiv = this.carouselContainer.createEl("div", {
      cls: "carousel-wrapper",
    });
    this.renderCarousel(carouselDiv);

    // Update review section visibility
    this.updateReviewSection();

    // Buttons
    const buttonContainer = contentEl.createEl("div", {
      cls: "napkin-modal-button-container",
    });

    const cancelBtn = buttonContainer.createEl("button", { text: "Cancel" });
    cancelBtn.addEventListener("click", () => this.close());

    this.insertBtn = buttonContainer.createEl("button", {
      text: "Insert into notes",
      cls: "napkin-mod-cta",
      attr: {
        "aria-label": "Upload image(s) first",
      },
    });
    this.insertBtn.disabled = true;
    this.insertBtn.addEventListener("click", () => {
      void (async () => {
        if (this.onComplete) {
          // Save to vault and return saved files to the caller instead of inserting into editor
          try {
            const saved = await this.saveImagesToVault();
            this.onComplete(saved);
            this.close();
          } catch (err) {
            console.error("Failed to save images for onComplete:", err);
            new Notice("Failed to save images");
          }
        } else {
          void this.insertNotes();
        }
      })();
    });
  }

  /**
   * Update the review section visibility and content
   */
  private updateReviewSection(): void {
    if (!this.reviewSection) return;

    const emptyState = this.reviewSection.querySelector<HTMLElement>(
      ".review-empty-state"
    );
    const carouselSection = this.reviewSection.querySelector<HTMLElement>(
      ".napkin-notes-carousel-section"
    );

    if (this.images.length === 0) {
      // Hide entire review section when no images
      this.reviewSection.style.display = "none";

      // Disable insert button
      if (this.insertBtn) {
        this.insertBtn.disabled = true;
        this.insertBtn.setAttribute("aria-label", "Upload image(s) first");
      }
    } else {
      // Show review section
      this.reviewSection.style.display = "block";

      // Enable insert button
      if (this.insertBtn) {
        this.insertBtn.disabled = false;
        this.insertBtn.removeAttribute("aria-label");
      }

      // Hide empty state, show carousel
      if (emptyState) emptyState.style.display = "none";
      if (carouselSection) carouselSection.style.display = "block";
      if (this.imageCountEl) {
        this.imageCountEl.textContent = `${this.images.length} image${
          this.images.length !== 1 ? "s" : ""
        }`;
      }
    }
  }

  /**
   * Delete an image from the list
   */
  private deleteImage(index: number): void {
    if (index < 0 || index >= this.images.length) return;

    const removed = this.images.splice(index, 1)[0];

    // Revoke data URL
    if (removed.dataUrl) {
      URL.revokeObjectURL(removed.dataUrl);
    }

    // Update carousel
    this.refreshCarousel();

    // Update review section
    this.updateReviewSection();
  }

  /**
   * Scroll to the review section
   */
  private scrollToReviewSection(): void {
    if (this.reviewSection) {
      this.reviewSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();

    void this.stopUploadServer();

    // Revoke data URLs
    this.images.forEach((img) => {
      if (img.dataUrl) {
        URL.revokeObjectURL(img.dataUrl);
      }
    });
  }

  private renderTabs(): void {
    if (!this.tabContainer) return;

    this.tabContainer.empty();

    // Filesystem tab
    const directTab = this.tabContainer.createEl("div", {
      text: TAB_FILESYSTEM,
      cls: "napkin-notes-tab",
    });
    if (this.currentTab === "direct") {
      directTab.addClass("active");
    }
    directTab.addEventListener("click", () => this.switchTab("direct"));

    // Camera upload tab (desktop only - requires Node.js HTTP server)
    if (!Platform.isMobileApp) {
      const cameraTab = this.tabContainer.createEl("div", {
        text: TAB_CAMERA,
        cls: "napkin-notes-tab",
      });
      if (this.currentTab === "camera") {
        cameraTab.addClass("active");
      }
      cameraTab.addEventListener("click", () => this.switchTab("camera"));
    }
  }

  /**
   * Render the carousel viewer using the unified CarouselViewer component
   */
  private renderCarousel(container: HTMLElement): void {
    // Convert ImageData to CarouselImage format
    const carouselImages: CarouselImage[] = this.images.map((img) => ({
      dataUrl: img.dataUrl,
      description: img.annotation?.description || "",
    }));

    this.carouselViewer = new CarouselViewer({
      app: this.app,
      container,
      images: carouselImages,
      mode: "edit", // Upload modal is always in edit mode
      collapsibleThumbnails: false, // Keep thumbnails always visible in modal
      showEditButton: false, // No edit button needed - always in edit mode
      showSaveButton: false, // No save button - use modal's Insert button
      enableNapkinMode: this.plugin.settings.enableNapkinMode,
      onImageChange: (index) => {
        this.onCarouselChange(index);
      },
      onDelete: (index) => {
        this.deleteImage(index);
      },
      onReorder: (reorderedImages) => {
        // Reorder the internal images array to match
        const newImages: ImageData[] = [];
        reorderedImages.forEach((carouselImg) => {
          const originalImg = this.images.find(
            (img) => img.dataUrl === carouselImg.dataUrl
          );
          if (originalImg) {
            newImages.push(originalImg);
          }
        });
        this.images = newImages;
      },
      onDescriptionChange: (index, description) => {
        if (this.images[index]) {
          if (!this.images[index].annotation) {
            this.images[index].annotation = { description: "" };
          }
          this.images[index].annotation.description = description;
        }
      },
    });

    this.carouselViewer.render();
  }

  /**
   * Refresh the carousel with current images
   */
  private refreshCarousel(): void {
    if (!this.carouselViewer) return;

    const carouselImages: CarouselImage[] = this.images.map((img) => ({
      dataUrl: img.dataUrl,
      description: img.annotation?.description || "",
    }));

    this.carouselViewer.updateImages(carouselImages);
  }

  private switchTab(tab: "direct" | "camera"): void {
    // Update tab state and UI immediately
    this.currentTab = tab;
    this.renderTabs();
    this.renderContent();

    if (this.uploadServer && tab !== "camera") {
      void this.stopUploadServer();
    }
  }

  /**
   * Stop the upload server if running
   */
  private async stopUploadServer(): Promise<void> {
    if (this.uploadServer) {
      console.debug("[Napkin Notes] Stopping upload server (tab switch)");
      await this.uploadServer.stop();
      this.uploadServer = undefined;
      this.qrDisplay = undefined;
      console.debug("[Napkin Notes] Upload server stopped");
    }
  }

  private renderContent(): void {
    if (!this.contentContainer) return;

    this.contentContainer.empty();

    if (this.currentTab === "direct") {
      this.renderDirectUpload();
    } else if (this.currentTab === "camera") {
      void this.renderCameraUpload();
    }
  }

  private renderDirectUpload(): void {
    if (!this.contentContainer) return;

    const uploadZone = this.contentContainer.createEl("div", {
      cls: "napkin-upload-zone",
    });

    uploadZone.createEl("p", {
      text: "📁 Drop images or click to upload",
      cls: "napkin-upload-zone-text",
    });

    uploadZone.createEl("p", {
      text: "Supports multiple images",
      cls: "napkin-upload-zone-subtext",
    });

    // File input
    const fileInput = uploadZone.createEl("input", {
      type: "file",
      attr: {
        accept: "image/*",
        multiple: "true",
      },
    });
    fileInput.style.display = "none";

    // Click to upload
    uploadZone.addEventListener("click", () => fileInput.click());

    // File selection
    fileInput.addEventListener("change", (e: Event) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        void this.handleFiles(Array.from(files));
      }
    });

    // Drag and drop
    uploadZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadZone.addClass("dragover");
    });

    uploadZone.addEventListener("dragleave", () => {
      uploadZone.removeClass("dragover");
    });

    uploadZone.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadZone.removeClass("dragover");
      const files = e.dataTransfer?.files;
      if (files) {
        void this.handleFiles(Array.from(files));
      }
    });
  }

  private async renderCameraUpload(): Promise<void> {
    if (!this.contentContainer) return;

    const qrContainer = this.contentContainer.createEl("div", {
      cls: "napkin-qr-upload-container",
    });

    // Initialize QR display
    this.qrDisplay = new QRCodeDisplay(qrContainer);

    try {
      // Initialize upload server (lazy-load to avoid Node imports on mobile)
      const serverModule = await import("../server/UploadServer.js");
      const UploadServerClass = serverModule.UploadServer;
      this.uploadServer = new UploadServerClass(
        (event: UploadEvent) => {
          void this.handleServerUpload(event);
        },
        (info) => {
          this.handleDeviceConnect(info);
        }
      );

      // Start server
      const serverInfo = await this.uploadServer.start(
        this.plugin.settings.serverPortRange
      );

      // Display QR code
      await this.qrDisplay.display(serverInfo);

      new Notice("Ready! Scan QR code with your phone.");
    } catch (error) {
      console.error("Failed to start server:", error);

      const errorMessage = Platform.isMobileApp
        ? "Camera upload via QR code is only available on desktop. Please use direct upload instead."
        : "Failed to start upload server. Please try again or use direct upload.";

      this.qrDisplay.showError(errorMessage);
      new Notice(errorMessage);
    }
  }

  private async handleServerUpload(event: UploadEvent): Promise<void> {
    try {
      // Convert ArrayBuffer to Blob and File
      const blob = new Blob([event.buffer], { type: "image/jpeg" });
      const file = new File([blob], event.filename, { type: "image/jpeg" });
      console.debug(`[Napkin Notes] Created File object, size: ${file.size}`);

      // Process the uploaded file
      const buffer = await this.imageProcessor.fileToArrayBuffer(file);
      const dataUrl = this.imageProcessor.createDataUrl(buffer, file.type);

      const imageData: ImageData = {
        file: file,
        buffer: buffer,
        filename: event.filename,
        dataUrl: dataUrl,
        annotation: {
          description: "",
        },
      };

      this.images.push(imageData);
      console.debug(
        `[Napkin Notes] Added image, total images: ${this.images.length}`
      );

      // Update carousel
      this.refreshCarousel();

      // Update review section
      this.updateReviewSection();

      // Update upload counter in QR display
      if (this.qrDisplay) {
        this.qrDisplay.updateCounter(this.images.length);
      }

      // Scroll to review section
      this.scrollToReviewSection();

      new Notice(`Received image: ${event.filename}`);
    } catch (error) {
      console.error("[Napkin Notes] Failed to process uploaded image:", error);
      new Notice("Failed to process uploaded image");
    }
  }

  /**
   * Save current images to the vault and return saved files + annotations
   */
  private async saveImagesToVault(): Promise<ImageWithFile[]> {
    const imageWithFiles: ImageWithFile[] = [];

    for (const imageData of this.images) {
      const buffer =
        imageData.buffer ||
        (await this.imageProcessor.fileToArrayBuffer(imageData.file!));
      const vaultFile = await this.imageProcessor.saveImage(
        buffer,
        imageData.filename
      );
      imageWithFiles.push({ vaultFile, annotation: imageData.annotation });
    }

    return imageWithFiles;
  }

  private handleDeviceConnect(info: {
    ip: string;
    userAgent?: string;
    url?: string;
    timestamp?: number;
  }): void {
    // Show a brief notification to the user and log details for debugging
    new Notice("[Napkin Notes] Device connected: " + (info.ip || "unknown"));
  }

  private async handleFiles(files: File[]): Promise<void> {
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));

    if (imageFiles.length === 0) {
      new Notice("Please select image files");
      return;
    }

    for (const file of imageFiles) {
      try {
        const buffer = await this.imageProcessor.fileToArrayBuffer(file);
        const dataUrl = this.imageProcessor.createDataUrl(buffer, file.type);

        const imageData: ImageData = {
          file: file,
          buffer: buffer,
          filename: file.name,
          dataUrl: dataUrl,
          annotation: {
            description: "",
          },
        };

        this.images.push(imageData);
      } catch (error) {
        console.error("Failed to process file:", error);
        new Notice(`Failed to process ${file.name}`);
      }
    }

    // Update carousel
    this.refreshCarousel();

    // Update review section
    this.updateReviewSection();

    // Scroll to review section
    this.scrollToReviewSection();

    new Notice(`Added ${imageFiles.length} image(s)`);
  }

  private onCarouselChange(index: number): void {
    // NOT IMPLEMENTED CURRENTLY
    // Update annotation editor to show current image's annotations
    // Annotation editor is now handled by CarouselViewer
  }

  // Annotation editor is now handled by CarouselViewer

  private async insertNotes(): Promise<void> {
    if (this.images.length === 0) {
      new Notice("No images to insert");
      return;
    }

    try {
      new Notice("Saving images...");

      // Save all images to vault
      const imageWithFiles = await this.saveImagesToVault();

      // Generate markdown
      const markdown = this.markdownGenerator.generate(imageWithFiles);

      // Insert at cursor
      if (!this.editor) {
        new Notice("No editor available to insert notes");
        return;
      }
      this.editor.replaceSelection(markdown);

      new Notice(`Inserted ${this.images.length} napkin note(s)`);

      this.close();
    } catch (error) {
      console.error("Failed to insert notes:", error);
      new Notice("Failed to insert notes");
    }
  }
}
