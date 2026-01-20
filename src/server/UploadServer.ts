import type { IncomingMessage, ServerResponse } from "http";
import Busboy from "busboy";
import { UploadEvent } from "../types";
import { Platform } from "obsidian";
import {
  getHttpModule,
  getCryptoModule,
  getOsModule,
} from "../utils/platformModules";

type BusboyFileInfo = { filename: string; encoding: string; mimeType: string };

// Lazy-loaded modules (desktop only - Node.js built-ins)
let http: typeof import("http") | null = null;
let crypto: typeof import("crypto") | null = null;
// Busboy is bundled, so we import it normally (not lazy-loaded)

// import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from "../constants";

/**
 * Initialize Node.js modules (desktop only)
 */
async function initializeNodeModules(): Promise<void> {
  if (Platform.isMobileApp) {
    return;
  }

  if (!http) {
    http = getHttpModule();
  }
  if (!crypto) {
    crypto = getCryptoModule();
  }
  // Busboy is bundled and imported at the top, no need to lazy-load
}

/**
 * Serve the mobile upload HTML page
 */
function serveUploadPage(res: ServerResponse): void {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Napkin Notes - Upload Images</title>
	<style>
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
			background: #1e1e1e;
			min-height: 100vh;
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 20px;
		}
		.container {
			background: #2d2d30;
			border-radius: 12px;
			padding: 40px;
			max-width: 500px;
			width: 100%;
			box-shadow: 0 8px 32px rgba(0,0,0,0.4);
			border: 1px solid #3e3e42;
		}
		h1 {
			color: #dcddde;
			margin-bottom: 10px;
			font-size: 28px;
		}
		p {
			color: #969696;
			margin-bottom: 30px;
		}
		.upload-area {
			border: 2px dashed #7f6df2;
			border-radius: 12px;
			padding: 40px;
			text-align: center;
			transition: all 0.3s ease;
			background: #252526;
			position: relative;
			display: block;
		}
		.upload-area:hover {
			background: #2d2d30;
			border-color: #8875ff;
		}
		.upload-area.dragover {
			background: #363638;
			border-color: #8875ff;
			transform: scale(1.02);
		}
		.upload-icon {
			font-size: 64px;
			margin-bottom: 20px;
		}
		input[type="file"] {
			display: none;
		}
		.btn {
			background: #7f6df2;
			color: #ffffff;
			border: none;
			padding: 15px 30px;
			border-radius: 8px;
			font-size: 16px;
			font-weight: 600;
			cursor: pointer;
			margin-top: 20px;
			width: 100%;
			transition: all 0.2s;
		}
		.btn:hover {
			background: #8875ff;
			transform: translateY(-1px);
		}
		.btn:disabled {
			opacity: 0.4;
			cursor: not-allowed;
			background: #5a5a5d;
		}
		.preview {
			margin-top: 20px;
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
			gap: 10px;
		}
		.preview img {
			width: 100%;
			height: 100px;
			object-fit: cover;
			border-radius: 8px;
			box-shadow: 0 2px 8px rgba(0,0,0,0.3);
			border: 1px solid #3e3e42;
		}
		.status {
			margin-top: 20px;
			padding: 15px;
			border-radius: 8px;
			text-align: center;
			font-weight: 600;
		}
		.status.success {
			background: #1a4d2e;
			color: #4ecca3;
			border: 1px solid #4ecca3;
		}
		.status.error {
			background: #4d1a1a;
			color: #ff6b6b;
			border: 1px solid #ff6b6b;
		}
		.connection-banner {
			display: none;
			background: #4d1a1a;
			color: #ff6b6b;
			padding: 10px;
			border-radius: 6px;
			margin-bottom: 12px;
			text-align: center;
			font-weight: 700;
		}
		.close-btn {
			background: #bb2b2b;
			color: #ffffff;
		}
		.count {
			margin-top: 15px;
			text-align: center;
			color: #7f6df2;
			font-weight: 600;
		}
	</style>
