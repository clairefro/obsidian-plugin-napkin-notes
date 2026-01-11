import { ImageAnnotation } from '../types';

export class AnnotationEditor {
	private container: HTMLElement;
	private currentAnnotation: ImageAnnotation;
	private onChange: (annotation: ImageAnnotation) => void;
	private descriptionInput?: HTMLTextAreaElement;

	constructor(
		container: HTMLElement,
		annotation: ImageAnnotation,
		onChange: (annotation: ImageAnnotation) => void
	) {
		this.container = container;
		this.currentAnnotation = annotation;
		this.onChange = onChange;
	}

	render(): void {
		this.container.empty();

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

	updateAnnotation(annotation: ImageAnnotation): void {
		this.currentAnnotation = annotation;
		this.render();
	}
}
