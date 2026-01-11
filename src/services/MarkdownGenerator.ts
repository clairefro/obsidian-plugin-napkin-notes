import { ImageWithFile } from '../types';
import { CODE_BLOCK_LANGUAGE } from '../constants';

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
		for (let i = 0; i < images.length; i++) {
			const img = images[i];

			// Image wikilink
			lines.push(`[[${img.vaultFile.path}]]`);

			// Description - support multiline by adding each line below the image path
			if (img.annotation.description && img.annotation.description.trim() !== '') {
				const descriptionLines = img.annotation.description.trim().split('\n');
				descriptionLines.forEach(line => {
					lines.push(line);
				});
			}

			// Two blank lines between images (allows single blank lines within descriptions)
			// Don't add separators after the last image
			if (i < images.length - 1) {
				lines.push('');
				lines.push('');
			}
		}

		lines.push('```');

		return lines.join('\n');
	}
}
