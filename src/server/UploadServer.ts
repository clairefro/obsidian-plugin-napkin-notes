import * as http from "http";
import { IncomingMessage, ServerResponse } from "http";
import * as crypto from "crypto";
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
	<title>Upload Physical Notes</title>
	<style>
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
			min-height: 100vh;
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 20px;
		}
		.container {
			background: white;
			border-radius: 20px;
			padding: 40px;
			max-width: 500px;
			width: 100%;
			box-shadow: 0 20px 60px rgba(0,0,0,0.3);
		}
		h1 {
			color: #333;
			margin-bottom: 10px;
			font-size: 28px;
		}
		p {
			color: #666;
			margin-bottom: 30px;
		}
		.upload-area {
			border: 3px dashed #667eea;
			border-radius: 15px;
			padding: 40px;
			text-align: center;
			cursor: pointer;
			transition: all 0.3s ease;
			background: #f8f9ff;
		}
		.upload-area:hover {
			background: #eef1ff;
			border-color: #764ba2;
		}
		.upload-area.dragover {
			background: #e0e7ff;
			border-color: #764ba2;
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
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
			color: white;
			border: none;
			padding: 15px 30px;
			border-radius: 10px;
			font-size: 16px;
			font-weight: 600;
			cursor: pointer;
			margin-top: 20px;
			width: 100%;
			transition: transform 0.2s;
		}
		.btn:hover {
			transform: translateY(-2px);
		}
		.btn:disabled {
			opacity: 0.5;
			cursor: not-allowed;
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
			border-radius: 10px;
			box-shadow: 0 2px 8px rgba(0,0,0,0.1);
		}
		.status {
			margin-top: 20px;
			padding: 15px;
			border-radius: 10px;
			text-align: center;
			font-weight: 600;
		}
		.status.success {
			background: #d4edda;
			color: #155724;
		}
		.status.error {
			background: #f8d7da;
			color: #721c24;
		}
		.count {
			margin-top: 15px;
			text-align: center;
			color: #667eea;
			font-weight: 600;
		}
	</style>
</head>
<body>
	<div class="container">
		<h1>📸 Upload Physical Notes</h1>
		<p>Select or capture photos to send to Obsidian</p>

		<div class="upload-area" id="dropZone">
			<div class="upload-icon">📷</div>
			<p><strong>Tap to select photos</strong><br>or drag and drop here</p>
		</div>

		<input type="file" id="fileInput" accept="image/*" multiple capture="environment">

		<button class="btn" id="uploadBtn" disabled>Upload Images</button>

		<div class="count" id="count" style="display:none;"></div>
		<div class="preview" id="preview"></div>
		<div class="status" id="status" style="display:none;"></div>
	</div>

	<script>
		const dropZone = document.getElementById('dropZone');
		const fileInput = document.getElementById('fileInput');
		const uploadBtn = document.getElementById('uploadBtn');
		const preview = document.getElementById('preview');
		const status = document.getElementById('status');
		const count = document.getElementById('count');
		let selectedFiles = [];

		// Click to select files
		dropZone.addEventListener('click', () => fileInput.click());

		// File selection
		fileInput.addEventListener('change', (e) => {
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

			// Show preview
			preview.innerHTML = '';
			selectedFiles.forEach(file => {
				const reader = new FileReader();
				reader.onload = (e) => {
					const img = document.createElement('img');
					img.src = e.target.result;
					preview.appendChild(img);
				};
				reader.readAsDataURL(file);
			});

			// Enable upload button
			uploadBtn.disabled = false;
			count.style.display = 'block';
			count.textContent = \`\${selectedFiles.length} image(s) selected\`;
			status.style.display = 'none';
		}

		// Upload button
		uploadBtn.addEventListener('click', async () => {
			uploadBtn.disabled = true;
			uploadBtn.textContent = 'Uploading...';

			try {
				for (let i = 0; i < selectedFiles.length; i++) {
					const file = selectedFiles[i];
					const formData = new FormData();
					formData.append('image', file);

					await fetch('/upload', {
						method: 'POST',
						body: formData
					});

					count.textContent = \`Uploaded \${i + 1}/\${selectedFiles.length}\`;
				}

				showStatus('All images uploaded successfully!', 'success');
				selectedFiles = [];
				preview.innerHTML = '';
				fileInput.value = '';
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
  const chunks: Uint8Array[] = [];

  req.on("data", (chunk) => {
    chunks.push(chunk);
  });

  req.on("end", () => {
    const buffer = Buffer.concat(chunks);

    // Here you would parse the form data and extract the file
    // For simplicity, we're assuming the entire request body is the file
    const file = {
      buffer,
      originalFilename: "upload.jpg", // You might want to extract this from the request
    };

    // Emit upload event
    onUpload({
      buffer: file.buffer.buffer, // Convert Buffer to ArrayBuffer
      filename: file.originalFilename || "image.jpg",
    });

    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Upload successful");
  });

  req.on("error", (err) => {
    console.error("Upload error:", err);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Server error");
  });
}

/**
 * Generate a secure random token
 */
function generateToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

// Removed the UploadServer class as part of removing the Upload via QR Code feature.

export { serveUploadPage, handleUpload, generateToken };
