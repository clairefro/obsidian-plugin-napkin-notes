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
          while (descriptionLines.length > 0 && descriptionLines[descriptionLines.length - 1] === "") {
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
          while (descriptionLines.length > 0 && descriptionLines[descriptionLines.length - 1] === "") {
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
      while (descriptionLines.length > 0 && descriptionLines[descriptionLines.length - 1] === "") {
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

  // Carousel container
  const carouselDiv = container.createEl("div", { cls: "carousel-reading" });

  // Navigation
  const nav = carouselDiv.createEl("div", { cls: "carousel-navigation" });

  const prevBtn = nav.createEl("button", {
    text: "←",
    cls: "carousel-button",
  });

  const counter = nav.createEl("span", { cls: "carousel-counter" });

  const nextBtn = nav.createEl("button", {
    text: "→",
    cls: "carousel-button",
  });

  // Image container
  const imageContainer = carouselDiv.createEl("div", {
    cls: "carousel-image-container",
  });
  const imageEl = imageContainer.createEl("img", { cls: "carousel-image" });

  // Metadata container
  const metadataDiv = carouselDiv.createEl("div", { cls: "carousel-metadata" });

  // Add zoom buttons
  const zoomControls = carouselDiv.createEl("div", {
    cls: "carousel-zoom-controls",
  });

  const zoomInBtn = zoomControls.createEl("button", {
    text: "+",
    cls: "carousel-zoom-button",
  });

  const zoomOutBtn = zoomControls.createEl("button", {
    text: "-",
    cls: "carousel-zoom-button",
  });

  let zoomLevel = 1;

  const updateZoom = () => {
    imageEl.style.transform = `scale(${zoomLevel})`;
  };

  zoomInBtn.addEventListener("click", () => {
    zoomLevel = Math.min(zoomLevel + 0.1, 3); // Limit max zoom level to 3x
    updateZoom();
  });

  zoomOutBtn.addEventListener("click", () => {
    zoomLevel = Math.max(zoomLevel - 0.1, 0.5); // Limit min zoom level to 0.5x
    updateZoom();
  });

  // Reset zoom level when slide changes
  const resetZoom = () => {
    zoomLevel = 1;
    updateZoom();
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

    // Update metadata
    metadataDiv.empty();

    // Show description in muted text with expand/collapse
    if (currentImage.description) {
      const descriptionContainer = metadataDiv.createEl("div");

      const descDiv = descriptionContainer.createEl("div", {
        cls: `carousel-description ${descriptionExpanded ? "expanded" : "collapsed"}`,
      });
      descDiv.setText(currentImage.description);

      // Check if description is long enough to need expand button (more than 3 lines)
      const lineCount = currentImage.description.split("\n").length;
      const needsExpand = lineCount > 3 || currentImage.description.length > 150;

      if (needsExpand) {
        const toggleBtn = descriptionContainer.createEl("button", {
          cls: "carousel-description-toggle",
        });
        toggleBtn.setText(descriptionExpanded ? "Show less ▲" : "Show more ▼");

        toggleBtn.addEventListener("click", () => {
          descriptionExpanded = !descriptionExpanded;
          descDiv.className = `carousel-description ${descriptionExpanded ? "expanded" : "collapsed"}`;
          toggleBtn.setText(descriptionExpanded ? "Show less ▲" : "Show more ▼");
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
      descriptionExpanded = false; // Reset collapse state
      resetZoom();
      updateDisplay();
    }
  });

  nextBtn.addEventListener("click", () => {
    if (currentIndex < images.length - 1) {
      currentIndex++;
      descriptionExpanded = false; // Reset collapse state
      resetZoom();
      updateDisplay();
    }
  });

  // Keyboard navigation
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft" && currentIndex > 0) {
      currentIndex--;
      descriptionExpanded = false; // Reset collapse state
      resetZoom();
      updateDisplay();
    } else if (e.key === "ArrowRight" && currentIndex < images.length - 1) {
      currentIndex++;
      descriptionExpanded = false; // Reset collapse state
      resetZoom();
      updateDisplay();
    }
  };

  carouselDiv.addEventListener("keydown", handleKeydown);
  carouselDiv.setAttribute("tabindex", "0"); // Make it focusable for keyboard nav

  // Initial render
  updateDisplay();
}
