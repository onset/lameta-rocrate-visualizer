# RO-Crate Visualizer - Quick Start Guide

## What It Does

Converts RO-Crate JSON-LD metadata files (LDAC profile) into beautiful, interactive Mermaid diagrams that display in your browser.

## Installation

```bash
cd src/export/ROCrate/visualizer
yarn install
```

## Usage

```bash
yarn cli <path-to-ro-crate-metadata.json>
```

## Examples

### Using Workspace Sample Data

```bash
# Lameta fishing sample
yarn cli ../../../../ro-crate-validation/lameta-fishing/ro-crate-metadata.json

# Farms to freeways sample
yarn cli ../../../../ro-crate-validation/farmstofreeways/ro-crate-metadata.json
```

### Using External Files

```bash
# Absolute path (Windows)
yarn cli "C:/Users/hatto/OneDrive/Documents/lameta/hewya/ro-crate-metadata.json"

# Relative path
yarn cli ../../../my-project/ro-crate-metadata.json
```

## Quick Test

Run the included test script:

**Windows:**

```cmd
test.bat
```

**Linux/Mac:**

```bash
chmod +x test.sh
./test.sh
```

## Output

The tool generates a `.rocrate-viz/visualization.html` file and automatically opens it in your default browser.

## What You'll See

The visualization shows:

- 📦 Dataset (root) in blue
- 📄 Files in yellow
- 👤 People (contributors) in purple
- 🗣️ Roles in green
- 🌍 Languages in pink
- 📍 Places in teal
- 📜 Licenses in orange

With relationships:

- Solid arrows → "hasPart" (contains)
- Dashed arrows ⇢ "contributor", "role", etc.

## Learn More

See `README.md` for full documentation and `EXAMPLE.md` for sample output.
