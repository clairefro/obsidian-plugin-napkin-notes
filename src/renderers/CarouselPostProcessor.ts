import { TFile, Notice } from "obsidian";
import NapkinNotesPlugin from "../../main";
import { CODE_BLOCK_LANGUAGE } from "../constants";
import { CarouselViewer, CarouselImage } from "../components/CarouselViewer";

interface ParsedImage {
  filepath: string;
  description?: string;
}

export function registerCarouselPostProcessor(plugin: NapkinNotesPlugin): void {
  plugin.registerMarkdownCodeBlockProcessor(
    CODE_BLOCK_LANGUAGE,
    (source, el, ctx) => {
      try {
        const images = parseCodeBlock(source);

        if (images.length > 0) {
          renderCarousel(el, images, plugin, ctx.sourcePath, source);
        } else {
          el.createEl("p", {
            text: "No images found in napkin-note block",
            cls: "napkin-notes-error",
          });
        }
      } catch (error) {
        console.error("Failed to render Napkin Notes viewer:", error);
        el.createEl("p", {
          text: "Error rendering napkin notes",
          cls: "napkin-notes-error",
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

      currentImage = {
        filepath: wikilinkMatch[1],
        description: undefined,
      };
      consecutiveBlankLines = 0;
      continue;
    }

    if (trimmed === "") {
      consecutiveBlankLines++;

      if (consecutiveBlankLines >= 2 && currentImage) {
        if (descriptionLines.length > 0) {
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

      if (currentImage && descriptionLines.length > 0) {
        descriptionLines.push("");
      }
      continue;
    }

    consecutiveBlankLines = 0;

    if (currentImage) {
      descriptionLines.push(trimmed);
    }
  }

  if (currentImage) {
    if (descriptionLines.length > 0) {
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

/**
 * Generate code block content from carousel images
 */
function generateCodeBlockContent(images: CarouselImage[]): string {
  const lines: string[] = [];

  images.forEach((image, index) => {
    // Add wikilink
    lines.push(`[[${image.filepath}]]`);

    // Add description if present
    if (image.description) {
      lines.push(image.description);
    }

    // Add separator between images (two blank lines)
    if (index < images.length - 1) {
      lines.push("");
      lines.push("");
    }
  });

  return lines.join("\n");
}

function renderCarousel(
  container: HTMLElement,
  parsedImages: ParsedImage[],
  plugin: NapkinNotesPlugin,
  sourcePath: string,
  originalSource: string
): void {
  container.empty();
  container.addClass("napkin-notes-carousel-reading");

  // Store original images for cancel functionality
  const originalImages = parsedImages.map((img) => ({ ...img }));

  // Convert ParsedImage to CarouselImage
  const carouselImages: CarouselImage[] = parsedImages.map((img) => ({
    filepath: img.filepath,
    description: img.description,
  }));

  let currentMode: "view" | "edit" = "view";
  let viewer: CarouselViewer;

  const createViewer = (mode: "view" | "edit") => {
    container.empty();

    viewer = new CarouselViewer({
      app: plugin.app,
      container,
      images: mode === "view" ? carouselImages : [...carouselImages],
      mode,
      collapsibleThumbnails: true,
      showEditButton: mode === "view",
      showSaveButton: mode === "edit",
      onModeChange: (newMode) => {
        currentMode = newMode;
        createViewer(newMode);
      },
      onDelete: (index) => {
        carouselImages.splice(index, 1);
        viewer.updateImages(carouselImages);

        if (carouselImages.length === 0) {
          new Notice(
            "All images removed. Save to update or cancel to restore."
          );
        }
      },
      onReorder: (newImages) => {
        carouselImages.length = 0;
        carouselImages.push(...newImages);
      },
      onDescriptionChange: (index, description) => {
        carouselImages[index].description = description;
      },
      onSave: async (images) => {
        try {
          // Generate new code block content
          const newContent = generateCodeBlockContent(images);

          // Find and update the code block in the file
          const file = plugin.app.vault.getAbstractFileByPath(sourcePath);
          if (file && file instanceof TFile) {
            const fileContent = await plugin.app.vault.read(file);

            // Find the code block with the original source
            const codeBlockRegex = new RegExp(
              "```" + CODE_BLOCK_LANGUAGE + "\\n[\\s\\S]*?```",
              "g"
            );

            let match;
            let found = false;
            let newFileContent = fileContent;

            while ((match = codeBlockRegex.exec(fileContent)) !== null) {
              const blockContent = match[0];
              const blockSource = blockContent
                .replace("```" + CODE_BLOCK_LANGUAGE + "\n", "")
                .replace(/\n?```$/, "");

              // Check if this is the right code block by comparing normalized content
              if (
                normalizeSource(blockSource) === normalizeSource(originalSource)
              ) {
                const newBlock =
                  "```" + CODE_BLOCK_LANGUAGE + "\n" + newContent + "\n```";
                newFileContent =
                  fileContent.slice(0, match.index) +
                  newBlock +
                  fileContent.slice(match.index + match[0].length);
                found = true;
                break;
              }
            }

            if (found) {
              await plugin.app.vault.modify(file, newFileContent);
              new Notice("Carousel updated successfully!");

              // Update the stored images
              carouselImages.length = 0;
              carouselImages.push(...images);

              // Switch back to view mode
              currentMode = "view";
              createViewer("view");
            } else {
              new Notice("Could not find the code block to update.");
            }
          }
        } catch (error) {
          console.error("Failed to save carousel:", error);
          new Notice("Failed to save carousel changes.");
        }
      },
    });

    viewer.render();
  };

  createViewer("view");
}

/**
 * Normalize source content for comparison (handle whitespace differences)
 */
function normalizeSource(source: string): string {
  return source
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");
}
