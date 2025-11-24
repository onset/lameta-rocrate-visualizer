# Example Mermaid Output

When you run the visualizer on a typical LDAC RO-Crate file, it generates Mermaid code like this:

```mermaid
graph TB
  ./[("The story behind how we catch fish with poison bark<br/>Dataset, Object, RepositoryObject")]
  style ./ fill:#e1f5ff,stroke:#0288d1,stroke-width:3px
  ETR009.session["ETR009.session<br/><i>File</i>"]
  ./ -->|hasPart| ETR009.session
  style ETR009.session fill:#fff9c4,stroke:#f57f17
  SceneHouse.JPG["SceneHouse.JPG<br/><i>File</i>"]
  ./ -->|hasPart| SceneHouse.JPG
  style SceneHouse.JPG fill:#fff9c4,stroke:#f57f17
  b(["Awi Heole2<br/><i>Person</i>"])
  b -.->|contributor| ./
  style b fill:#f3e5f5,stroke:#7b1fa2
  Ilawi Amosa(["Ilawi Amosa<br/><i>Person</i>"])
  Ilawi Amosa -.->|contributor| ./
  style Ilawi Amosa fill:#f3e5f5,stroke:#7b1fa2
  role_participant{{"participant<br/><i>Role</i>"}}
  Ilawi Amosa -.->|role| role_participant
  style role_participant fill:#e8f5e9,stroke:#388e3c
  #language_etr{{"Edolo<br/><i>Language</i>"}}
  style #language_etr fill:#fce4ec,stroke:#c2185b
  #license[/"Open<br/><i>CreativeWork</i>"/]
  style #license fill:#fff3e0,stroke:#e65100
```

## Diagram Features

The generated diagram includes:

### Nodes

- **Root Dataset** (cylinder shape): Main collection/session
- **Files** (rectangles): All media and metadata files
- **People** (stadium shapes): Contributors and participants
- **Roles** (hexagons): Participant roles like speaker, recorder
- **Languages** (hexagons): Subject languages
- **Places** (hexagons): Geographic locations
- **Licenses** (trapezoids): Access and licensing info

### Relationships

- **Solid arrows** (-->): "hasPart" relationships showing containment
- **Dashed arrows** (-.->): "contributor" and "role" relationships

### Colors

Each entity type has a distinct color scheme for easy identification.
