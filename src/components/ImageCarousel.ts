import { ImageData } from '../types';

export class ImageCarousel {
	private container: HTMLElement;
	private images: ImageData[];
	private currentIndex: number = 0;
	private onImageChange?: (index: number) => void;
	private imageEl?: HTMLImageElement;
	private counterEl?: HTMLElement;
	private prevBtn?: HTMLButtonElement;
	private nextBtn?: HTMLButtonElement;

	constructor(
		container: HTMLElement,
		images: ImageData[],
		onImageChange?: (index: number) => void
	) {
		this.container = container;
		this.images = images;
		this.onImageChange = onImageChange;
	}

	render(): void {
		this.container.empty();

		if (this.images.length === 0) {
			this.container.createEl('p', {
				text: 'No images uploaded yet',
				cls: 'carousel-empty'
			});
			return;
		}

		// Navigation controls
		const nav = this.container.createEl('div', { cls: 'carousel-navigation' });

		this.prevBtn = nav.createEl('button', {
			text: '←',
			cls: 'carousel-button'
		});
		this.prevBtn.addEventListener('click', () => this.previous());

		this.counterEl = nav.createEl('span', { cls: 'carousel-counter' });

		this.nextBtn = nav.createEl('button', {
			text: '→',
			cls: 'carousel-button'
		});
		this.nextBtn.addEventListener('click', () => this.next());

		// Image display
		const imageContainer = this.container.createEl('div', { cls: 'carousel-image-container' });
		this.imageEl = imageContainer.createEl('img', { cls: 'carousel-image' });

		// Initial render
		this.updateDisplay();

		// Keyboard navigation
		this.setupKeyboardNav();
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
		this.counterEl.textContent = `${this.currentIndex + 1} / ${this.images.length}`;

		// Update buttons
		if (this.prevBtn) {
			this.prevBtn.disabled = this.currentIndex === 0;
		}
		if (this.nextBtn) {
			this.nextBtn.disabled = this.currentIndex === this.images.length - 1;
		}

		// Notify change
		if (this.onImageChange) {
			this.onImageChange(this.currentIndex);
		}
	}

	private setupKeyboardNav(): void {
		document.addEventListener('keydown', (e) => {
			if (e.key === 'ArrowLeft') {
				this.previous();
			} else if (e.key === 'ArrowRight') {
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

	getImages(): ImageData[] {
		return this.images;
	}

	updateImages(images: ImageData[]): void {
		this.images = images;
		this.currentIndex = 0;
		this.render();
	}
}
