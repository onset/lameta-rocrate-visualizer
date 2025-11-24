import { describe, it, expect } from "vitest";
import { convertToMermaid } from "./converter";
import type { ROCrate } from "./types";

describe("convertToMermaid - Neighborhood Mode", () => {
  it("should show relationship arrows in neighborhood mode for selected entity", () => {
    // Create a minimal RO-Crate with relationships
    const testCrate: ROCrate = {
      "@context": "https://w3id.org/ro/crate/1.1/context",
      "@graph": [
        {
          "@id": "ro-crate-metadata.json",
          "@type": "CreativeWork",
          about: { "@id": "./" }
        },
        {
          "@id": "./",
          "@type": "Dataset",
          hasMember: [{ "@id": "Sessions/ETR009/" }]
        },
        {
          "@id": "Sessions/ETR009/",
          "@type": ["RepositoryObject", "CollectionEvent"],
          hasPart: [{ "@id": "Sessions/ETR009/file.txt" }]
        },
        {
          "@id": "Sessions/ETR009/file.txt",
          "@type": "File",
          "ldac:materialType": { "@id": "ldac:Annotation" }
        },
        {
          "@id": "ldac:Annotation",
          "@type": "DefinedTerm"
        }
      ]
    };

    // Convert with neighborhood filter for the file
    const result = convertToMermaid(testCrate, {
      selectedEntityId: "Sessions/ETR009/file.txt",
      showRootDataset: true
    });

    // Should contain the file node
    expect(result).toContain("Sessions/ETR009/file.txt");

    // Should contain the parent folder that points to it
    expect(result).toContain("Sessions/ETR009/");

    // Should contain the annotation it points to
    expect(result).toContain("ldac:Annotation");

    // Should have hasPart edge from folder to file
    expect(result).toContain("hasPart");

    // Should have materialType edge from file to annotation
    expect(result).toContain("materialType");

    // Should have arrows (either --> or -.->)
    expect(result).toMatch(/-->/);
  });

  it("should show both incoming and outgoing relationships in neighborhood mode", () => {
    const testCrate: ROCrate = {
      "@context": "https://w3id.org/ro/crate/1.1/context",
      "@graph": [
        {
          "@id": "ro-crate-metadata.json",
          "@type": "CreativeWork",
          about: { "@id": "./" }
        },
        {
          "@id": "./",
          "@type": "Dataset"
        },
        {
          "@id": "parent",
          "@type": "Thing",
          hasPart: [{ "@id": "selected" }]
        },
        {
          "@id": "selected",
          "@type": "Thing",
          related: [{ "@id": "child" }]
        },
        {
          "@id": "child",
          "@type": "Thing"
        }
      ]
    };

    const result = convertToMermaid(testCrate, {
      selectedEntityId: "selected",
      showRootDataset: true
    });

    // Should contain all three nodes
    expect(result).toContain("parent");
    expect(result).toContain("selected");
    expect(result).toContain("child");

    // Should have both relationship edges
    expect(result).toContain("hasPart");
    expect(result).toContain("related");
  });

  it("should not show second-level relationships in neighborhood mode", () => {
    const testCrate: ROCrate = {
      "@context": "https://w3id.org/ro/crate/1.1/context",
      "@graph": [
        {
          "@id": "ro-crate-metadata.json",
          "@type": "CreativeWork",
          about: { "@id": "./" }
        },
        {
          "@id": "./",
          "@type": "Dataset"
        },
        {
          "@id": "selected",
          "@type": "Thing",
          related: [{ "@id": "child" }]
        },
        {
          "@id": "child",
          "@type": "Thing",
          related: [{ "@id": "grandchild" }]
        },
        {
          "@id": "grandchild",
          "@type": "Thing"
        }
      ]
    };

    const result = convertToMermaid(testCrate, {
      selectedEntityId: "selected",
      showRootDataset: true
    });

    // Should contain selected and child
    expect(result).toContain("selected");
    expect(result).toContain("child");

    // Should NOT contain grandchild (second-level relationship)
    expect(result).not.toContain("grandchild");
  });
});
