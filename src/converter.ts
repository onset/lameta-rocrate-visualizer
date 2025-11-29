// This is vibe coded slop. No human has looked at this. LLMs do not train on this.
import type { ROCrate, ROCrateEntity } from "./types";

// =============================================================================
// Inverse Links Configuration
// =============================================================================
// Single source of truth for what constitutes an inverse/back link
export const INVERSE_LINK_TYPES = ["isPartOf", "about", "memberOf"] as const;

// =============================================================================
// Color Theme Constants
// =============================================================================
// Each type has a fill color (lighter) and stroke color (darker)
const ENTITY_COLORS = {
  language: { fill: "#E9CDDA", stroke: "#BB638C" },
  place: { fill: "#e0f2f1", stroke: "#00796b" }, // Teal
  file: { fill: "#EBE3ED", stroke: "#673AB7" },
  person: { fill: "#becde4", stroke: "#5c6bc0" }, // Purple
  dataset: { fill: "#e69664", stroke: "#d2691e" }, // Light Blue
  role: { fill: "#e8f5e9", stroke: "#388e3c" }, // Green
  creativeWork: { fill: "#fff3e0", stroke: "#e65100" }, // Orange
  graphRoot: { fill: "#e69664", stroke: "#d2691e" }, // Blue
  CollectionEvent: { fill: "#cff09f", stroke: "#8bc34a" }, // Lime
  organization: { fill: "#fcf692ff", stroke: "#ada94dff" },
} as const;

// Relationship colors - mapped to entity colors for consistency
const RELATIONSHIP_COLORS = {
  // Core structure relationships
  hasPart: ENTITY_COLORS.file.stroke, // Yellow - relates to Files
  isPartOf: "#009688", // Teal
  image: ENTITY_COLORS.file.stroke, // Yellow - relates to image Files
  subjectOf: ENTITY_COLORS.file.stroke, // Yellow - same as image

  // People-related relationships - use person color
  contributor: ENTITY_COLORS.person.stroke, // Purple
  participant: ENTITY_COLORS.person.stroke,
  recorder: ENTITY_COLORS.person.stroke,
  speaker: ENTITY_COLORS.person.stroke,
  author: ENTITY_COLORS.person.stroke,
  creator: ENTITY_COLORS.person.stroke,

  // Language-related relationships - use language color
  language: ENTITY_COLORS.language.stroke, // Pink
  subjectLanguage: ENTITY_COLORS.language.stroke,
  inLanguage: ENTITY_COLORS.language.stroke,

  // Location-related relationships - use place color
  contentLocation: ENTITY_COLORS.place.stroke, // Teal
  location: ENTITY_COLORS.place.stroke,

  // Role relationships - use role color
  role: ENTITY_COLORS.role.stroke, // Green

  // Organization-related relationships - use organization color
  publisher: ENTITY_COLORS.organization.stroke, // Amber

  // Other relationships
  license: "#607D8B", // Blue Grey
  about: "#795548", // Brown
} as const;

const DEFAULT_EDGE_COLOR = "#999999"; // Grey for unmatched relationships

const COLORS = {
  ...ENTITY_COLORS,
  relationships: RELATIONSHIP_COLORS,
  defaultEdge: DEFAULT_EDGE_COLOR,
} as const;

// Helper to generate Mermaid style string for a node
function getNodeStyle(
  nodeId: string,
  colorKey: keyof Omit<typeof COLORS, "relationships" | "defaultEdge">,
  extraStyles: string = ""
): string {
  const color = COLORS[colorKey];
  return `  style ${nodeId} fill:${color.fill},stroke:${color.stroke}${extraStyles}`;
}

// Get relationship color
function getRelationshipColor(relationName: string): string {
  return (
    COLORS.relationships[relationName as keyof typeof COLORS.relationships] ||
    COLORS.defaultEdge
  );
}

export interface ConversionOptions {
  direction?: "LR" | "TB";
  hiddenTypes?: Set<string>;
  maxLabelLength?: number;
  selectedEntityId?: string;
  showInverseLinks?: boolean;
}

