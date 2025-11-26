# Lameta RO-Crate Visualizer

Converts RO-Crate metadata files into interactive Mermaid diagrams and opens them in your browser.

> [!WARNING]
> This is 100% vibe-coded slop because I needed this tool for a project.

## Installation

```bash
npm install
```

## Modes

- `npm run dev` — original desktop helper with file picker support. Use this when you want to inspect any local RO-Crate JSON file.
- `npm run dev:viewer` — single-file viewer mode. The UI hides the file picker and always loads the shipped RO-Crate located at `public/sample-ro-crate.json`. This mirrors how GitHub Pages serves the site.

## Deployment

- Pushes to `master` trigger `.github/workflows/deploy.yml`, which builds the Vite app and publishes the contents of `dist/` to GitHub Pages.
- The production build runs in single-file viewer mode automatically, so https://<your-username>.github.io/lameta-rocrate-visualizer always visualizes the bundled `sample-ro-crate.json` file.
- To ship a different crate, replace `public/sample-ro-crate.json` and commit the new artifact before pushing.
