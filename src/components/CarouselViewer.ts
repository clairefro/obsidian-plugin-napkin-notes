import { App, TFile, MarkdownView } from "obsidian";

/**
 * Unified image data structure for the carousel viewer
 */
export interface CarouselImage {
  // For reading view (file-based)
  filepath?: string;
  vaultFile?: TFile;

  // For upload modal (data URL based)
  dataUrl?: string;

  // Shared
  description?: string;
}

export interface CarouselViewerOptions {
  app: App;
  container: HTMLElement;
  images: CarouselImage[];
  mode: "view" | "edit";

  // Callbacks
  onImageChange?: (index: number) => void;
  onDelete?: (index: number) => void;
  onReorder?: (images: CarouselImage[]) => void;
  onDescriptionChange?: (index: number, description: string) => void;
  onSave?: (images: CarouselImage[]) => void;
  onModeChange?: (mode: "view" | "edit") => void;

  // Options
  showEditButton?: boolean; // Show edit button in view mode (for reading view)
  showSaveButton?: boolean; // Show save button in edit mode (for reading view)
  collapsibleThumbnails?: boolean; // Start thumbnails collapsed (for reading view)
  portraitMode?: boolean; // Use portrait aspect ratio
}

export class CarouselViewer {
  private app: App;
  private container: HTMLElement;
  private images: CarouselImage[];
  private mode: "view" | "edit";
  private options: CarouselViewerOptions;

  private currentIndex: number = 0;
  private descriptionExpanded: boolean = false;

  // Zoom state
  private zoomLevel: number = 1;
  private panX: number = 0;
  private panY: number = 0;
  private isPanning: boolean = false;
  private lastPanX: number = 0;
  private lastPanY: number = 0;

  // Drag state
  private draggedIndex: number = -1;

  // UI Elements
  private carouselLayout?: HTMLElement;
  private thumbnailStrip?: HTMLElement;
  private thumbnailContent?: HTMLElement;
  private thumbsContainer?: HTMLElement;
  private mainArea?: HTMLElement;
  private imageContainer?: HTMLElement;
  private imageEl?: HTMLImageElement;
  private zoomSlider?: HTMLInputElement;
  private counterEl?: HTMLElement;
  private prevBtn?: HTMLButtonElement;
  private nextBtn?: HTMLButtonElement;
  private deleteBtn?: HTMLButtonElement;
  private editBtn?: HTMLButtonElement;
  private saveBtn?: HTMLButtonElement;
  private cancelBtn?: HTMLButtonElement;
  private metadataDiv?: HTMLElement;
  private descriptionInput?: HTMLTextAreaElement;

  constructor(options: CarouselViewerOptions) {
    this.app = options.app;
    this.container = options.container;
    this.images = [...options.images]; // Clone to avoid mutations
    this.mode = options.mode;
    this.options = options;
  }

  render(): void {
    this.container.empty();

    // Add mode class to container
    this.container.removeClass(
      "napkin-carousel-mode-view",
      "napkin-carousel-mode-edit"
    );
    this.container.addClass(`napkin-carousel-mode-${this.mode}`);

    if (this.images.length === 0) {
      this.container.createEl("p", {
        text:
          this.mode === "edit" ? "No images uploaded yet" : "No images found",
        cls: "napkin-carousel-empty",
      });
      return;
    }

    // Main carousel layout
    this.carouselLayout = this.container.createEl("div", {
      cls: "napkin-carousel-layout",
    });

    // Thumbnail strip
    this.renderThumbnailStrip();

    // Main content area
    this.renderMainArea();

    // Setup interactions
    this.setupZoomGestures();
    this.setupKeyboardNav();

    // Initial display
    this.updateDisplay();
  }

