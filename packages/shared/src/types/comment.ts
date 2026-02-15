export interface Comment {
  id: string;
  cardId: string;
  authorId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author?: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
}
