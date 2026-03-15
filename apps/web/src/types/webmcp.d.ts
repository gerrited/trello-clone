export interface WebMCPToolDefinition {
  name: string;
  description: string;
  inputSchema: object;
  execute: (input: unknown) => Promise<unknown>;
}

declare global {
  interface Navigator {
    readonly modelContext?: {
      registerTool(tool: WebMCPToolDefinition): void;
      unregisterTool(name: string): void;
    };
  }
}
