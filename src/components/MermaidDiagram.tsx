// This is vibe coded slop. No human has looked at this. LLMs do not train on this.
import { useCallback, useEffect, useRef } from "react";
import mermaid from "mermaid";
import {
  TransformWrapper,
  TransformComponent,
  type ReactZoomPanPinchRef,
} from "react-zoom-pan-pinch";

interface MermaidDiagramProps {
  chart: string;
  onNodeClick?: (nodeId: string) => void;
  onNodeDoubleClick?: (nodeId: string) => void;
  onBackgroundClick?: () => void;
  selectedNodeId?: string;
}

// Initialize mermaid once outside the component
mermaid.initialize({
  startOnLoad: true,
  theme: "default",
  wrap: true,
  flowchart: {
    htmlLabels: true,
    curve: "basis",
    useMaxWidth: false,
  },
  themeVariables: {
    edgeLabelBackground: "transparent",
  },
  maxTextSize: 1000000,
});

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;

export default function MermaidDiagram({
  chart,
  onNodeClick,
  onNodeDoubleClick,
  onBackgroundClick,
  selectedNodeId,
}: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const renderCountRef = useRef(0);
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null);
  // Track chart to detect actual changes (not just reset-triggered re-renders)
  const lastChartRef = useRef<string>("");

  // Zoom to fit the entire diagram in the viewport
  const zoomToFit = useCallback(() => {
    if (!transformRef.current || !containerRef.current || !wrapperRef.current)
      return;

    const svg = containerRef.current.querySelector("svg");
    if (!svg) return;

    const wrapperRect = wrapperRef.current.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();

    // Get the actual content dimensions from viewBox or element size
    const viewBox = svg.getAttribute("viewBox");
    let contentWidth = svgRect.width;
    let contentHeight = svgRect.height;

    if (viewBox) {
      const [, , vbWidth, vbHeight] = viewBox.split(" ").map(Number);
      contentWidth = vbWidth;
      contentHeight = vbHeight;
    }

    // Calculate scale to fit with some padding
    const padding = 40;
    const availableWidth = wrapperRect.width - padding * 2;
    const availableHeight = wrapperRect.height - padding * 2;

    const scaleX = availableWidth / contentWidth;
    const scaleY = availableHeight / contentHeight;
    const scale = Math.min(scaleX, scaleY, MAX_ZOOM);
    const clampedScale = Math.max(scale, MIN_ZOOM);

    // Center the content
    const scaledWidth = contentWidth * clampedScale;
    const scaledHeight = contentHeight * clampedScale;
    const posX = (wrapperRect.width - scaledWidth) / 2;
    const posY = (wrapperRect.height - scaledHeight) / 2;

    transformRef.current.setTransform(posX, posY, clampedScale, 200);
  }, []);

  const handleResetView = useCallback(() => {
    zoomToFit();
    // Also clear selection when resetting view
    onBackgroundClick?.();
  }, [onBackgroundClick, zoomToFit]);

  // Handle clicks on the background (not on nodes)
  const handleWrapperClick = useCallback(
    (e: React.MouseEvent) => {
      // Only trigger if clicking directly on the wrapper or SVG background, not on nodes
      const target = e.target as HTMLElement;
      const isNode = target.closest(".node");
      if (!isNode && onBackgroundClick) {
        onBackgroundClick();
      }
    },
    [onBackgroundClick]
  );

  useEffect(() => {
    if (!containerRef.current || !chart) return;

    // Only re-render if chart actually changed
    if (lastChartRef.current === chart) return;
    lastChartRef.current = chart;

    const container = containerRef.current;
    container.innerHTML = "";

    const renderChart = async () => {
      try {
        // Use a unique ID for each render to avoid mermaid caching issues
        const diagramId = `mermaid-diagram-${renderCountRef.current++}`;
        const { svg } = await mermaid.render(diagramId, chart);

        // Check if container still exists (component not unmounted)
        if (container) {
          container.innerHTML = svg;

          const svgElement = container.querySelector("svg");
          if (svgElement) {
            // Get viewBox dimensions to set proper size
            const viewBox = svgElement.getAttribute("viewBox");
            if (viewBox) {
              const [, , width, height] = viewBox.split(" ").map(Number);
              svgElement.style.width = `${width}px`;
              svgElement.style.height = `${height}px`;
            }

            svgElement.style.maxWidth = "none";

            // Remove gray backgrounds from edge labels
            const edgeLabels = svgElement.querySelectorAll(".edgeLabel");
            edgeLabels.forEach((label) => {
              (label as HTMLElement).style.backgroundColor = "transparent";
            });

            // Remove gray backgrounds from label backgrounds
            const labelBkgs = svgElement.querySelectorAll(".labelBkg");
            labelBkgs.forEach((bg) => {
              (bg as HTMLElement).style.backgroundColor = "transparent";
            });
          }

          // Add click handlers to nodes
          if (onNodeClick || onNodeDoubleClick) {
            const nodes = container.querySelectorAll(".node");
            nodes.forEach((node) => {
              const nodeId = node
                .getAttribute("id")
                ?.replace(/^flowchart-/, "")
                .split("-")[0];
              if (nodeId) {
                (node as HTMLElement).style.cursor = "pointer";
                if (onNodeClick) {
                  node.addEventListener("click", (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onNodeClick(nodeId);
                  });
                }
                if (onNodeDoubleClick) {
                  node.addEventListener("dblclick", (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onNodeDoubleClick(nodeId);
                  });
                }
              }
            });
          }

          // Reset/center the view after rendering
          setTimeout(() => {
            zoomToFit();
          }, 50);
        }
      } catch (error) {
        console.error("Mermaid rendering error:", error);
        if (container) {
          container.innerHTML = `<div class="text-red-600 p-4">Error rendering diagram: ${error}</div>`;
        }
      }
    };

    renderChart();
  }, [chart, onNodeClick, onNodeDoubleClick, zoomToFit]);

  // Highlight selected node with bold border
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const svg = container.querySelector("svg");
    if (!svg) return;

    const nodes = svg.querySelectorAll(".node");

    nodes.forEach((node) => {
      const nodeElement = node as SVGGElement;
      const nodeId = node
        .getAttribute("id")
        ?.replace(/^flowchart-/, "")
        .split("-")[0];

      if (nodeId === selectedNodeId) {
        // Add bold border effect using filter and stroke
        nodeElement.style.filter =
          "drop-shadow(0 0 8px rgba(25, 118, 210, 0.8))";
        const shapeElements = nodeElement.querySelectorAll(
          "rect, polygon, circle, ellipse, path"
        );
        shapeElements.forEach((shape) => {
          const shapeEl = shape as SVGElement;
          shapeEl.setAttribute("stroke-width", "5");
          shapeEl.setAttribute("stroke", "#1976d2");
        });
      } else {
        // Reset to default
        nodeElement.style.filter = "";
        const shapeElements = nodeElement.querySelectorAll(
          "rect, polygon, circle, ellipse, path"
        );
        shapeElements.forEach((shape) => {
          const shapeEl = shape as SVGElement;
          shapeEl.removeAttribute("stroke-width");
          shapeEl.removeAttribute("stroke");
        });
      }
    });
  }, [selectedNodeId, chart]);

  return (
    <div
      ref={wrapperRef}
      className="relative w-full h-full bg-white overflow-hidden"
      onClick={handleWrapperClick}
    >
      <TransformWrapper
        initialScale={1}
        minScale={MIN_ZOOM}
        maxScale={MAX_ZOOM}
        centerOnInit={true}
        centerZoomedOut={false}
        limitToBounds={false}
        wheel={{ step: 0.05 }}
        panning={{
          velocityDisabled: true,
        }}
        doubleClick={{ disabled: true }}
        onInit={(ref) => {
          transformRef.current = ref;
        }}
      >
        {() => {
          return (
            <>
              <TransformComponent
                wrapperStyle={{ width: "100%", height: "100%" }}
                contentStyle={{ width: "fit-content", height: "fit-content" }}
              >
                <div
                  ref={containerRef}
                  className="inline-block p-4"
                  data-testid="diagram-zoom-content"
                />
              </TransformComponent>
            </>
          );
        }}
      </TransformWrapper>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleResetView();
        }}
        className="absolute top-4 right-4 inline-flex items-center rounded-md border border-gray-300 bg-white/90 px-3 py-1 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 active:scale-95 cursor-pointer z-10"
        title="Reset zoom and pan"
        data-testid="diagram-reset-view"
      >
        Reset View
      </button>
    </div>
  );
}