  private renderThumbnailStrip(): void {
    if (!this.carouselLayout) return;

    const isCollapsible = this.options.collapsibleThumbnails;
    // In edit mode, always open the tray (no 'collapsed' class)
    const forceOpen = isCollapsible && this.mode === "edit";
    this.thumbnailStrip = this.carouselLayout.createEl("div", {
      cls: `napkin-thumbnail-strip${
        isCollapsible && !forceOpen ? " collapsed" : ""
      }`,
    });

    if (isCollapsible && this.mode !== "edit") {
      // Toggle button for collapsible mode (view mode only)
      const toggleBtn = this.thumbnailStrip.createEl("button", {
        cls: "napkin-thumbnail-toggle-btn",
        attr: { title: "Toggle thumbnails" },
      });
      const toggleIcon = toggleBtn.createEl("span", {
        cls: "napkin-toggle-icon",
        text: "›",
      });

      toggleBtn.addEventListener("click", () => {
        this.thumbnailStrip?.classList.toggle("collapsed");
        toggleIcon.textContent = this.thumbnailStrip?.classList.contains(
          "collapsed"
        )
          ? "›"
          : "‹";
      });
    }

    // Thumbnail content wrapper
    this.thumbnailContent = this.thumbnailStrip.createEl("div", {
      cls: "napkin-thumbnail-content",
    });

    // Header
    const thumbHeader = this.thumbnailContent.createEl("div", {
      cls: "napkin-thumbnail-header",
    });
    thumbHeader.createEl("span", {
      text: `${this.images.length} image${this.images.length !== 1 ? "s" : ""}`,
      cls: "napkin-thumbnail-count",
    });

    // Thumbnails container
    this.thumbsContainer = this.thumbnailContent.createEl("div", {
      cls: "napkin-thumbnails-container",
    });

    this.renderThumbnails();
  }

  private renderThumbnails(): void {
    if (!this.thumbsContainer) return;

    this.thumbsContainer.empty();

    this.images.forEach((image, index) => {
      const thumbWrapper = this.thumbsContainer!.createEl("div", {
        cls: `napkin-thumbnail-wrapper ${
          index === this.currentIndex ? "active" : ""
        }`,
        attr:
          this.mode === "edit"
            ? {
                draggable: "true",
                "data-index": index.toString(),
              }
            : {},
      });

      // Page number
      thumbWrapper.createEl("div", {
        cls: "napkin-thumbnail-number",
        text: (index + 1).toString(),
      });

      // Thumbnail image
      const thumbImg = thumbWrapper.createEl("img", {
        cls: "napkin-thumbnail-image",
        attr: { alt: `Page ${index + 1}` },
      });

      // Set image source
      this.setImageSource(thumbImg, image);

      // Click to select
      thumbWrapper.addEventListener("click", () => {
        this.goTo(index);
      });

      // Drag and drop (edit mode only)
      if (this.mode === "edit") {
        this.setupThumbnailDragDrop(thumbWrapper, index);
      }
    });
  }

  private setupThumbnailDragDrop(wrapper: HTMLElement, index: number): void {
    wrapper.addEventListener("dragstart", (e) => {
      this.draggedIndex = index;
      wrapper.addClass("dragging");
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
      }
    });

    wrapper.addEventListener("dragend", () => {
      wrapper.removeClass("dragging");
      this.draggedIndex = -1;
      this.thumbsContainer?.querySelectorAll(".drag-over").forEach((el) => {
        el.removeClass("drag-over");
      });
    });

