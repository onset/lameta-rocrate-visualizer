// This is vibe coded slop. No human has looked at this. LLMs do not train on this.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Tldraw,
  createShapeId,
  Editor,
  DefaultColorStyle,
  toRichText,
} from "tldraw";
import type { TLShapeId, TLUiOverrides, TLUiActionsContextType } from "tldraw";
import "tldraw/tldraw.css";
import type { ROCrate } from "../types";
import { convertToTLDrawGraphAsync, sanitizeId } from "../tldrawConverter";
import type { ConversionOptions, TLDrawGraphData } from "../tldrawConverter";
import type { LayoutAlgorithm } from "../store";

interface TLDrawDiagramProps {
  roCrate: ROCrate;
  direction?: "LR" | "TB";
  hiddenTypes?: Set<string>;
  selectedEntityId?: string;
  showInverseLinks?: boolean;
  layoutAlgorithm?: LayoutAlgorithm;
  onNodeClick?: (nodeId: string) => void;
  onNodeDoubleClick?: (nodeId: string) => void;
  onBackgroundClick?: () => void;
  selectedNodeId?: string;
}

// Custom shape colors mapped to tldraw colors
const colorMap: Record<string, (typeof DefaultColorStyle.values)[number]> = {
  "#E9CDDA": "violet",
  "#e0f2f1": "light-green",
  "#EBE3ED": "violet",
  "#becde4": "light-blue",
  "#e69664": "orange",
  "#e8f5e9": "green",
  "#fff3e0": "orange",
  "#cff09f": "light-green",
  "#fcf692ff": "yellow",
  "#f5f5f5": "grey",
};

function findClosestColor(
  fill: string
): (typeof DefaultColorStyle.values)[number] {
  return colorMap[fill] || "grey";
}

