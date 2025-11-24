import { useCallback, useEffect, useRef } from "react";
import mermaid from "mermaid";
import PrismaZoom from "react-prismazoom";
import type { Ref as PrismaZoomRef } from "react-prismazoom/dist/esm/types";

interface MermaidDiagramProps {
  chart: string;
  onNodeClick?: (nodeId: string) => void;
}

// Initialize mermaid once outside the component
mermaid.initialize({
  startOnLoad: true,
  theme: "default",
  flowchart: {
    htmlLabels: true,
    curve: "basis",
  },
  themeVariables: {
    edgeLabelBackground: "transparent",
  },
});

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;

export default function MermaidDiagram({
  chart,
  onNodeClick,
}: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderCountRef = useRef(0);
  const prismaZoomRef = useRef<PrismaZoomRef | null>(null);
  const zoomSurfaceRef = useRef<HTMLDivElement>(null);
  // Track chart to detect actual changes (not just reset-triggered re-renders)
  const lastChartRef = useRef<string>("");

  const handleResetView = useCallback(() => {
    // Use the PrismaZoom reset method to reset zoom and pan
    if (prismaZoomRef.current) {
      prismaZoomRef.current.reset();
    }
  }, []);

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
          if (onNodeClick) {
            const nodes = container.querySelectorAll(".node");
            nodes.forEach((node) => {
              const nodeId = node
                .getAttribute("id")
                ?.replace(/^flowchart-/, "")
                .split("-")[0];
              if (nodeId) {
                (node as HTMLElement).style.cursor = "pointer";
                node.addEventListener("click", (e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onNodeClick(nodeId);
                });
              }
            });
          }
        }
      } catch (error) {
        console.error("Mermaid rendering error:", error);
        if (container) {
          container.innerHTML = `<div class="text-red-600 p-4">Error rendering diagram: ${error}</div>`;
        }
      }
    };

    renderChart();
  }, [chart, onNodeClick]);

  useEffect(() => {
    const surface = zoomSurfaceRef.current;
    if (!surface) return;

    const preventBrowserZoom = (event: WheelEvent) => {
      if (event.ctrlKey) {
        event.preventDefault();
      }
    };

    const options: AddEventListenerOptions & EventListenerOptions = {
      passive: false,
      capture: true,
    };

    surface.addEventListener("wheel", preventBrowserZoom, options);
    return () => {
      surface.removeEventListener("wheel", preventBrowserZoom, options);
    };
  }, []);

  return (
    <div className="relative w-full h-full bg-gray-50 overflow-hidden">
      <div
        ref={zoomSurfaceRef}
        className="w-full h-full"
        data-testid="diagram-zoom-surface"
      >
        <PrismaZoom
          ref={prismaZoomRef}
          className="w-full h-full"
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          scrollVelocity={0.1}
          animDuration={0.1}
          decelerationDuration={0}
          allowWheel
          ignoredMouseButtons={[2]}
          allowPan
          allowZoom
        >
          <div
            ref={containerRef}
            className="inline-block p-4"
            data-testid="diagram-zoom-content"
          />
        </PrismaZoom>
      </div>
      <button
        type="button"
        onClick={handleResetView}
        className="absolute top-4 right-4 inline-flex items-center rounded-md border border-gray-300 bg-white/90 px-3 py-1 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 active:scale-95 cursor-pointer"
        title="Reset zoom and pan"
        data-testid="diagram-reset-view"
      >
        Reset View
      </button>
    </div>
  );
}
