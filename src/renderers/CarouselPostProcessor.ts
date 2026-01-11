import { TFile } from "obsidian";
import PhysicalNoteScannerPlugin from "../../main";
import { CODE_BLOCK_LANGUAGE } from "../constants";

interface ParsedImage {
  filepath: string;
  description?: string;
}

export function registerCarouselPostProcessor(
  plugin: PhysicalNoteScannerPlugin
): void {
  plugin.registerMarkdownCodeBlockProcessor(
    CODE_BLOCK_LANGUAGE,
    (source, el, ctx) => {
      try {
        const images = parseCodeBlock(source);

        if (images.length > 0) {
          renderCarousel(el, images, plugin);
        } else {
          el.createEl("p", {
            text: "No images found in physical-note-viewer block",
            cls: "physical-notes-error",
          });
        }
      } catch (error) {
        console.error("Failed to render physical notes carousel:", error);
        el.createEl("p", {
          text: "Error rendering physical notes",
          cls: "physical-notes-error",
        });
      }
    }
  );
}

function parseCodeBlock(source: string): ParsedImage[] {
  const images: ParsedImage[] = [];
  const lines = source.split("\n");
  let currentImage: ParsedImage | null = null;
  let descriptionLines: string[] = [];
  let consecutiveBlankLines = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for wikilink: [[path/to/image.jpg]]
    const wikilinkMatch = trimmed.match(/^\[\[([^\]]+)\]\]$/);
    if (wikilinkMatch) {
      // Save previous image if exists
      if (currentImage) {
        if (descriptionLines.length > 0) {
          // Remove trailing blank lines from description
          while (
            descriptionLines.length > 0 &&
            descriptionLines[descriptionLines.length - 1] === ""
          ) {
            descriptionLines.pop();
          }
          currentImage.description = descriptionLines.join("\n");
          descriptionLines = [];
        }
        images.push(currentImage);
      }

      // Start new image
      currentImage = {
        filepath: wikilinkMatch[1],
        description: undefined,
      };
      consecutiveBlankLines = 0;
      continue;
    }

    // Handle blank lines
    if (trimmed === "") {
      consecutiveBlankLines++;

      // Two consecutive blank lines end the current image
      if (consecutiveBlankLines >= 2 && currentImage) {
        if (descriptionLines.length > 0) {
          // Remove trailing blank lines from description
          while (
            descriptionLines.length > 0 &&
            descriptionLines[descriptionLines.length - 1] === ""
          ) {
            descriptionLines.pop();
          }
          currentImage.description = descriptionLines.join("\n");
          descriptionLines = [];
        }
        images.push(currentImage);
        currentImage = null;
        consecutiveBlankLines = 0;
        continue;
      }

      // Single blank line within description - preserve it
      if (currentImage && descriptionLines.length > 0) {
        descriptionLines.push("");
      }
      continue;
    }

    // Non-blank line resets counter
    consecutiveBlankLines = 0;

    // Any other line is part of the description
    if (currentImage) {
      descriptionLines.push(trimmed);
    }
  }

  // Save last image if exists
  if (currentImage) {
    if (descriptionLines.length > 0) {
      // Remove trailing blank lines from description
      while (
        descriptionLines.length > 0 &&
        descriptionLines[descriptionLines.length - 1] === ""
      ) {
        descriptionLines.pop();
      }
      currentImage.description = descriptionLines.join("\n");
    }
    images.push(currentImage);
  }

  return images;
}

