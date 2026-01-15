import NapkinNotesPlugin from "../../main";
import { CODE_BLOCK_LANGUAGE } from "../constants";
import { CarouselViewer, CarouselImage } from "../components/CarouselViewer";
import { UploadModal } from "../components/UploadModal";
import { MarkdownView, TFile } from "obsidian";

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
            text: "No images found in napkin-notes block",
            cls: "napkin-notes-error",
          });
        }
      } catch (error) {
        console.error("Failed to render Napkin Notes viewer:", error);
        el.createEl("p", {
          text: "Error rendering Napkin Notes",
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

  const carouselImages: CarouselImage[] = parsedImages.map((img) => ({
    filepath: img.filepath,
    description: img.description,
  }));

  const viewer = new CarouselViewer({
    app: plugin.app,
    container,
    images: carouselImages,
    mode: "view",
    collapsibleThumbnails: true,
    showEditButton: true,
    showSaveButton: true,
    enableNapkinMode: plugin.settings.enableNapkinMode,
    onAdd: async (index: number) => {
      // Open the upload modal in 'return results' mode. Resolve with CarouselImage[].
      return new Promise<CarouselImage[]>((resolve, reject) => {
        try {
          const activeView =
            plugin.app.workspace.getActiveViewOfType(MarkdownView);
          const editor = activeView ? activeView.editor : undefined;

          let completed = false;
          const modal = new UploadModal(
            plugin.app,
            plugin,
            editor,
            async (saved) => {
              // saved: array of {vaultFile, annotation}
              completed = true;
              const newImgs: CarouselImage[] = saved.map((s) => ({
                filepath: s.vaultFile.path,
                description: s.annotation?.description || "",
              }));
              resolve(newImgs);
            }
          );

          const origOnClose = modal.onClose.bind(modal);
          modal.onClose = async () => {
            if (!completed) {
              resolve([]);
            }
            await origOnClose();
          };

          modal.open();
        } catch (err) {
          reject(err);
        }
      });
    },
    onSave: async (images: CarouselImage[]) => {
      try {
        const newContent = generateCodeBlockContent(images);
        if (normalizeSource(newContent) === normalizeSource(originalSource)) {
          return; // No changes
        }

        const file = plugin.app.vault.getAbstractFileByPath(
          sourcePath
        ) as TFile;
        if (!file) return;

        const text = await plugin.app.vault.read(file);

        const fenceRegex = new RegExp(
          "```" + CODE_BLOCK_LANGUAGE + "\\s*([\\s\\S]*?)```",
          "g"
        );

        let replaced = false;
        const normalizedOriginal = normalizeSource(originalSource);

        const updatedText = text.replace(fenceRegex, (fullMatch, inner) => {
          if (!replaced && normalizeSource(inner) === normalizedOriginal) {
            replaced = true;
            return `\`\`\`${CODE_BLOCK_LANGUAGE}\n${newContent}\n\`\`\``;
          }
          return fullMatch;
        });

        if (!replaced) return; // Couldn't locate the original block

        await plugin.app.vault.modify(file, updatedText);
      } catch (err) {
        console.error("Failed to save Napkin Notes block:", err);
      }
    },
  });
  viewer.render();
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
