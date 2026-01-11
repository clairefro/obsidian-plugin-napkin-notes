import * as QRCode from 'qrcode';
import { ServerInfo } from '../types';

/**
 * Component for displaying QR code and server info
 */
export class QRCodeDisplay {
	private container: HTMLElement;
	private serverInfo: ServerInfo | null = null;
	private qrCanvas?: HTMLCanvasElement;

	constructor(container: HTMLElement) {
		this.container = container;
	}

	/**
	 * Display the QR code and server info
	 */
	async display(serverInfo: ServerInfo): Promise<void> {
		this.serverInfo = serverInfo;
		this.container.empty();

		// Status message
		const statusDiv = this.container.createEl('div', { cls: 'qr-status' });
		statusDiv.createEl('div', {
			text: '✓ Ready to connect',
			cls: 'qr-status-active'
		});

		// QR code container
		const qrContainer = this.container.createEl('div', { cls: 'qr-container' });

		// Generate and display QR code
		this.qrCanvas = qrContainer.createEl('canvas', { cls: 'qr-code' });
		await QRCode.toCanvas(this.qrCanvas, serverInfo.url, {
			width: 300,
			margin: 2,
			color: {
				dark: '#000000',
				light: '#FFFFFF'
			}
		});

		// Server info
		const infoDiv = qrContainer.createEl('div', { cls: 'qr-info' });
		infoDiv.createEl('div', {
			text: 'Scan with your phone camera',
			cls: 'qr-info-title'
		});

		const urlDiv = infoDiv.createEl('div', { cls: 'qr-info-url' });
		urlDiv.setText(serverInfo.url);

		// Copy button
		const copyBtn = infoDiv.createEl('button', {
			text: 'Copy URL',
			cls: 'qr-copy-btn'
		});

		copyBtn.addEventListener('click', async () => {
			await navigator.clipboard.writeText(serverInfo.url);
			copyBtn.setText('Copied!');
			setTimeout(() => {
				copyBtn.setText('Copy URL');
			}, 2000);
		});

		// Upload counter
		const counterDiv = this.container.createEl('div', {
			text: '0 images received',
			cls: 'qr-upload-count'
		});
		this.container.dataset.counter = '0';
	}

	/**
	 * Update upload counter
	 */
	updateCounter(count: number): void {
		const counterDiv = this.container.querySelector<HTMLElement>('.qr-upload-count');
		if (counterDiv) {
			counterDiv.textContent = `${count} image${count !== 1 ? 's' : ''} received`;
		}
	}

	/**
	 * Show error message
	 */
	showError(message: string): void {
		this.container.empty();

		const errorDiv = this.container.createEl('div', { cls: 'qr-status' });
		errorDiv.createEl('div', {
			text: `✗ ${message}`,
			cls: 'qr-error'
		});
	}

	/**
	 * Clear display
	 */
	clear(): void {
		this.container.empty();
		this.serverInfo = null;
		this.qrCanvas = undefined;
	}
}
