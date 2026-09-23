import type { TaskPayload } from "./task-payload";
export type TaskRecord = TaskPayload & {
  id: string;
  ownerName: string;
  status: "draft" | "published" | "selected";
  qualityScore: number;
  selectedResponseId: string | null;
  isOwner: boolean;
  createdAt: number;
  updatedAt: number;
  publishedAt: number | null;
  responseCount?: number;
};
export type TeamResponse = {
  id: string;
  taskId: string;
  teamName: string;
  teamMembers: string;
  proposal: string;
  studentName: string;
  studentEmail: string;
  createdAt: number;
  selected: boolean;
  taskTitle?: string;
  taskStatus?: TaskRecord["status"];
  organization?: string;
};
