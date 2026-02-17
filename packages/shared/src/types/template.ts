export interface BoardTemplateColumnConfig {
  name: string;
  color?: string;
  wipLimit?: number;
}

export interface BoardTemplateSwimlaneConfig {
  name: string;
}

export interface BoardTemplateLabelConfig {
  name: string;
  color: string;
}

export interface BoardTemplateConfig {
  columns: BoardTemplateColumnConfig[];
  swimlanes: BoardTemplateSwimlaneConfig[];
  labels: BoardTemplateLabelConfig[];
}

export interface BoardTemplate {
  id: string;
  teamId: string | null;
  name: string;
  description: string | null;
  isSystem: boolean;
  createdBy: string | null;
  config: BoardTemplateConfig;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  config: BoardTemplateConfig;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  config?: BoardTemplateConfig;
}

export interface CreateBoardFromTemplateInput {
  name: string;
  description?: string;
  templateId: string;
}

export interface SaveAsTemplateInput {
  name: string;
  description?: string;
}
