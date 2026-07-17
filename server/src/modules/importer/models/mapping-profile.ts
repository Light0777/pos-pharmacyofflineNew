export interface MappingProfile {
  profileName: string;
  module: "inventory";

  fields: Record<string, string>;
}