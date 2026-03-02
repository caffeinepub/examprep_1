import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getSeedExams,
  getSeedFolders,
  getSeedNotes,
  getSeedSubjects,
} from "../seedData";
import type { Exam, Folder, Note } from "../types";
import { useActor } from "./useActor";

// ── Serialization helpers (must be defined before any hook that uses them) ──
function bigIntReviver(_key: string, value: unknown): unknown {
  if (typeof value === "string" && /^\d+n$/.test(value)) {
    return BigInt(value.slice(0, -1));
  }
  return value;
}

function bigIntReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") return `${value.toString()}n`;
  return value;
}

const SEED_KEY = "examprep_seeded_v1";

async function ensureSeed(actor: import("../backend.d").backendInterface) {
  if (localStorage.getItem(SEED_KEY)) return;
  const [exams, subjects, folders, notes] = await Promise.all([
    getSeedExams(),
    getSeedSubjects(),
    getSeedFolders(),
    getSeedNotes(),
  ]);
  await Promise.all([
    ...exams.map((e) => actor.createExam(e)),
    ...subjects.map((s) => actor.createSubject(s)),
    ...folders.map((f) => actor.createFolder(f)),
    ...notes.map((n) => actor.createNote(n)),
  ]);
  localStorage.setItem(SEED_KEY, "1");
}

function syncExamsLocal(exams: Exam[]) {
  localStorage.setItem("exams_local", JSON.stringify(exams, bigIntReplacer));
}

// ── Exams ──────────────────────────────────────────────────
export function useExams() {
  const { actor, isFetching } = useActor();
  return useQuery<Exam[]>({
    queryKey: ["exams"],
    queryFn: async () => {
      // Always read from localStorage first — survives canister redeployments
      const stored = localStorage.getItem("exams_local");
      if (stored) return JSON.parse(stored, bigIntReviver) as Exam[];
      if (!actor) return [];
      await ensureSeed(actor);
      const exams = (await actor.getUpcomingExams()) as Exam[];
      syncExamsLocal(exams);
      return exams;
    },
    enabled: !isFetching,
  });
}

export function useCreateExam() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (exam: Exam) => {
      const exams = [...(qc.getQueryData<Exam[]>(["exams"]) ?? []), exam];
      syncExamsLocal(exams);
      return actor ? actor.createExam(exam) : Promise.resolve(null);
    },
    onMutate: async (exam) => {
      await qc.cancelQueries({ queryKey: ["exams"] });
      const prev = qc.getQueryData<Exam[]>(["exams"]) ?? [];
      qc.setQueryData<Exam[]>(["exams"], [...prev, exam]);
      return { prev };
    },
    onError: (_err, _exam, ctx) => {
      if (ctx?.prev) qc.setQueryData(["exams"], ctx.prev);
    },
  });
}

export function useUpdateExam() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (exam: Exam) => {
      const exams = (qc.getQueryData<Exam[]>(["exams"]) ?? []).map((e) =>
        e.id === exam.id ? exam : e,
      );
      syncExamsLocal(exams);
      return actor ? actor.updateExam(exam) : Promise.resolve(null);
    },
    onMutate: async (exam) => {
      await qc.cancelQueries({ queryKey: ["exams"] });
      const prev = qc.getQueryData<Exam[]>(["exams"]) ?? [];
      qc.setQueryData<Exam[]>(
        ["exams"],
        prev.map((e) => (e.id === exam.id ? exam : e)),
      );
      return { prev };
    },
    onError: (_err, _exam, ctx) => {
      if (ctx?.prev) qc.setQueryData(["exams"], ctx.prev);
    },
  });
}

export function useDeleteExam() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      const exams = (qc.getQueryData<Exam[]>(["exams"]) ?? []).filter(
        (e) => e.id !== id,
      );
      syncExamsLocal(exams);
      return actor ? actor.deleteExam(id) : Promise.resolve(null);
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["exams"] });
      const prev = qc.getQueryData<Exam[]>(["exams"]) ?? [];
      qc.setQueryData<Exam[]>(
        ["exams"],
        prev.filter((e) => e.id !== id),
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["exams"], ctx.prev);
    },
  });
}

// Subjects are fully managed in SyllabusTab via plain useState + localStorage.
// No React Query hooks needed for subjects.

// ── Folders ────────────────────────────────────────────────
export function useFolders() {
  const { actor, isFetching } = useActor();

  const query = useQuery<Folder[]>({
    queryKey: ["folders"],
    queryFn: async () => {
      if (!actor) return [];
      await ensureSeed(actor);
      const stored = localStorage.getItem("folders_local");
      if (stored) return JSON.parse(stored) as Folder[];
      return getSeedFolders();
    },
    enabled: !!actor && !isFetching,
  });

  return query;
}

