import { useEffect, useRef } from 'react';

export interface WebMCPTool {
  name: string;
  description: string;
  inputSchema: object;
  execute: (input: unknown) => Promise<unknown>;
}

/**
 * Registers WebMCP tools via navigator.modelContext on mount.
 * Unregisters on unmount. No-ops if WebMCP is not available.
 *
 * Tools are captured on first render via useRef. The hook does NOT
 * re-register if the tools array reference changes after mount.
 * To update tools, remount the host component (e.g. via a key prop).
 */
export function useWebMCP(tools: WebMCPTool[]): void {
  const toolsRef = useRef(tools);

  useEffect(() => {
    if (!('modelContext' in navigator) || !navigator.modelContext) return;

    const ctx = navigator.modelContext;
    const registered = toolsRef.current;

    for (const tool of registered) {
      ctx.registerTool(tool);
    }

    return () => {
      for (const tool of registered) {
        ctx.unregisterTool(tool.name);
      }
    };
  }, []);
}
