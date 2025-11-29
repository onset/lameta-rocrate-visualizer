// This is vibe coded slop. No human has looked at this. LLMs do not train on this.
import type { ROCrate, ROCrateEntity } from "./types";
import { INVERSE_LINK_TYPES } from "./converter";
import dagre from "dagre";
import ELK from "elkjs/lib/elk.bundled.js";
import * as cola from "webcola";
import type { LayoutAlgorithm } from "./store";

// =============================================================================
// Color Theme Constants (matching Mermaid colors)
// =============================================================================
const ENTITY_COLORS = {
  language: { fill: "#E9CDDA", stroke: "#BB638C" },
  place: { fill: "#e0f2f1", stroke: "#00796b" },
  file: { fill: "#EBE3ED", stroke: "#673AB7" },
  person: { fill: "#becde4", stroke: "#5c6bc0" },
  dataset: { fill: "#e69664", stroke: "#d2691e" },
  role: { fill: "#e8f5e9", stroke: "#388e3c" },
  creativeWork: { fill: "#fff3e0", stroke: "#e65100" },
  graphRoot: { fill: "#e69664", stroke: "#d2691e" },
  CollectionEvent: { fill: "#cff09f", stroke: "#8bc34a" },
  organization: { fill: "#fcf692ff", stroke: "#ada94dff" },
  default: { fill: "#f5f5f5", stroke: "#666666" },
} as const;

// Node dimensions (shared across algorithms)
const NODE_WIDTH = 200;
const NODE_HEIGHT = 60;

export interface TLDrawNode {
  id: string;
  entityId: string;
  label: string;
  types: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke: string;
}

export interface TLDrawEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  color: string;
}

export interface TLDrawGraphData {
  nodes: TLDrawNode[];
  edges: TLDrawEdge[];
}

export interface ConversionOptions {
  direction?: "LR" | "TB";
  hiddenTypes?: Set<string>;
  selectedEntityId?: string;
  showInverseLinks?: boolean;
  layoutAlgorithm?: LayoutAlgorithm;
}

// =============================================================================
// Temporary node structure before layout
// =============================================================================
interface TempNode {
  id: string;
  entityId: string;
  label: string;
  types: string[];
  fill: string;
  stroke: string;
}

interface TempEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  color: string;
}

function getTypes(entity: ROCrateEntity): string[] {
  if (!entity["@type"]) return ["Unknown"];
  const types = Array.isArray(entity["@type"])
    ? entity["@type"]
    : [entity["@type"]];
  return types.filter((t) => t !== "Thing");
}

function getLabel(entity: ROCrateEntity): string {
  return entity["@id"];
}

function getNodeColors(types: string[]): { fill: string; stroke: string } {
  if (types.includes("Language")) return ENTITY_COLORS.language;
  if (types.includes("Place")) return ENTITY_COLORS.place;
  if (types.includes("File")) return ENTITY_COLORS.file;
  if (types.includes("Person")) return ENTITY_COLORS.person;
  if (types.includes("Dataset") || types.includes("RepositoryObject"))
    return ENTITY_COLORS.dataset;
  if (types.includes("Role")) return ENTITY_COLORS.role;
  if (types.includes("CreativeWork") || types.includes("License"))
    return ENTITY_COLORS.creativeWork;
  if (types.includes("CollectionEvent")) return ENTITY_COLORS.CollectionEvent;
  if (types.includes("Organization")) return ENTITY_COLORS.organization;
  return ENTITY_COLORS.default;
}

function sanitizeId(str: string): string {
  if (!str || typeof str !== "string") {
    return "node_" + Math.random().toString(36).substring(7);
  }
  return str.replace(/[^a-zA-Z0-9]/g, "_");
}

// =============================================================================
// Layout Algorithm Implementations
// =============================================================================

