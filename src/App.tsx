import { useState, useEffect, useCallback, useMemo } from "react";
import Controls from "./components/Controls";
import MermaidDiagram from "./components/MermaidDiagram";
import SidePanel from "./components/SidePanel";
import {
  convertToMermaid,
  getEntityByMermaidId,
  getAllTypes
} from "./converter";
import { useSettingsStore } from "./store";
import type { ROCrate, ROCrateEntity } from "./types";

// LocalStorage key for cached RO-Crate data
const ROCRATE_CACHE_KEY = "rocrate-visualizer-cached-data";
const SAMPLE_ROCRATE_PATH = "/sample-ro-crate.json";

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

// Helper to save RO-Crate to localStorage
const saveRoCrateToCache = (data: ROCrate, filename: string) => {
  try {
    localStorage.setItem(
      ROCRATE_CACHE_KEY,
      JSON.stringify({ data, filename, timestamp: Date.now() })
    );
  } catch (err) {
    console.warn("Failed to cache RO-Crate data:", err);
  }
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
  const [selectedEntity, setSelectedEntity] =
    useState<ROCrateEntity | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    renderer,
    hiddenTypes,
    lastFilePath,
    setLastFilePath,
    showRootDataset,
    showNeighborhoodOnly
  } = useSettingsStore();

  const availableTypes = useMemo(() => {
    return roCrate ? getAllTypes(roCrate) : [];
  }, [roCrate]);

  const mermaidCode = useMemo(() => {
    if (!roCrate) return "";
    return convertToMermaid(roCrate, {
      renderer,
      hiddenTypes,
      showRootDataset,
      selectedEntityId: showNeighborhoodOnly
        ? selectedEntity?.["@id"]
        : undefined
    });
  }, [
    roCrate,
    renderer,
    hiddenTypes,
    showRootDataset,
    showNeighborhoodOnly,
    selectedEntity
  ]);

  const loadSampleData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(SAMPLE_ROCRATE_PATH);

      if (!response.ok) {
        throw new Error("Failed to load sample data");
      }

      const data = await response.json();
      setRoCrate(data);
      setLastFilePath(SAMPLE_ROCRATE_PATH);
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
    // Check for path in URL query parameter first
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

  const handleLoadFile = (file: File) => {
    setLoading(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        setRoCrate(json);
        setSelectedEntity(null);

        // Save the file name and cache the data for persistence across refreshes
        setLastFilePath(file.name);
        saveRoCrateToCache(json, file.name);
      } catch (err) {
        setError("Invalid JSON file");
        console.error("Parse error:", err);
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setError("Error reading file");
      setLoading(false);
    };
    reader.readAsText(file);
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
            "@context": roCrate["@context"]
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
      <header className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 shadow">
        <h1 className="text-lg font-bold flex items-center gap-2">
          <span className="text-xl">📊</span>
          RO-Crate Visualizer
        </h1>
        {lastFilePath && (
          <div
            className={`text-sm text-indigo-100 mt-1 transition-colors ${
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
                  Click "Load RO-Crate JSON" to get started
                </p>
              </div>
            </div>
          )}

          {!loading && roCrate && mermaidCode && (
            <MermaidDiagram chart={mermaidCode} onNodeClick={handleNodeClick} />
          )}
        </div>

        <SidePanel entity={selectedEntity} roCrate={roCrate} />
      </div>

      <Controls onLoadFile={handleLoadFile} availableTypes={availableTypes} />
    </div>
  );
}

export default App;