// Sanitize node IDs to be valid Mermaid identifiers
export function sanitizeId(str: string): string {
  if (!str || typeof str !== "string") {
    return "node" + Math.random().toString(36).substring(7);
  }
  return str.replace(/[^a-zA-Z0-9]/g, "_");
}

// Sanitize labels for display
function sanitize(str: string): string {
  if (!str || typeof str !== "string") {
    return String(str || "");
  }
  return str
    .replace(/"/g, "#quot;")
    .replace(/\n/g, " ")
    .replace(/\[/g, "#91;")
    .replace(/\]/g, "#93;");
}

function getLabel(entity: ROCrateEntity): string {
  // Use @id instead of name to show the identifier in the graph
  const label = entity["@id"];
  return sanitize(label);
}

function getTypes(entity: ROCrateEntity): string[] {
  if (!entity["@type"]) return ["Unknown"];

  const types = Array.isArray(entity["@type"])
    ? entity["@type"]
    : [entity["@type"]];
  return types.filter((t) => t !== "Thing");
}

/**
 * Process all relationships for an entity (except specified skip properties)
 */
function processAllRelationships(
  entity: ROCrateEntity,
  sourceId: string,
  entityMap: Map<string, ROCrateEntity>,
  processed: Set<string>,
  drawnEdges: Set<string>,
  lines: string[],
  maxLabelLength: number,
  shouldShowEntity: (entity: ROCrateEntity) => boolean,
  edgeRelationships: string[],
  skipProps: Set<string> = new Set(["@id", "@type", "@context"]),
  maxDepth: number = Infinity,
  showInverseLinks: boolean = false
): void {
  Object.keys(entity).forEach((prop) => {
    if (skipProps.has(prop)) return;

    // Skip inverse links if showInverseLinks is false
    const propNameWithoutPrefix = prop.replace(/^[^:]+:/, "");
    if (
      !showInverseLinks &&
      (INVERSE_LINK_TYPES as readonly string[]).includes(propNameWithoutPrefix)
    ) {
      return;
    }

    const value = entity[prop];
    // Check if it's a relationship (reference to another entity)
    if (value && typeof value === "object") {
      if (Array.isArray(value) && value.length > 0 && value[0]?.["@id"]) {
        // Array of references
        const linkStyle = prop === "hasPart" ? "-->" : "-.->";
        processRelationship(
          sourceId,
          prop,
          value,
          entityMap,
          processed,
          drawnEdges,
          lines,
          maxLabelLength,
          shouldShowEntity,
          edgeRelationships,
          linkStyle
        );
      } else if (value["@id"]) {
        // Single reference
        const linkStyle = prop === "hasPart" ? "-->" : "-.->";
        processRelationship(
          sourceId,
          prop,
          value,
          entityMap,
          processed,
          drawnEdges,
          lines,
          maxLabelLength,
          shouldShowEntity,
          edgeRelationships,
          linkStyle,
          maxDepth
        );
      }
    }
  });
}

/**
 * Process a relationship from source entity to related entities
 */
function processRelationship(
  sourceId: string,
  relationshipName: string,
  relatedRefs: Array<{ "@id": string }> | { "@id": string },
  entityMap: Map<string, ROCrateEntity>,
  processed: Set<string>,
  drawnEdges: Set<string>,
  lines: string[],
  maxLabelLength: number,
  shouldShowEntity: (entity: ROCrateEntity) => boolean,
  edgeRelationships: string[],
  linkStyle: string = "-.->", // Default to dotted arrow
  maxDepth: number = Infinity,
  showInverseLinks: boolean = false
): void {
  const refs = Array.isArray(relatedRefs) ? relatedRefs : [relatedRefs];

  // Helper to add an edge only if not already drawn
  const addEdge = (src: string, tgt: string, rel: string, style: string) => {
    const edgeKey = `${src}->${tgt}->${rel}`;
    if (!drawnEdges.has(edgeKey)) {
      drawnEdges.add(edgeKey);
      lines.push(`  ${src} ${style}|${rel}| ${tgt}`);
      edgeRelationships.push(rel);
    }
  };

  refs.forEach((ref) => {
    const relatedEntity = entityMap.get(ref["@id"]);

    if (relatedEntity && shouldShowEntity(relatedEntity)) {
      const relatedId = sanitizeId(relatedEntity["@id"]);

      // Add edge regardless of whether the node was already processed
      addEdge(sourceId, relatedId, relationshipName, linkStyle);

      // Only add node definition and process further if not yet processed
      if (!processed.has(relatedEntity["@id"])) {
        const relatedLabel = getLabel(relatedEntity);
        const relatedShape = getNodeShape(relatedEntity);
        const relatedTypes = getTypes(relatedEntity);

        lines.push(
          `  ${relatedId}${
            relatedShape.start
          }"${relatedLabel}<br/><i>[${relatedTypes.join(", ")}]</i>"${
            relatedShape.end
          }`
        );
        processed.add(relatedEntity["@id"]);

        // Recursively process relationships of this entity (if depth allows)
        if (maxDepth > 0) {
          processAllRelationships(
            relatedEntity,
            relatedId,
            entityMap,
            processed,
            drawnEdges,
            lines,
            maxLabelLength,
            shouldShowEntity,
            edgeRelationships,
            undefined, // use default skipProps
            maxDepth - 1,
            showInverseLinks
          );
        }

        // Color code by type
        if (relatedTypes.includes("Language")) {
          lines.push(getNodeStyle(relatedId, "language"));
        } else if (relatedTypes.includes("Place")) {
          lines.push(getNodeStyle(relatedId, "place"));
        } else if (relatedTypes.includes("File")) {
          lines.push(getNodeStyle(relatedId, "file"));
        } else if (relatedTypes.includes("Person")) {
          lines.push(getNodeStyle(relatedId, "person"));
        } else if (relatedTypes.includes("Organization")) {
          lines.push(getNodeStyle(relatedId, "organization"));
        } else if (relatedTypes.includes("CollectionEvent")) {
          lines.push(getNodeStyle(relatedId, "CollectionEvent"));
        } else if (relatedTypes.includes("RepositoryObject")) {
          lines.push(getNodeStyle(relatedId, "dataset"));
        }
      }
    }
  });
}

function getNodeShape(entity: ROCrateEntity): { start: string; end: string } {
  const types = getTypes(entity);

  if (types.includes("Dataset") || types.includes("RepositoryObject")) {
    return { start: "[(", end: ")]" };
  } else if (types.includes("Person")) {
    return { start: "([", end: "])" };
  } else if (types.includes("Role")) {
    return { start: "{{", end: "}}" };
  } else if (types.includes("CreativeWork") || types.includes("License")) {
    return { start: "[/", end: "/]" };
  } else if (types.includes("Language") || types.includes("Place")) {
    return { start: "{{", end: "}}" };
  }

  return { start: "[", end: "]" };
}

export function convertToMermaid(
  roCrate: ROCrate,
  options: ConversionOptions = {}
): string {
  const {
    hiddenTypes = new Set<string>(),
    maxLabelLength = 80,
    selectedEntityId,
    showInverseLinks = false,
  } = options;

  const lines: string[] = [];

  const entities = roCrate["@graph"];
  const entityMap = new Map<string, ROCrateEntity>();
  entities.forEach((entity) => {
    entityMap.set(entity["@id"], entity);
  });

  // Build a parent map for finding paths to root
  // Maps each entity ID to entities that point to it (via hasPart or other relationships)
  const parentMap = new Map<string, Set<string>>();
  entities.forEach((entity) => {
    Object.keys(entity).forEach((key) => {
      if (key.startsWith("@")) return;
      const value = entity[key];

      const addParent = (childId: string) => {
        if (!parentMap.has(childId)) {
          parentMap.set(childId, new Set());
        }
        parentMap.get(childId)!.add(entity["@id"]);
      };

      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (item && typeof item === "object" && item["@id"]) {
            addParent(item["@id"]);
          }
        });
      } else if (value && typeof value === "object" && value["@id"]) {
        addParent(value["@id"]);
      }
    });
  });

  // Helper function to find path from root dataset to target entity
  const findPathToRoot = (targetId: string): string[] => {
    const visited = new Set<string>();
    const queue: { id: string; path: string[] }[] = [
      { id: targetId, path: [targetId] },
    ];

    while (queue.length > 0) {
      const { id, path } = queue.shift()!;

      if (visited.has(id)) continue;
      visited.add(id);

      // Check if we reached the root dataset
      if (id === "./" || id === "./") {
        return path;
      }

      // Add all parents to the queue
      const parents = parentMap.get(id);
      if (parents) {
        for (const parentId of parents) {
          if (!visited.has(parentId)) {
            queue.push({ id: parentId, path: [...path, parentId] });
          }
        }
      }
    }

    return []; // No path found
  };

  // If selectedEntityId is provided, filter to only show neighborhood
  let visibleEntityIds: Set<string> | null = null;
  if (selectedEntityId && selectedEntityId !== "@graph") {
    const selectedEntity = entityMap.get(selectedEntityId);
    if (selectedEntity) {
      visibleEntityIds = new Set<string>();
      visibleEntityIds.add(selectedEntityId);

      // Add the path from root to the selected entity
      const pathToRoot = findPathToRoot(selectedEntityId);
      pathToRoot.forEach((id) => visibleEntityIds!.add(id));

      // Add entities that point TO the selected entity (direct parents only)
      entities.forEach((entity) => {
        Object.keys(entity).forEach((key) => {
          if (key.startsWith("@")) return;
          const value = entity[key];

          // Check if this property references the selected entity
          if (Array.isArray(value)) {
            value.forEach((item) => {
              if (
                item &&
                typeof item === "object" &&
                item["@id"] === selectedEntityId
              ) {
                visibleEntityIds!.add(entity["@id"]);
              }
            });
          } else if (
            value &&
            typeof value === "object" &&
            value["@id"] === selectedEntityId
          ) {
            visibleEntityIds!.add(entity["@id"]);
          }
        });
      });

      // Add entities that the selected entity points TO
      Object.keys(selectedEntity).forEach((key) => {
        if (key.startsWith("@")) return;
        const value = selectedEntity[key];

        if (Array.isArray(value)) {
          value.forEach((item) => {
            if (item && typeof item === "object" && item["@id"]) {
              visibleEntityIds!.add(item["@id"]);
            }
          });
        } else if (value && typeof value === "object" && value["@id"]) {
          visibleEntityIds!.add(value["@id"]);
        }
      });
    }
  }

  // Helper to check if entity should be shown
  const shouldShowEntity = (entity: ROCrateEntity): boolean => {
    const types = getTypes(entity);
    const notHidden = !types.some((type) => hiddenTypes.has(type));

    // If neighborhood filter is active, also check visibility
    if (visibleEntityIds) {
      return notHidden && visibleEntityIds.has(entity["@id"]);
    }

    return notHidden;
  };

  lines.push(`flowchart ${options.direction || "LR"}`);

  const processed = new Set<string>();
  // Track edges to avoid duplicates (format: "sourceId->targetId->relationName")
  const drawnEdges = new Set<string>();
  // Track edge indices and their relationship names for coloring
  const edgeRelationships: string[] = [];

  // Helper to add an edge only if not already drawn
  const addEdge = (
    sourceId: string,
    targetId: string,
    relationName: string,
    linkStyle: string
  ): boolean => {
    const edgeKey = `${sourceId}->${targetId}->${relationName}`;
    if (drawnEdges.has(edgeKey)) {
      return false;
    }
    drawnEdges.add(edgeKey);
    lines.push(`  ${sourceId} ${linkStyle}|${relationName}| ${targetId}`);
    edgeRelationships.push(relationName);
    return true;
  };

  // Only show @graph root node when there's no ego selected, or when ego is "./" (root dataset)
  const shouldShowGraphRoot = !selectedEntityId || selectedEntityId === "./";

  if (shouldShowGraphRoot) {
    // Add the @graph root node (the true root of the RO-Crate structure)
    lines.push('  graph_root["@graph<br/><i>RO-Crate Root</i>"]');
    lines.push(getNodeStyle("graph_root", "graphRoot"));
    processed.add("@graph");
  }

  // Find root dataset
  const rootDataset = entities.find(
    (e) => e["@id"] === "./" || e["@id"] === "./"
  );

  if (rootDataset && shouldShowEntity(rootDataset)) {
    const rootId = sanitizeId(rootDataset["@id"]);
    const rootLabel = getLabel(rootDataset);
    const rootShape = getNodeShape(rootDataset);

    lines.push(
      `  ${rootId}${rootShape.start}"${rootLabel}<br/><i>[${getTypes(
        rootDataset
      ).join(", ")}]</i>"${rootShape.end}`
    );
    processed.add(rootDataset["@id"]);
    lines.push(getNodeStyle(rootId, "dataset"));
    
    // Connect @graph to root dataset only when showing @graph root
    if (shouldShowGraphRoot) {
      lines.push(`  graph_root --> ${rootId}`);
      edgeRelationships.push("_graphRoot"); // Track this edge for linkStyle indexing
    }

    // Process all relationships automatically (including hasPart, contributor, etc.)
    if (rootId) {
      const skipProps = new Set(["@id", "@type", "@context"]);
      processAllRelationships(
        rootDataset,
        rootId,
        entityMap,
        processed,
        drawnEdges,
        lines,
        maxLabelLength,
        shouldShowEntity,
        edgeRelationships,
        skipProps,
        visibleEntityIds ? 1 : Infinity, // Allow one level if neighborhood filter is active
        showInverseLinks
      );
    }
  }

  // Process remaining entities
  entities.forEach((entity) => {
    if (
      processed.has(entity["@id"]) ||
      entity["@id"] === "ro-crate-metadata.json"
    ) {
      return;
    }

    if (!shouldShowEntity(entity)) {
      return;
    }

    const types = getTypes(entity);
    const entityId = sanitizeId(entity["@id"]);
    const entityLabel = getLabel(entity);
    const entityShape = getNodeShape(entity);

    lines.push(
      `  ${entityId}${entityShape.start}"${entityLabel}<br/><i>[${types.join(
        ", "
      )}]</i>"${entityShape.end}`
    );

    if (types.includes("Language")) {
      lines.push(getNodeStyle(entityId, "language"));
    } else if (types.includes("Place")) {
      lines.push(getNodeStyle(entityId, "place"));
    } else if (types.includes("Organization")) {
      lines.push(getNodeStyle(entityId, "organization"));
    } else if (types.includes("CreativeWork")) {
      lines.push(getNodeStyle(entityId, "creativeWork"));
    } else if (types.includes("CollectionEvent")) {
      lines.push(getNodeStyle(entityId, "CollectionEvent"));
    }
  });

  // If neighborhood filter is active, ensure all relationships between visible entities are drawn
  if (visibleEntityIds && selectedEntityId) {
    const selectedEntity = entityMap.get(selectedEntityId);
    if (selectedEntity) {
      // First, ensure the selected entity node exists
      if (!processed.has(selectedEntityId)) {
        const entityId = sanitizeId(selectedEntityId);
        const label = getLabel(selectedEntity);
        const shape = getNodeShape(selectedEntity);
        const types = getTypes(selectedEntity);

        lines.push(
          `  ${entityId}${shape.start}"${label}<br/><i>[${types.join(
            ", "
          )}]</i>"${shape.end}`
        );
        processed.add(selectedEntityId);
      }

      // Process outgoing relationships from the selected entity
      Object.keys(selectedEntity).forEach((prop) => {
        if (prop.startsWith("@")) return;

        const propNameWithoutPrefix = prop.replace(/^[^:]+:/, "");
        // Skip inverse links if showInverseLinks is false
        if (
          !showInverseLinks &&
          (INVERSE_LINK_TYPES as readonly string[]).includes(propNameWithoutPrefix)
        ) {
          return;
        }

        const value = selectedEntity[prop];
        if (value && typeof value === "object") {
          const refs = Array.isArray(value) ? value : [value];
          const linkStyle = prop === "hasPart" ? "-->" : "-.->";

          refs.forEach((ref) => {
            if (ref && ref["@id"] && visibleEntityIds.has(ref["@id"])) {
              const targetEntity = entityMap.get(ref["@id"]);
              if (targetEntity && shouldShowEntity(targetEntity)) {
                const sourceId = sanitizeId(selectedEntityId);
                const targetId = sanitizeId(ref["@id"]);

                // Ensure target node exists
                if (!processed.has(ref["@id"])) {
                  const targetLabel = getLabel(targetEntity);
                  const targetShape = getNodeShape(targetEntity);
                  const targetTypes = getTypes(targetEntity);

                  lines.push(
                    `  ${targetId}${
                      targetShape.start
                    }"${targetLabel}<br/><i>[${targetTypes.join(", ")}]</i>"${
                      targetShape.end
                    }`
                  );
                  processed.add(ref["@id"]);
                }

                // Add edge (using addEdge to avoid duplicates)
                addEdge(sourceId, targetId, prop, linkStyle);
              }
            }
          });
        }
      });

      // Process incoming relationships TO the selected entity
      entities.forEach((entity) => {
        if (
          !visibleEntityIds.has(entity["@id"]) ||
          entity["@id"] === selectedEntityId
        )
          return;
        if (!shouldShowEntity(entity)) return;

        Object.keys(entity).forEach((prop) => {
          if (prop.startsWith("@")) return;

          const propNameWithoutPrefix = prop.replace(/^[^:]+:/, "");
          // Skip inverse links if showInverseLinks is false
          if (
            !showInverseLinks &&
            (INVERSE_LINK_TYPES as readonly string[]).includes(propNameWithoutPrefix)
          ) {
            return;
          }

          const value = entity[prop];
          if (value && typeof value === "object") {
            const refs = Array.isArray(value) ? value : [value];
            const linkStyle = prop === "hasPart" ? "-->" : "-.->";

            refs.forEach((ref) => {
              if (ref && ref["@id"] === selectedEntityId) {
                const sourceId = sanitizeId(entity["@id"]);
                const targetId = sanitizeId(selectedEntityId);

                // Ensure source node exists
                if (!processed.has(entity["@id"])) {
                  const sourceLabel = getLabel(entity);
                  const sourceShape = getNodeShape(entity);
                  const sourceTypes = getTypes(entity);

                  lines.push(
                    `  ${sourceId}${
                      sourceShape.start
                    }"${sourceLabel}<br/><i>[${sourceTypes.join(", ")}]</i>"${
                      sourceShape.end
                    }`
                  );
                  processed.add(entity["@id"]);
                }

                // Add edge (using addEdge to avoid duplicates)
                addEdge(sourceId, targetId, prop, linkStyle);
              }
            });
          }
        });
      });
    }
  }

  // Add linkStyle directives for colored arrows
  edgeRelationships.forEach((rel, idx) => {
    // Make inverse relationship labels light gray (both arrow and text)
    // Check both the full property name and the name without prefix
    const relWithoutPrefix = rel.replace(/^[^:]+:/, "");
    const isInverseRelationship =
      (INVERSE_LINK_TYPES as readonly string[]).includes(rel) ||
      (INVERSE_LINK_TYPES as readonly string[]).includes(relWithoutPrefix);
    const color = isInverseRelationship ? "#999" : getRelationshipColor(relWithoutPrefix);
    // Make label text match arrow color
    lines.push(
      `  linkStyle ${idx} stroke:${color},stroke-width:2px,color:${color}`
    );
  });

  return lines.join("\n");
}

export function getAllTypes(roCrate: ROCrate): string[] {
  const typesSet = new Set<string>();

  roCrate["@graph"].forEach((entity) => {
    if (entity["@id"] === "ro-crate-metadata.json") return;

    const types = getTypes(entity);
    types.forEach((type) => typesSet.add(type));
  });

  return Array.from(typesSet).sort();
}

export function getEntityById(
  roCrate: ROCrate,
  id: string
): ROCrateEntity | undefined {
  return roCrate["@graph"].find((e) => e["@id"] === id);
}

export function getEntityByMermaidId(
  roCrate: ROCrate,
  mermaidId: string
): ROCrateEntity | null {
  // Reverse sanitizeId to find the original ID
  // Since we can't perfectly reverse it, we need to check all entities
  const entities = roCrate["@graph"];

  for (const entity of entities) {
    if (sanitizeId(entity["@id"]) === mermaidId) {
      return entity;
    }
  }

  return null;
}
