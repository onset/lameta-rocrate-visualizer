// This is vibe coded slop. No human has looked at this. LLMs do not train on this.
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
          about: { "@id": "./" },
        },
        {
          "@id": "./",
          "@type": "Dataset",
          hasMember: [{ "@id": "Sessions/ETR009/" }],
        },
        {
          "@id": "Sessions/ETR009/",
          "@type": ["RepositoryObject", "CollectionEvent"],
          hasPart: [{ "@id": "Sessions/ETR009/file.txt" }],
        },
        {
          "@id": "Sessions/ETR009/file.txt",
          "@type": "File",
          "ldac:materialType": { "@id": "ldac:Annotation" },
        },
        {
          "@id": "ldac:Annotation",
          "@type": "DefinedTerm",
        },
      ],
    };

    // Convert with neighborhood filter for the file
    const result = convertToMermaid(testCrate, {
      selectedEntityId: "Sessions/ETR009/file.txt",
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
          about: { "@id": "./" },
        },
        {
          "@id": "./",
          "@type": "Dataset",
        },
        {
          "@id": "parent",
          "@type": "Thing",
          hasPart: [{ "@id": "selected" }],
        },
        {
          "@id": "selected",
          "@type": "Thing",
          related: [{ "@id": "child" }],
        },
        {
          "@id": "child",
          "@type": "Thing",
        },
      ],
    };

    const result = convertToMermaid(testCrate, {
      selectedEntityId: "selected",
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
          about: { "@id": "./" },
        },
        {
          "@id": "./",
          "@type": "Dataset",
        },
        {
          "@id": "selected",
          "@type": "Thing",
          related: [{ "@id": "child" }],
        },
        {
          "@id": "child",
          "@type": "Thing",
          related: [{ "@id": "grandchild" }],
        },
        {
          "@id": "grandchild",
          "@type": "Thing",
        },
      ],
    };

    const result = convertToMermaid(testCrate, {
      selectedEntityId: "selected",
    });

    // Should contain selected and child
    expect(result).toContain("selected");
    expect(result).toContain("child");

    // Should NOT contain grandchild (second-level relationship)
    expect(result).not.toContain("grandchild");
  });

  it("should show the full path from root to selected entity in neighborhood mode", () => {
    const testCrate: ROCrate = {
      "@context": "https://w3id.org/ro/crate/1.1/context",
      "@graph": [
        {
          "@id": "ro-crate-metadata.json",
          "@type": "CreativeWork",
          about: { "@id": "./" },
        },
        {
          "@id": "./",
          "@type": "Dataset",
          hasPart: [{ "@id": "level1" }],
        },
        {
          "@id": "level1",
          "@type": "RepositoryObject",
          hasPart: [{ "@id": "level2" }],
        },
        {
          "@id": "level2",
          "@type": "RepositoryObject",
          hasPart: [{ "@id": "level3" }],
        },
        {
          "@id": "level3",
          "@type": "File",
        },
        {
          "@id": "unrelated",
          "@type": "Thing",
        },
      ],
    };

    // Select the deepest entity
    const result = convertToMermaid(testCrate, {
      selectedEntityId: "level3",
    });

    // Should contain the selected entity and all ancestors on the path to root
    expect(result).toContain("level3");
    expect(result).toContain("level2");
    expect(result).toContain("level1");
    expect(result).toContain("./"); // Root dataset (escaped in mermaid id)

    // Should NOT contain unrelated entities
    expect(result).not.toContain("unrelated");
  });

  it("should not produce duplicate edges in neighborhood mode", () => {
    const testCrate: ROCrate = {
      "@context": "https://w3id.org/ro/crate/1.1/context",
      "@graph": [
        {
          "@id": "ro-crate-metadata.json",
          "@type": "CreativeWork",
          about: { "@id": "./" },
        },
        {
          "@id": "./",
          "@type": "Dataset",
          contributor: [{ "@id": "person1" }],
        },
        {
          "@id": "person1",
          "@type": "Person",
          role: [{ "@id": "role1" }],
        },
        {
          "@id": "role1",
          "@type": "Role",
        },
      ],
    };

    // Select the person entity
    const result = convertToMermaid(testCrate, {
      selectedEntityId: "person1",
    });

    // Count occurrences of the contributor edge
    const contributorMatches = result.match(/\|contributor\|/g) || [];
    expect(contributorMatches.length).toBe(1);

    // Count occurrences of the role edge
    const roleMatches = result.match(/\|role\|/g) || [];
    expect(roleMatches.length).toBe(1);
  });

  it("should process ldac: namespaced relationships like participant, speaker, recorder", () => {
    const testCrate: ROCrate = {
      "@context": "https://w3id.org/ro/crate/1.1/context",
      "@graph": [
        {
          "@id": "ro-crate-metadata.json",
          "@type": "CreativeWork",
          about: { "@id": "./" },
        },
        {
          "@id": "./",
          "@type": "Dataset",
          hasPart: [{ "@id": "Sessions/ETR009/" }],
        },
        {
          "@id": "Sessions/ETR009/",
          "@type": ["RepositoryObject", "CollectionEvent"],
          "ldac:participant": [
            { "@id": "#Awi_Heole" },
            { "@id": "#Ilawi_Amosa" },
          ],
          "ldac:recorder": [{ "@id": "#contributor-Hatton" }],
          "ldac:speaker": [{ "@id": "#Awi_Heole" }],
        },
        {
          "@id": "#Awi_Heole",
          "@type": "Person",
          name: "Awi Heole",
        },
        {
          "@id": "#Ilawi_Amosa",
          "@type": "Person",
          name: "Ilawi Amosa",
        },
        {
          "@id": "#contributor-Hatton",
          "@type": "Person",
          name: "Hatton",
        },
      ],
    };

    const result = convertToMermaid(testCrate, {
    });

    // Should contain all person nodes (by their name labels, since IDs get sanitized for Mermaid)
    expect(result).toContain("Awi Heole");
    expect(result).toContain("Ilawi Amosa");
    expect(result).toContain("Hatton");

    // Should have participant edge (with namespace prefix preserved)
    expect(result).toContain("|ldac:participant|");

    // Should have speaker edge (with namespace prefix preserved)
    expect(result).toContain("|ldac:speaker|");

    // Should have recorder edge (with namespace prefix preserved)
    expect(result).toContain("|ldac:recorder|");

    // Verify there are 4 relationships total:
    // 2 participant (one to each person), 1 speaker, 1 recorder
    const participantMatches = result.match(/\|ldac:participant\|/g) || [];
    expect(participantMatches.length).toBe(2);

    const speakerMatches = result.match(/\|ldac:speaker\|/g) || [];
    expect(speakerMatches.length).toBe(1);

    const recorderMatches = result.match(/\|ldac:recorder\|/g) || [];
    expect(recorderMatches.length).toBe(1);
  });
});

