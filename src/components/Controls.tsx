// This is vibe coded slop. No human has looked at this. LLMs do not train on this.
import { useRef, useState, useEffect } from "react";
import { useSettingsStore } from "../store";
import { notifyDropdownClosed } from "./MermaidDiagram";

interface ControlsProps {
  onPickFile?: () => void;
  availableTypes: string[];
  downloadUrl?: string;
}

export default function Controls({
  onPickFile,
  availableTypes,
  downloadUrl,
}: ControlsProps) {
  const {
    direction,
    setDirection,
    isTypeVisible,
    toggleType,
    showInverseLinks,
    setShowInverseLinks,
  } = useSettingsStore();
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showDirectionDropdown, setShowDirectionDropdown] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const directionDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        if (showTypeDropdown) {
          notifyDropdownClosed();
        }
        setShowTypeDropdown(false);
      }
      if (
        directionDropdownRef.current &&
        !directionDropdownRef.current.contains(event.target as Node)
      ) {
        if (showDirectionDropdown) {
          notifyDropdownClosed();
        }
        setShowDirectionDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showTypeDropdown, showDirectionDropdown]);

  const visibleCount = availableTypes.filter(isTypeVisible).length;

  return (
    <>
      <footer className="bg-[#d1f09b] border-t border-gray-200 px-4 py-2 flex items-center gap-4 flex-wrap text-sm">
        {onPickFile && (
          <button
            onClick={onPickFile}
            className="px-3 py-1.5 bg-[#d2691e] text-white rounded hover:bg-[#b8581a] transition-colors font-medium"
          >
            Load RO-Crate JSON
          </button>
        )}

        <div className="relative" ref={directionDropdownRef}>
          <button
            onClick={() => setShowDirectionDropdown(!showDirectionDropdown)}
            className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <span className="text-gray-700">
              Direction:{" "}
              {direction === "LR" ? "Left to Right" : "Top to Bottom"}
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

          {showDirectionDropdown && (
            <div className="absolute bottom-full left-0 mb-1 bg-white border border-gray-200 rounded shadow-lg z-50 min-w-[200px]">
              <label
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer"
                onClick={() => {
                  setDirection("LR");
                  setShowDirectionDropdown(false);
                }}
              >
                <input
                  type="radio"
                  checked={direction === "LR"}
                  onChange={() => {}}
                  className="w-3.5 h-3.5 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">Left to Right</span>
              </label>
              <label
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer"
                onClick={() => {
                  setDirection("TB");
                  setShowDirectionDropdown(false);
                }}
              >
                <input
                  type="radio"
                  checked={direction === "TB"}
                  onChange={() => {}}
                  className="w-3.5 h-3.5 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">Top to Bottom</span>
              </label>
            </div>
          )}
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showInverseLinks}
            onChange={(e) => setShowInverseLinks(e.target.checked)}
            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
          />
          <span className="text-gray-700">Show inverse links</span>
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

        <div className="ml-auto flex items-center gap-2">
          {downloadUrl && (
            <a
              href={downloadUrl}
              download
              className="px-3 py-1.5 bg-white border border-[#8bc34a] text-[#4b6f1a] rounded hover:bg-[#f4ffe3] transition-colors font-medium"
            >
              Download JSON
            </a>
          )}
          <button
            onClick={() => setShowHelpModal(true)}
            className="px-3 py-1.5 bg-[#8bc34a] text-white rounded hover:bg-[#7cb342] transition-colors flex items-center gap-1"
            title="Help"
          >
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
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>Help</span>
          </button>
        </div>
      </footer>

      {showHelpModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowHelpModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Quick Help</h2>
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Zoom</h3>
                <p className="text-gray-600">
                  Use mouse wheel or trackpad pinch
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Pan</h3>
                <p className="text-gray-600">Click and drag the diagram</p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-1">
                  See JSON of a node
                </h3>
                <p className="text-gray-600">
                  Click on any node to view its details in the right sidebar
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-1">
                  Trim graph to focus on a node
                </h3>
                <p className="text-gray-600">
                  Double-click on a node to show only its neighborhood. Click
                  the background or Reset View to restore the full graph.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