export function useCreateFolder() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (folder: Folder) => {
      const folders = [
        ...(qc.getQueryData<Folder[]>(["folders"]) ?? []),
        folder,
      ];
      localStorage.setItem("folders_local", JSON.stringify(folders));
      return actor!.createFolder(folder);
    },
    onMutate: async (folder) => {
      await qc.cancelQueries({ queryKey: ["folders"] });
      const prev = qc.getQueryData<Folder[]>(["folders"]) ?? [];
      qc.setQueryData<Folder[]>(["folders"], [...prev, folder]);
      return { prev };
    },
    onError: (_err, _f, ctx) => {
      if (ctx?.prev) qc.setQueryData(["folders"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["folders"] }),
  });
}

export function useUpdateFolder() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (folder: Folder) => {
      const folders = (qc.getQueryData<Folder[]>(["folders"]) ?? []).map((f) =>
        f.id === folder.id ? folder : f,
      );
      localStorage.setItem("folders_local", JSON.stringify(folders));
      return actor!.updateFolder(folder);
    },
    onMutate: async (folder) => {
      await qc.cancelQueries({ queryKey: ["folders"] });
      const prev = qc.getQueryData<Folder[]>(["folders"]) ?? [];
      qc.setQueryData<Folder[]>(
        ["folders"],
        prev.map((f) => (f.id === folder.id ? folder : f)),
      );
      return { prev };
    },
    onError: (_err, _f, ctx) => {
      if (ctx?.prev) qc.setQueryData(["folders"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["folders"] }),
  });
}

export function useDeleteFolder() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      const folders = (qc.getQueryData<Folder[]>(["folders"]) ?? []).filter(
        (f) => f.id !== id,
      );
      localStorage.setItem("folders_local", JSON.stringify(folders));
      return actor!.deleteFolder(id);
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["folders"] });
      const prev = qc.getQueryData<Folder[]>(["folders"]) ?? [];
      qc.setQueryData<Folder[]>(
        ["folders"],
        prev.filter((f) => f.id !== id),
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["folders"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["folders"] }),
  });
}

// ── Notes ──────────────────────────────────────────────────
export function useNotes() {
  const { actor, isFetching } = useActor();
  return useQuery<Note[]>({
    queryKey: ["notes"],
    queryFn: async () => {
      // Always read from localStorage first — source of truth, no backend refetch needed
      const stored = localStorage.getItem("notes_local");
      if (stored) return JSON.parse(stored, bigIntReviver) as Note[];
      if (!actor) return getSeedNotes();
      await ensureSeed(actor);
      return getSeedNotes();
    },
    enabled: !isFetching,
  });
}

function syncNotesLocal(notes: Note[]) {
  localStorage.setItem("notes_local", JSON.stringify(notes, bigIntReplacer));
}

export function useCreateNote() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (note: Note) => {
      const notes = [...(qc.getQueryData<Note[]>(["notes"]) ?? []), note];
      syncNotesLocal(notes);
      return actor ? actor.createNote(note) : Promise.resolve(null);
    },
    onMutate: async (note) => {
      await qc.cancelQueries({ queryKey: ["notes"] });
      const prev = qc.getQueryData<Note[]>(["notes"]) ?? [];
      qc.setQueryData<Note[]>(["notes"], [...prev, note]);
      return { prev };
    },
    onError: (_err, _n, ctx) => {
      if (ctx?.prev) qc.setQueryData(["notes"], ctx.prev);
    },
    // No onSettled invalidation — localStorage is the source of truth
    // and invalidating causes a refetch that duplicates the optimistic update
  });
}

export function useUpdateNote() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (note: Note) => {
      const notes = (qc.getQueryData<Note[]>(["notes"]) ?? []).map((n) =>
        n.id === note.id ? note : n,
      );
      syncNotesLocal(notes);
      return actor ? actor.updateNote(note) : Promise.resolve(null);
    },
    onMutate: async (note) => {
      await qc.cancelQueries({ queryKey: ["notes"] });
      const prev = qc.getQueryData<Note[]>(["notes"]) ?? [];
      qc.setQueryData<Note[]>(
        ["notes"],
        prev.map((n) => (n.id === note.id ? note : n)),
      );
      return { prev };
    },
    onError: (_err, _n, ctx) => {
      if (ctx?.prev) qc.setQueryData(["notes"], ctx.prev);
    },
  });
}

export function useDeleteNote() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      const notes = (qc.getQueryData<Note[]>(["notes"]) ?? []).filter(
        (n) => n.id !== id,
      );
      syncNotesLocal(notes);
      return actor ? actor.deleteNote(id) : Promise.resolve(null);
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["notes"] });
      const prev = qc.getQueryData<Note[]>(["notes"]) ?? [];
      qc.setQueryData<Note[]>(
        ["notes"],
        prev.filter((n) => n.id !== id),
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["notes"], ctx.prev);
    },
  });
}