</head>
<body>
		<div class="container">
			<h1>📸 Upload Images as Napkin Notes</h1>
			<p>Select or capture photos to send to Obsidian</p>

			<!-- Connection banner: shown if polling detects server is unreachable -->
			<div id="connectionBanner" class="connection-banner" style="display:none;">Connection lost - close tab and scan again</div>

			<label class="upload-area" id="dropZone" for="fileInput" style="position:relative; overflow:hidden; cursor:pointer;">
				<div style="position:relative; z-index:1; pointer-events:none;">
					<div class="upload-icon">📁</div>
					<p><strong>Tap to select photos</strong></p>
				</div>
				<!-- File input positioned over the label for reliable native picker activation -->
				<input type="file" id="fileInput" accept="image/*" multiple style="position:absolute; top:0; left:0; width:100%; height:100%; opacity:0; cursor:pointer; z-index:10;">
			</label>

			<!-- Hidden file input for camera capture -->
			<input type="file" id="cameraInput" accept="image/*" capture="environment" style="display:none;">

			<!-- Camera capture and camera preview options -->
			<div style="display:flex; gap:10px; margin-top:20px;">
				<label id="directCameraLabel" for="directCameraInput" class="btn" style="flex:1; text-align:center; margin:0;">
					Capture with Camera
					<input type="file" id="directCameraInput" accept="image/*" capture="environment" style="display:none;">
				</label>
				<button class="btn" id="openCameraPreviewBtn" style="flex:1; display:none;">Open Camera Preview (Low-Res)</button>
			</div>

			<!-- Camera preview modal -->
			<div id="cameraPreviewModal" style="display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.85); z-index:1000; align-items:center; justify-content:center; flex-direction:column;">
				<video id="cameraPreviewVideo" autoplay playsinline style="max-width:90vw; max-height:60vh; border-radius:12px; background:#000;"></video>
				<div style="margin-top:20px; display:flex; gap:10px;">
					<button class="btn" id="takePreviewPhotoBtn">Take Photo</button>
					<button class="btn" id="closePreviewBtn" style="background:#444;">Cancel</button>
				</div>
				<canvas id="previewCanvas" style="display:none;"></canvas>
			</div>


			<div class="count" id="count" style="display:none;"></div>
			<div class="preview" id="preview"></div>
			<div class="status" id="status" style="display:none;"></div>

			<!-- Close-tab button for ephemeral clients (placed at bottom) -->
			<button class="btn close-btn" id="closeTabBtn" style="margin-top:16px;">Close this tab</button>
		</div>

		<script>
			const dropZone = document.getElementById('dropZone');
			const fileInput = document.getElementById('fileInput');
			const cameraInput = document.getElementById('cameraInput');
			const cameraBtn = document.getElementById('cameraBtn');
			const preview = document.getElementById('preview');
			const status = document.getElementById('status');
			const count = document.getElementById('count');
			let selectedFiles = [];

			// Helper to disable non-gallery inputs and show transient status since uploads happen immediately
			function setBusy(isBusy, text) {
				// Keep the main gallery file input enabled so users can re-open it anytime.
				if (cameraInput) cameraInput.disabled = isBusy;
				const directEl = document.getElementById('directCameraInput');
				if (directEl) directEl.disabled = isBusy;
				const previewBtn = document.getElementById('openCameraPreviewBtn');
				if (previewBtn) previewBtn.disabled = isBusy;
				const directLabel = document.getElementById('directCameraLabel');
				if (directLabel) directLabel.style.pointerEvents = isBusy ? 'none' : '';
				if (text) {
					status.textContent = text;
					status.className = 'status busy';
					status.style.color = '#ffffff';
					status.style.display = 'block';
				} else if (!isBusy) {
					status.style.display = 'none';
					status.style.color = '';
					status.className = 'status';
				}
			}

			// File input is positioned absolutely over drop zone, so native click handling works.
			// No need for manual event handlers - the file input captures interactions directly.


			// Compress image using createImageBitmap + OffscreenCanvas before upload
			async function compressImage(file) {
				// Robust compression with fallbacks: prefer createImageBitmap + OffscreenCanvas, otherwise use DOM canvas
				try {
					if (typeof createImageBitmap === 'function' && typeof OffscreenCanvas === 'function') {
						const bitmap = await createImageBitmap(file);
						const MAX_DIM = 1600;
						const scale = Math.min(1, MAX_DIM / bitmap.width, MAX_DIM / bitmap.height);
						const canvas = new OffscreenCanvas(Math.max(1, Math.floor(bitmap.width * scale)), Math.max(1, Math.floor(bitmap.height * scale)));
						const ctx = canvas.getContext('2d');
						ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
						const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
						bitmap.close();
						return blob;
					}
				} catch (err) {
					console.warn('createImageBitmap/OffscreenCanvas compression failed, falling back:', err);
				}

				// Fallback to DOM canvas
				return await new Promise((resolve, reject) => {
					const img = new Image();
					img.onload = () => {
						try {
							const MAX_DIM = 1600;
							let width = img.width;
							let height = img.height;
							const scale = Math.min(1, MAX_DIM / width, MAX_DIM / height);
							width = Math.max(1, Math.floor(width * scale));
							height = Math.max(1, Math.floor(height * scale));
							const canvas = document.createElement('canvas');
							canvas.width = width;
							canvas.height = height;
							const ctx = canvas.getContext('2d');
							ctx.drawImage(img, 0, 0, width, height);
							canvas.toBlob((blob) => {
								if (blob) resolve(blob);
								else reject(new Error('Canvas toBlob failed'));
							}, 'image/jpeg', 0.8);
						} catch (err) {
							reject(err);
						}
					};
					img.onerror = (e) => reject(new Error('Image load error'));
					img.src = URL.createObjectURL(file);
				});
			}