describe("convertToMermaid - Label Truncation", () => {
  it("should not truncate long file paths in labels", () => {
    const testCrate: ROCrate = {
      "@context": "https://w3id.org/ro/crate/1.1/context",
      "@graph": [
        {
          "@id": "ro-crate-metadata.json",
          "@type": "CreativeWork",
          about: { "@id": "./" },
        },
        {
          "@id": "./",
          "@type": "Dataset",
          hasPart: [
            { "@id": "People/Awi_Heole/Awi_Heole_Photo.JPG" },
            { "@id": "People/Awi_Heole/Awi_Heole_Consent.JPG" },
          ],
        },
        {
          "@id": "People/Awi_Heole/Awi_Heole_Photo.JPG",
          "@type": ["File", "ImageObject"],
          name: "Awi_Heole_Photo.JPG",
        },
        {
          "@id": "People/Awi_Heole/Awi_Heole_Consent.JPG",
          "@type": ["File", "ImageObject"],
          name: "Awi_Heole_Consent.JPG",
        },
      ],
    };

    const result = convertToMermaid(testCrate, {});

    // The full @id should appear in the label, not truncated
    expect(result).toContain("People/Awi_Heole/Awi_Heole_Photo.JPG");
    expect(result).toContain("People/Awi_Heole/Awi_Heole_Consent.JPG");

    // Should NOT contain truncated versions with "..."
    expect(result).not.toContain("...");
  });

  it("should not truncate very long paths exceeding 80 characters", () => {
    const longPath =
      "Very/Long/Path/To/Some/Deep/Directory/Structure/With/A/Very/Long/Filename/That/Exceeds/Eighty/Characters.txt";

    const testCrate: ROCrate = {
      "@context": "https://w3id.org/ro/crate/1.1/context",
      "@graph": [
        {
          "@id": "ro-crate-metadata.json",
          "@type": "CreativeWork",
          about: { "@id": "./" },
        },
        {
          "@id": "./",
          "@type": "Dataset",
          hasPart: [{ "@id": longPath }],
        },
        {
          "@id": longPath,
          "@type": "File",
        },
      ],
    };

    const result = convertToMermaid(testCrate, {});

    // The full path should be in the output
    expect(result).toContain(longPath);

    // Should NOT be truncated
    expect(result).not.toContain("...");
  });
});
