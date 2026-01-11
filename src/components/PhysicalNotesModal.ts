import { App, Modal, Notice, Editor } from "obsidian";
import PhysicalNoteScannerPlugin from "../../main";
import { ImageData, ImageAnnotation } from "../types";
import { ImageCarousel } from "./ImageCarousel";
import { AnnotationEditor } from "./AnnotationEditor";
import { ImageProcessor } from "../services/ImageProcessor";
import { MarkdownGenerator } from "../services/MarkdownGenerator";
import {
  MODAL_TITLE,
  TAB_DIRECT_UPLOAD,
  ALLOWED_MIME_TYPES,
} from "../constants";

export class PhysicalNotesModal extends Modal {
  private plugin: PhysicalNoteScannerPlugin;
  private editor: Editor;
  private images: ImageData[] = [];
  private currentTab: "direct" | "qr" = "direct";

  // Components
  private carousel?: ImageCarousel;
  private annotationEditor?: AnnotationEditor;
  private imageProcessor: ImageProcessor;
  private markdownGenerator: MarkdownGenerator;

  // UI Elements
  private tabContainer?: HTMLElement;
  private contentContainer?: HTMLElement;
  private carouselContainer?: HTMLElement;
  private annotationContainer?: HTMLElement;

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

    // Tabs
    this.tabContainer = contentEl.createEl("div", {
      cls: "physical-notes-tabs",
    });
    this.renderTabs();

    // Content area
    this.contentContainer = contentEl.createEl("div", {
      cls: "physical-notes-content",
    });
    this.renderContent();

    // Carousel section (shared)
    this.carouselContainer = contentEl.createEl("div", {
      cls: "physical-notes-carousel-section",
    });
    contentEl.createEl("h3", { text: "Image Review" });

    const carouselDiv = this.carouselContainer.createEl("div", {
      cls: "carousel-wrapper",
    });
    this.carousel = new ImageCarousel(carouselDiv, this.images, (index) => {
      this.onCarouselChange(index);
    });
    this.carousel.render();

    // Annotation section
    this.annotationContainer = contentEl.createEl("div", {
      cls: "physical-notes-annotation-section",
    });
    if (this.images.length > 0) {
      this.renderAnnotationEditor();
    }

    // Buttons
    const buttonContainer = contentEl.createEl("div", {
      cls: "modal-button-container",
    });

    const cancelBtn = buttonContainer.createEl("button", { text: "Cancel" });
    cancelBtn.addEventListener("click", () => this.close());

    const insertBtn = buttonContainer.createEl("button", {
      text: "Insert Notes",
      cls: "mod-cta",
    });
    insertBtn.addEventListener("click", () => this.insertNotes());
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();

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

    // Direct upload tab
    const directTab = this.tabContainer.createEl("div", {
      text: TAB_DIRECT_UPLOAD,
      cls: "physical-notes-tab",
    });
    if (this.currentTab === "direct") {
      directTab.addClass("active");
    }
    directTab.addEventListener("click", () => this.switchTab("direct"));
  }

  private switchTab(tab: "direct" | "qr"): void {
    this.currentTab = tab;
    this.renderTabs();
    this.renderContent();
  }

  private renderContent(): void {
    if (!this.contentContainer) return;

    this.contentContainer.empty();

    if (this.currentTab === "direct") {
      this.renderDirectUpload();
    }
  }

  private renderDirectUpload(): void {
    if (!this.contentContainer) return;

    const uploadZone = this.contentContainer.createEl("div", {
      cls: "upload-zone",
    });

    uploadZone.createEl("p", {
      text: "📁 Drop files or click to upload",
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
            keywords: [],
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

    // Render annotation editor if this is the first image
    if (this.images.length > 0 && !this.annotationEditor) {
      this.renderAnnotationEditor();
    }

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
      },
      this.plugin.settings.defaultKeywords
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