function layoutWithDagre(
  tempNodes: Map<string, TempNode>,
  tempEdges: TempEdge[],
  direction: "LR" | "TB"
): TLDrawNode[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: direction,
    nodesep: 80,
    ranksep: 120,
    marginx: 50,
    marginy: 50,
  });
  g.setDefaultEdgeLabel(() => ({}));

  // Add nodes to dagre
  tempNodes.forEach((_, nodeId) => {
    g.setNode(nodeId, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  // Add edges to dagre
  tempEdges.forEach((edge) => {
    if (tempNodes.has(edge.from) && tempNodes.has(edge.to)) {
      g.setEdge(edge.from, edge.to);
    }
  });

  // Run layout
  dagre.layout(g);

  // Extract positions
  const nodes: TLDrawNode[] = [];
  tempNodes.forEach((nodeData, nodeId) => {
    const layoutNode = g.node(nodeId);
    if (layoutNode) {
      nodes.push({
        ...nodeData,
        x: layoutNode.x - NODE_WIDTH / 2,
        y: layoutNode.y - NODE_HEIGHT / 2,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      });
    }
  });

  return nodes;
}

async function layoutWithElk(
  tempNodes: Map<string, TempNode>,
  tempEdges: TempEdge[],
  direction: "LR" | "TB"
): Promise<TLDrawNode[]> {
  const elk = new ELK();

  const elkDirection = direction === "LR" ? "RIGHT" : "DOWN";

  const graph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": elkDirection,
      "elk.spacing.nodeNode": "80",
      "elk.layered.spacing.nodeNodeBetweenLayers": "120",
      "elk.padding": "[top=50,left=50,bottom=50,right=50]",
    },
    children: Array.from(tempNodes.entries()).map(([nodeId]) => ({
      id: nodeId,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    })),
    edges: tempEdges
      .filter((e) => tempNodes.has(e.from) && tempNodes.has(e.to))
      .map((edge, index) => ({
        id: `e${index}`,
        sources: [edge.from],
        targets: [edge.to],
      })),
  };

  const layoutResult = await elk.layout(graph);

  const nodes: TLDrawNode[] = [];
  tempNodes.forEach((nodeData, nodeId) => {
    const layoutNode = layoutResult.children?.find((c) => c.id === nodeId);
    if (layoutNode) {
      nodes.push({
        ...nodeData,
        x: layoutNode.x ?? 0,
        y: layoutNode.y ?? 0,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      });
    }
  });

  return nodes;
}

function layoutWithCola(
  tempNodes: Map<string, TempNode>,
  tempEdges: TempEdge[],
  direction: "LR" | "TB"
): TLDrawNode[] {
  const nodeIds = Array.from(tempNodes.keys());
  const nodeIndexMap = new Map<string, number>();
  nodeIds.forEach((id, index) => {
    nodeIndexMap.set(id, index);
  });

  // Create cola nodes with initial positions
  const colaNodes = nodeIds.map((_, index) => ({
    index,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    x: (index % 5) * 300 + 50,
    y: Math.floor(index / 5) * 150 + 50,
  }));

  // Create cola links
  const colaLinks = tempEdges
    .filter((e) => nodeIndexMap.has(e.from) && nodeIndexMap.has(e.to))
    .map((edge) => ({
      source: nodeIndexMap.get(edge.from)!,
      target: nodeIndexMap.get(edge.to)!,
    }));

  // Create constraints for directional flow
  const constraints: { axis: "x" | "y"; left: number; right: number; gap: number }[] = [];
  
  if (direction === "LR") {
    // For left-to-right, use x-axis separation
    colaLinks.forEach((link) => {
      constraints.push({
        axis: "x",
        left: link.source,
        right: link.target,
        gap: 250,
      });
    });
  } else {
    // For top-to-bottom, use y-axis separation
    colaLinks.forEach((link) => {
      constraints.push({
        axis: "y",
        left: link.source,
        right: link.target,
        gap: 120,
      });
    });
  }

  // Run cola layout
  new cola.Layout()
    .size([2000, 2000])
    .nodes(colaNodes)
    .links(colaLinks)
    .constraints(constraints)
    .avoidOverlaps(true)
    .linkDistance(200)
    .start(30, 20, 10);

  // Extract positions
  const nodes: TLDrawNode[] = [];
  const nodeArray = Array.from(tempNodes.values());
  colaNodes.forEach((colaNode, index) => {
    const nodeData = nodeArray[index];
    if (nodeData) {
      nodes.push({
        ...nodeData,
        x: colaNode.x - NODE_WIDTH / 2,
        y: colaNode.y - NODE_HEIGHT / 2,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      });
    }
  });

  return nodes;
}

