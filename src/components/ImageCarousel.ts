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
      text: "🗑️",
      cls: "carousel-button carousel-delete-btn",
      attr: { title: "Remove this image" },
    });
    this.deleteBtn.addEventListener("click", () => {
      if (this.onDelete) {
        this.onDelete(this.currentIndex);
      }
    });

    // Image display
    const imageContainer = mainArea.createEl("div", {
      cls: "carousel-image-container",
    });
    this.imageEl = imageContainer.createEl("img", { cls: "carousel-image" });

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
