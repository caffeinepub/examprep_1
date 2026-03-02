import type { ExternalBlob } from "./backend";

export type { ExternalBlob };

export interface Exam {
  id: string;
  title: string;
  subject: string;
  completed: boolean;
  progress: bigint;
  examType: string;
  dateTime: bigint; // nanoseconds
  location: string;
}

export interface Topic {
  id: string;
  references: string[];
  order: bigint;
  name: string;
  completed: boolean;
  notes?: string;
}

export interface Chapter {
  id: string;
  name: string;
  topics: Topic[];
}

export interface Subject {
  id: string;
  name: string;
  chapters: Chapter[];
}

export interface Folder {
  id: string;
  name: string;
  parentId?: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  blob?: ExternalBlob;
  createdAt: bigint;
  tags: string[];
  pinned: boolean;
  folderId: string;
  favorite: boolean;
}

// Helpers
export function msToNano(ms: number): bigint {
  return BigInt(ms) * 1_000_000n;
}

export function nanoToMs(nano: bigint): number {
  return Number(nano / 1_000_000n);
}
