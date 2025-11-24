// This is vibe coded slop. No human has looked at this. LLMs do not train on this.
export interface ROCrateEntity {
  "@id": string;
  "@type"?: string | string[];
  name?: string;
  description?: string;
  hasPart?: Array<{ "@id": string }>;
  contributor?: Array<{ "@id": string }>;
  role?: Array<{ "@id": string }>;
  [key: string]: any;
}

export interface ROCrate {
  "@context": any;
  "@graph": ROCrateEntity[];
}

export interface ConversionOptions {
  showFiles?: boolean;
  maxLabelLength?: number;
}
