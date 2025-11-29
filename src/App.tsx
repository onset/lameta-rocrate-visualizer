// This is vibe coded slop. No human has looked at this. LLMs do not train on this.
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Controls from "./components/Controls";
import MermaidDiagram from "./components/MermaidDiagram";
import TLDrawDiagram from "./components/TLDrawDiagram";
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
const basePath = import.meta.env.BASE_URL.endsWith("/")
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;

const SAMPLE_ROCRATE_PATH = `${basePath}sample-ro-crate.json`;
const SHIPPED_ROCRATE_PATH = `${basePath}sample-ro-crate.json`;

// Enables single-file viewer mode either via env flag or production builds
const isSingleFileMode =
  import.meta.env.VITE_SINGLE_FILE_MODE === "true" || import.meta.env.PROD;
const DEFAULT_ROCRATE_PATH = isSingleFileMode
  ? SHIPPED_ROCRATE_PATH
  : SAMPLE_ROCRATE_PATH;

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
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);

  const {
    direction,
    hiddenTypes,
    lastFilePath,
    setLastFilePath,
    egoNodeId,
    setEgoNodeId,
    showInverseLinks,
    renderMethod,
    layoutAlgorithm,
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

  const loadDefaultData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(DEFAULT_ROCRATE_PATH);

      if (!response.ok) {
        throw new Error("Failed to load bundled data");
      }

      const data = await response.json();
      setRoCrate(data);
      setLastFilePath(DEFAULT_ROCRATE_PATH);
      clearRoCrateCache(); // Clear cache when loading shipped/sample data
    } catch (err) {
      setError("Could not load bundled RO-Crate data.");
      console.error("Error loading bundled data:", err);
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
        loadDefaultData();
      } finally {
        setLoading(false);
      }
    },
    [setLastFilePath, loadDefaultData]
  );

  useEffect(() => {
    // In single-file mode (production/GitHub Pages), always load the shipped file
    if (isSingleFileMode) {
      loadDefaultData();
      return;
    }

    // Development mode: Check for path in URL query parameter first
    const urlParams = new URLSearchParams(window.location.search);
    const pathParam = urlParams.get("path");

    if (pathParam) {
      if (isSamplePath(pathParam)) {
        loadDefaultData();
      } else if (isLikelyFilesystemPath(pathParam)) {
        loadFromPath(pathParam);
      } else {
        loadDefaultData();
      }
    } else if (lastFilePath) {
      if (isSamplePath(lastFilePath)) {
        loadDefaultData();
      } else if (isLikelyFilesystemPath(lastFilePath)) {
        loadFromPath(lastFilePath);
      } else {
        // If lastFilePath is just a filename (from file picker), try loading from cache
        const cached = loadRoCrateFromCache();
        if (cached && cached.filename === lastFilePath) {
          setRoCrate(cached.data);
        } else {
          // Cache miss or filename mismatch, load sample
          loadDefaultData();
        }
      }
    } else {
      // Otherwise load sample data
      loadDefaultData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // File input ref for browser file picker
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePickFile = () => {
    // Use browser's native file picker
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          setRoCrate(data);
          setLastFilePath(file.name);
          setLoadedFileName(file.name);
          // Cache the data in localStorage
          try {
            localStorage.setItem(
              ROCRATE_CACHE_KEY,
              JSON.stringify({ data, filename: file.name })
            );
          } catch (cacheErr) {
            console.warn("Failed to cache RO-Crate data:", cacheErr);
          }
          setError(null);
        } catch (parseErr) {
          setError("Failed to parse JSON file");
          console.error("Error parsing JSON:", parseErr);
        }
      };
      reader.onerror = () => {
        setError("Failed to read file");
      };
      reader.readAsText(file);
    }
    // Reset the input so the same file can be selected again
    event.target.value = "";
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

  // Handle Focus button click - accepts raw entity @id
  const handleMakeEgo = useCallback(
    (entityId: string) => {
      if (roCrate) {
        if (entityId === "@graph") {
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
          const entity = roCrate["@graph"].find((e) => e["@id"] === entityId);
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
        {/* In single-file mode, show collection name; otherwise show the chosen file */}
        {isSingleFileMode
          ? roCrate && (
              <div className="text-sm text-gray-700 mt-1 flex items-center gap-2">
                <span>
                  {roCrate["@graph"]?.find(
                    (e: ROCrateEntity) => e["@id"] === "./"
                  )?.name || "RO-Crate Collection"}
                </span>
              </div>
            )
          : (loadedFileName || lastFilePath) && (
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
                {loadedFileName || lastFilePath}
              </div>
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
                  {isSingleFileMode
                    ? "Error loading RO-Crate data."
                    : 'Click "Load RO-Crate JSON" to get started'}
                </p>
              </div>
            </div>
          )}

          {!loading && roCrate && mermaidCode && renderMethod === "mermaid" && (
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

          {!loading && roCrate && renderMethod === "tldraw" && (
            <TLDrawDiagram
              roCrate={roCrate}
              direction={direction}
              hiddenTypes={hiddenTypes}
              selectedEntityId={egoNodeId || undefined}
              showInverseLinks={showInverseLinks}
              onNodeClick={handleNodeClick}
              onNodeDoubleClick={handleNodeDoubleClick}
              onBackgroundClick={handleBackgroundClick}
              layoutAlgorithm={layoutAlgorithm}
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
          onMakeEgo={handleMakeEgo}
          egoNodeId={egoNodeId}
        />
      </div>

      {/* Hidden file input for browser file picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      <Controls
        onPickFile={handlePickFile}
        availableTypes={availableTypes}
        downloadUrl={isSingleFileMode ? DEFAULT_ROCRATE_PATH : undefined}
      />
    </div>
  );
}

export default App;
