# RO-Crate Visualizer

A Vite-based CLI tool that converts RO-Crate metadata (LDAC profile) to interactive Mermaid diagrams and renders them in your browser.

## Features

- 📊 Converts RO-Crate JSON-LD to Mermaid flowchart diagrams
- 🚀 Uses Mermaid's **elk renderer** for superior handling of large/complex diagrams
- 🎨 Color-coded nodes by entity type (Dataset, Person, File, Language, etc.)
- 🌐 Automatic browser launch with interactive visualization
- 🔍 Shows relationships: hasPart, contributor, role connections
- 💅 Beautiful, responsive HTML output with legend
- 🛡️ Automatic size management prevents "Maximum text size exceeded" errors

## Installation

```bash
cd src/export/ROCrate/visualizer
yarn install
```

## Testing

The visualizer includes comprehensive unit tests to validate Mermaid syntax generation:

```bash
# Run all tests
yarn test

# Run tests in watch mode
yarn test

# Run tests once and exit
yarn test:run

# Run tests with UI
yarn test:ui
```

The tests validate:

- Correct Mermaid syntax generation
- Character escaping for special characters
- Text size limits (prevents "Maximum text size exceeded" error)
- Node shapes and colors by entity type
- Relationship creation (hasPart, contributor, role)
- Output format consistency

## Usage

### Quick Start (Development Mode)

Use `tsx` to run directly without building:

```bash
yarn cli <path-to-ro-crate-metadata.json>
```

Example using the sample data in the workspace:

```bash
yarn cli ../../../../ro-crate-validation/lameta-fishing/ro-crate-metadata.json
```

Or using an absolute path:

```bash
yarn cli "C:/Users/hatto/OneDrive/Documents/lameta/hewya/ro-crate-metadata.json"
```

### Production Build

Build the CLI tool:

```bash
yarn build
```

Run the built version:

```bash
node dist/cli.js <path-to-ro-crate-metadata.json>
```

### Global Installation (Optional)

Link the package globally:

```bash
yarn link
```

Then use from anywhere:

```bash
rocrate-viz <path-to-ro-crate-metadata.json>
```

## How It Works

1. **Parse**: Reads and parses the RO-Crate JSON-LD file
2. **Convert**: Transforms the graph structure into Mermaid syntax
3. **Optimize**: Automatically limits diagram size to prevent Mermaid's "Maximum text size exceeded" error
4. **Generate**: Creates an HTML file with embedded Mermaid code
5. **Display**: Opens the visualization in your default browser

### Size Management

The converter includes automatic size management to prevent Mermaid diagram errors:

- **Elk Renderer**: Uses Mermaid's elk renderer (since v9.4) for better handling of large/complex diagrams
- **Max diagram size**: 45KB (under Mermaid's ~50KB limit)
- **Max label length**: 80 characters (truncates with "...")
- **Max nodes**: 100 (for large graphs)
- **Auto-simplification**: Enabled for datasets with >100 entities

The elk renderer is specifically designed for larger and more complex diagrams, providing better layout and performance than the default renderer.

If a diagram exceeds limits, the tool will:

1. Warn you in the console
2. Show only the first 20 items in large collections
3. Add a note indicating how many items were not shown

## Visualization Features

### Node Types & Shapes

- **Dataset/Repository Object**: Cylinder shape (blue)
- **Person**: Stadium shape (purple)
- **File**: Rectangle (yellow)
- **Language/Role/Place**: Hexagon (various colors)
- **Creative Work/License**: Trapezoid (orange)

### Relationships

- **Solid arrows** (`-->`): Direct relationships (hasPart)
- **Dashed arrows** (`-.->`)\*\*: Indirect relationships (contributor, role)

### Color Coding

- 🔵 **Blue**: Datasets and repository objects
- 🟡 **Yellow**: Files
- 🟣 **Purple**: People
- 🟢 **Green**: Roles
- 🔴 **Pink**: Languages
- 🔷 **Teal**: Places
- 🟠 **Orange**: Licenses and creative works

## Output

The tool creates a `.rocrate-viz` folder in your current working directory containing:

- `visualization.html`: Interactive HTML page with Mermaid diagram

The HTML file includes:

- Source file path
- Interactive Mermaid diagram
- Color-coded legend
- Responsive design for mobile and desktop

## Project Structure

```
visualizer/
├── src/
│   ├── cli.ts          # CLI entry point
│   └── converter.ts    # RO-Crate to Mermaid converter
├── index.html          # HTML template for visualization
├── package.json        # Dependencies and scripts
├── tsconfig.json       # TypeScript configuration
├── vite.config.ts      # Vite build configuration
└── README.md           # This file
```

## Development

### Watch Mode

For development with auto-reload:

```bash
yarn dev
```

### Testing with Sample Data

The workspace includes sample RO-Crate files for testing:

```bash
# Test with fishing sample
yarn cli ../../../../ro-crate-validation/lameta-fishing/ro-crate-metadata.json

# Test with farms sample
yarn cli ../../../../ro-crate-validation/farmstofreeways/ro-crate-metadata.json
```

Or use the provided test scripts:

**Linux/Mac:**

```bash
chmod +x test.sh
./test.sh
```

**Windows:**

```cmd
test.bat
```

### Testing with External Files

You can also test with RO-Crate files outside the workspace:

```bash
# Using absolute path
yarn cli "C:/Users/hatto/OneDrive/Documents/lameta/hewya/ro-crate-metadata.json"

# Using relative path
yarn cli ../../../my-rocrate/ro-crate-metadata.json
```

## Dependencies

- **vite**: Build tool and dev server
- **typescript**: Type safety
- **mermaid**: Diagram rendering (loaded via CDN in browser)
- **tsx**: TypeScript execution for development
- **open**: Cross-platform browser launching

## Supported RO-Crate Profiles

This tool is optimized for the **Language Data Commons (LDAC)** profile of RO-Crate, which includes:

- Language metadata entities
- Person contributors with roles
- File hierarchies and relationships
- Geographic locations
- Access and licensing information

## Troubleshooting

### "File not found" error

Make sure to provide the correct path to your `ro-crate-metadata.json` file. Use absolute paths if relative paths don't work.

### Browser doesn't open

The visualization HTML file is still created in `.rocrate-viz/visualization.html`. Open it manually in your browser.

### Diagram too large

For very large RO-Crate files, the diagram may be complex. Use your browser's zoom controls to navigate.

## License

MIT

## Contributing

This tool is part of the lameta project. For issues or contributions, please refer to the main lameta repository.