export default function TLDrawDiagram({
  roCrate,
  direction = "LR",
  hiddenTypes = new Set<string>(),
  selectedEntityId,
  showInverseLinks = false,
  layoutAlgorithm = "dagre",
  onNodeClick,
  onNodeDoubleClick,
  onBackgroundClick,
  selectedNodeId,
}: TLDrawDiagramProps) {
  const editorRef = useRef<Editor | null>(null);
  const lastGraphDataRef = useRef<string>("");
  const [graphData, setGraphData] = useState<TLDrawGraphData>({ nodes: [], edges: [] });
  const [isLoading, setIsLoading] = useState(true);

  const conversionOptions: ConversionOptions = useMemo(
    () => ({
      direction,
      hiddenTypes,
      selectedEntityId,
      showInverseLinks,
      layoutAlgorithm,
    }),
    [direction, hiddenTypes, selectedEntityId, showInverseLinks, layoutAlgorithm]
  );

  // Use async layout computation
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    
    convertToTLDrawGraphAsync(roCrate, conversionOptions).then((data) => {
      if (!cancelled) {
        setGraphData(data);
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [roCrate, conversionOptions]);

  // Create shapes from graph data
  const createShapes = useCallback(
    (editor: Editor) => {
      // Only recreate if graph data actually changed
      const graphDataStr = JSON.stringify(graphData);
      if (lastGraphDataRef.current === graphDataStr) {
        return;
      }
      lastGraphDataRef.current = graphDataStr;

      // Clear existing shapes
      const allShapeIds = editor.getCurrentPageShapeIds();
      if (allShapeIds.size > 0) {
        editor.deleteShapes([...allShapeIds]);
      }

      // Create a map to track shape IDs for connecting arrows
      const shapeIdMap = new Map<string, TLShapeId>();

      // Create node shapes (using geo shapes as rectangles with richText)
      graphData.nodes.forEach((node) => {
        const shapeId = createShapeId(node.id);
        shapeIdMap.set(node.id, shapeId);

        const color = findClosestColor(node.fill);
        const labelText = `${node.label}\n[${node.types.join(", ")}]`;

        // Create rectangle shape with text inside using richText
        editor.createShape({
          id: shapeId,
          type: "geo",
          x: node.x,
          y: node.y,
          props: {
            geo: "rectangle",
            w: node.width,
            h: node.height,
            color: color,
            fill: "solid",
            size: "s",
            richText: toRichText(labelText),
          },
        });
      });

      // Create edge shapes (arrows) with bindings
      const bindings: Array<{
        fromId: TLShapeId;
        toId: TLShapeId;
        type: "arrow";
        props: {
          terminal: "start" | "end";
          normalizedAnchor: { x: number; y: number };
          isExact: boolean;
          isPrecise: boolean;
        };
      }> = [];

      graphData.edges.forEach((edge) => {
        const fromShapeId = shapeIdMap.get(edge.from);
        const toShapeId = shapeIdMap.get(edge.to);

        if (fromShapeId && toShapeId) {
          const arrowId = createShapeId(edge.id);

          // Get positions of source and target nodes
          const fromNode = graphData.nodes.find((n) => n.id === edge.from);
          const toNode = graphData.nodes.find((n) => n.id === edge.to);

          if (fromNode && toNode) {
            // Calculate arrow start/end positions relative to the arrow shape's origin
            const startX = fromNode.x + fromNode.width / 2;
            const startY = fromNode.y + fromNode.height / 2;
            const endX = toNode.x + toNode.width / 2;
            const endY = toNode.y + toNode.height / 2;

            const minX = Math.min(startX, endX);
            const minY = Math.min(startY, endY);

            editor.createShape({
              id: arrowId,
              type: "arrow",
              x: minX,
              y: minY,
              props: {
                color: "grey",
                size: "s",
                start: {
                  x: startX - minX,
                  y: startY - minY,
                },
                end: {
                  x: endX - minX,
                  y: endY - minY,
                },
              },
            });

            // Queue up bindings to be created
            bindings.push({
              fromId: arrowId,
              toId: fromShapeId,
              type: "arrow",
              props: {
                terminal: "start",
                normalizedAnchor: { x: 0.5, y: 0.5 },
                isExact: false,
                isPrecise: false,
              },
            });

            bindings.push({
              fromId: arrowId,
              toId: toShapeId,
              type: "arrow",
              props: {
                terminal: "end",
                normalizedAnchor: { x: 0.5, y: 0.5 },
                isExact: false,
                isPrecise: false,
              },
            });
          }
        }
      });

      // Create all the arrow bindings
      if (bindings.length > 0) {
        editor.createBindings(bindings);
      }

      // Zoom to fit all content
      setTimeout(() => {
        editor.zoomToFit({ animation: { duration: 200 } });
      }, 100);
    },
    [graphData]
  );

  // Handle editor mount
  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;

      // Set up click handlers
      editor.on("event", (event) => {
        if (event.name === "pointer_down") {
          const shape = editor.getShapeAtPoint(editor.inputs.currentPagePoint);
          if (shape && shape.type === "geo") {
            // Find the node that corresponds to this shape
            const nodeId = shape.id.replace("shape:", "");
            if (onNodeClick) {
              // Map back to entity ID
              const node = graphData.nodes.find((n) => n.id === nodeId);
              if (node) {
                onNodeClick(
                  nodeId === "graph_root"
                    ? "graph_root"
                    : sanitizeId(node.entityId)
                );
              }
            }
          } else if (!shape && onBackgroundClick) {
            onBackgroundClick();
          }
        } else if (event.name === "double_click") {
          const shape = editor.getShapeAtPoint(editor.inputs.currentPagePoint);
          if (shape && shape.type === "geo" && onNodeDoubleClick) {
            const nodeId = shape.id.replace("shape:", "");
            const node = graphData.nodes.find((n) => n.id === nodeId);
            if (node) {
              onNodeDoubleClick(
                nodeId === "graph_root"
                  ? "graph_root"
                  : sanitizeId(node.entityId)
              );
            }
          }
        }
      });

      createShapes(editor);
    },
    [
      createShapes,
      onNodeClick,
      onNodeDoubleClick,
      onBackgroundClick,
      graphData.nodes,
    ]
  );

  // Update shapes when graph data changes
  useEffect(() => {
    if (editorRef.current) {
      createShapes(editorRef.current);
    }
  }, [graphData, createShapes]);

  // Highlight selected node
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !selectedNodeId) return;

    const shapeId = createShapeId(selectedNodeId);
    const shape = editor.getShape(shapeId);
    if (shape) {
      editor.select(shapeId);
    }
  }, [selectedNodeId]);

  // Custom UI overrides to hide unnecessary UI elements
  const uiOverrides: TLUiOverrides = useMemo(
    () => ({
      actions(_editor: Editor, actions: TLUiActionsContextType) {
        return actions;
      },
    }),
    []
  );

  return (
    <div className="relative w-full h-full bg-white">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-[1001]">
          <div className="text-gray-600 text-sm">Computing layout...</div>
        </div>
      )}
      <Tldraw
        onMount={handleMount}
        overrides={uiOverrides}
        hideUi={false}
        inferDarkMode={false}
      />
      <button
        type="button"
        onClick={() => {
          if (editorRef.current) {
            editorRef.current.zoomToFit({ animation: { duration: 200 } });
          }
          onBackgroundClick?.();
        }}
        className="absolute top-4 right-4 inline-flex items-center rounded-md border border-[#8bc34a] bg-white/95 px-3 py-1 text-sm font-medium text-[#4b6f1a] shadow-sm transition hover:bg-[#f4ffe3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8bc34a] active:scale-95 cursor-pointer z-[1000]"
        title="Reset zoom and pan"
        data-testid="diagram-reset-view"
      >
        Reset View
      </button>
    </div>
  );
}
