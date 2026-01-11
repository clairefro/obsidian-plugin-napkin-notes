import { ImageData } from "../types";

export class ImageCarousel {
  private container: HTMLElement;
  private images: ImageData[];
  private currentIndex: number = 0;
  private onImageChange?: (index: number) => void;
  private onDelete?: (index: number) => void;
  private onReorder?: (images: ImageData[]) => void;
  private imageEl?: HTMLImageElement;
  private counterEl?: HTMLElement;
  private prevBtn?: HTMLButtonElement;
  private nextBtn?: HTMLButtonElement;
  private deleteBtn?: HTMLButtonElement;
  private thumbnailStrip?: HTMLElement;
  private draggedIndex: number = -1;
  private zoomLevel: number = 1;
  private zoomSlider?: HTMLInputElement;
  private imageContainer?: HTMLElement;
  private panX: number = 0;
  private panY: number = 0;
  private isPanning: boolean = false;
  private lastPanX: number = 0;
  private lastPanY: number = 0;

  constructor(
    container: HTMLElement,
    images: ImageData[],
    onImageChange?: (index: number) => void,
    onDelete?: (index: number) => void,
    onReorder?: (images: ImageData[]) => void
  ) {
    this.container = container;
    this.images = images;
    this.onImageChange = onImageChange;
    this.onDelete = onDelete;
    this.onReorder = onReorder;
  }

  render(): void {
    this.container.empty();

    if (this.images.length === 0) {
      this.container.createEl("p", {
        text: "No images uploaded yet",
        cls: "carousel-empty",
      });
      return;
    }

    // Main carousel layout: thumbnails on left, main image on right
    const carouselLayout = this.container.createEl("div", {
      cls: "carousel-layout",
    });

    // Thumbnail strip (left side)
    this.thumbnailStrip = carouselLayout.createEl("div", {
      cls: "thumbnail-strip",
    });
    this.renderThumbnails();

    // Main content area (right side)
    const mainArea = carouselLayout.createEl("div", {
      cls: "carousel-main-area",
    });

    // Navigation controls
    const nav = mainArea.createEl("div", { cls: "carousel-navigation" });

    this.prevBtn = nav.createEl("button", {
      text: "←",
      cls: "carousel-button",
    });
    this.prevBtn.addEventListener("click", () => this.previous());

    this.counterEl = nav.createEl("span", { cls: "carousel-counter" });

    this.nextBtn = nav.createEl("button", {
      text: "→",
      cls: "carousel-button",
    });
    this.nextBtn.addEventListener("click", () => this.next());

    // Delete button
    this.deleteBtn = nav.createEl("button", {
      text: "Delete",
      cls: "carousel-button carousel-delete-btn",
      attr: { title: "Remove this image" },
    });
    this.deleteBtn.addEventListener("click", () => {
      if (this.onDelete) {
        this.onDelete(this.currentIndex);
      }
    });

    // Image display with zoom controls
    this.imageContainer = mainArea.createEl("div", {
      cls: "carousel-image-container",
    });

    const imageWrapper = this.imageContainer.createEl("div", {
      cls: "carousel-image-wrapper",
    });
    this.imageEl = imageWrapper.createEl("img", { cls: "carousel-image" });

    // Zoom slider overlay
    const zoomOverlay = this.imageContainer.createEl("div", {
      cls: "zoom-slider-overlay",
    });

    const zoomIcon = zoomOverlay.createEl("span", {
      cls: "zoom-icon",
      text: "🔍",
    });

    this.zoomSlider = zoomOverlay.createEl("input", {
      cls: "zoom-slider",
      attr: {
        type: "range",
        min: "0.5",
        max: "3",
        step: "0.1",
        value: "1",
      },
    }) as HTMLInputElement;

    const zoomValue = zoomOverlay.createEl("span", {
      cls: "zoom-value",
      text: "100%",
    });

    // Zoom slider event
    this.zoomSlider.addEventListener("input", () => {
      this.zoomLevel = parseFloat(this.zoomSlider!.value);
      zoomValue.textContent = `${Math.round(this.zoomLevel * 100)}%`;
      this.applyZoom();
    });

    // Reset button
    const resetBtn = zoomOverlay.createEl("button", {
      cls: "zoom-reset-btn",
      text: "Reset",
      attr: { title: "Reset zoom" },
    });
    resetBtn.addEventListener("click", () => this.resetZoom());

    // Setup zoom gestures
    this.setupZoomGestures();

    // Initial render
    this.updateDisplay();

    // Keyboard navigation
    this.setupKeyboardNav();
  }

