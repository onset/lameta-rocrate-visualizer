import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { ROCrateEntity, ROCrate } from "../types";

interface SidePanelProps {
  entity: ROCrateEntity | null;
  roCrate: ROCrate | null;
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

export default function SidePanel({ entity, roCrate }: SidePanelProps) {
  const references =
    entity && roCrate ? findReferences(roCrate, entity["@id"]) : [];

  return (
    <div className="w-96 bg-white border-l border-gray-200 flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Entity Details</h2>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {entity ? (
          <>
            {references.length > 0 && (
              <div className="mb-4 pb-4 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">
                  Referenced By
                </h3>
                <div className="space-y-2">
                  {references.map((ref, idx) => (
                    <div key={idx} className="text-xs bg-gray-50 p-2 rounded">
                      <div
                        className="font-mono text-indigo-600 truncate"
                        title={ref.entity["@id"]}
                      >
                        {ref.entity["@id"]}
                      </div>
                      <div className="text-gray-600 mt-1">
                        via{" "}
                        <span className="font-semibold">{ref.property}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <SyntaxHighlighter
              language="json"
              style={vscDarkPlus}
              customStyle={{
                fontSize: "12px",
                margin: 0,
                borderRadius: "0.375rem"
              }}
              wrapLongLines={true}
            >
              {JSON.stringify(entity, null, 2)}
            </SyntaxHighlighter>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 text-center p-4">
            <p>Click on a node in the diagram to view its details</p>
          </div>
        )}
      </div>
    </div>
  );
}
