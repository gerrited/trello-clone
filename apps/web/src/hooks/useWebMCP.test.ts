import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWebMCP, type WebMCPTool } from './useWebMCP.js';

const makeTool = (name: string): WebMCPTool => ({
  name,
  description: `Tool ${name}`,
  inputSchema: { type: 'object', properties: {} },
  execute: async () => ({ ok: true }),
});

describe('useWebMCP', () => {
  const registerTool = vi.fn();
  const unregisterTool = vi.fn();

  beforeEach(() => {
    registerTool.mockClear();
    unregisterTool.mockClear();
    Object.defineProperty(navigator, 'modelContext', {
      value: { registerTool, unregisterTool },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'modelContext', {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  it('calls registerTool for each tool on mount', () => {
    const tools = [makeTool('tool_a'), makeTool('tool_b')];
    renderHook(() => useWebMCP(tools));
    expect(registerTool).toHaveBeenCalledTimes(2);
    expect(registerTool).toHaveBeenCalledWith(tools[0]);
    expect(registerTool).toHaveBeenCalledWith(tools[1]);
  });

  it('calls unregisterTool for each tool on unmount', () => {
    const tools = [makeTool('tool_a'), makeTool('tool_b')];
    const { unmount } = renderHook(() => useWebMCP(tools));
    unmount();
    expect(unregisterTool).toHaveBeenCalledTimes(2);
    expect(unregisterTool).toHaveBeenCalledWith('tool_a');
    expect(unregisterTool).toHaveBeenCalledWith('tool_b');
  });

  it('does not call registerTool when navigator.modelContext is absent', () => {
    Object.defineProperty(navigator, 'modelContext', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    renderHook(() => useWebMCP([makeTool('tool_a')]));
    expect(registerTool).not.toHaveBeenCalled();
  });

  it('captures tools at mount and does not re-register when array reference changes', () => {
    const tools1 = [makeTool('tool_a')];
    const tools2 = [makeTool('tool_b')];
    let tools = tools1;
    const { rerender } = renderHook(() => useWebMCP(tools));
    tools = tools2;
    rerender();
    // registerTool only called once (on mount with tools1)
    expect(registerTool).toHaveBeenCalledTimes(1);
    expect(registerTool).toHaveBeenCalledWith(tools1[0]);
  });
});