  private renderThumbnails(): void {
    if (!this.thumbnailStrip) return;

    this.thumbnailStrip.empty();

    // Header
    const header = this.thumbnailStrip.createEl("div", {
      cls: "thumbnail-header",
    });
    header.createEl("span", {
      text: `${this.images.length} image${this.images.length !== 1 ? "s" : ""}`,
      cls: "thumbnail-count",
    });

    // Thumbnails container
    const thumbsContainer = this.thumbnailStrip.createEl("div", {
      cls: "thumbnails-container",
    });

    this.images.forEach((image, index) => {
      const thumbWrapper = thumbsContainer.createEl("div", {
        cls: `thumbnail-wrapper ${index === this.currentIndex ? "active" : ""}`,
        attr: {
          draggable: "true",
          "data-index": index.toString(),
        },
      });

      // Page number
      const pageNum = thumbWrapper.createEl("div", {
        cls: "thumbnail-number",
        text: (index + 1).toString(),
      });

      // Thumbnail image
      const thumbImg = thumbWrapper.createEl("img", {
        cls: "thumbnail-image",
        attr: {
          src: image.dataUrl || "",
          alt: `Page ${index + 1}`,
        },
      });

      // Click to select
      thumbWrapper.addEventListener("click", () => {
        this.goTo(index);
        this.updateThumbnailSelection();
      });

      // Drag and drop for reordering
      thumbWrapper.addEventListener("dragstart", (e) => {
        this.draggedIndex = index;
        thumbWrapper.addClass("dragging");
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = "move";
        }
      });

      thumbWrapper.addEventListener("dragend", () => {
        thumbWrapper.removeClass("dragging");
        this.draggedIndex = -1;
        // Remove all drag-over states
        thumbsContainer.querySelectorAll(".drag-over").forEach((el) => {
          el.removeClass("drag-over");
        });
      });

      thumbWrapper.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (this.draggedIndex !== index && this.draggedIndex !== -1) {
          thumbWrapper.addClass("drag-over");
        }
      });

      thumbWrapper.addEventListener("dragleave", () => {
        thumbWrapper.removeClass("drag-over");
      });

      thumbWrapper.addEventListener("drop", (e) => {
        e.preventDefault();
        thumbWrapper.removeClass("drag-over");

        if (this.draggedIndex !== -1 && this.draggedIndex !== index) {
          this.reorderImages(this.draggedIndex, index);
        }
      });
    });
  }

  private reorderImages(fromIndex: number, toIndex: number): void {
    // Remove the image from the original position
    const [movedImage] = this.images.splice(fromIndex, 1);
    // Insert at the new position
    this.images.splice(toIndex, 0, movedImage);

    // Update current index to follow the selected image
    if (this.currentIndex === fromIndex) {
      this.currentIndex = toIndex;
    } else if (fromIndex < this.currentIndex && toIndex >= this.currentIndex) {
      this.currentIndex--;
    } else if (fromIndex > this.currentIndex && toIndex <= this.currentIndex) {
      this.currentIndex++;
    }

    // Re-render thumbnails
    this.renderThumbnails();

    // Update main display (counter, navigation buttons, image)
    this.updateDisplay();

    // Notify about reorder
    if (this.onReorder) {
      this.onReorder(this.images);
    }
  }

  private updateThumbnailSelection(): void {
    if (!this.thumbnailStrip) return;

    const thumbs = this.thumbnailStrip.querySelectorAll(".thumbnail-wrapper");
    thumbs.forEach((thumb, index) => {
      if (index === this.currentIndex) {
        thumb.addClass("active");
        // Scroll into view
        thumb.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } else {
        thumb.removeClass("active");
      }
    });
  }

  private updateDisplay(): void {
    if (this.images.length === 0 || !this.imageEl || !this.counterEl) {
      return;
    }

    const currentImage = this.images[this.currentIndex];

    // Reset zoom when changing images
    this.resetZoom();

    // Update image
    if (currentImage.dataUrl) {
      this.imageEl.src = currentImage.dataUrl;
    }

    // Update counter
    this.counterEl.textContent = `${this.currentIndex + 1} / ${
      this.images.length
    }`;

    // Update buttons
    if (this.prevBtn) {
      this.prevBtn.disabled = this.currentIndex === 0;
    }
    if (this.nextBtn) {
      this.nextBtn.disabled = this.currentIndex === this.images.length - 1;
    }

    // Update thumbnail selection
    this.updateThumbnailSelection();

    // Notify change
    if (this.onImageChange) {
      this.onImageChange(this.currentIndex);
    }
  }

  private setupKeyboardNav(): void {
    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") {
        this.previous();
      } else if (e.key === "ArrowRight") {
        this.next();
      }
    });
  }

  private setupZoomGestures(): void {
    if (!this.imageContainer) return;

    // Wheel zoom (mouse wheel / trackpad pinch)
    this.imageContainer.addEventListener(
      "wheel",
      (e) => {
        // Check if it's a pinch gesture (ctrlKey is true for trackpad pinch on most browsers)
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
          // Start panning when zoomed in
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

    // Mouse panning when zoomed
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
        this.zoomSlider.parentElement?.querySelector(".zoom-value");
      if (zoomValue) {
        zoomValue.textContent = `${Math.round(this.zoomLevel * 100)}%`;
      }
    }
    this.applyZoom();
  }

  private applyZoom(): void {
    if (!this.imageEl) return;

    // Constrain panning based on zoom level
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
        this.zoomSlider.parentElement?.querySelector(".zoom-value");
      if (zoomValue) {
        zoomValue.textContent = "100%";
      }
    }
    this.applyZoom();
  }

  next(): void {
    if (this.currentIndex < this.images.length - 1) {
      this.currentIndex++;
      this.updateDisplay();
    }
  }

  previous(): void {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.updateDisplay();
    }
  }

  goTo(index: number): void {
    if (index >= 0 && index < this.images.length) {
      this.currentIndex = index;
      this.updateDisplay();
    }
  }

  addImage(image: ImageData): void {
    this.images.push(image);
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

  getCurrentIndex(): number {
    return this.currentIndex;
  }

  setCurrentIndex(index: number): void {
    if (index >= 0 && index < this.images.length) {
      this.currentIndex = index;
      this.updateDisplay();
    }
  }

  getImages(): ImageData[] {
    return this.images;
  }

  updateImages(images: ImageData[]): void {
    this.images = images;
    this.currentIndex = 0;
    this.render();
  }
}