// =============================================================================
// Graph Data Extraction
// =============================================================================

function extractGraphData(
  roCrate: ROCrate,
  options: ConversionOptions
): { tempNodes: Map<string, TempNode>; tempEdges: TempEdge[]; processedNodeIds: Set<string> } {
  const {
    hiddenTypes = new Set<string>(),
    selectedEntityId,
    showInverseLinks = false,
  } = options;

  const entities = roCrate["@graph"];
  const entityMap = new Map<string, ROCrateEntity>();
  entities.forEach((entity) => {
    entityMap.set(entity["@id"], entity);
  });

  // Build parent map for finding paths to root
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

  // Find path from root dataset to target entity
  const findPathToRoot = (targetId: string): string[] => {
    const visited = new Set<string>();
    const queue: { id: string; path: string[] }[] = [
      { id: targetId, path: [targetId] },
    ];

    while (queue.length > 0) {
      const { id, path } = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);

      if (id === "./" || id === "./") {
        return path;
      }

      const parents = parentMap.get(id);
      if (parents) {
        for (const parentId of parents) {
          if (!visited.has(parentId)) {
            queue.push({ id: parentId, path: [...path, parentId] });
          }
        }
      }
    }

    return [];
  };

  // Determine visible entities if neighborhood filter is active
  let visibleEntityIds: Set<string> | null = null;
  if (selectedEntityId && selectedEntityId !== "@graph") {
    const selectedEntity = entityMap.get(selectedEntityId);
    if (selectedEntity) {
      visibleEntityIds = new Set<string>();
      visibleEntityIds.add(selectedEntityId);

      const pathToRoot = findPathToRoot(selectedEntityId);
      pathToRoot.forEach((id) => visibleEntityIds!.add(id));

      // Add entities that point TO the selected entity
      entities.forEach((entity) => {
        Object.keys(entity).forEach((key) => {
          if (key.startsWith("@")) return;
          const value = entity[key];

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

    if (visibleEntityIds) {
      return notHidden && visibleEntityIds.has(entity["@id"]);
    }

    return notHidden;
  };

  const tempNodes = new Map<string, TempNode>();
  const tempEdges: TempEdge[] = [];
  const processedNodeIds = new Set<string>();
  const processedEdges = new Set<string>();

  // Add graph root node if not focusing on a specific entity
  const shouldShowGraphRoot = !selectedEntityId || selectedEntityId === "./";
  if (shouldShowGraphRoot) {
    const nodeId = "graph_root";
    tempNodes.set(nodeId, {
      id: nodeId,
      entityId: "@graph",
      label: "@graph",
      types: ["RO-Crate Root"],
      fill: ENTITY_COLORS.graphRoot.fill,
      stroke: ENTITY_COLORS.graphRoot.stroke,
    });
    processedNodeIds.add("@graph");
  }

  // Process root dataset first
  const rootDataset = entities.find(
    (e) => e["@id"] === "./" || e["@id"] === "./"
  );
  if (rootDataset && shouldShowEntity(rootDataset)) {
    const nodeId = sanitizeId(rootDataset["@id"]);
    const types = getTypes(rootDataset);
    const colors = getNodeColors(types);

    tempNodes.set(nodeId, {
      id: nodeId,
      entityId: rootDataset["@id"],
      label: getLabel(rootDataset),
      types,
      fill: colors.fill,
      stroke: colors.stroke,
    });
    processedNodeIds.add(rootDataset["@id"]);

    // Connect graph root to root dataset
    if (shouldShowGraphRoot) {
      tempEdges.push({
        id: `edge_graph_root_${nodeId}`,
        from: "graph_root",
        to: nodeId,
        label: "",
        color: "#666666",
      });
    }
  }

  // Process all entities
  entities.forEach((entity) => {
    if (entity["@id"] === "ro-crate-metadata.json") return;
    if (!shouldShowEntity(entity)) return;
    if (processedNodeIds.has(entity["@id"])) return;

    const nodeId = sanitizeId(entity["@id"]);
    const types = getTypes(entity);
    const colors = getNodeColors(types);

    tempNodes.set(nodeId, {
      id: nodeId,
      entityId: entity["@id"],
      label: getLabel(entity),
      types,
      fill: colors.fill,
      stroke: colors.stroke,
    });
    processedNodeIds.add(entity["@id"]);
  });

  // Process edges (relationships)
  entities.forEach((entity) => {
    if (entity["@id"] === "ro-crate-metadata.json") return;
    if (!shouldShowEntity(entity)) return;

    const sourceId = sanitizeId(entity["@id"]);

    Object.keys(entity).forEach((prop) => {
      if (prop.startsWith("@")) return;

      // Skip inverse links if showInverseLinks is false
      const propNameWithoutPrefix = prop.replace(/^[^:]+:/, "");
      if (
        !showInverseLinks &&
        (INVERSE_LINK_TYPES as readonly string[]).includes(
          propNameWithoutPrefix
        )
      ) {
        return;
      }

      const value = entity[prop];
      if (value && typeof value === "object") {
        const refs = Array.isArray(value) ? value : [value];

        refs.forEach((ref) => {
          if (ref && ref["@id"]) {
            const targetEntity = entityMap.get(ref["@id"]);
            if (targetEntity && shouldShowEntity(targetEntity)) {
              const targetId = sanitizeId(ref["@id"]);
              const edgeKey = `${sourceId}->${targetId}->${prop}`;

              if (
                !processedEdges.has(edgeKey) &&
                processedNodeIds.has(targetEntity["@id"])
              ) {
                processedEdges.add(edgeKey);

                const isInverse = (
                  INVERSE_LINK_TYPES as readonly string[]
                ).includes(propNameWithoutPrefix);
                const edgeColor = isInverse ? "#999999" : "#666666";

                tempEdges.push({
                  id: `edge_${sourceId}_${targetId}_${prop}`,
                  from: sourceId,
                  to: targetId,
                  label: prop,
                  color: edgeColor,
                });
              }
            }
          }
        });
      }
    });
  });

  return { tempNodes, tempEdges, processedNodeIds };
}

// =============================================================================
// Main Conversion Functions
// =============================================================================

// Synchronous version using dagre or cola (for backwards compatibility)
export function convertToTLDrawGraph(
  roCrate: ROCrate,
  options: ConversionOptions = {}
): TLDrawGraphData {
  const { direction = "LR", layoutAlgorithm = "dagre" } = options;
  const { tempNodes, tempEdges } = extractGraphData(roCrate, options);

  let nodes: TLDrawNode[];

  // For synchronous call, use dagre or cola (elk is async)
  if (layoutAlgorithm === "cola") {
    nodes = layoutWithCola(tempNodes, tempEdges, direction);
  } else {
    // Default to dagre for sync calls
    nodes = layoutWithDagre(tempNodes, tempEdges, direction);
  }

  return { nodes, edges: tempEdges };
}

// Async version that supports all algorithms including ELK
export async function convertToTLDrawGraphAsync(
  roCrate: ROCrate,
  options: ConversionOptions = {}
): Promise<TLDrawGraphData> {
  const { direction = "LR", layoutAlgorithm = "dagre" } = options;
  const { tempNodes, tempEdges } = extractGraphData(roCrate, options);

  let nodes: TLDrawNode[];

  switch (layoutAlgorithm) {
    case "elk":
      nodes = await layoutWithElk(tempNodes, tempEdges, direction);
      break;
    case "cola":
      nodes = layoutWithCola(tempNodes, tempEdges, direction);
      break;
    case "dagre":
    default:
      nodes = layoutWithDagre(tempNodes, tempEdges, direction);
      break;
  }

  return { nodes, edges: tempEdges };
}

export { sanitizeId };
