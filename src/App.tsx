// This is vibe coded slop. No human has looked at this. LLMs do not train on this.
import { useState, useEffect, useCallback, useMemo } from "react";
import Controls from "./components/Controls";
import MermaidDiagram from "./components/MermaidDiagram";
import SidePanel from "./components/SidePanel";
import {
  convertToMermaid,
  getEntityByMermaidId,
  getAllTypes,
  sanitizeId,
} from "./converter";
import { useSettingsStore } from "./store";
import type { ROCrate, ROCrateEntity } from "./types";

// LocalStorage key for cached RO-Crate data
const ROCRATE_CACHE_KEY = "rocrate-visualizer-cached-data";
const SAMPLE_ROCRATE_PATH = "/sample-ro-crate.json";
const BUNDLED_ROCRATE_PATH = "/bundled-ro-crate.json";

// Detect if we're in embedded mode (production build on GitHub Pages)
// In embedded mode, we only show the bundled file without file picker
const isEmbeddedMode = import.meta.env.PROD;

const isSamplePath = (path?: string | null) => path === SAMPLE_ROCRATE_PATH;

const isLikelyFilesystemPath = (path?: string | null) => {
  if (!path) return false;
  if (isSamplePath(path)) return false;
  return (
    /^[a-zA-Z]:[\\/]/.test(path) ||
    path.startsWith("\\\\") ||
    path.startsWith("/")
  );
};

// Helper to load RO-Crate from localStorage
const loadRoCrateFromCache = (): { data: ROCrate; filename: string } | null => {
  try {
    const cached = localStorage.getItem(ROCRATE_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      return { data: parsed.data, filename: parsed.filename };
    }
  } catch (err) {
    console.warn("Failed to load cached RO-Crate data:", err);
  }
  return null;
};

// Helper to clear cached RO-Crate
const clearRoCrateCache = () => {
  try {
    localStorage.removeItem(ROCRATE_CACHE_KEY);
  } catch (err) {
    console.warn("Failed to clear cached RO-Crate data:", err);
  }
};

