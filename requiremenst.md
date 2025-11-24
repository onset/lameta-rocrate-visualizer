Handling "large" files (100+ nodes) in Mermaid is a significant technical challenge because the default layout engine (Dagre) is not designed for high density. It tends to produce "spaghetti code" visualizations.

To achieve a "really good" result for large RO-Crates, your TypeScript app must implement specific **Graph Engineering** strategies, not just simple string concatenation.

Here is the technical specification (requirements list) for your generator.

### 1. Layout Engine Requirement: Use the "ELK" Renderer

The default Mermaid renderer (`dagre`) fails with large graphs—it expands strictly downwards or sideways, creating extremely wide or tall images.

- **Requirement:** Your generated string must start with the directive to use the **ELK** (Eclipse Layout Kernel) engine, which is built for dense graphs.
- **Implementation:**
  ```mermaid
  %%{init: {'flowchart': {'defaultRenderer': 'elk', 'curve': 'linear'}}}%%
  graph TD
  ```
  _(Note: ELK handles recursive subgraphs much better than the default engine.)_

### 2. Deterministic ID Hashing

RO-Crate IDs are often URLs (e.g., `https://doi.org/10...`) or paths (`./data/file.txt`). These contain characters that break Mermaid syntax (`:`, `/`, `.`, `@`, spaces).

- **Requirement:** You must implement a hashing or mapping function that converts every `@id` into a safe, short alphanumeric string (e.g., `N_a1b2`), while maintaining a lookup table to ensure the same `@id` always gets the same Mermaid ID.
- **Do not** just strip characters (collisions will happen). Use a counter or a hash.

### 3. Hierarchy Detection (The `subgraph` Strategy)

RO-Crates are hierarchical (Datasets contain Files). If you link them with simple arrows (`A --> B`), the graph looks messy. If you use **Subgraphs**, it looks like a file explorer (files visually inside folders).

- **Requirement:** Your code must identify `hasPart` relationships _before_ generating the graph.
  - If `A hasPart B`, then `B` must be printed **inside** the definition block of `A`.
  - Recursive handling is required (Dataset -> Sub-Dataset -> File).

### 4. Ontology-Based Styling System

A plain white graph is unreadable. You need visual separation between a `File`, a `Person`, and a `CreativeWork`.

- **Requirement:** Implement a `classDef` injector.
  1.  Iterate through all unique `@type` values in the crate.
  2.  Assign a specific color/shape to each type.
  3.  At the end of the Mermaid string, append CSS classes.
- **Example Output:**
  ```mermaid
  classDef File fill:#e1f5fe,stroke:#01579b;
  classDef Person fill:#fff3e0,stroke:#ff6f00;
  class X,Y File;
  class Z Person;
  ```

### 5. Label "Hygiene" and Wrapping

Long file paths or abstract descriptions will break the layout.

- **Requirement:**
  1.  **Truncation:** Hard limit labels to ~20-30 characters (e.g., `my_very_long_fi...json`).
  2.  **Wrapping:** Insert `<br/>` tags every N characters if you want to show more text. Mermaid supports HTML in labels if enclosed in quotes.
  3.  **Sanitization:** You must escape quotes `"` and special chars `#` in labels. `Data "Set" 1` -> `Data #quot;Set#quot; 1`.

### 6. Connectivity pruning (The "Spiderweb" Prevention)

RO-Crates often have high-degree nodes (e.g., a `Person` node who is the author of 500 files). If you draw an arrow from every File to that Person, the graph becomes unreadable.

- **Requirement:** Implement a "Degree Check" or "Relationship Filter".
  - **Primary Edges:** Always show structural edges (`hasPart`).
  - **Secondary Edges:** For metadata edges (like `author`, `license`), if a node has > 10 connections, do _not_ draw the lines. Instead, list the author name inside the node label or use a different visual shorthand.

### 7. Interactivity (Click Events)

Visualizing a large graph is useless if you can't see the details.

- **Requirement:** Bind every node to a callback or URL.
  - Mermaid syntax: `click nodeId call callbackFunc()` or `click nodeId "URL" "Tooltip"`.
  - Your app should generate a click event that allows the user to click a node in the diagram and open the full JSON details in a side panel.

### Summary: Your Typescript Interface

Based on these requirements, your conversion function signature should look like this:

```typescript
interface MermaidConfig {
  useElkRenderer: boolean; // Default true
  maxLabelLength: number; // Default 25
  groupFilesByDataset: boolean; // Default true (activates subgraphs)
  collapseHighDegreeNodes: boolean; // If a Person has > 20 links, don't draw lines
}

function convertCrateToMermaid(crate: ROCrate, config: MermaidConfig): string {
  // 1. Pre-process: Map all IDs to safe hashes
  // 2. Pre-process: Build a tree for 'hasPart' nesting
  // 3. Generate 'graph TD' or 'graph LR' header
  // 4. Recursive function to print Nodes inside Subgraphs
  // 5. Iterate remaining edges (author, license) that aren't structural
  // 6. Append 'classDef' styles based on @type
  // 7. Return string
}
```
