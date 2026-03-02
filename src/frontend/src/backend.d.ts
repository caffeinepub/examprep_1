import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export class ExternalBlob {
    getBytes(): Promise<Uint8Array<ArrayBuffer>>;
    getDirectURL(): string;
    static fromURL(url: string): ExternalBlob;
    static fromBytes(blob: Uint8Array<ArrayBuffer>): ExternalBlob;
    withUploadProgress(onProgress: (percentage: number) => void): ExternalBlob;
}
export interface Chapter {
    id: string;
    name: string;
    topics: Array<Topic>;
}
export interface Topic {
    id: string;
    references: Array<string>;
    order: bigint;
    name: string;
    completed: boolean;
    notes?: string;
}
export interface Folder {
    id: string;
    name: string;
    parentId?: string;
}
export interface Exam {
    id: string;
    title: string;
    subject: string;
    completed: boolean;
    progress: bigint;
    examType: string;
    dateTime: bigint;
    location: string;
}
export interface Subject {
    id: string;
    name: string;
    chapters: Array<Chapter>;
}
export interface Note {
    id: string;
    title: string;
    content: string;
    blob?: ExternalBlob;
    createdAt: bigint;
    tags: Array<string>;
    pinned: boolean;
    folderId: string;
    favorite: boolean;
}
export interface backendInterface {
    createExam(exam: Exam): Promise<void>;
    createFolder(folder: Folder): Promise<void>;
    createNote(note: Note): Promise<void>;
    createSubject(subject: Subject): Promise<void>;
    deleteExam(id: string): Promise<void>;
    deleteFolder(id: string): Promise<void>;
    deleteNote(id: string): Promise<void>;
    deleteSubject(id: string): Promise<void>;
    getExamsBySubject(subject: string): Promise<Array<Exam>>;
    getFavoriteNotes(): Promise<Array<Note>>;
    getPinnedNotes(): Promise<Array<Note>>;
    getUpcomingExams(): Promise<Array<Exam>>;
    searchNotes(term: string): Promise<Array<Note>>;
    searchSyllabus(term: string): Promise<Array<string>>;
    updateExam(exam: Exam): Promise<void>;
    updateFolder(folder: Folder): Promise<void>;
    updateNote(note: Note): Promise<void>;
    updateSubject(subject: Subject): Promise<void>;
}
