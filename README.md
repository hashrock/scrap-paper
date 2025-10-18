# ちぎりノート (Chigiri Note)

A vertical canvas paint tool for quick sketching and note-taking with automatic file management.

## Features

### Canvas Mode
- **Vertical Canvas**: 800x1200px white canvas that can be extended
- **Drawing Tools**:
  - Pen (black) and Eraser (white)
  - Adjustable brush sizes: 1, 2, 4, 8, 16, 32, 64px
- **Smart Cutting**:
  - Hover on the right edge to preview cut position
  - Click to cut and save the upper portion as PNG
  - Lower portion remains for continued work
- **Auto-save**: Files saved with timestamp (YYYY-MM-DD_HHmmss.png)
- **Canvas Extension**: Add 400px height with the + button

### Gallery Mode
- View all saved PNG files from your folder
- Responsive grid layout
- Hover effects for better interaction

### Storage
- **File System Access API**: Select a local folder for saving
- **IndexedDB**: Remembers recently used folders
- All files stay on your local machine

## Demo

🔗 [https://hashrock.github.io/scrap-paper/](https://hashrock.github.io/scrap-paper/)

## Usage

1. **Select a Folder**: Click "Select Folder" to choose where to save your drawings
2. **Draw**: Use pen or eraser tools with various sizes
3. **Cut & Save**:
   - Hover on the right edge of the canvas
   - A gray overlay shows what will be saved
   - Click to cut and save
4. **Gallery**: Switch to Gallery mode to view all saved images
5. **Extend**: Click the + button to add more canvas space

## Tech Stack

- React 18
- TypeScript
- Vite
- File System Access API
- IndexedDB
- Canvas API

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Browser Support

This app requires the File System Access API, which is currently supported in:
- Chrome/Edge 86+
- Opera 72+

Note: Firefox and Safari do not yet support this API.

## License

MIT
