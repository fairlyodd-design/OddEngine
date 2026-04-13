export type CommandDef = {
  id: string;
  label: string;
  keywords?: string[];
  description?: string;
};

export function getCommands(): CommandDef[] {
  return [];
}