// Camera preview capture (getUserMedia) + compressed gallery upload
			const openCameraPreviewBtn = document.getElementById('openCameraPreviewBtn');
			const cameraPreviewModal = document.getElementById('cameraPreviewModal');
			const cameraPreviewVideo = document.getElementById('cameraPreviewVideo');
			const takePreviewPhotoBtn = document.getElementById('takePreviewPhotoBtn');
			const closePreviewBtn = document.getElementById('closePreviewBtn');
			const previewCanvas = document.getElementById('previewCanvas');
			const directCameraLabelEl = document.getElementById('directCameraLabel');
			let previewStream = null;

			if (openCameraPreviewBtn) {
				// Feature detect
				if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
					// Prefer preview flow: hide file-input camera label to prevent high-res camera app flow
					if (directCameraLabelEl) directCameraLabelEl.style.display = 'none';
					openCameraPreviewBtn.style.display = 'inline-block';
					openCameraPreviewBtn.addEventListener('click', async () => {
						try {
							previewStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 320 }, height: { ideal: 240 } }, audio: false });
							cameraPreviewVideo.srcObject = previewStream;
							cameraPreviewModal.style.display = 'flex';
						} catch (err) {
							showStatus('Camera preview unavailable: ' + err.message, 'error');
						}
					});

					closePreviewBtn.addEventListener('click', () => {
						cameraPreviewModal.style.display = 'none';
						if (previewStream) { previewStream.getTracks().forEach(t => t.stop()); previewStream = null; }
					});

					takePreviewPhotoBtn.addEventListener('click', () => {
						const w = 320;
						const h = 240;
						previewCanvas.width = w; previewCanvas.height = h;
						const ctx = previewCanvas.getContext('2d');
						ctx.drawImage(cameraPreviewVideo, 0, 0, w, h);
						previewCanvas.toBlob(async (blob) => {
							if (!blob) { showStatus('Capture failed', 'error'); return; }
							try {
								setBusy(true, 'Uploading...');
								const urlParams = new URLSearchParams(window.location.search);
								const token = urlParams.get('token');
								const formData = new FormData(); formData.append('image', blob, 'photo.jpg');
								const response = await fetch('/upload?token=' + token, { method: 'POST', body: formData });
								if (!response.ok) throw new Error('Upload failed with status ' + response.status);
								showStatus('Image uploaded successfully!', 'success');
							} catch (error) {
								showStatus('Upload failed: ' + error.message, 'error');
							} finally {
								setBusy(false, '');
								cameraPreviewModal.style.display = 'none';
								if (previewStream) { previewStream.getTracks().forEach(t => t.stop()); previewStream = null; }
							}
						}, 'image/jpeg', 0.7);
					});
				} else {
					// Preview not supported: show file-input camera and notice
					if (directCameraLabelEl) directCameraLabelEl.style.display = 'inline-block';
					openCameraPreviewBtn.style.display = 'none';
				}
			}

			// Upload after camera capture (file input), compressing first
			const directCameraInputEl = document.getElementById('directCameraInput');
			if (directCameraInputEl) {
				directCameraInputEl.addEventListener('change', async (e) => {
					const files = e.target.files;
					if (files && files.length > 0) {
						const file = files[0];
						try {
							setBusy(true, 'Compressing...');
					let compressed;
					try {
						compressed = await compressImage(file);
						console.debug('[Upload Page] compressed size:', compressed.size);
					} catch (errCompress) {
						console.warn('[Upload Page] compressImage failed for camera file, uploading original:', errCompress);
						compressed = file; // fallback to original
					}
							setBusy(true, 'Uploading...');
							const urlParams = new URLSearchParams(window.location.search);
							const token = urlParams.get('token');
							const formData = new FormData();
							formData.append('image', compressed, file.name);
							const response = await fetch('/upload?token=' + token, { method: 'POST', body: formData });
							if (!response.ok) { throw new Error('Upload failed with status ' + response.status); }
							showStatus('Image uploaded successfully!', 'success');
						} catch (error) {
							showStatus('Upload failed: ' + error.message, 'error');
						} finally {
							setBusy(false, ''); directCameraInputEl.value = '';
						}
					}
				});
			}

			// Upload after gallery selection, compressing each image
			fileInput.addEventListener('change', async (e) => {
				const files = e.target.files;
			console.debug('[Upload Page] gallery change event, files:', files && files.length ? files.length : 0);
			if (files && files.length > 0) {
				try {
					setBusy(true, 'Compressing...');
					const urlParams = new URLSearchParams(window.location.search);
					const token = urlParams.get('token');
					for (let i = 0; i < files.length; i++) {
						console.debug('[Upload Page] processing file', i, files[i].name, files[i].size);
						let compressed;
						try {
							compressed = await compressImage(files[i]);
							console.debug('[Upload Page] compressed size:', compressed.size);
						} catch (errCompress) {
							console.warn('[Upload Page] compressImage failed, will try uploading original file:', errCompress);
							compressed = files[i];
						}
						const formData = new FormData(); formData.append('image', compressed, files[i].name);
						setBusy(true, 'Uploading... (' + (i+1) + '/' + files.length + ')');
						const response = await fetch('/upload?token=' + token, { method: 'POST', body: formData });
						console.debug('[Upload Page] upload response status:', response.status);
						if (!response.ok) { throw new Error('Upload failed with status ' + response.status); }
					}
					showStatus('All images uploaded successfully!', 'success');
				} catch (error) {
					console.error('[Upload Page] gallery upload error:', error);
						setBusy(false, ''); fileInput.value = '';
					}
				}
			});


			function showStatus(message, type) {
				status.textContent = message;
				status.className = 'status ' + type;
				status.style.display = 'block';
			}

			function attemptClose(fallbackMessage) {
				try { window.close(); return; } catch (e) {}
				try { window.open('', '_self').close(); return; } catch (e) {}
				if (fallbackMessage) {
					showStatus(fallbackMessage, 'error');
				}
			}

			(function initConnectionPolling() {
				const urlParams = new URLSearchParams(window.location.search);
				const token = urlParams.get('token');
				const banner = document.getElementById('connectionBanner');
				const closeBtn = document.getElementById('closeTabBtn');
				let lost = false;
				if (closeBtn) {
					closeBtn.addEventListener('click', () => attemptClose('Please close this tab manually.'));
				}
				if (!token) return;

						async function check() {
							const controller = new AbortController();
							const timeout = setTimeout(() => controller.abort(), 1500);
							try {
								const res = await fetch('/ping?token=' + token, {
									method: 'GET',
									cache: 'no-cache',
									headers: { 'Cache-Control': 'no-cache' },
									signal: controller.signal
								});
								clearTimeout(timeout);
								// 204 No Content is expected
								if (res.ok) {
									if (lost) {
										lost = false;
										if (banner) banner.style.display = 'none';
										setBusy(false, '');
									}
								} else {
									if (!lost) {
										lost = true;
										if (banner) { banner.style.display = 'block'; banner.textContent = 'Connection lost'; }
										setBusy(false, '');
									}
								}
							} catch (e) {
								clearTimeout(timeout);
								if (!lost) {
									lost = true;
									if (banner) { banner.style.display = 'block'; banner.textContent = 'Connection lost'; }
									setBusy(false, '');
								}
							}
						}

				// Run immediately and then every 2 seconds
				check();
				const id = setInterval(check, 2000);
				window.addEventListener('beforeunload', () => clearInterval(id));
			})();

		</script>