function renderCarousel(
  container: HTMLElement,
  images: ParsedImage[],
  plugin: PhysicalNoteScannerPlugin
): void {
  container.empty();
  container.addClass("physical-notes-carousel-reading");

  let currentIndex = 0;
  let descriptionExpanded = false;
  let zoomLevel = 1;
  let panX = 0;
  let panY = 0;
  let isPanning = false;
  let lastPanX = 0;
  let lastPanY = 0;

  // Main carousel layout: thumbnails on left, main content on right
  const carouselLayout = container.createEl("div", { cls: "carousel-layout" });

  // Thumbnail strip (left side) - collapsed by default
  const thumbnailStrip = carouselLayout.createEl("div", {
    cls: "thumbnail-strip collapsed",
  });

  // Toggle button for expand/collapse
  const toggleBtn = thumbnailStrip.createEl("button", {
    cls: "thumbnail-toggle-btn",
    attr: { title: "Toggle thumbnails" },
  });
  toggleBtn.createEl("span", { cls: "toggle-icon", text: "›" });

  // Thumbnail content (header + thumbnails)
  const thumbnailContent = thumbnailStrip.createEl("div", {
    cls: "thumbnail-content",
  });

  // Thumbnail header
  const thumbHeader = thumbnailContent.createEl("div", {
    cls: "thumbnail-header",
  });
  thumbHeader.createEl("span", {
    text: `${images.length} image${images.length !== 1 ? "s" : ""}`,
    cls: "thumbnail-count",
  });

  // Thumbnails container
  const thumbsContainer = thumbnailContent.createEl("div", {
    cls: "thumbnails-container",
  });

  // Toggle expand/collapse
  toggleBtn.addEventListener("click", () => {
    thumbnailStrip.classList.toggle("collapsed");
    const icon = toggleBtn.querySelector(".toggle-icon");
    if (icon) {
      icon.textContent = thumbnailStrip.classList.contains("collapsed")
        ? "›"
        : "‹";
    }
  });

  // Main content area (right side)
  const mainArea = carouselLayout.createEl("div", {
    cls: "carousel-main-area",
  });

  // Navigation
  const nav = mainArea.createEl("div", { cls: "carousel-navigation" });

  const prevBtn = nav.createEl("button", {
    text: "←",
    cls: "carousel-button",
  });

  const counter = nav.createEl("span", { cls: "carousel-counter" });

  const nextBtn = nav.createEl("button", {
    text: "→",
    cls: "carousel-button",
  });

  // Image container with zoom support
  const imageContainer = mainArea.createEl("div", {
    cls: "carousel-image-container",
  });

  const imageWrapper = imageContainer.createEl("div", {
    cls: "carousel-image-wrapper",
  });

  const imageEl = imageWrapper.createEl("img", { cls: "carousel-image" });

  // Zoom slider overlay
  const zoomOverlay = imageContainer.createEl("div", {
    cls: "zoom-slider-overlay",
  });

  zoomOverlay.createEl("span", {
    cls: "zoom-icon",
    text: "🔍",
  });

  const zoomSlider = zoomOverlay.createEl("input", {
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

  const resetBtn = zoomOverlay.createEl("button", {
    cls: "zoom-reset-btn",
    text: "Reset",
    attr: { title: "Reset zoom" },
  });

  // Metadata container (description + filepath)
  const metadataDiv = mainArea.createEl("div", { cls: "carousel-metadata" });

  // Zoom functions
  const applyZoom = () => {
    if (zoomLevel <= 1) {
      panX = 0;
      panY = 0;
    }
    imageEl.style.transform = `scale(${zoomLevel}) translate(${
      panX / zoomLevel
    }px, ${panY / zoomLevel}px)`;
    imageContainer.style.cursor = zoomLevel > 1 ? "grab" : "default";
  };

  const setZoom = (level: number) => {
    zoomLevel = Math.max(0.5, Math.min(3, level));
    zoomSlider.value = zoomLevel.toString();
    zoomValue.textContent = `${Math.round(zoomLevel * 100)}%`;
    applyZoom();
  };

  const resetZoom = () => {
    zoomLevel = 1;
    panX = 0;
    panY = 0;
    zoomSlider.value = "1";
    zoomValue.textContent = "100%";
    applyZoom();
  };

  // Zoom slider event
  zoomSlider.addEventListener("input", () => {
    zoomLevel = parseFloat(zoomSlider.value);
    zoomValue.textContent = `${Math.round(zoomLevel * 100)}%`;
    applyZoom();
  });

  resetBtn.addEventListener("click", resetZoom);

  // Wheel zoom (mouse wheel / trackpad pinch)
  imageContainer.addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom(zoomLevel + delta);
      }
    },
    { passive: false }
  );

  // Touch pinch zoom
  let initialDistance = 0;
  let initialZoom = 1;

  imageContainer.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        initialDistance = Math.sqrt(dx * dx + dy * dy);
        initialZoom = zoomLevel;
      } else if (e.touches.length === 1 && zoomLevel > 1) {
        isPanning = true;
        lastPanX = e.touches[0].clientX;
        lastPanY = e.touches[0].clientY;
      }
    },
    { passive: false }
  );

  imageContainer.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches.length === 2 && initialDistance > 0) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const currentDistance = Math.sqrt(dx * dx + dy * dy);
        const scale = currentDistance / initialDistance;
        setZoom(initialZoom * scale);
      } else if (e.touches.length === 1 && isPanning) {
        e.preventDefault();
        const deltaX = e.touches[0].clientX - lastPanX;
        const deltaY = e.touches[0].clientY - lastPanY;
        panX += deltaX;
        panY += deltaY;
        lastPanX = e.touches[0].clientX;
        lastPanY = e.touches[0].clientY;
        applyZoom();
      }
    },
    { passive: false }
  );

  imageContainer.addEventListener("touchend", (e) => {
    if (e.touches.length < 2) {
      initialDistance = 0;
    }
    if (e.touches.length === 0) {
      isPanning = false;
    }
  });

  // Mouse panning when zoomed
  imageContainer.addEventListener("mousedown", (e) => {
    if (zoomLevel > 1) {
      isPanning = true;
      lastPanX = e.clientX;
      lastPanY = e.clientY;
      imageContainer.style.cursor = "grabbing";
    }
  });

  document.addEventListener("mousemove", (e) => {
    if (isPanning && zoomLevel > 1) {
      const deltaX = e.clientX - lastPanX;
      const deltaY = e.clientY - lastPanY;
      panX += deltaX;
      panY += deltaY;
      lastPanX = e.clientX;
      lastPanY = e.clientY;
      applyZoom();
    }
  });

  document.addEventListener("mouseup", () => {
    isPanning = false;
    if (imageContainer) {
      imageContainer.style.cursor = zoomLevel > 1 ? "grab" : "default";
    }
  });

  // Double-click to toggle zoom
  imageContainer.addEventListener("dblclick", () => {
    if (zoomLevel === 1) {
      setZoom(2);
    } else {
      resetZoom();
    }
  });

  // Render thumbnails
  const renderThumbnails = () => {
    thumbsContainer.empty();

    images.forEach((image, index) => {
      const thumbWrapper = thumbsContainer.createEl("div", {
        cls: `thumbnail-wrapper ${index === currentIndex ? "active" : ""}`,
      });

      // Page number
      thumbWrapper.createEl("div", {
        cls: "thumbnail-number",
        text: (index + 1).toString(),
      });

      // Thumbnail image
      const thumbImg = thumbWrapper.createEl("img", {
        cls: "thumbnail-image",
      });

      // Get vault file for thumbnail
      const vault = plugin.app.vault;
      const file = vault.getAbstractFileByPath(image.filepath) as TFile;
      if (file) {
        thumbImg.src = plugin.app.vault.getResourcePath(file);
        thumbImg.alt = `Page ${index + 1}`;
      }

      // Click to select
      thumbWrapper.addEventListener("click", () => {
        currentIndex = index;
        descriptionExpanded = false;
        resetZoom();
        updateDisplay();
        renderThumbnails();
      });
    });
  };

  // Update display function
  const updateDisplay = () => {
    const currentImage = images[currentIndex];

    // Get vault file for image
    const vault = plugin.app.vault;
    const file = vault.getAbstractFileByPath(currentImage.filepath) as TFile;

    if (file) {
      const resourcePath = plugin.app.vault.getResourcePath(file);
      imageEl.src = resourcePath;
      imageEl.alt = file.name;
    } else {
      // Try to find file by name (in case it was moved)
      const filename =
        currentImage.filepath.split("/").pop() || currentImage.filepath;
      const files = vault.getFiles();
      const foundFile = files.find((f) => f.name === filename);

      if (foundFile) {
        const resourcePath = plugin.app.vault.getResourcePath(foundFile);
        imageEl.src = resourcePath;
        imageEl.alt = foundFile.name;
      } else {
        imageEl.alt = `Image not found: ${currentImage.filepath}`;
        imageEl.style.display = "none";
        imageContainer.createEl("p", {
          text: `Image not found: ${currentImage.filepath}`,
          cls: "carousel-error",
        });
      }
    }

    // Update counter
    counter.textContent = `${currentIndex + 1} / ${images.length}`;

    // Update buttons
    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex === images.length - 1;

    // Update thumbnail selection
    const thumbs = thumbsContainer.querySelectorAll(".thumbnail-wrapper");
    thumbs.forEach((thumb, index) => {
      if (index === currentIndex) {
        thumb.addClass("active");
        thumb.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } else {
        thumb.removeClass("active");
      }
    });

    // Update metadata
    metadataDiv.empty();

    // Show description in muted text with expand/collapse
    if (currentImage.description) {
      const descriptionContainer = metadataDiv.createEl("div");

      const descDiv = descriptionContainer.createEl("div", {
        cls: `carousel-description ${
          descriptionExpanded ? "expanded" : "collapsed"
        }`,
      });
      descDiv.setText(currentImage.description);

      // Check if description is long enough to need expand button (more than 3 lines)
      const lineCount = currentImage.description.split("\n").length;
      const needsExpand =
        lineCount > 3 || currentImage.description.length > 150;

      if (needsExpand) {
        const toggleBtn = descriptionContainer.createEl("button", {
          cls: "carousel-description-toggle",
        });
        toggleBtn.setText(descriptionExpanded ? "Show less ▲" : "Show more ▼");

        toggleBtn.addEventListener("click", () => {
          descriptionExpanded = !descriptionExpanded;
          descDiv.className = `carousel-description ${
            descriptionExpanded ? "expanded" : "collapsed"
          }`;
          toggleBtn.setText(
            descriptionExpanded ? "Show less ▲" : "Show more ▼"
          );
        });
      }
    }

    // Show file path in small muted text
    const filenameDiv = metadataDiv.createEl("div", {
      cls: "carousel-filepath",
    });
    filenameDiv.setText(currentImage.filepath);
  };

  // Navigation handlers
  prevBtn.addEventListener("click", () => {
    if (currentIndex > 0) {
      currentIndex--;
      descriptionExpanded = false;
      resetZoom();
      updateDisplay();
    }
  });

  nextBtn.addEventListener("click", () => {
    if (currentIndex < images.length - 1) {
      currentIndex++;
      descriptionExpanded = false;
      resetZoom();
      updateDisplay();
    }
  });

  // Keyboard navigation
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft" && currentIndex > 0) {
      currentIndex--;
      descriptionExpanded = false;
      resetZoom();
      updateDisplay();
    } else if (e.key === "ArrowRight" && currentIndex < images.length - 1) {
      currentIndex++;
      descriptionExpanded = false;
      resetZoom();
      updateDisplay();
    }
  };

  carouselLayout.addEventListener("keydown", handleKeydown);
  carouselLayout.setAttribute("tabindex", "0");

  // Initial render
  renderThumbnails();
  updateDisplay();
}
