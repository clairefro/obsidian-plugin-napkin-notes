import { ImageWithFile } from '../types';
import { CODE_BLOCK_LANGUAGE, METADATA_KEYWORDS, METADATA_DESCRIPTION } from '../constants';

export class MarkdownGenerator {
	/**
	 * Generate markdown for physical notes
	 * @param images Array of images with their vault files and annotations
	 * @returns Markdown string in code block format
	 */
	generate(images: ImageWithFile[]): string {
		const lines: string[] = [];

		// Add code block start
		lines.push(`\`\`\`${CODE_BLOCK_LANGUAGE}`);

		// Add each image with its annotations
		for (const img of images) {
			// Image wikilink
			lines.push(`[[${img.vaultFile.path}]]`);

			// Keywords metadata
			if (img.annotation.keywords.length > 0) {
				const keywords = img.annotation.keywords.join(', ');
				lines.push(`${METADATA_KEYWORDS}: ${keywords}`);
			}

			// Description metadata
			if (img.annotation.description && img.annotation.description.trim() !== '') {
				// Replace newlines with spaces to keep it on one line
				const description = img.annotation.description.replace(/\n/g, ' ').trim();
				lines.push(`${METADATA_DESCRIPTION}: ${description}`);
			}

			// Blank line between images
			lines.push('');
		}

		// Remove trailing blank line and add code block end
		if (lines[lines.length - 1] === '') {
			lines.pop();
		}
		lines.push('```');

		return lines.join('\n');
	}
}