</body>
</html>
		`;

  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(html);
}

/**
 * Handle file upload
 */
function handleUpload(
  req: IncomingMessage,
  res: ServerResponse,
  onUpload: (event: UploadEvent) => void
): void {
  try {
    const busboy = Busboy({ headers: req.headers });
    let fileCount = 0;

    busboy.on(
      "file",
      (
        _fieldname: string,
        file: NodeJS.ReadableStream,
        info: BusboyFileInfo
      ) => {
        const { filename, mimeType } = info;
        fileCount++;

        console.debug(
          `[Napkin Notes Upload Server] Receiving file #${fileCount}: ${filename}, type: ${mimeType}`
        );

        const chunks: Buffer[] = [];

        file.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });

        file.on("end", () => {
          const buffer = Buffer.concat(chunks);
          console.debug(
            `[Napkin Notes Upload Server] File received: ${filename}, size: ${buffer.length} bytes`
          );

          try {
            // Emit upload event
            const uploadEvent = {
              buffer: buffer.buffer.slice(
                buffer.byteOffset,
                buffer.byteOffset + buffer.byteLength
              ),
              filename: filename || "image.jpg",
            };
            onUpload(uploadEvent);
          } catch (err) {
            console.error(
              `[Napkin Notes Upload Server] Error in onUpload callback:`,
              err
            );
          }
        });

        file.on("error", (err: Error) => {
          console.error("[Napkin Notes Upload Server] File stream error:", err);
        });
      }
    );

    busboy.on("finish", () => {
      console.debug(
        `[Napkin Notes Upload Server] Upload finished. Total files: ${fileCount}`
      );
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("Upload successful");
    });

    busboy.on("error", (err: Error) => {
      console.error("[Napkin Notes Upload Server] Busboy error:", err);
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Server error");
    });

    req.pipe(busboy);
  } catch (err) {
    console.error("[Napkin Notes Upload Server] Upload error:", err);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Server error");
  }
}

