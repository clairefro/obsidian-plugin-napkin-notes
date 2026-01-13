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
				<div class="upload-icon">📷</div>
				<p><strong>Tap to select photos</strong></p>
			</div>

			<!-- Hidden file input for gallery selection -->
			<input type="file" id="fileInput" accept="image/*" multiple style="display:none;">

			<!-- Hidden file input for camera capture -->
			<input type="file" id="cameraInput" accept="image/*" capture="environment" style="display:none;">

			<div style="display: flex; gap: 10px; margin-top: 20px;">
				<!-- Camera capture button uses a hidden file input with capture attribute -->
				<label for="directCameraInput" class="btn" style="flex:1; text-align:center; margin:0;">
					Capture with Camera
					<input type="file" id="directCameraInput" accept="image/*" capture="environment" style="display:none;">
				</label>
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


			// Camera button is now a label for the hidden input, so no JS needed
			// Optionally, you can still listen for changes on directCameraInput:
			const directCameraInput = document.getElementById('directCameraInput');
			if (directCameraInput) {
				directCameraInput.addEventListener('change', (e) => {
					handleFiles(e.target.files);
				});
			}

			// File selection from gallery
			fileInput.addEventListener('change', (e) => {
				handleFiles(e.target.files);
			});

			// File selection from camera
			cameraInput.addEventListener('change', (e) => {
				handleFiles(e.target.files);
			});

			// Drag and drop
			dropZone.addEventListener('dragover', (e) => {
				e.preventDefault();
				dropZone.classList.add('dragover');
			});
			dropZone.addEventListener('dragleave', () => {
				dropZone.classList.remove('dragover');
			});
			dropZone.addEventListener('drop', (e) => {
				e.preventDefault();
				dropZone.classList.remove('dragover');
				handleFiles(e.dataTransfer.files);
			});

			function handleFiles(files) {
				selectedFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
				if (selectedFiles.length === 0) {
					showStatus('Please select image files', 'error');
					return;
				}
				// Show preview - limit preview generation to save memory
				preview.innerHTML = '';
				const maxPreviews = Math.min(selectedFiles.length, 6); // Limit to 6 previews
				for (var i = 0; i < maxPreviews; i++) {
					var file = selectedFiles[i];
					try {
						var reader = new FileReader();
						reader.onload = function(e) {
							try {
								var img = document.createElement('img');
								img.src = e.target.result;
								preview.appendChild(img);
							} catch (err) {
								console.error('Failed to create preview:', err);
							}
						};
						reader.onerror = function() {
							console.error('Failed to read file for preview');
						};
						reader.readAsDataURL(file);
					} catch (err) {
						console.error('Failed to generate preview:', err);
					}
				}
				if (selectedFiles.length > maxPreviews) {
					var moreText = document.createElement('div');
					moreText.style.cssText = 'grid-column: 1 / -1; text-align: center; color: #666;';
					moreText.textContent = '+' + (selectedFiles.length - maxPreviews) + ' more';
					preview.appendChild(moreText);
				}
				// Enable upload button
				uploadBtn.disabled = false;
				count.style.display = 'block';
				count.textContent = selectedFiles.length + ' image(s) selected';
				status.style.display = 'none';
			}

			// Upload button
			uploadBtn.addEventListener('click', async () => {
				uploadBtn.disabled = true;
				uploadBtn.textContent = 'Uploading...';
				try {
					// Get token from URL
					const urlParams = new URLSearchParams(window.location.search);
					const token = urlParams.get('token');
					for (var i = 0; i < selectedFiles.length; i++) {
						var file = selectedFiles[i];
						var formData = new FormData();
						formData.append('image', file);
						var urlParams = new URLSearchParams(window.location.search);
						var token = urlParams.get('token');
						var response = await fetch('/upload?token=' + token, {
							method: 'POST',
							body: formData
						});
						if (!response.ok) {
							throw new Error('Upload failed with status ' + response.status);
						}
						count.textContent = 'Uploaded ' + (i + 1) + '/' + selectedFiles.length;
					}
					showStatus('All images uploaded successfully!', 'success');
					selectedFiles = [];
					preview.innerHTML = '';
					fileInput.value = '';
					cameraInput.value = '';
					uploadBtn.textContent = 'Upload Images';
				} catch (error) {
					showStatus('Upload failed: ' + error.message, 'error');
					uploadBtn.disabled = false;
					uploadBtn.textContent = 'Upload Images';
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
    console.log("[UploadServer] Starting handleUpload");
    const busboy = Busboy({ headers: req.headers });
    let fileCount = 0;

    busboy.on(
      "file",
      (fieldname: string, file: NodeJS.ReadableStream, info: any) => {
        const { filename, encoding, mimeType } = info;
        fileCount++;

        console.log(
          `[UploadServer] Receiving file #${fileCount}: ${filename}, type: ${mimeType}`
        );

        const chunks: Buffer[] = [];

        file.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });

        file.on("end", () => {
          const buffer = Buffer.concat(chunks);
          console.log(
            `[UploadServer] File received: ${filename}, size: ${buffer.length} bytes`
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
              `[UploadServer] Calling onUpload callback for ${filename}`
            );
            onUpload(uploadEvent);
            console.log(
              `[UploadServer] onUpload callback completed for ${filename}`
            );
          } catch (err) {
            console.error(`[UploadServer] Error in onUpload callback:`, err);
          }
        });

        file.on("error", (err: Error) => {
          console.error("[UploadServer] File stream error:", err);
        });
      }
    );

    busboy.on("finish", () => {
      console.log(`[UploadServer] Upload finished. Total files: ${fileCount}`);
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("Upload successful");
    });

    busboy.on("error", (err: Error) => {
      console.error("[UploadServer] Busboy error:", err);
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Server error");
    });

    req.pipe(busboy);
  } catch (err) {
    console.error("[UploadServer] Upload error:", err);
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
      `[UploadServer] Starting server, port range: ${portRange[0]}-${portRange[1]}`
    );
    this.token = generateToken();

    for (let port = portRange[0]; port <= portRange[1]; port++) {
      try {
        await this.tryStartServer(port);
        this.port = port;
        const url = `http://${this.getLocalIP()}:${port}?token=${this.token}`;
        console.log(`[UploadServer] Server started successfully on ${url}`);
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
        console.log(`[UploadServer] Stopping server on port ${this.port}`);
        this.server.close(() => {
          console.log(`[UploadServer] Server stopped successfully`);
          this.server = null;
          resolve();
        });
      } else {
        console.log(`[UploadServer] No server to stop`);
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
