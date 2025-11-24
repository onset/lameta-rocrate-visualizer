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
  renderer?: "default" | "elk";
  showFiles?: boolean;
  maxLabelLength?: number;
}
