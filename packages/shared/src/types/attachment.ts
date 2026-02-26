export interface Attachment {
  id: string;
  cardId: string;
  uploadedBy: string;
  filename: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploader?: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
}