/**
 * Generate a secure random token
 */
function generateToken(): string {
  if (!crypto) {
    throw new Error("Crypto module not available");
  }
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Upload server for receiving images from mobile devices
 */
export class UploadServer {
  private server: import("http").Server | null = null;
  private port: number = 0;
  private token: string = "";
  private onUpload: (event: UploadEvent) => void;
  private onConnect?: (info: {
    ip: string;
    userAgent?: string;
    url?: string;
    timestamp?: number;
  }) => void;
  // Track open sockets for force-close
  private sockets: Set<any> = new Set();

  constructor(
    onUpload: (event: UploadEvent) => void,
    onConnect?: (info: {
      ip: string;
      userAgent?: string;
      url?: string;
      timestamp?: number;
    }) => void
  ) {
    this.onUpload = onUpload;
    this.onConnect = onConnect;
  }

  /**
   * Start the server on an available port
   */
  async start(
    portRange: [number, number]
  ): Promise<{ port: number; token: string; url: string }> {
    if (Platform.isMobileApp) {
      throw new Error("Upload server is disabled on mobile devices.");
    }

    // Initialize Node.js modules
    await initializeNodeModules();

    if (!http || !crypto) {
      const missingModules = [];
      if (!http) missingModules.push("http");
      if (!crypto) missingModules.push("crypto");
      throw new Error(
        `Required Node.js modules not available: ${missingModules.join(", ")}`
      );
    }

    this.token = generateToken();

    for (let port = portRange[0]; port <= portRange[1]; port++) {
      try {
        await this.tryStartServer(port);
        this.port = port;
        const localIP = await this.getLocalIP();
        const url = `http://${localIP}:${port}?token=${this.token}`;
        console.debug(
          `[Napkin Notes Upload Server] Server started successfully on ${url}`
        );
        return { port, token: this.token, url };
      } catch (_err) {
        // Port in use, try next one
        continue;
      }
    }

    throw new Error(
      `No available ports in range ${portRange[0]}-${portRange[1]}`
    );
  }

  /**
   * Try to start server on a specific port
   */
  private tryStartServer(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!http) {
        reject(new Error("HTTP module not available"));
        return;
      }
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      // Track sockets for force-close
      this.server.on("connection", (socket) => {
        this.sockets.add(socket);
        socket.on("close", () => {
          this.sockets.delete(socket);
        });
      });

      this.server.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      });

      this.server.listen(port, () => {
        resolve();
      });
    });
  }

  /**
   * Handle incoming HTTP requests
   */
  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    // Enable CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const token = url.searchParams.get("token");

    // Verify token
    if (token !== this.token) {
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("Forbidden");
      return;
    }

    if (req.method === "GET" && url.pathname === "/") {
      // Notify plugin that a device connected to the upload page
      try {
        const remoteIP =
          req.socket && req.socket.remoteAddress
            ? req.socket.remoteAddress
            : "";
        const userAgent = String(req.headers["user-agent"] || "");
        if (this.onConnect) {
          this.onConnect({
            ip: remoteIP,
            userAgent,
            url: url.toString(),
            timestamp: Date.now(),
          });
        }
        console.debug(
          `[Napkin Notes Upload Server] Client connected: ${remoteIP} - ${userAgent}`
        );
      } catch (err) {
        console.error(
          "[Napkin Notes Upload Server] Error notifying onConnect:",
          err
        );
      }
      serveUploadPage(res);
    } else if (req.method === "GET" && url.pathname === "/ping") {
      // Lightweight ping for client polling. If token verified above, respond with 204.
      res.writeHead(204);
      res.end();
    } else if (req.method === "POST" && url.pathname === "/upload") {
      void handleUpload(req, res, this.onUpload);
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
    }
  }

  /**
   * Get local IP address
   */
  private async getLocalIP(): Promise<string> {
    const os = getOsModule();

    if (!os) {
      return "localhost";
    }

    const interfaces = os.networkInterfaces();

    for (const name of Object.keys(interfaces)) {
      const ifaces = interfaces[name];
      if (!ifaces) continue;

      for (const iface of ifaces) {
        // Skip internal and non-IPv4 addresses
        if (iface.family === "IPv4" && !iface.internal) {
          return iface.address;
        }
      }
    }

    return "localhost";
  }

  /**
   * Stop the server
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        // Force-close all open sockets
        for (const socket of this.sockets) {
          try {
            socket.destroy();
          } catch (_err) {
            // Ignore errors
          }
        }
        this.sockets.clear();
        this.server.close(() => {
          console.debug(
            `[Napkin Notes Upload Server] Server stopped successfully`
          );
          this.server = null;
          resolve();
        });
      } else {
        console.debug(`[Napkin Notes Upload Server] No server to stop`);
        resolve();
      }
    });
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.server !== null;
  }
}

export { serveUploadPage, handleUpload, generateToken };
