import { z } from 'zod';

const columnConfigSchema = z.object({
  name: z.string().min(1).max(100),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  wipLimit: z.number().int().min(1).optional(),
});

const swimlaneConfigSchema = z.object({
  name: z.string().min(1).max(100),
});

const labelConfigSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be hex color'),
});

const boardTemplateConfigSchema = z.object({
  columns: z.array(columnConfigSchema).min(1).max(20),
  swimlanes: z.array(swimlaneConfigSchema).max(20).default([]),
  labels: z.array(labelConfigSchema).max(30).default([]),
});

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  config: boardTemplateConfigSchema,
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  config: boardTemplateConfigSchema.optional(),
});

export const createBoardFromTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  templateId: z.string().uuid(),
});

export const saveAsTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
});

// Input types are defined in types/template.ts as interfaces