    wrapper.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (this.draggedIndex !== -1 && this.draggedIndex !== index) {
        // Remove drag-over from all others
        this.thumbsContainer?.querySelectorAll(".drag-over").forEach((el) => {
          if (el !== wrapper) el.removeClass("drag-over");
        });
        wrapper.addClass("drag-over");
      }
    });

    wrapper.addEventListener("dragleave", () => {
      wrapper.removeClass("drag-over");
    });

    wrapper.addEventListener("drop", (e) => {
      e.preventDefault();
      wrapper.removeClass("drag-over");
      if (this.draggedIndex !== -1 && this.draggedIndex !== index) {
        // Move dragged image to the hovered index
        this.reorderImages(this.draggedIndex, index);
      }
      this.draggedIndex = -1;
    });
  }

  private reorderImages(fromIndex: number, toIndex: number): void {
    const [movedImage] = this.images.splice(fromIndex, 1);
    this.images.splice(toIndex, 0, movedImage);

    // Update current index to follow selection
    if (this.currentIndex === fromIndex) {
      this.currentIndex = toIndex;
    } else if (fromIndex < this.currentIndex && toIndex >= this.currentIndex) {
      this.currentIndex--;
    } else if (fromIndex > this.currentIndex && toIndex <= this.currentIndex) {
      this.currentIndex++;
    }

    this.renderThumbnails();
    this.updateDisplay();

    if (this.options.onReorder) {
      this.options.onReorder(this.images);
    }
  }

  private renderMainArea(): void {
    if (!this.carouselLayout) return;

    this.mainArea = this.carouselLayout.createEl("div", {
      cls: "napkin-carousel-main-area",
    });

    // --- EDIT MODE CONTROLS (Delete, Save, Cancel) ---
    if (this.mode === "edit") {
      const editControls = this.mainArea.createEl("div", {
        cls: "napkin-carousel-edit-controls",
      });

      this.deleteBtn = editControls.createEl("button", {
        text: "Delete",
        cls: "napkin-carousel-button napkin-carousel-delete-btn",
        attr: { title: "Remove this image" },
      });
      this.deleteBtn.addEventListener("click", () => this.handleDelete());

      // Only show Done editing button in markdown note (reading view)
      const isUploadModal =
        this.container.closest(".napkin-notes-upload-modal") !== null;
      if (!isUploadModal) {
        this.cancelBtn = editControls.createEl("button", {
          text: "Done editing",
          cls: "napkin-carousel-button napkin-carousel-edit-btn",
          attr: { title: "Save and exit editing" },
        });
        this.cancelBtn.addEventListener("click", () => {
          this.handleSave();
          this.cancelEditMode();
        });
      }
    }

    // --- PAGINATION CONTROLS ---
    const nav = this.mainArea.createEl("div", {
      cls: "napkin-carousel-navigation",
    });

    this.prevBtn = nav.createEl("button", {
      text: "←",
      cls: "napkin-carousel-button",
    });
    this.prevBtn.addEventListener("click", () => this.previous());

    this.counterEl = nav.createEl("span", { cls: "napkin-carousel-counter" });

    this.nextBtn = nav.createEl("button", {
      text: "→",
      cls: "napkin-carousel-button",
    });
    this.nextBtn.addEventListener("click", () => this.next());

    // Edit button (view mode only)
    if (this.options.showEditButton && this.mode === "view") {
      this.editBtn = nav.createEl("button", {
        text: "Edit",
        cls: "napkin-carousel-edit-btn napkin-nav-edit-absolute",
        attr: { title: "Edit this carousel" },
      });
      this.editBtn.addEventListener("click", () => this.enterEditMode());
    }

    // Image container
    this.imageContainer = this.mainArea.createEl("div", {
      cls: "napkin-carousel-image-container",
    });

    const imageWrapper = this.imageContainer.createEl("div", {
      cls: "napkin-carousel-image-wrapper",
    });

    this.imageEl = imageWrapper.createEl("img", {
      cls: "napkin-carousel-image",
    });

    // File path as tooltip (reading view only)
    const currentImage = this.images[this.currentIndex];
    if (currentImage.filepath && this.mode !== "edit") {
      this.imageEl.setAttr("title", currentImage.filepath);
    } else if (this.imageEl) {
      this.imageEl.removeAttribute("title");
    }

    // Zoom controls
    this.renderZoomControls();

    // Metadata section
    this.metadataDiv = this.mainArea.createEl("div", {
      cls: "napkin-carousel-metadata",
    });
  }

  private handleDelete(): void {
    if (this.options.onDelete) {
      this.options.onDelete(this.currentIndex);
    }
  }

  private cancelEditMode(): void {
    this.mode = "view";
    if (this.options.onModeChange) {
      this.options.onModeChange("view");
    }
    // Restore original images and re-render
    this.images = [...this.options.images];
    this.options.mode = "view";
    this.options.showEditButton = true;
    this.options.showSaveButton = false;
    this.render();
  }

  private renderZoomControls(): void {
    if (!this.imageContainer) return;

    const zoomOverlay = this.imageContainer.createEl("div", {
      cls: "napkin-napkin-zoom-slider-overlay",
    });

    zoomOverlay.createEl("span", { cls: "napkin-zoom-icon", text: "🔍" });

    this.zoomSlider = zoomOverlay.createEl("input", {
      cls: "napkin-zoom-slider",
      attr: {
        type: "range",
        min: "0.5",
        max: "3",
        step: "0.1",
        value: "1",
      },
    }) as HTMLInputElement;

    const zoomValue = zoomOverlay.createEl("span", {
      cls: "napkin-zoom-value",
      text: "100%",
    });

    this.zoomSlider.addEventListener("input", () => {
      this.zoomLevel = parseFloat(this.zoomSlider!.value);
      zoomValue.textContent = `${Math.round(this.zoomLevel * 100)}%`;
      this.applyZoom();
    });

    const resetBtn = zoomOverlay.createEl("button", {
      cls: "napkin-zoom-reset-btn",
      text: "Reset",
      attr: { title: "Reset zoom" },
    });
    resetBtn.addEventListener("click", () => this.resetZoom());
  }

  private updateDisplay(): void {
    if (this.images.length === 0 || !this.imageEl || !this.counterEl) {
      return;
    }

    const currentImage = this.images[this.currentIndex];

    // Reset zoom when changing images
    this.resetZoom();

    // Update image
    this.setImageSource(this.imageEl, currentImage);

    // Update counter
    this.counterEl.textContent = `${this.currentIndex + 1} / ${
      this.images.length
    }`;

    // Update navigation buttons
    if (this.prevBtn) {
      this.prevBtn.disabled = this.currentIndex === 0;
    }
    if (this.nextBtn) {
      this.nextBtn.disabled = this.currentIndex === this.images.length - 1;
    }

    // Update thumbnail selection
    this.updateThumbnailSelection();

    // Update metadata
    this.updateMetadata(currentImage);

    // Notify change
    if (this.options.onImageChange) {
      this.options.onImageChange(this.currentIndex);
    }
  }

  private setImageSource(imgEl: HTMLImageElement, image: CarouselImage): void {
    if (image.dataUrl) {
      // Direct data URL (upload modal)
      imgEl.src = image.dataUrl;
    } else if (image.vaultFile) {
      // Vault file (reading view)
      imgEl.src = this.app.vault.getResourcePath(image.vaultFile);
    } else if (image.filepath) {
      // Try to resolve filepath
      const file = this.app.vault.getAbstractFileByPath(
        image.filepath
      ) as TFile;
      if (file) {
        imgEl.src = this.app.vault.getResourcePath(file);
      } else {
        // Try to find by filename
        const filename = image.filepath.split("/").pop() || image.filepath;
        const files = this.app.vault.getFiles();
        const foundFile = files.find((f) => f.name === filename);
        if (foundFile) {
          imgEl.src = this.app.vault.getResourcePath(foundFile);
        }
      }
    }
  }

  private updateThumbnailSelection(): void {
    const thumbs = this.thumbsContainer?.querySelectorAll(
      ".napkin-thumbnail-wrapper"
    );
    thumbs?.forEach((thumb, index) => {
      if (index === this.currentIndex) {
        thumb.addClass("active");
        thumb.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } else {
        thumb.removeClass("active");
      }
    });
  }

  private updateMetadata(image: CarouselImage): void {
    if (!this.metadataDiv) return;

    this.metadataDiv.empty();

    if (this.mode === "edit") {
      // Editable description

      this.descriptionInput = this.metadataDiv.createEl("textarea", {
        cls: "napkin-carousel-description-input",
        attr: {
          placeholder:
            "[Optional] Add a description or keywords for this image to help with search...",
          rows: "3",
        },
      }) as HTMLTextAreaElement;
      this.descriptionInput.value = image.description || "";

      this.descriptionInput.addEventListener("input", () => {
        image.description = this.descriptionInput!.value;
        if (this.options.onDescriptionChange) {
          this.options.onDescriptionChange(
            this.currentIndex,
            this.descriptionInput!.value
          );
        }
      });
    } else {
      // Read-only description with expand/collapse (only if present and non-empty)
      const desc =
        typeof image.description === "string" ? image.description.trim() : "";
      if (desc.length > 0) {
        const descContainer = this.metadataDiv.createEl("div");
        const descDiv = descContainer.createEl("div", {
          cls: `napkin-carousel-description ${
            this.descriptionExpanded ? "expanded" : "collapsed"
          }`,
        });
        descDiv.setText(desc);

        const lineCount = desc.split("\n").length;
        const needsExpand = lineCount > 3 || desc.length > 150;

        if (needsExpand) {
          const toggleBtn = descContainer.createEl("button", {
            cls: "napkin-carousel-description-toggle",
          });
          toggleBtn.setText(
            this.descriptionExpanded ? "Show less" : "Show more..."
          );

          toggleBtn.addEventListener("click", () => {
            this.descriptionExpanded = !this.descriptionExpanded;
            descDiv.className = `napkin-carousel-description ${
              this.descriptionExpanded ? "expanded" : "collapsed"
            }`;
            toggleBtn.setText(
              this.descriptionExpanded ? "Show less" : "Show more..."
            );
          });
        }
        this.metadataDiv.style.display = "";
      } else {
        this.metadataDiv.style.display = "none";
      }
    }
  }

  // Navigation methods
  next(): void {
    if (this.currentIndex < this.images.length - 1) {
      this.currentIndex++;
      this.descriptionExpanded = false;
      this.updateDisplay();
    }
  }

  previous(): void {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.descriptionExpanded = false;
      this.updateDisplay();
    }
  }

  goTo(index: number): void {
    if (index >= 0 && index < this.images.length) {
      this.currentIndex = index;
      this.descriptionExpanded = false;
      this.updateDisplay();
    }
  }

  // Edit mode methods
  private enterEditMode(): void {
    this.mode = "edit";
    if (this.options.onModeChange) {
      this.options.onModeChange("edit");
    }
    this.render();
  }

  private handleSave(): void {
    if (this.options.onSave) {
      this.options.onSave(this.images);
    }
  }

  // Zoom methods
  private setupZoomGestures(): void {
    if (!this.imageContainer) return;

    // Wheel zoom (mouse wheel / trackpad pinch)
    this.imageContainer.addEventListener(
      "wheel",
      (e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const delta = e.deltaY > 0 ? -0.1 : 0.1;
          this.setZoom(this.zoomLevel + delta);
        }
      },
      { passive: false }
    );

    // Touch pinch zoom
    let initialDistance = 0;
    let initialZoom = 1;

    this.imageContainer.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length === 2) {
          e.preventDefault();
          initialDistance = this.getTouchDistance(e.touches);
          initialZoom = this.zoomLevel;
        } else if (e.touches.length === 1 && this.zoomLevel > 1) {
          this.isPanning = true;
          this.lastPanX = e.touches[0].clientX;
          this.lastPanY = e.touches[0].clientY;
        }
      },
      { passive: false }
    );

    this.imageContainer.addEventListener(
      "touchmove",
      (e) => {
        if (e.touches.length === 2 && initialDistance > 0) {
          e.preventDefault();
          const currentDistance = this.getTouchDistance(e.touches);
          const scale = currentDistance / initialDistance;
          this.setZoom(initialZoom * scale);
        } else if (e.touches.length === 1 && this.isPanning) {
          e.preventDefault();
          const deltaX = e.touches[0].clientX - this.lastPanX;
          const deltaY = e.touches[0].clientY - this.lastPanY;
          this.panX += deltaX;
          this.panY += deltaY;
          this.lastPanX = e.touches[0].clientX;
          this.lastPanY = e.touches[0].clientY;
          this.applyZoom();
        }
      },
      { passive: false }
    );

    this.imageContainer.addEventListener("touchend", (e) => {
      if (e.touches.length < 2) {
        initialDistance = 0;
      }
      if (e.touches.length === 0) {
        this.isPanning = false;
      }
    });

    // Mouse panning
    this.imageContainer.addEventListener("mousedown", (e) => {
      if (this.zoomLevel > 1) {
        this.isPanning = true;
        this.lastPanX = e.clientX;
        this.lastPanY = e.clientY;
        this.imageContainer!.style.cursor = "grabbing";
      }
    });

    document.addEventListener("mousemove", (e) => {
      if (this.isPanning && this.zoomLevel > 1) {
        const deltaX = e.clientX - this.lastPanX;
        const deltaY = e.clientY - this.lastPanY;
        this.panX += deltaX;
        this.panY += deltaY;
        this.lastPanX = e.clientX;
        this.lastPanY = e.clientY;
        this.applyZoom();
      }
    });

    document.addEventListener("mouseup", () => {
      this.isPanning = false;
      if (this.imageContainer) {
        this.imageContainer.style.cursor =
          this.zoomLevel > 1 ? "grab" : "default";
      }
    });

    // Double-click to toggle zoom
    this.imageContainer.addEventListener("dblclick", () => {
      if (this.zoomLevel === 1) {
        this.setZoom(2);
      } else {
        this.resetZoom();
      }
    });
  }

  private getTouchDistance(touches: TouchList): number {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private setZoom(level: number): void {
    this.zoomLevel = Math.max(0.5, Math.min(3, level));
    if (this.zoomSlider) {
      this.zoomSlider.value = this.zoomLevel.toString();
      const zoomValue =
        this.zoomSlider.parentElement?.querySelector(".napkin-zoom-value");
      if (zoomValue) {
        zoomValue.textContent = `${Math.round(this.zoomLevel * 100)}%`;
      }
    }
    this.applyZoom();
  }

  private applyZoom(): void {
    if (!this.imageEl) return;

    if (this.zoomLevel <= 1) {
      this.panX = 0;
      this.panY = 0;
    }

    this.imageEl.style.transform = `scale(${this.zoomLevel}) translate(${
      this.panX / this.zoomLevel
    }px, ${this.panY / this.zoomLevel}px)`;

    if (this.imageContainer) {
      this.imageContainer.style.cursor =
        this.zoomLevel > 1 ? "grab" : "default";
    }
  }

  private resetZoom(): void {
    this.zoomLevel = 1;
    this.panX = 0;
    this.panY = 0;
    if (this.zoomSlider) {
      this.zoomSlider.value = "1";
      const zoomValue =
        this.zoomSlider.parentElement?.querySelector(".napkin-zoom-value");
      if (zoomValue) {
        zoomValue.textContent = "100%";
      }
    }
    this.applyZoom();
  }

  private setupKeyboardNav(): void {
    this.carouselLayout?.setAttribute("tabindex", "0");
    this.carouselLayout?.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") {
        this.previous();
      } else if (e.key === "ArrowRight") {
        this.next();
      }
    });
  }

  // Public methods for external control
  getCurrentIndex(): number {
    return this.currentIndex;
  }

  setCurrentIndex(index: number): void {
    this.goTo(index);
  }

  getImages(): CarouselImage[] {
    return this.images;
  }

  updateImages(images: CarouselImage[]): void {
    this.images = [...images];
    this.currentIndex = Math.min(
      this.currentIndex,
      Math.max(0, this.images.length - 1)
    );
    this.render();
  }

  removeImage(index: number): void {
    if (index >= 0 && index < this.images.length) {
      this.images.splice(index, 1);
      if (this.currentIndex >= this.images.length) {
        this.currentIndex = Math.max(0, this.images.length - 1);
      }
      this.render();
    }
  }

  addImage(image: CarouselImage): void {
    this.images.push(image);
    this.render();
  }
}
