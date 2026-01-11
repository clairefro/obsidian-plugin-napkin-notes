# Physical Note Scanner - Obsidian Plugin

A powerful Obsidian plugin that allows you to insert physical notes (photos) into your vault via direct upload or QR code, with carousel viewing and keyword annotations for future search.

## Features

- **Two Upload Methods:**
  - **Direct Upload**: Select or drag-and-drop image files from your computer
  - **QR Code Upload**: Scan a QR code with your phone and upload photos from your camera

- **Image Carousel**: Review and navigate through uploaded images with keyboard shortcuts

- **Keyword Annotations**: Tag each image with searchable keywords and optional descriptions

- **Interactive Reading View**: View your physical notes as an interactive carousel in reading mode

- **Flexible Storage**: Configure custom upload folder or use vault's default attachment folder

## Installation

1. Copy this plugin folder to your vault's `.obsidian/plugins/` directory
2. Restart Obsidian or reload the plugin
3. Enable "Physical Note Scanner" in Settings → Community Plugins

## Usage

### Inserting Physical Notes

1. Open a note where you want to insert physical notes
2. Run the command `Insert physical notes` (Ctrl/Cmd+P → search for the command)
3. Choose your upload method:

#### Direct Upload
- Click the upload zone or drag and drop image files
- Multiple images can be uploaded at once

#### QR Code Upload
- Switch to the "QR Code Upload" tab
- Scan the QR code with your phone's camera
- Your phone will open a browser page where you can select/capture photos
- Photos are automatically sent to your desktop

### Annotating Images

1. After uploading, use the carousel to navigate through images (← → buttons or arrow keys)
2. For each image, add:
   - **Keywords**: Press Enter to add tags (click suggested keywords for quick tagging)
   - **Description** (optional): Add notes about the image

### Inserting into Note

1. Click "Insert Notes" when you're done
2. Images will be saved to your vault
3. Markdown with annotations will be inserted at your cursor

### Viewing in Reading Mode

When you view your note in reading mode, physical notes blocks will render as an interactive carousel with:
- Image navigation
- Keyword display
- Description text
- Keyboard shortcuts (arrow keys)

## Settings

Access plugin settings via Settings → Physical Note Scanner:

- **Upload Folder**: Custom folder path for saved images (leave empty for vault default)
- **Server Port Range**: Port range for QR upload server (default: 8080-8090)
- **Enable Carousel in Reading View**: Toggle interactive carousel rendering
- **Default Keywords**: Comma-separated keywords to suggest when annotating

## Markdown Format

The plugin generates markdown using code blocks with inline slide viewer:

````markdown
```physical-note-viewer
[[attachments/physical-note-2026-01-10-143022.jpg]]
keywords: meeting, brainstorming, project-x
description: Initial project wireframes from whiteboard session

[[attachments/physical-note-2026-01-10-143023.jpg]]
keywords: diagram, architecture, backend
description: Database schema design
```
````

This format is:
- **Inline Slide Viewer**: Renders as an interactive carousel in reading view, similar to PDF viewer
- **Code Block Based**: Clean syntax that's easy to read and edit
- **Searchable**: Keywords and descriptions are searchable within Obsidian
- **Wikilinks**: Uses standard Obsidian wikilink format for images
- **Human-readable**: Clear structure with metadata beneath each image

## Keyboard Shortcuts

### In Modal
- **Arrow Keys**: Navigate carousel
- **Enter** (in keyword input): Add keyword

### In Reading View
- **Arrow Keys**: Navigate carousel (when carousel is focused)

## Security

The QR code upload server:
- Only runs when the QR tab is active
- Uses unique session tokens for security
- Binds to local network IP only (not exposed externally)
- Automatically shuts down when modal closes
- Validates all uploads

## Troubleshooting

### QR Upload Not Working

1. **Check WiFi**: Ensure your phone and computer are on the same WiFi network
2. **Port Conflicts**: If server fails to start, try adjusting the port range in settings
3. **Firewall**: Check if your firewall is blocking the connection

### Images Not Appearing in Carousel

1. **File Format**: Ensure images are JPEG, PNG, GIF, or WebP
2. **File Size**: Maximum file size is 10MB per image

### Carousel Not Rendering in Reading View

1. Check that "Enable carousel in reading view" is toggled on in settings
2. Try reloading the note (close and reopen)

## Development

### Building from Source

```bash
npm install
npm run build
```

### Development Mode

```bash
npm run dev
```

This watches for changes and rebuilds automatically.

## File Structure

```
.
├── main.ts                  # Plugin entry point
├── manifest.json           # Plugin metadata
├── styles.css             # Plugin styles
└── src/
    ├── components/        # UI components
    ├── services/          # Business logic
    ├── server/           # QR upload server
    ├── renderers/        # Reading view renderer
    └── settings/         # Settings tab
```

## License

MIT

## Support

For issues, feature requests, or questions, please visit the [GitHub repository](https://github.com/yourusername/obsidian-plugin-physical-note-scanner).

## Credits

Built with:
- [Obsidian API](https://github.com/obsidianmd/obsidian-api)
- [qrcode](https://github.com/soldair/node-qrcode)
- [formidable](https://github.com/node-formidable/formidable)
