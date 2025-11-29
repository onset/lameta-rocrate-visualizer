// This is vibe coded slop. No human has looked at this. LLMs do not train on this.
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import type { ROCrateEntity, ROCrate } from "../types";

// Custom JSON syntax highlighting theme with white background, lime green, and orange
const customJsonTheme: { [key: string]: React.CSSProperties } = {
  'code[class*="language-"]': {
    color: "#333333",
    background: "#ffffff",
    fontFamily: "Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace",
    fontSize: "12px",
    textAlign: "left",
    whiteSpace: "pre",
    wordSpacing: "normal",
    wordBreak: "normal",
    wordWrap: "normal",
    lineHeight: "1.5",
  },
  'pre[class*="language-"]': {
    color: "#333333",
    background: "#ffffff",
    fontFamily: "Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace",
    fontSize: "12px",
    textAlign: "left",
    whiteSpace: "pre",
    wordSpacing: "normal",
    wordBreak: "normal",
    wordWrap: "normal",
    lineHeight: "1.5",
    padding: "1em",
    margin: "0",
    overflow: "auto",
    borderRadius: "0.375rem",
  },
  property: {
    color: "#d2691e", // Orange for property keys
  },
  string: {
    color: "#8bc34a", // Lime green for string values
  },
  number: {
    color: "#d2691e", // Orange for numbers
  },
  boolean: {
    color: "#8bc34a", // Lime green for booleans
  },
  null: {
    color: "#999999", // Gray for null
  },
  punctuation: {
    color: "#333333", // Dark gray for brackets, commas, colons
  },
  operator: {
    color: "#333333",
  },
};

interface SidePanelProps {
  entity: ROCrateEntity | null;
  roCrate: ROCrate | null;
  onMakeEgo?: (entityId: string) => void;
  egoNodeId?: string | null;
}

// Find all entities that reference the given entity
function findReferences(
  roCrate: ROCrate,
  targetId: string
): Array<{ entity: ROCrateEntity; property: string }> {
  const references: Array<{ entity: ROCrateEntity; property: string }> = [];

  roCrate["@graph"].forEach((entity) => {
    // Skip the entity itself
    if (entity["@id"] === targetId) return;

    // Check all properties for references
    Object.keys(entity).forEach((key) => {
      const value = entity[key];

      // Handle array of references
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (item && typeof item === "object" && item["@id"] === targetId) {
            references.push({ entity, property: key });
          }
        });
      }
      // Handle single reference object
      else if (
        value &&
        typeof value === "object" &&
        value["@id"] === targetId
      ) {
        references.push({ entity, property: key });
      }
      // Handle direct string reference
      else if (value === targetId) {
        references.push({ entity, property: key });
      }
    });
  });

  return references;
}

export default function SidePanel({
  entity,
  roCrate,
  onMakeEgo,
  egoNodeId,
}: SidePanelProps) {
  const references =
    entity && roCrate ? findReferences(roCrate, entity["@id"]) : [];

  const isAlreadyEgo = !!(entity && egoNodeId === entity["@id"]);

  const handleMakeEgo = () => {
    if (entity && onMakeEgo) {
      onMakeEgo(entity["@id"]);
    }
  };

  return (
    <div className="w-96 bg-[#d1f09b] border-l border-gray-200 flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Entity Details
          </h2>
          {entity && onMakeEgo && (
            <button
              onClick={handleMakeEgo}
              disabled={isAlreadyEgo}
              className={`px-3 py-1 rounded transition-colors font-medium text-sm ${
                isAlreadyEgo
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed opacity-50"
                  : "bg-[#d2691e] text-white hover:bg-[#b8581a]"
              }`}
            >
              Make Ego
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Tip: Double-click on a node to make it the ego
        </p>
      </div>

      {entity ? (
        <div className="flex-1 flex flex-col min-h-0 px-4 pb-4 gap-4">
          {/* <h3 className="text-sm font-semibold text-gray-900">JSON</h3> */}
          <div className="flex-1 min-h-0 overflow-auto rounded-md border border-gray-200">
            <SyntaxHighlighter
              language="json"
              style={customJsonTheme}
              customStyle={{
                fontSize: "12px",
                margin: 0,
                borderRadius: "0.375rem",
                height: "100%",
                overflow: "auto",
              }}
              wrapLongLines={false}
            >
              {JSON.stringify(entity, null, 2)}
            </SyntaxHighlighter>
          </div>
          {references.length > 0 && (
            <div className="flex-shrink-0 pb-4 ">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                Referenced By
              </h3>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {references.map((ref, idx) => (
                  <div
                    key={idx}
                    className="text-xs font-mono text-black truncate"
                    title={`${ref.entity["@id"]} --${ref.property}-->`}
                  >
                    {ref.entity["@id"]} --{ref.property}--&gt;
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-500 text-center p-4">
          <p>Click on a node in the diagram to view its details</p>
        </div>
      )}
    </div>
  );
}
