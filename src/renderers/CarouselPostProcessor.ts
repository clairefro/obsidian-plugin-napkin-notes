import { TFile } from "obsidian";
import PhysicalNoteScannerPlugin from "../../main";
import { CODE_BLOCK_LANGUAGE } from "../constants";

interface ParsedImage {
  filepath: string;
  keywords: string[];
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

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "") {
      // Blank line - save current image if exists
      if (currentImage) {
        images.push(currentImage);
        currentImage = null;
      }
      continue;
    }

    // Check for wikilink: [[path/to/image.jpg]]
    const wikilinkMatch = trimmed.match(/^\[\[([^\]]+)\]\]$/);
    if (wikilinkMatch) {
      // Save previous image if exists
      if (currentImage) {
        images.push(currentImage);
      }

      // Start new image
      currentImage = {
        filepath: wikilinkMatch[1],
        keywords: [],
        description: undefined,
      };
      continue;
    }

    // Check for keywords metadata
    const keywordsMatch = trimmed.match(/^keywords:\s*(.+)$/i);
    if (keywordsMatch && currentImage) {
      currentImage.keywords = keywordsMatch[1]
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k.length > 0);
      continue;
    }

    // Check for description metadata
    const descMatch = trimmed.match(/^description:\s*(.+)$/i);
    if (descMatch && currentImage) {
      currentImage.description = descMatch[1].trim();
      continue;
    }
  }

  // Save last image if exists
  if (currentImage) {
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

    if (currentImage.keywords.length > 0) {
      const keywordsDiv = metadataDiv.createEl("div", {
        cls: "carousel-keywords-section",
      });
      keywordsDiv.createEl("strong", { text: "Keywords: " });

      const keywordsList = keywordsDiv.createEl("span", {
        cls: "carousel-keywords",
      });
      currentImage.keywords.forEach((keyword, i) => {
        keywordsList.createEl("span", {
          text: keyword,
          cls: "carousel-keyword-tag",
        });
        if (i < currentImage.keywords.length - 1) {
          keywordsList.appendText(", ");
        }
      });
    }

    if (currentImage.description) {
      const descDiv = metadataDiv.createEl("div", {
        cls: "carousel-description-section",
      });
      descDiv.createEl("strong", { text: "Description: " });
      descDiv.appendText(currentImage.description);
    }

    // Show filename
    const filenameDiv = metadataDiv.createEl("div", {
      cls: "carousel-filename-section",
    });
    filenameDiv.createEl("small", {
      text: currentImage.filepath,
      cls: "carousel-filename",
    });
  };

  // Navigation handlers
  prevBtn.addEventListener("click", () => {
    if (currentIndex > 0) {
      currentIndex--;
      resetZoom();
      updateDisplay();
    }
  });

  nextBtn.addEventListener("click", () => {
    if (currentIndex < images.length - 1) {
      currentIndex++;
      resetZoom();
      updateDisplay();
    }
  });

  // Keyboard navigation
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft" && currentIndex > 0) {
      currentIndex--;
      resetZoom();
      updateDisplay();
    } else if (e.key === "ArrowRight" && currentIndex < images.length - 1) {
      currentIndex++;
      resetZoom();
      updateDisplay();
    }
  };

  carouselDiv.addEventListener("keydown", handleKeydown);
  carouselDiv.setAttribute("tabindex", "0"); // Make it focusable for keyboard nav

  // Initial render
  updateDisplay();
}
