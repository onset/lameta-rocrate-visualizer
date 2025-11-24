import { useRef, useState, useEffect } from "react";
import { useSettingsStore } from "../store";

interface ControlsProps {
  onLoadFile: (file: File) => void;
  availableTypes: string[];
}

export default function Controls({
  onLoadFile,
  availableTypes
}: ControlsProps) {
  const {
    renderer,
    setRenderer,
    isTypeVisible,
    toggleType,
    showRootDataset,
    toggleRootDataset,
    showNeighborhoodOnly,
    toggleNeighborhoodOnly
  } = useSettingsStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onLoadFile(file);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowTypeDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const visibleCount = availableTypes.filter(isTypeVisible).length;

  return (
    <footer className="bg-white border-t border-gray-200 px-4 py-2 flex items-center gap-4 flex-wrap text-sm">
      <button
        onClick={() => fileInputRef.current?.click()}
        className="px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors font-medium"
      >
        Load File
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="flex items-center gap-2">
        <label className="text-gray-600">Renderer:</label>
        <select
          value={renderer}
          onChange={(e) => setRenderer(e.target.value as "default" | "elk")}
          className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="default">Default</option>
          <option value="elk">ELK</option>
        </select>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={showRootDataset}
          onChange={toggleRootDataset}
          className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
        />
        <span className="text-gray-700">Show Root Dataset</span>
      </label>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={showNeighborhoodOnly}
          onChange={toggleNeighborhoodOnly}
          className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
        />
        <span className="text-gray-700">Show Neighborhood Only</span>
      </label>

      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowTypeDropdown(!showTypeDropdown)}
          className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          <span className="text-gray-700">
            Entity Types ({visibleCount}/{availableTypes.length})
          </span>
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {showTypeDropdown && availableTypes.length > 0 && (
          <div className="absolute bottom-full left-0 mb-1 bg-white border border-gray-200 rounded shadow-lg z-50 min-w-[200px] max-h-64 overflow-y-auto">
            <div className="p-2 border-b border-gray-100">
              <button
                onClick={() => {
                  availableTypes.forEach((type) => {
                    if (!isTypeVisible(type)) toggleType(type);
                  });
                }}
                className="text-xs text-indigo-600 hover:text-indigo-700 mr-2"
              >
                Show All
              </button>
              <button
                onClick={() => {
                  availableTypes.forEach((type) => {
                    if (isTypeVisible(type)) toggleType(type);
                  });
                }}
                className="text-xs text-gray-600 hover:text-gray-700"
              >
                Hide All
              </button>
            </div>
            {availableTypes.map((type) => (
              <label
                key={type}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={isTypeVisible(type)}
                  onChange={() => toggleType(type)}
                  className="w-3.5 h-3.5 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">{type}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </footer>
  );
}
