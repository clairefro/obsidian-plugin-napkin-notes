import { ImageAnnotation } from '../types';

export class AnnotationEditor {
	private container: HTMLElement;
	private currentAnnotation: ImageAnnotation;
	private onChange: (annotation: ImageAnnotation) => void;
	private keywordInputContainer?: HTMLElement;
	private keywordInput?: HTMLInputElement;
	private descriptionInput?: HTMLTextAreaElement;
	private defaultKeywords: string[];

	constructor(
		container: HTMLElement,
		annotation: ImageAnnotation,
		onChange: (annotation: ImageAnnotation) => void,
		defaultKeywords: string[] = []
	) {
		this.container = container;
		this.currentAnnotation = annotation;
		this.onChange = onChange;
		this.defaultKeywords = defaultKeywords;
	}

	render(): void {
		this.container.empty();

		// Keywords section
		const keywordsSection = this.container.createEl('div', { cls: 'annotation-section' });
		keywordsSection.createEl('label', {
			text: 'Keywords (press Enter to add)',
			cls: 'annotation-label'
		});

		// Keyword tags container
		this.keywordInputContainer = keywordsSection.createEl('div', {
			cls: 'keyword-input-container'
		});

		// Render existing keywords
		this.renderKeywords();

		// Keyword input
		this.keywordInput = this.keywordInputContainer.createEl('input', {
			type: 'text',
			placeholder: 'Add keyword...',
			cls: 'keyword-input'
		});

		this.keywordInput.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				this.addKeyword(this.keywordInput!.value.trim());
			}
		});

		// Default keyword suggestions
		if (this.defaultKeywords.length > 0) {
			const suggestionsDiv = keywordsSection.createEl('div', {
				cls: 'keyword-suggestions'
			});
			suggestionsDiv.createEl('span', {
				text: 'Suggestions: ',
				cls: 'suggestions-label'
			});

			this.defaultKeywords.forEach(keyword => {
				const btn = suggestionsDiv.createEl('button', {
					text: keyword,
					cls: 'keyword-suggestion-btn'
				});
				btn.addEventListener('click', () => this.addKeyword(keyword));
			});
		}

		// Description section
		const descSection = this.container.createEl('div', { cls: 'annotation-section' });
		descSection.createEl('label', {
			text: 'Description (optional)',
			cls: 'annotation-label'
		});

		this.descriptionInput = descSection.createEl('textarea', {
			placeholder: 'Add a description...',
			cls: 'description-input'
		});
		this.descriptionInput.value = this.currentAnnotation.description || '';

		this.descriptionInput.addEventListener('input', () => {
			this.currentAnnotation.description = this.descriptionInput!.value;
			this.onChange(this.currentAnnotation);
		});
	}

	private renderKeywords(): void {
		// Remove existing keyword tags (but keep the input)
		const tags = this.keywordInputContainer?.querySelectorAll('.keyword-tag');
		tags?.forEach(tag => tag.remove());

		// Render current keywords
		this.currentAnnotation.keywords.forEach((keyword, index) => {
			const tag = this.keywordInputContainer!.createEl('span', {
				text: keyword,
				cls: 'keyword-tag'
			});

			const removeBtn = tag.createEl('span', {
				text: '×',
				cls: 'keyword-remove'
			});

			removeBtn.addEventListener('click', () => {
				this.removeKeyword(index);
			});

			// Insert before the input
			if (this.keywordInput) {
				this.keywordInputContainer!.insertBefore(tag, this.keywordInput);
			}
		});
	}

	private addKeyword(keyword: string): void {
		if (keyword && !this.currentAnnotation.keywords.includes(keyword)) {
			this.currentAnnotation.keywords.push(keyword);
			this.onChange(this.currentAnnotation);
			this.renderKeywords();

			// Clear input
			if (this.keywordInput) {
				this.keywordInput.value = '';
			}
		}
	}

	private removeKeyword(index: number): void {
		this.currentAnnotation.keywords.splice(index, 1);
		this.onChange(this.currentAnnotation);
		this.renderKeywords();
	}

	updateAnnotation(annotation: ImageAnnotation): void {
		this.currentAnnotation = annotation;
		this.render();
	}
}
