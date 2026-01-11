import { App, Modal, Notice, Editor } from "obsidian";
import PhysicalNoteScannerPlugin from "../../main";
import { ImageData, ImageAnnotation, UploadEvent } from "../types";
import { ImageCarousel } from "./ImageCarousel";
import { AnnotationEditor } from "./AnnotationEditor";
import { ImageProcessor } from "../services/ImageProcessor";
import { MarkdownGenerator } from "../services/MarkdownGenerator";
import { UploadServer } from "../server/UploadServer";
import { QRCodeDisplay } from "./QRCodeDisplay";
import {
  MODAL_TITLE,
  TAB_DIRECT_UPLOAD,
  TAB_CAMERA,
  ALLOWED_MIME_TYPES,
} from "../constants";

export class PhysicalNotesModal extends Modal {
  private plugin: PhysicalNoteScannerPlugin;
  private editor: Editor;
  private images: ImageData[] = [];
  private currentTab: "direct" | "camera" = "direct";

  // Components
  private carousel?: ImageCarousel;
  private annotationEditor?: AnnotationEditor;
  private imageProcessor: ImageProcessor;
  private markdownGenerator: MarkdownGenerator;
  private uploadServer?: UploadServer;
  private qrDisplay?: QRCodeDisplay;

  // UI Elements
  private tabContainer?: HTMLElement;
  private contentContainer?: HTMLElement;
  private reviewSection?: HTMLElement;
  private carouselContainer?: HTMLElement;
  private annotationContainer?: HTMLElement;
  private imageCountEl?: HTMLElement;
  private insertBtn?: HTMLButtonElement;

