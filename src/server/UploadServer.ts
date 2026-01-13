import * as http from "http";
import { IncomingMessage, ServerResponse } from "http";
import * as crypto from "crypto";
const Busboy = require("busboy");
import { UploadEvent } from "../types";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from "../constants";

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
			cursor: pointer;
			transition: all 0.3s ease;
			background: #252526;
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

			<div class="upload-area" id="dropZone">
				<div class="upload-icon">📁</div>
				<p><strong>Tap to select photos</strong></p>
			</div>

			<!-- Hidden file input for gallery selection -->
			<input type="file" id="fileInput" accept="image/*" multiple style="display:none;">

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
			<div id="cameraSupportNotice" style="margin-top:8px; font-size:0.95em; color:#ffb300; display:none; text-align:center;">Your browser does not support camera preview — please use the Gallery option.</div>

			<!-- Camera preview modal -->
			<div id="cameraPreviewModal" style="display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.85); z-index:1000; align-items:center; justify-content:center; flex-direction:column;">
				<video id="cameraPreviewVideo" autoplay playsinline style="max-width:90vw; max-height:60vh; border-radius:12px; background:#000;"></video>
				<div style="margin-top:20px; display:flex; gap:10px;">
					<button class="btn" id="takePreviewPhotoBtn">Take Photo</button>
					<button class="btn" id="closePreviewBtn" style="background:#444;">Cancel</button>
				</div>
				<canvas id="previewCanvas" style="display:none;"></canvas>
			</div>

			<button class="btn" id="uploadBtn" disabled style="margin-top: 20px;">Upload Images</button>

			<div class="count" id="count" style="display:none;"></div>
			<div class="preview" id="preview"></div>
			<div class="status" id="status" style="display:none;"></div>
		</div>

		<script>
			const dropZone = document.getElementById('dropZone');
			const fileInput = document.getElementById('fileInput');
			const cameraInput = document.getElementById('cameraInput');
			const cameraBtn = document.getElementById('cameraBtn');
			const uploadBtn = document.getElementById('uploadBtn');
			const preview = document.getElementById('preview');
			const status = document.getElementById('status');
			const count = document.getElementById('count');
			let selectedFiles = [];

			// Drop zone click/touch opens gallery
			dropZone.addEventListener('click', (e) => {
				e.preventDefault();
				fileInput.click();
			});
			dropZone.addEventListener('touchend', (e) => {
				e.preventDefault();
				fileInput.click();
			});


			// Compress image using createImageBitmap + OffscreenCanvas before upload
			async function compressImage(file) {
				const bitmap = await createImageBitmap(file);
				const MAX_DIM = 1600;
				const scale = Math.min(1, MAX_DIM / bitmap.width, MAX_DIM / bitmap.height);
				const canvas = new OffscreenCanvas(bitmap.width * scale, bitmap.height * scale);
				const ctx = canvas.getContext('2d');
				ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
				const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
				bitmap.close();
				return blob;
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
								uploadBtn.disabled = true; uploadBtn.textContent = 'Uploading...';
								const urlParams = new URLSearchParams(window.location.search);
								const token = urlParams.get('token');
								const formData = new FormData(); formData.append('image', blob, 'photo.jpg');
								const response = await fetch('/upload?token=' + token, { method: 'POST', body: formData });
								if (!response.ok) throw new Error('Upload failed with status ' + response.status);
								showStatus('Image uploaded successfully!', 'success');
							} catch (error) {
								showStatus('Upload failed: ' + error.message, 'error');
							} finally {
								uploadBtn.disabled = false; uploadBtn.textContent = 'Upload Images';
								cameraPreviewModal.style.display = 'none';
								if (previewStream) { previewStream.getTracks().forEach(t => t.stop()); previewStream = null; }
							}
						}, 'image/jpeg', 0.7);
					});
				} else {
					// Preview not supported: show file-input camera and notice
					if (directCameraLabelEl) directCameraLabelEl.style.display = 'inline-block';
					openCameraPreviewBtn.style.display = 'none';
					const notice = document.getElementById('cameraSupportNotice'); if (notice) notice.style.display = 'block';
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
							uploadBtn.disabled = true;
							uploadBtn.textContent = 'Compressing...';
							const compressed = await compressImage(file);
							uploadBtn.textContent = 'Uploading...';
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
							uploadBtn.disabled = false; uploadBtn.textContent = 'Upload Images'; directCameraInputEl.value = '';
						}
					}
				});
			}

			// Upload after gallery selection, compressing each image
			fileInput.addEventListener('change', async (e) => {
				const files = e.target.files;
				if (files && files.length > 0) {
					try {
						uploadBtn.disabled = true; uploadBtn.textContent = 'Compressing...';
						const urlParams = new URLSearchParams(window.location.search);
						const token = urlParams.get('token');
						for (let i = 0; i < files.length; i++) {
							const compressed = await compressImage(files[i]);
							const formData = new FormData(); formData.append('image', compressed, files[i].name);
							uploadBtn.textContent = 'Uploading... (' + (i+1) + '/' + files.length + ')';
							const response = await fetch('/upload?token=' + token, { method: 'POST', body: formData });
							if (!response.ok) { throw new Error('Upload failed with status ' + response.status); }
						}
						showStatus('All images uploaded successfully!', 'success');
					} catch (error) {
						showStatus('Upload failed: ' + error.message, 'error');
					} finally {
						uploadBtn.disabled = false; uploadBtn.textContent = 'Upload Images'; fileInput.value = '';
					}
				}
			});


			function showStatus(message, type) {
				status.textContent = message;
				status.className = 'status ' + type;
				status.style.display = 'block';
			}
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
async function handleUpload(
  req: IncomingMessage,
  res: ServerResponse,
  onUpload: (event: UploadEvent) => void
): Promise<void> {
  try {
    console.log("[Napkin Notes Upload Server] Starting handleUpload");
    const busboy = Busboy({ headers: req.headers });
    let fileCount = 0;

    busboy.on(
      "file",
      (fieldname: string, file: NodeJS.ReadableStream, info: any) => {
        const { filename, encoding, mimeType } = info;
        fileCount++;

        console.log(
          `[Napkin Notes Upload Server] Receiving file #${fileCount}: ${filename}, type: ${mimeType}`
        );

        const chunks: Buffer[] = [];

        file.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });

        file.on("end", () => {
          const buffer = Buffer.concat(chunks);
          console.log(
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
            console.log(
              `[Napkin Notes Upload Server] Calling onUpload callback for ${filename}`
            );
            onUpload(uploadEvent);
            console.log(
              `[Napkin Notes Upload Server] onUpload callback completed for ${filename}`
            );
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
      console.log(
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
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Upload server for receiving images from mobile devices
 */
export class UploadServer {
  private server: http.Server | null = null;
  private port: number = 0;
  private token: string = "";
  private onUpload: (event: UploadEvent) => void;

  constructor(onUpload: (event: UploadEvent) => void) {
    this.onUpload = onUpload;
  }

  /**
   * Start the server on an available port
   */
  async start(
    portRange: [number, number]
  ): Promise<{ port: number; token: string; url: string }> {
    console.log(
      `[Napkin Notes Upload Server] Starting server, port range: ${portRange[0]}-${portRange[1]}`
    );
    this.token = generateToken();

    for (let port = portRange[0]; port <= portRange[1]; port++) {
      try {
        await this.tryStartServer(port);
        this.port = port;
        const url = `http://${this.getLocalIP()}:${port}?token=${this.token}`;
        console.log(
          `[Napkin Notes Upload Server] Server started successfully on ${url}`
        );
        return { port, token: this.token, url };
      } catch (err) {
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
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on("error", (err: any) => {
        if (err.code === "EADDRINUSE") {
          reject(err);
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
      serveUploadPage(res);
    } else if (req.method === "POST" && url.pathname === "/upload") {
      handleUpload(req, res, this.onUpload);
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
    }
  }

  /**
   * Get local IP address
   */
  private getLocalIP(): string {
    const os = require("os");
    const interfaces = os.networkInterfaces();

    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
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
        console.log(
          `[Napkin Notes Upload Server] Stopping server on port ${this.port}`
        );
        this.server.close(() => {
          console.log(
            `[Napkin Notes Upload Server] Server stopped successfully`
          );
          this.server = null;
          resolve();
        });
      } else {
        console.log(`[Napkin Notes Upload Server] No server to stop`);
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
