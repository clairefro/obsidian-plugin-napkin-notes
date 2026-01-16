# Napking Notes

Minimal Obsidian plugin for turning handwritten notes, sketches, and whiteboard photos into simple, interactive image carousels.

Does your handwriting suck too much for OCR? No problem - easily sync your physical and digital notes with inline Napkin Notes. 

![napkin-notes-demo](https://github.com/user-attachments/assets/fb3c6e4d-4613-4a4d-8321-baf3bbc8962a)

<img width="806" height="749" alt="image" src="https://github.com/user-attachments/assets/30b7d340-741a-40cd-8bd1-f44711430bac" />

## Features

- Filesystem upload or QR code upload from your phone
- Group your physical notes into inline, PDF-style viewers
- Optional image annotations for easy search
- Responsive design for desktop and mobile
- Light/Dark mode support


## Usage

1. Open a note and open the command palette (Ctrl+P or Cmd+P) >  **"Insert Napking Notes"**
2. Upload images directly or scan the QR code to upload from your phone
3. Optionally add annotations
4. Insert into your note

### Upload methods 
Choose your preferred upload method. On the Obsidain mobile app, you'll only be able to choose "from Filesystem" (i.e. your photo gallery)

#### From Filesystem
<img width="581" height="512" alt="image" src="https://github.com/user-attachments/assets/05324bd9-3c72-4d09-8578-1b267344a13c" />

#### From Camera (Wifi required)
Scan the QR code to send images instantly from your phone. Capture new photos or upload from your gallery straight to your desktop.

- Smart phone must be on same wifi network as your computer to send
- If you get "low memory" error with camera capture, your phone unfortunately isn't optimized for camerea capture. Use photo gallery instead.

<img width="628" height="729" alt="image" src="https://github.com/user-attachments/assets/5fa00ace-f0ea-4a0c-a967-2864236a60b7" />
<img width="547" height="730" alt="image" src="https://github.com/user-attachments/assets/cb6e8d64-7ed1-44ca-87fe-14ae2c821557" />


## Markdown Format

Images references are stored as plain text in a code block:

````markdown
```napkin-notes
[[assets/napkin-note-2026-01-15-16-16-37-1.jpg]]


[[assets/napkin-note-2026-01-15-16-16-37-2.jpg]]
Optional description
```
````

## Settings

- **Set custom folder for attachments** (defaults to your Obsidian attachment location setting)
- **Napkin Mode**: adds (dirty) paper napkin texture to your Napkin Notes. 

<img width="812" height="743" alt="image" src="https://github.com/user-attachments/assets/4265a66d-f0f2-4f10-8e8d-08b5b717706b" />

## License

MIT

## Author

Claire Froelich

<a href="https://www.buymeacoffee.com/clairefro"><img src="https://img.buymeacoffee.com/button-api/?text=Buy me a potato&emoji=🍠&slug=clairefro&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff" /></a>