  constructor(app: App, plugin: PhysicalNoteScannerPlugin, editor: Editor) {
    super(app);
    this.plugin = plugin;
    this.editor = editor;

    this.imageProcessor = new ImageProcessor(app, plugin.settings);
    this.markdownGenerator = new MarkdownGenerator();
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("physical-notes-modal");

    // Title
    contentEl.createEl("h2", { text: MODAL_TITLE });

    // ========== UPLOAD SECTION ==========
    const uploadSection = contentEl.createEl("div", {
      cls: "modal-section upload-section",
    });

    const uploadHeader = uploadSection.createEl("div", {
      cls: "section-header",
    });
    uploadHeader.createEl("h3", { text: "Upload" });

    // Tabs for upload method
    this.tabContainer = uploadSection.createEl("div", {
      cls: "physical-notes-tabs",
    });
    this.renderTabs();

    // Upload content area
    this.contentContainer = uploadSection.createEl("div", {
      cls: "physical-notes-content",
    });
    this.renderContent();

    // ========== REVIEW SECTION ==========
    this.reviewSection = contentEl.createEl("div", {
      cls: "modal-section review-section",
    });

    const reviewHeader = this.reviewSection.createEl("div", {
      cls: "section-header",
    });
    reviewHeader.createEl("h3", { text: "Review" });
    this.imageCountEl = reviewHeader.createEl("span", {
      cls: "image-count",
      text: "No images",
    });

    // Empty state message
    const emptyState = this.reviewSection.createEl("div", {
      cls: "review-empty-state",
    });
    emptyState.createEl("p", {
      text: "Upload images to review them here",
      cls: "empty-state-text",
    });

    // Carousel section
    this.carouselContainer = this.reviewSection.createEl("div", {
      cls: "physical-notes-carousel-section",
    });

    const carouselDiv = this.carouselContainer.createEl("div", {
      cls: "carousel-wrapper",
    });
    this.carousel = new ImageCarousel(
      carouselDiv,
      this.images,
      (index) => {
        this.onCarouselChange(index);
      },
      (index) => {
        this.deleteImage(index);
      },
      (reorderedImages) => {
        this.images = reorderedImages;
      }
    );
    this.carousel.render();

    // Annotation section
    this.annotationContainer = this.reviewSection.createEl("div", {
      cls: "physical-notes-annotation-section",
    });

    // Update review section visibility
    this.updateReviewSection();

    // Buttons
    const buttonContainer = contentEl.createEl("div", {
      cls: "modal-button-container",
    });

    const cancelBtn = buttonContainer.createEl("button", { text: "Cancel" });
    cancelBtn.addEventListener("click", () => this.close());

    this.insertBtn = buttonContainer.createEl("button", {
      text: "Insert Notes",
      cls: "mod-cta",
      attr: {
        "aria-label": "Upload image(s) first",
      },
    });
    this.insertBtn.disabled = true;
    this.insertBtn.addEventListener("click", () => this.insertNotes());
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
      ".physical-notes-carousel-section"
    );
    const annotationSection = this.reviewSection.querySelector<HTMLElement>(
      ".physical-notes-annotation-section"
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

      // Hide empty state, show carousel and annotation
      if (emptyState) emptyState.style.display = "none";
      if (carouselSection) carouselSection.style.display = "block";
      if (annotationSection) annotationSection.style.display = "block";
      if (this.imageCountEl) {
        this.imageCountEl.textContent = `${this.images.length} image${
          this.images.length !== 1 ? "s" : ""
        }`;
      }

      // Render annotation editor if not already rendered
      if (!this.annotationEditor) {
        this.renderAnnotationEditor();
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
    this.carousel?.updateImages(this.images);

    // Update annotation editor
    if (this.images.length > 0) {
      const newIndex = Math.min(index, this.images.length - 1);
      this.carousel?.setCurrentIndex(newIndex);
      this.onCarouselChange(newIndex);
    } else {
      this.annotationEditor = undefined;
      if (this.annotationContainer) {
        this.annotationContainer.empty();
      }
    }

    // Update review section
    this.updateReviewSection();

    new Notice("Image removed");
  }

  /**
   * Scroll to the review section
   */
  private scrollToReviewSection(): void {
    if (this.reviewSection) {
      this.reviewSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  async onClose() {
    console.log("[PhysicalNotesModal] onClose called");
    const { contentEl } = this;
    contentEl.empty();

    // Stop upload server if running
    await this.stopUploadServer();

    // Revoke data URLs
    this.images.forEach((img) => {
      if (img.dataUrl) {
        URL.revokeObjectURL(img.dataUrl);
      }
    });
    console.log("[PhysicalNotesModal] onClose completed");
  }

  private renderTabs(): void {
    if (!this.tabContainer) return;

    this.tabContainer.empty();

    // Direct upload tab
    const directTab = this.tabContainer.createEl("div", {
      text: TAB_DIRECT_UPLOAD,
      cls: "physical-notes-tab",
    });
    if (this.currentTab === "direct") {
      directTab.addClass("active");
    }
    directTab.addEventListener("click", () => this.switchTab("direct"));

    // Camera upload tab
    const cameraTab = this.tabContainer.createEl("div", {
      text: TAB_CAMERA,
      cls: "physical-notes-tab",
    });
    if (this.currentTab === "camera") {
      cameraTab.addClass("active");
    }
    cameraTab.addEventListener("click", () => this.switchTab("camera"));
  }

  private async switchTab(tab: "direct" | "camera"): Promise<void> {
    // Stop upload server when leaving camera tab
    if (this.currentTab === "camera" && tab !== "camera") {
      await this.stopUploadServer();
    }

    this.currentTab = tab;
    this.renderTabs();
    this.renderContent();
  }

  /**
   * Stop the upload server if running
   */
  private async stopUploadServer(): Promise<void> {
    if (this.uploadServer) {
      console.log("[PhysicalNotesModal] Stopping upload server (tab switch)");
      await this.uploadServer.stop();
      this.uploadServer = undefined;
      this.qrDisplay = undefined;
      console.log("[PhysicalNotesModal] Upload server stopped");
    }
  }

  private renderContent(): void {
    if (!this.contentContainer) return;

    this.contentContainer.empty();

    if (this.currentTab === "direct") {
      this.renderDirectUpload();
    } else if (this.currentTab === "camera") {
      this.renderCameraUpload();
    }
  }

  private renderDirectUpload(): void {
    if (!this.contentContainer) return;

    const uploadZone = this.contentContainer.createEl("div", {
      cls: "upload-zone",
    });

    uploadZone.createEl("p", {
      text: "📁 Drop images or click to upload",
      cls: "upload-zone-text",
    });

    uploadZone.createEl("p", {
      text: "Supports multiple images",
      cls: "upload-zone-subtext",
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
        this.handleFiles(Array.from(files));
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
        this.handleFiles(Array.from(files));
      }
    });
  }

  private async renderCameraUpload(): Promise<void> {
    if (!this.contentContainer) return;

    const qrContainer = this.contentContainer.createEl("div", {
      cls: "qr-upload-container",
    });

    // Initialize QR display
    this.qrDisplay = new QRCodeDisplay(qrContainer);

    try {
      // Initialize upload server
      this.uploadServer = new UploadServer((event: UploadEvent) => {
        this.handleServerUpload(event);
      });

      // Start server
      const serverInfo = await this.uploadServer.start(
        this.plugin.settings.serverPortRange
      );

      // Display QR code
      await this.qrDisplay.display(serverInfo);

      new Notice("Ready! Scan QR code with your phone.");
    } catch (error) {
      console.error("Failed to start server:", error);
      this.qrDisplay.showError("Failed to start server");
      new Notice("Failed to start upload server");
    }
  }

  private async handleServerUpload(event: UploadEvent): Promise<void> {
    console.log(
      `[PhysicalNotesModal] handleServerUpload called for ${event.filename}`
    );
    try {
      // Convert ArrayBuffer to Blob
      const blob = new Blob([event.buffer], { type: "image/jpeg" });
      const file = new File([blob], event.filename, { type: "image/jpeg" });
      console.log(
        `[PhysicalNotesModal] Created File object, size: ${file.size}`
      );

      // Process the uploaded file
      const buffer = await this.imageProcessor.fileToArrayBuffer(file);
      const dataUrl = this.imageProcessor.createDataUrl(buffer, file.type);
      console.log(
        `[PhysicalNotesModal] Processed image, dataUrl length: ${dataUrl.length}`
      );

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
      console.log(
        `[PhysicalNotesModal] Added image, total images: ${this.images.length}`
      );

      // Update carousel
      this.carousel?.updateImages(this.images);
      console.log(`[PhysicalNotesModal] Updated carousel`);

      // Update review section
      this.updateReviewSection();
      console.log(`[PhysicalNotesModal] Updated review section`);

      // Update upload counter in QR display
      if (this.qrDisplay) {
        this.qrDisplay.updateCounter(this.images.length);
        console.log(`[PhysicalNotesModal] Updated QR counter`);
      }

      // Scroll to review section
      this.scrollToReviewSection();

      new Notice(`Received image: ${event.filename}`);
      console.log(
        `[PhysicalNotesModal] handleServerUpload completed successfully`
      );
    } catch (error) {
      console.error(
        "[PhysicalNotesModal] Failed to process uploaded image:",
        error
      );
      new Notice("Failed to process uploaded image");
    }
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
    this.carousel?.updateImages(this.images);

    // Update review section
    this.updateReviewSection();

    // Scroll to review section
    this.scrollToReviewSection();

    new Notice(`Added ${imageFiles.length} image(s)`);
  }

  private onCarouselChange(index: number): void {
    // Update annotation editor to show current image's annotations
    if (this.annotationEditor && this.images[index]) {
      this.annotationEditor.updateAnnotation(this.images[index].annotation);
    }
  }

  private renderAnnotationEditor(): void {
    if (!this.annotationContainer) return;

    this.annotationContainer.empty();

    const currentIndex = this.carousel?.getCurrentIndex() || 0;
    const currentImage = this.images[currentIndex];

    if (!currentImage) return;

    this.annotationEditor = new AnnotationEditor(
      this.annotationContainer,
      currentImage.annotation,
      (annotation) => {
        // Update the annotation in the images array
        const index = this.carousel?.getCurrentIndex() || 0;
        if (this.images[index]) {
          this.images[index].annotation = annotation;
        }
      }
    );

    this.annotationEditor.render();
  }

  private async insertNotes(): Promise<void> {
    if (this.images.length === 0) {
      new Notice("No images to insert");
      return;
    }

    try {
      new Notice("Saving images...");

      // Save all images to vault
      const imageWithFiles = [];

      for (const imageData of this.images) {
        const buffer =
          imageData.buffer ||
          (await this.imageProcessor.fileToArrayBuffer(imageData.file!));
        const vaultFile = await this.imageProcessor.saveImage(
          buffer,
          imageData.filename
        );

        imageWithFiles.push({
          vaultFile: vaultFile,
          annotation: imageData.annotation,
        });
      }

      // Generate markdown
      const markdown = this.markdownGenerator.generate(imageWithFiles);

      // Insert at cursor
      this.editor.replaceSelection(markdown);

      new Notice(`Inserted ${this.images.length} physical note(s)`);

      this.close();
    } catch (error) {
      console.error("Failed to insert notes:", error);
      new Notice("Failed to insert notes");
    }
  }
}
