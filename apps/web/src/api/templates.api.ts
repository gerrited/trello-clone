import { api } from './client.js';
import type {
  BoardTemplate,
  CreateTemplateInput,
  UpdateTemplateInput,
  CreateBoardFromTemplateInput,
  SaveAsTemplateInput,
  Board,
} from '@trello-clone/shared';

export async function listTemplates(teamId: string): Promise<BoardTemplate[]> {
  const { data } = await api.get<{ templates: BoardTemplate[] }>(`/teams/${teamId}/templates`);
  return data.templates;
}

export async function createTemplate(
  teamId: string,
  input: CreateTemplateInput,
): Promise<BoardTemplate> {
  const { data } = await api.post<{ template: BoardTemplate }>(
    `/teams/${teamId}/templates`,
    input,
  );
  return data.template;
}

export async function updateTemplate(
  teamId: string,
  templateId: string,
  input: UpdateTemplateInput,
): Promise<BoardTemplate> {
  const { data } = await api.patch<{ template: BoardTemplate }>(
    `/teams/${teamId}/templates/${templateId}`,
    input,
  );
  return data.template;
}

export async function deleteTemplate(teamId: string, templateId: string): Promise<void> {
  await api.delete(`/teams/${teamId}/templates/${templateId}`);
}

export async function createBoardFromTemplate(
  teamId: string,
  input: CreateBoardFromTemplateInput,
): Promise<Board> {
  const { data } = await api.post<{ board: Board }>(
    `/teams/${teamId}/templates/from-template`,
    input,
  );
  return data.board;
}

export async function saveAsTemplate(
  boardId: string,
  input: SaveAsTemplateInput,
): Promise<BoardTemplate> {
  const { data } = await api.post<{ template: BoardTemplate }>(
    `/boards/${boardId}/save-as-template`,
    input,
  );
  return data.template;
}