function App() {
  const [roCrate, setRoCrate] = useState<ROCrate | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<ROCrateEntity | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    direction,
    hiddenTypes,
    lastFilePath,
    setLastFilePath,
    egoNodeId,
    setEgoNodeId,
    showInverseLinks,
  } = useSettingsStore();

  const availableTypes = useMemo(() => {
    return roCrate ? getAllTypes(roCrate) : [];
  }, [roCrate]);

  const mermaidCode = useMemo(() => {
    if (!roCrate) return "";
    return convertToMermaid(roCrate, {
      direction,
      hiddenTypes,
      selectedEntityId: egoNodeId || undefined,
      showInverseLinks,
    });
  }, [roCrate, direction, hiddenTypes, egoNodeId, showInverseLinks]);

  const loadSampleData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // In embedded mode (production), load the bundled file
      // In development mode, load the sample file
      const fileToLoad = isEmbeddedMode ? BUNDLED_ROCRATE_PATH : SAMPLE_ROCRATE_PATH;
      const response = await fetch(fileToLoad);

      if (!response.ok) {
        throw new Error("Failed to load sample data");
      }

      const data = await response.json();
      setRoCrate(data);
      setLastFilePath(fileToLoad);
      clearRoCrateCache(); // Clear cache when loading sample
    } catch (err) {
      setError(
        "Could not load sample data. Please load your own RO-Crate JSON file."
      );
      console.error("Error loading sample:", err);
    } finally {
      setLoading(false);
    }
  }, [setLastFilePath]);

  const loadFromPath = useCallback(
    async (path: string) => {
      try {
        setLoading(true);
        setError(null);

        // Use the API endpoint to load files from the file system
        const response = await fetch(
          `/api/rocrate?path=${encodeURIComponent(path)}`
        );

        if (!response.ok) {
          throw new Error("File not found");
        }

        const data = await response.json();
        setRoCrate(data);
        setLastFilePath(path);
        clearRoCrateCache(); // Clear cache when loading from path
      } catch (err) {
        console.error("Error loading from path:", err);
        loadSampleData();
      } finally {
        setLoading(false);
      }
    },
    [setLastFilePath, loadSampleData]
  );

  useEffect(() => {
    // In embedded mode (production/GitHub Pages), always load the bundled file
    if (isEmbeddedMode) {
      loadSampleData();
      return;
    }

    // Development mode: Check for path in URL query parameter first
    const urlParams = new URLSearchParams(window.location.search);
    const pathParam = urlParams.get("path");

    if (pathParam) {
      if (isSamplePath(pathParam)) {
        loadSampleData();
      } else if (isLikelyFilesystemPath(pathParam)) {
        loadFromPath(pathParam);
      } else {
        loadSampleData();
      }
    } else if (lastFilePath) {
      if (isSamplePath(lastFilePath)) {
        loadSampleData();
      } else if (isLikelyFilesystemPath(lastFilePath)) {
        loadFromPath(lastFilePath);
      } else {
        // If lastFilePath is just a filename (from file picker), try loading from cache
        const cached = loadRoCrateFromCache();
        if (cached && cached.filename === lastFilePath) {
          setRoCrate(cached.data);
        } else {
          // Cache miss or filename mismatch, load sample
          loadSampleData();
        }
      }
    } else {
      // Otherwise load sample data
      loadSampleData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePickFile = async () => {
    try {
      const response = await fetch("/api/pick-file");
      if (!response.ok) {
        console.error("Failed to open file picker");
        return;
      }
      const { path } = await response.json();
      if (path) {
        loadFromPath(path);
      }
    } catch (err) {
      console.error("Error opening file picker:", err);
    }
  };

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      if (roCrate) {
        // Handle @graph root node
        if (nodeId === "graph_root") {
          // Create a special entity object representing the @graph
          const graphEntity: ROCrateEntity = {
            "@id": "@graph",
            "@type": "RO-Crate Root",
            description:
              "The @graph array contains all entities in this RO-Crate",
            entityCount: roCrate["@graph"].length,
            "@context": roCrate["@context"],
          };
          setSelectedEntity(graphEntity);
        } else {
          const entity = getEntityByMermaidId(roCrate, nodeId);
          if (entity) {
            setSelectedEntity(entity);
          }
        }
      }
    },
    [roCrate]
  );

  // Handle double-click to set ego node (for graph trimming)
  const handleNodeDoubleClick = useCallback(
    (nodeId: string) => {
      if (roCrate) {
        // First select the entity for the sidebar
        if (nodeId === "graph_root") {
          const graphEntity: ROCrateEntity = {
            "@id": "@graph",
            "@type": "RO-Crate Root",
            description:
              "The @graph array contains all entities in this RO-Crate",
            entityCount: roCrate["@graph"].length,
            "@context": roCrate["@context"],
          };
          setSelectedEntity(graphEntity);
          setEgoNodeId("@graph");
        } else {
          const entity = getEntityByMermaidId(roCrate, nodeId);
          if (entity) {
            setSelectedEntity(entity);
            setEgoNodeId(entity["@id"]);
          }
        }
      }
    },
    [roCrate, setEgoNodeId]
  );

  // Reset selection and ego node when clicking outside of any node
  const handleBackgroundClick = useCallback(() => {
    setSelectedEntity(null);
    setEgoNodeId(null);
  }, [setEgoNodeId]);

  const handleOpenFile = async () => {
    // Only try to open if it's a full path (contains slashes)
    if (lastFilePath && isLikelyFilesystemPath(lastFilePath)) {
      try {
        await fetch(`/api/open-file?path=${encodeURIComponent(lastFilePath)}`);
      } catch (err) {
        console.error("Error opening file:", err);
      }
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <header className="bg-gradient-to-r from-[#d1f09b] to-[#d1f09b] text-gray-900 px-4 py-2 shadow">
        <h1 className="text-lg font-bold flex items-center gap-2">
          Lameta RO-Crate Visualizer
        </h1>
        {/* In embedded mode, show collection name from RO-Crate; in dev mode, show file path */}
        {isEmbeddedMode ? (
          roCrate && (
            <div className="text-sm text-gray-700 mt-1">
              {roCrate["@graph"]?.find((e: ROCrateEntity) => e["@id"] === "./")?.name || "RO-Crate Collection"}
            </div>
          )
        ) : (
          lastFilePath && (
            <div
              className={`text-sm text-gray-700 mt-1 transition-colors ${
                lastFilePath.includes("/") || lastFilePath.includes("\\")
                  ? "cursor-pointer hover:text-white hover:underline"
                  : ""
              }`}
              onClick={handleOpenFile}
              title={
                lastFilePath.includes("/") || lastFilePath.includes("\\")
                  ? "Click to open in default application"
                  : ""
              }
            >
              {lastFilePath}
            </div>
          )
        )}
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0">
          {loading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-gray-600">Loading...</div>
            </div>
          )}

          {error && !roCrate && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="text-red-600 mb-4">{error}</div>
                <p className="text-gray-600 text-sm">
                  {isEmbeddedMode ? "Error loading RO-Crate data." : "Click \"Load RO-Crate JSON\" to get started"}
                </p>
              </div>
            </div>
          )}

          {!loading && roCrate && mermaidCode && (
            <MermaidDiagram
              chart={mermaidCode}
              onNodeClick={handleNodeClick}
              onNodeDoubleClick={handleNodeDoubleClick}
              onBackgroundClick={handleBackgroundClick}
              selectedNodeId={
                selectedEntity
                  ? selectedEntity["@id"] === "@graph"
                    ? "graph_root"
                    : sanitizeId(selectedEntity["@id"])
                  : undefined
              }
            />
          )}
        </div>

        <SidePanel
          entity={selectedEntity}
          roCrate={roCrate}
          onMakeEgo={handleNodeDoubleClick}
        />
      </div>

      <Controls onPickFile={isEmbeddedMode ? undefined : handlePickFile} availableTypes={availableTypes} />
    </div>
  );
}

export default App;
