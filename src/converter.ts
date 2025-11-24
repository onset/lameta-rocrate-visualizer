import type { ROCrate, ROCrateEntity } from "./types";

export interface ConversionOptions {
  renderer?: "default" | "elk";
  hiddenTypes?: Set<string>;
  maxLabelLength?: number;
  showRootDataset?: boolean;
  selectedEntityId?: string;
}

// Sanitize node IDs to be valid Mermaid identifiers
function sanitizeId(str: string): string {
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

function getLabel(entity: ROCrateEntity, maxLength: number = 80): string {
  // Use @id instead of name to show the identifier in the graph
  const label = entity["@id"];
  const sanitized = sanitize(label);

  if (sanitized.length > maxLength) {
    return sanitized.substring(0, maxLength) + "...";
  }
  return sanitized;
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
  lines: string[],
  maxLabelLength: number,
  shouldShowEntity: (entity: ROCrateEntity) => boolean,
  skipProps: Set<string> = new Set(["@id", "@type", "@context"]),
  maxDepth: number = Infinity
): void {
  Object.keys(entity).forEach((prop) => {
    if (skipProps.has(prop)) return;

    const value = entity[prop];
    // Check if it's a relationship (reference to another entity)
    if (value && typeof value === "object") {
      if (Array.isArray(value) && value.length > 0 && value[0]?.["@id"]) {
        // Array of references
        const displayName = prop.replace(/^[^:]+:/, ""); // Remove namespace prefix
        const linkStyle = prop === "hasPart" ? "-->" : "-.->";
        processRelationship(
          sourceId,
          displayName,
          value,
          entityMap,
          processed,
          lines,
          maxLabelLength,
          shouldShowEntity,
          linkStyle
        );
      } else if (value["@id"]) {
        // Single reference
        const displayName = prop.replace(/^[^:]+:/, ""); // Remove namespace prefix
        const linkStyle = prop === "hasPart" ? "-->" : "-.->";
        processRelationship(
          sourceId,
          displayName,
          value,
          entityMap,
          processed,
          lines,
          maxLabelLength,
          shouldShowEntity,
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
  lines: string[],
  maxLabelLength: number,
  shouldShowEntity: (entity: ROCrateEntity) => boolean,
  linkStyle: string = "-.->", // Default to dotted arrow
  maxDepth: number = Infinity
): void {
  const refs = Array.isArray(relatedRefs) ? relatedRefs : [relatedRefs];

  refs.forEach((ref) => {
    const relatedEntity = entityMap.get(ref["@id"]);

    if (
      relatedEntity &&
      !processed.has(relatedEntity["@id"]) &&
      shouldShowEntity(relatedEntity)
    ) {
      const relatedId = sanitizeId(relatedEntity["@id"]);
      const relatedLabel = getLabel(relatedEntity, maxLabelLength);
      const relatedShape = getNodeShape(relatedEntity);
      const relatedTypes = getTypes(relatedEntity);

      lines.push(
        `  ${relatedId}${
          relatedShape.start
        }"${relatedLabel}<br/><i>${relatedTypes
          .map((t) => `[${t}]`)
          .join(", ")}</i>"${relatedShape.end}`
      );
      lines.push(
        `  ${sourceId} ${linkStyle}|${relationshipName}| ${relatedId}`
      );
      processed.add(relatedEntity["@id"]);

      // Recursively process relationships of this entity (if depth allows)
      if (maxDepth > 0) {
        processAllRelationships(
          relatedEntity,
          relatedId,
          entityMap,
          processed,
          lines,
          maxLabelLength,
          shouldShowEntity,
          undefined, // use default skipProps
          maxDepth - 1
        );
      }

      // Color code by type
      if (relatedTypes.includes("Language")) {
        lines.push(`  style ${relatedId} fill:#fce4ec,stroke:#c2185b`);
      } else if (relatedTypes.includes("Place")) {
        lines.push(`  style ${relatedId} fill:#e0f2f1,stroke:#00796b`);
      } else if (relatedTypes.includes("File")) {
        lines.push(`  style ${relatedId} fill:#fff9c4,stroke:#f57f17`);
      } else if (relatedTypes.includes("Person")) {
        lines.push(`  style ${relatedId} fill:#f3e5f5,stroke:#7b1fa2`);
      } else if (relatedTypes.includes("RepositoryObject")) {
        lines.push(`  style ${relatedId} fill:#e1f5ff,stroke:#0288d1`);
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
    renderer = "default",
    hiddenTypes = new Set<string>(),
    maxLabelLength = 80,
    showRootDataset = true,
    selectedEntityId
  } = options;

  const lines: string[] = [];

  const entities = roCrate["@graph"];
  const entityMap = new Map<string, ROCrateEntity>();
  entities.forEach((entity) => {
    entityMap.set(entity["@id"], entity);
  });

  // If selectedEntityId is provided, filter to only show neighborhood
  let visibleEntityIds: Set<string> | null = null;
  if (selectedEntityId && selectedEntityId !== "@graph") {
    const selectedEntity = entityMap.get(selectedEntityId);
    if (selectedEntity) {
      visibleEntityIds = new Set<string>();
      visibleEntityIds.add(selectedEntityId);

      // Add entities that point TO the selected entity
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
            visibleEntityIds.add(entity["@id"]);
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
          visibleEntityIds.add(value["@id"]);
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

  // Add renderer config
  if (renderer === "elk") {
    lines.push('%%{init: {"flowchart": {"defaultRenderer": "elk"}} }%%');
    lines.push("flowchart TB");
  } else {
    lines.push("flowchart LR");
  }

  const processed = new Set<string>();

  // Add the @graph root node (the true root of the RO-Crate structure)
  lines.push('  graph_root["@graph<br/><i>RO-Crate Root</i>"]');
  lines.push("  style graph_root fill:#e3f2fd,stroke:#1976d2,stroke-width:3px");
  processed.add("@graph");

  // Find root dataset
  const rootDataset = entities.find(
    (e) => e["@id"] === "./" || e["@id"] === "./"
  );

  if (rootDataset && shouldShowEntity(rootDataset)) {
    let rootId: string | null = null;

    if (showRootDataset) {
      rootId = sanitizeId(rootDataset["@id"]);
      const rootLabel = getLabel(rootDataset, maxLabelLength);
      const rootShape = getNodeShape(rootDataset);

      lines.push(
        `  ${rootId}${rootShape.start}"${rootLabel}<br/><i>${getTypes(
          rootDataset
        )
          .map((t) => `[${t}]`)
          .join(", ")}</i>"${rootShape.end}`
      );
      processed.add(rootDataset["@id"]);
      lines.push(
        `  style ${rootId} fill:#e1f5ff,stroke:#0288d1,stroke-width:3px`
      );
      // Connect @graph to root dataset
      lines.push(`  graph_root --> ${rootId}`);
    } else {
      // Mark as processed even if not shown
      processed.add(rootDataset["@id"]);
    }

    // Process hasPart relationships
    if (rootDataset.hasPart) {
      rootDataset.hasPart.forEach((part) => {
        const partEntity = entityMap.get(part["@id"]);
        if (
          partEntity &&
          !processed.has(partEntity["@id"]) &&
          shouldShowEntity(partEntity)
        ) {
          const partId = sanitizeId(partEntity["@id"]);
          const partLabel = getLabel(partEntity, maxLabelLength);
          const partShape = getNodeShape(partEntity);
          const partTypes = getTypes(partEntity);

          lines.push(
            `  ${partId}${partShape.start}"${partLabel}<br/><i>${partTypes
              .map((t) => `[${t}]`)
              .join(", ")}</i>"${partShape.end}`
          );
          if (rootId) {
            lines.push(`  ${rootId} -->|hasPart| ${partId}`);
          }
          processed.add(partEntity["@id"]);

          if (partTypes.includes("File")) {
            lines.push(`  style ${partId} fill:#fff9c4,stroke:#f57f17`);
          }
        }
      });
    }

    // Process all other relationships automatically
    if (rootId) {
      const skipProps = new Set([
        "@id",
        "@type",
        "@context",
        "hasPart",
        "contributor"
      ]);
      processAllRelationships(
        rootDataset,
        rootId,
        entityMap,
        processed,
        lines,
        maxLabelLength,
        shouldShowEntity,
        skipProps,
        visibleEntityIds ? 1 : Infinity // Allow one level if neighborhood filter is active
      );
    }

    // Process contributors
    if (rootDataset.contributor) {
      rootDataset.contributor.forEach((contrib) => {
        const contribEntity = entityMap.get(contrib["@id"]);
        if (
          contribEntity &&
          !processed.has(contribEntity["@id"]) &&
          shouldShowEntity(contribEntity)
        ) {
          const contribId = sanitizeId(contribEntity["@id"]);
          const contribLabel = getLabel(contribEntity, maxLabelLength);
          const contribShape = getNodeShape(contribEntity);
          const contribTypes = getTypes(contribEntity);

          lines.push(
            `  ${contribId}${
              contribShape.start
            }"${contribLabel}<br/><i>${contribTypes
              .map((t) => `[${t}]`)
              .join(", ")}</i>"${contribShape.end}`
          );
          if (rootId) {
            lines.push(`  ${contribId} -.->|contributor| ${rootId}`);
          }
          processed.add(contribEntity["@id"]);

          if (contribTypes.includes("Person")) {
            lines.push(`  style ${contribId} fill:#f3e5f5,stroke:#7b1fa2`);

            // Process person's hasPart (files)
            if (contribEntity.hasPart) {
              contribEntity.hasPart.forEach((part) => {
                const partEntity = entityMap.get(part["@id"]);
                if (
                  partEntity &&
                  !processed.has(partEntity["@id"]) &&
                  shouldShowEntity(partEntity)
                ) {
                  const partId = sanitizeId(partEntity["@id"]);
                  const partLabel = getLabel(partEntity, maxLabelLength);
                  const partShape = getNodeShape(partEntity);

                  lines.push(
                    `  ${partId}${partShape.start}"${partLabel}"${partShape.end}`
                  );
                  lines.push(`  ${contribId} -->|hasPart| ${partId}`);
                  processed.add(partEntity["@id"]);
                  lines.push(`  style ${partId} fill:#fff9c4,stroke:#f57f17`);
                }
              });
            }

            // Process roles
            if (contribEntity.role) {
              contribEntity.role.forEach((roleRef) => {
                const roleEntity = entityMap.get(roleRef["@id"]);
                if (
                  roleEntity &&
                  !processed.has(roleEntity["@id"]) &&
                  shouldShowEntity(roleEntity)
                ) {
                  const roleId = sanitizeId(roleEntity["@id"]);
                  const roleLabel = getLabel(roleEntity, maxLabelLength);
                  const roleShape = getNodeShape(roleEntity);

                  lines.push(
                    `  ${roleId}${roleShape.start}"${roleLabel}"${roleShape.end}`
                  );
                  lines.push(`  ${contribId} -.->|role| ${roleId}`);
                  processed.add(roleEntity["@id"]);
                  lines.push(`  style ${roleId} fill:#e8f5e9,stroke:#388e3c`);
                }
              });
            }
          }
        }
      });
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
    const entityLabel = getLabel(entity, maxLabelLength);
    const entityShape = getNodeShape(entity);

    lines.push(
      `  ${entityId}${entityShape.start}"${entityLabel}<br/><i>${types
        .map((t) => `[${t}]`)
        .join(", ")}</i>"${entityShape.end}`
    );

    if (types.includes("Language")) {
      lines.push(`  style ${entityId} fill:#fce4ec,stroke:#c2185b`);
    } else if (types.includes("Place")) {
      lines.push(`  style ${entityId} fill:#e0f2f1,stroke:#00796b`);
    } else if (types.includes("CreativeWork")) {
      lines.push(`  style ${entityId} fill:#fff3e0,stroke:#e65100`);
    }
  });

  // If neighborhood filter is active, ensure all relationships between visible entities are drawn
  if (visibleEntityIds && selectedEntityId) {
    const selectedEntity = entityMap.get(selectedEntityId);
    if (selectedEntity) {
      // First, ensure the selected entity node exists
      if (!processed.has(selectedEntityId)) {
        const entityId = sanitizeId(selectedEntityId);
        const label = getLabel(selectedEntity, maxLabelLength);
        const shape = getNodeShape(selectedEntity);
        const types = getTypes(selectedEntity);

        lines.push(
          `  ${entityId}${shape.start}"${label}<br/><i>${types
            .map((t) => `[${t}]`)
            .join(", ")}</i>"${shape.end}`
        );
        processed.add(selectedEntityId);
      }

      // Process outgoing relationships from the selected entity
      Object.keys(selectedEntity).forEach((prop) => {
        if (prop.startsWith("@")) return;

        const value = selectedEntity[prop];
        if (value && typeof value === "object") {
          const refs = Array.isArray(value) ? value : [value];
          const displayName = prop.replace(/^[^:]+:/, "");
          const linkStyle = prop === "hasPart" ? "-->" : "-.->";

          refs.forEach((ref) => {
            if (ref && ref["@id"] && visibleEntityIds.has(ref["@id"])) {
              const targetEntity = entityMap.get(ref["@id"]);
              if (targetEntity && shouldShowEntity(targetEntity)) {
                const sourceId = sanitizeId(selectedEntityId);
                const targetId = sanitizeId(ref["@id"]);

                // Ensure target node exists
                if (!processed.has(ref["@id"])) {
                  const targetLabel = getLabel(targetEntity, maxLabelLength);
                  const targetShape = getNodeShape(targetEntity);
                  const targetTypes = getTypes(targetEntity);

                  lines.push(
                    `  ${targetId}${
                      targetShape.start
                    }"${targetLabel}<br/><i>${targetTypes
                      .map((t) => `[${t}]`)
                      .join(", ")}</i>"${targetShape.end}`
                  );
                  processed.add(ref["@id"]);
                }

                // Add edge
                lines.push(
                  `  ${sourceId} ${linkStyle}|${displayName}| ${targetId}`
                );
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

          const value = entity[prop];
          if (value && typeof value === "object") {
            const refs = Array.isArray(value) ? value : [value];
            const displayName = prop.replace(/^[^:]+:/, "");
            const linkStyle = prop === "hasPart" ? "-->" : "-.->";

            refs.forEach((ref) => {
              if (ref && ref["@id"] === selectedEntityId) {
                const sourceId = sanitizeId(entity["@id"]);
                const targetId = sanitizeId(selectedEntityId);

                // Ensure source node exists
                if (!processed.has(entity["@id"])) {
                  const sourceLabel = getLabel(entity, maxLabelLength);
                  const sourceShape = getNodeShape(entity);
                  const sourceTypes = getTypes(entity);

                  lines.push(
                    `  ${sourceId}${
                      sourceShape.start
                    }"${sourceLabel}<br/><i>${sourceTypes
                      .map((t) => `[${t}]`)
                      .join(", ")}</i>"${sourceShape.end}`
                  );
                  processed.add(entity["@id"]);
                }

                // Add edge
                lines.push(
                  `  ${sourceId} ${linkStyle}|${displayName}| ${targetId}`
                );
              }
            });
          }
        });
      });
    }
  }

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
