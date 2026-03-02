import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Edit2,
  FileText,
  GripVertical,
  Layers,
  Link,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { getSeedSubjects } from "../seedData";
import type { Chapter, Subject, Topic } from "../types";

// ── localStorage helpers ────────────────────────────────────
const LS_KEY = "subjects_local";

const BIGINT_KEYS_SYLLABUS = new Set(["order"]);

function bigIntReviver(key: string, value: unknown): unknown {
  if (typeof value === "string" && /^\d+n$/.test(value)) {
    return BigInt(value.slice(0, -1));
  }
  // Migrate old format: plain numeric strings for known BigInt fields
  if (
    BIGINT_KEYS_SYLLABUS.has(key) &&
    typeof value === "string" &&
    /^\d+$/.test(value)
  ) {
    return BigInt(value);
  }
  return value;
}

function bigIntReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") return `${value.toString()}n`;
  return value;
}

function loadSubjects(): Subject[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw, bigIntReviver) as Subject[];
      // Validate structure
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // corrupted data — clear and fall through to seed
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      /* ignore */
    }
  }
  const seed = getSeedSubjects();
  saveSubjectsToStorage(seed);
  return seed;
}

function saveSubjectsToStorage(subjects: Subject[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(subjects, bigIntReplacer));
}

// ── helpers ─────────────────────────────────────────────────
function calcProgress(subject: Subject): number {
  const topics = subject.chapters.flatMap((c) => c.topics);
  if (topics.length === 0) return 0;
  const done = topics.filter((t) => t.completed).length;
  return Math.round((done / topics.length) * 100);
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const regex = new RegExp(
    `(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
    "gi",
  );
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: index is stable for split parts
      <mark key={i} className="bg-primary/30 text-foreground rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

export default function SyllabusTab() {
  // Single source of truth: plain state, persisted synchronously to localStorage
  const [subjects, setSubjects] = useState<Subject[]>(() => loadSubjects());

  function updateSubjects(next: Subject[]) {
    saveSubjectsToStorage(next);
    setSubjects(next);
  }

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(
    null,
  );
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(
    new Set(),
  );
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);

  // Dialogs
  const [subjectDialog, setSubjectDialog] = useState<{
    open: boolean;
    editing?: Subject;
  }>({ open: false });
  const [chapterDialog, setChapterDialog] = useState<{
    open: boolean;
    subjectId: string;
    editing?: Chapter;
  } | null>(null);
  const [topicDialog, setTopicDialog] = useState<{
    open: boolean;
    subjectId: string;
    chapterId: string;
    editing?: Topic;
  } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    type: "subject" | "chapter" | "topic";
    id: string;
    subjectId?: string;
    chapterId?: string;
    label: string;
  } | null>(null);

  // Form state
  const [nameInput, setNameInput] = useState("");
  const [topicForm, setTopicForm] = useState({
    name: "",
    notes: "",
    references: [""],
  });

  const selectedSubject =
    subjects.find((s) => s.id === selectedSubjectId) ?? null;

  // Filter by search
  const filteredSubjects = subjects.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    if (s.name.toLowerCase().includes(q)) return true;
    return s.chapters.some(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.topics.some((t) => t.name.toLowerCase().includes(q)),
    );
  });

  function toggleChapter(id: string) {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ── Subject CRUD ───────────────────────────────────────────
  function openAddSubject() {
    setNameInput("");
    setSubjectDialog({ open: true });
  }
  function openEditSubject(s: Subject) {
    setNameInput(s.name);
    setSubjectDialog({ open: true, editing: s });
  }
  function saveSubject() {
    if (!nameInput.trim()) return;
    const editing = subjectDialog.editing;
    const next = editing
      ? subjects.map((s) =>
          s.id === editing.id ? { ...s, name: nameInput.trim() } : s,
        )
      : [
          ...subjects,
          { id: crypto.randomUUID(), name: nameInput.trim(), chapters: [] },
        ];
    updateSubjects(next);
    setSubjectDialog({ open: false });
    toast.success(editing ? "Subject updated" : "Subject added");
  }

  // ── Chapter CRUD ───────────────────────────────────────────
  function openAddChapter(subjectId: string) {
    setNameInput("");
    setChapterDialog({ open: true, subjectId });
  }
  function openEditChapter(subjectId: string, chapter: Chapter) {
    setNameInput(chapter.name);
    setChapterDialog({ open: true, subjectId, editing: chapter });
  }
  function saveChapter() {
    if (!chapterDialog || !nameInput.trim()) return;
    const { subjectId, editing } = chapterDialog;
    const next = subjects.map((s) => {
      if (s.id !== subjectId) return s;
      const chapters = editing
        ? s.chapters.map((c) =>
            c.id === editing.id ? { ...c, name: nameInput.trim() } : c,
          )
        : [
            ...s.chapters,
            { id: crypto.randomUUID(), name: nameInput.trim(), topics: [] },
          ];
      return { ...s, chapters };
    });
    updateSubjects(next);
    setChapterDialog(null);
    toast.success(editing ? "Chapter updated" : "Chapter added");
  }

  // ── Topic CRUD ─────────────────────────────────────────────
  function openAddTopic(subjectId: string, chapterId: string) {
    setTopicForm({ name: "", notes: "", references: [""] });
    setTopicDialog({ open: true, subjectId, chapterId });
  }
  function openEditTopic(subjectId: string, chapterId: string, topic: Topic) {
    setTopicForm({
      name: topic.name,
      notes: topic.notes ?? "",
      references: topic.references.length > 0 ? topic.references : [""],
    });
    setTopicDialog({ open: true, subjectId, chapterId, editing: topic });
  }
  function saveTopic() {
    if (!topicDialog || !topicForm.name.trim()) return;
    const { subjectId, chapterId, editing } = topicDialog;
    const refs = topicForm.references.filter((r) => r.trim());
    const next = subjects.map((s) => {
      if (s.id !== subjectId) return s;
      const chapters = s.chapters.map((c) => {
        if (c.id !== chapterId) return c;
        if (editing) {
          return {
            ...c,
            topics: c.topics.map((t) =>
              t.id === editing.id
                ? {
                    ...t,
                    name: topicForm.name.trim(),
                    notes: topicForm.notes,
                    references: refs,
                  }
                : t,
            ),
          };
        }
        const newTopic: Topic = {
          id: crypto.randomUUID(),
          name: topicForm.name.trim(),
          notes: topicForm.notes,
          references: refs,
          completed: false,
          order: BigInt(c.topics.length),
        };
        return { ...c, topics: [...c.topics, newTopic] };
      });
      return { ...s, chapters };
    });
    updateSubjects(next);
    setTopicDialog(null);
    toast.success(editing ? "Topic updated" : "Topic added");
  }

  // ── Topic toggle complete ──────────────────────────────────
  function toggleTopicComplete(
    subjectId: string,
    chapterId: string,
    topicId: string,
  ) {
    const next = subjects.map((s) => {
      if (s.id !== subjectId) return s;
      return {
        ...s,
        chapters: s.chapters.map((c) => {
          if (c.id !== chapterId) return c;
          return {
            ...c,
            topics: c.topics.map((t) =>
              t.id === topicId ? { ...t, completed: !t.completed } : t,
            ),
          };
        }),
      };
    });
    updateSubjects(next);
  }

  // ── Topic reorder ──────────────────────────────────────────
  function reorderTopic(
    subjectId: string,
    chapterId: string,
    topicId: string,
    dir: "up" | "down",
  ) {
    const next = subjects.map((s) => {
      if (s.id !== subjectId) return s;
      return {
        ...s,
        chapters: s.chapters.map((c) => {
          if (c.id !== chapterId) return c;
          const idx = c.topics.findIndex((t) => t.id === topicId);
          if (idx === -1) return c;
          const newIdx = dir === "up" ? idx - 1 : idx + 1;
          if (newIdx < 0 || newIdx >= c.topics.length) return c;
          const topics = [...c.topics];
          [topics[idx], topics[newIdx]] = [topics[newIdx], topics[idx]];
          return {
            ...c,
            topics: topics.map((t, i) => ({ ...t, order: BigInt(i) })),
          };
        }),
      };
    });
    updateSubjects(next);
  }

  // ── Deletions ──────────────────────────────────────────────
  function confirmDelete() {
    if (!deleteDialog) return;
    const { type, id, subjectId, chapterId } = deleteDialog;

    if (type === "subject") {
      updateSubjects(subjects.filter((s) => s.id !== id));
      if (selectedSubjectId === id) setSelectedSubjectId(null);
      toast.success("Subject deleted");
    } else if (type === "chapter" && subjectId) {
      updateSubjects(
        subjects.map((s) =>
          s.id === subjectId
            ? { ...s, chapters: s.chapters.filter((c) => c.id !== id) }
            : s,
        ),
      );
      toast.success("Chapter deleted");
    } else if (type === "topic" && subjectId && chapterId) {
      updateSubjects(
        subjects.map((s) =>
          s.id === subjectId
            ? {
                ...s,
                chapters: s.chapters.map((c) =>
                  c.id === chapterId
                    ? { ...c, topics: c.topics.filter((t) => t.id !== id) }
                    : c,
                ),
              }
            : s,
        ),
      );
      toast.success("Topic deleted");
    }
    setDeleteDialog(null);
  }

  return (
    <div className="h-[calc(100vh-120px)] flex overflow-hidden">
      {/* Left sidebar — subjects */}
      <div className="w-64 shrink-0 border-r border-border flex flex-col bg-sidebar/50">
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search syllabus..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm bg-muted/30 border-border"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {filteredSubjects.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8 px-3">
                {searchQuery ? "No results found" : "No subjects yet"}
              </p>
            ) : (
              filteredSubjects.map((subject) => {
                const progress = calcProgress(subject);
                const isSelected = selectedSubjectId === subject.id;
                return (
                  <div key={subject.id} className="group">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedSubjectId(isSelected ? null : subject.id)
                      }
                      className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-colors ${
                        isSelected
                          ? "bg-primary/15 text-foreground"
                          : "hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <BookOpen className="w-3.5 h-3.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {highlightText(subject.name, searchQuery)}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Progress value={progress} className="h-1 flex-1" />
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {progress}%
                          </span>
                        </div>
                      </div>
                    </button>
                    {/* Inline actions on hover */}
                    <div className="flex gap-0.5 px-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => openEditSubject(subject)}
                        className="text-muted-foreground hover:text-foreground p-0.5 rounded"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteDialog({
                            type: "subject",
                            id: subject.id,
                            label: subject.name,
                          })
                        }
                        className="text-muted-foreground hover:text-destructive p-0.5 rounded"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        <div className="p-3 border-t border-border">
          <Button
            onClick={openAddSubject}
            size="sm"
            variant="outline"
            className="w-full h-8 gap-1.5 text-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Subject
          </Button>
        </div>
      </div>

      {/* Main content — chapters & topics */}
      <div className="flex-1 flex overflow-hidden">
        {selectedSubject ? (
          <ScrollArea className="flex-1">
            <div className="p-5 space-y-4">
              {/* Subject header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display font-bold text-lg text-foreground">
                    {selectedSubject.name}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedSubject.chapters.reduce(
                      (a, c) => a + c.topics.length,
                      0,
                    )}{" "}
                    topics across {selectedSubject.chapters.length} chapters
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-8"
                  onClick={() => openAddChapter(selectedSubject.id)}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Chapter
                </Button>
              </div>

              {/* Chapters */}
              {selectedSubject.chapters.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Layers className="w-8 h-8 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">
                    No chapters yet. Add one to get started.
                  </p>
                </div>
              ) : (
                selectedSubject.chapters.map((chapter) => {
                  const isExpanded = expandedChapters.has(chapter.id);
                  const completedTopics = chapter.topics.filter(
                    (t) => t.completed,
                  ).length;
                  return (
                    <div
                      key={chapter.id}
                      className="bg-card rounded-xl border border-border card-glow overflow-hidden"
                    >
                      {/* Chapter header */}
                      <div className="flex items-center gap-3 px-4 py-3 group">
                        <button
                          type="button"
                          onClick={() => toggleChapter(chapter.id)}
                          className="flex items-center gap-2 flex-1 min-w-0 text-left"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                          )}
                          <Layers className="w-3.5 h-3.5 text-accent shrink-0" />
                          <span className="font-medium text-sm text-foreground truncate">
                            {highlightText(chapter.name, searchQuery)}
                          </span>
                        </button>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {completedTopics}/{chapter.topics.length}
                        </span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() =>
                              openAddTopic(selectedSubject.id, chapter.id)
                            }
                            className="text-muted-foreground hover:text-foreground p-1 rounded"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              openEditChapter(selectedSubject.id, chapter)
                            }
                            className="text-muted-foreground hover:text-foreground p-1 rounded"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteDialog({
                                type: "chapter",
                                id: chapter.id,
                                subjectId: selectedSubject.id,
                                label: chapter.name,
                              })
                            }
                            className="text-muted-foreground hover:text-destructive p-1 rounded"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Topics list */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: "auto" }}
                            exit={{ height: 0 }}
                            className="overflow-hidden border-t border-border"
                          >
                            {chapter.topics.length === 0 ? (
                              <div className="px-6 py-4 text-sm text-muted-foreground">
                                No topics yet.{" "}
                                <button
                                  type="button"
                                  className="text-primary hover:underline"
                                  onClick={() =>
                                    openAddTopic(selectedSubject.id, chapter.id)
                                  }
                                >
                                  Add one
                                </button>
                              </div>
                            ) : (
                              <div className="divide-y divide-border">
                                {[...chapter.topics]
                                  .sort((a, b) => Number(a.order - b.order))
                                  .map((topic, topicIdx) => {
                                    const isSelectedTopic =
                                      selectedTopicId === topic.id;
                                    return (
                                      <div
                                        key={topic.id}
                                        className="group/topic"
                                      >
                                        <button
                                          type="button"
                                          className={`w-full flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors text-left ${
                                            isSelectedTopic
                                              ? "bg-primary/8"
                                              : "hover:bg-muted/20"
                                          }`}
                                          onClick={() =>
                                            setSelectedTopicId(
                                              isSelectedTopic ? null : topic.id,
                                            )
                                          }
                                        >
                                          <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                                          <Checkbox
                                            checked={topic.completed}
                                            onCheckedChange={() =>
                                              toggleTopicComplete(
                                                selectedSubject.id,
                                                chapter.id,
                                                topic.id,
                                              )
                                            }
                                            onClick={(e) => e.stopPropagation()}
                                            className="shrink-0"
                                          />
                                          <span
                                            className={`text-sm flex-1 ${
                                              topic.completed
                                                ? "line-through text-muted-foreground"
                                                : "text-foreground"
                                            }`}
                                          >
                                            {highlightText(
                                              topic.name,
                                              searchQuery,
                                            )}
                                          </span>
                                          {topic.references.length > 0 && (
                                            <Link className="w-3 h-3 text-accent shrink-0" />
                                          )}
                                          {topic.notes && (
                                            <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
                                          )}
                                          {/* Reorder + actions */}
                                          <div
                                            className="flex gap-0.5 opacity-0 group-hover/topic:opacity-100 transition-opacity"
                                            onClick={(e) => e.stopPropagation()}
                                            onKeyDown={(e) =>
                                              e.stopPropagation()
                                            }
                                          >
                                            <button
                                              type="button"
                                              disabled={topicIdx === 0}
                                              onClick={() =>
                                                reorderTopic(
                                                  selectedSubject.id,
                                                  chapter.id,
                                                  topic.id,
                                                  "up",
                                                )
                                              }
                                              className="text-muted-foreground hover:text-foreground p-0.5 rounded disabled:opacity-30"
                                            >
                                              <ArrowUp className="w-3 h-3" />
                                            </button>
                                            <button
                                              type="button"
                                              disabled={
                                                topicIdx ===
                                                chapter.topics.length - 1
                                              }
                                              onClick={() =>
                                                reorderTopic(
                                                  selectedSubject.id,
                                                  chapter.id,
                                                  topic.id,
                                                  "down",
                                                )
                                              }
                                              className="text-muted-foreground hover:text-foreground p-0.5 rounded disabled:opacity-30"
                                            >
                                              <ArrowDown className="w-3 h-3" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                openEditTopic(
                                                  selectedSubject.id,
                                                  chapter.id,
                                                  topic,
                                                )
                                              }
                                              className="text-muted-foreground hover:text-foreground p-0.5 rounded"
                                            >
                                              <Edit2 className="w-3 h-3" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setDeleteDialog({
                                                  type: "topic",
                                                  id: topic.id,
                                                  subjectId: selectedSubject.id,
                                                  chapterId: chapter.id,
                                                  label: topic.name,
                                                })
                                              }
                                              className="text-muted-foreground hover:text-destructive p-0.5 rounded"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          </div>
                                        </button>

                                        {/* Topic detail panel */}
                                        <AnimatePresence>
                                          {isSelectedTopic && (
                                            <motion.div
                                              initial={{
                                                height: 0,
                                                opacity: 0,
                                              }}
                                              animate={{
                                                height: "auto",
                                                opacity: 1,
                                              }}
                                              exit={{ height: 0, opacity: 0 }}
                                              className="overflow-hidden"
                                            >
                                              <div className="px-10 pb-4 pt-2 bg-muted/10 border-t border-border space-y-3">
                                                {topic.notes && (
                                                  <div>
                                                    <p className="text-xs font-medium text-muted-foreground mb-1">
                                                      Notes
                                                    </p>
                                                    <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/30 rounded-lg px-3 py-2 border border-border">
                                                      {topic.notes}
                                                    </p>
                                                  </div>
                                                )}
                                                {topic.references.length >
                                                  0 && (
                                                  <div>
                                                    <p className="text-xs font-medium text-muted-foreground mb-1">
                                                      References
                                                    </p>
                                                    <div className="space-y-1">
                                                      {topic.references.map(
                                                        (ref) => (
                                                          <a
                                                            key={ref}
                                                            href={ref}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-1.5 text-xs text-accent hover:underline"
                                                          >
                                                            <Link className="w-3 h-3" />
                                                            {ref}
                                                          </a>
                                                        ),
                                                      )}
                                                    </div>
                                                  </div>
                                                )}
                                                {!topic.notes &&
                                                  topic.references.length ===
                                                    0 && (
                                                    <p className="text-xs text-muted-foreground">
                                                      No notes or references.
                                                      Click edit to add some.
                                                    </p>
                                                  )}
                                              </div>
                                            </motion.div>
                                          )}
                                        </AnimatePresence>
                                      </div>
                                    );
                                  })}
                              </div>
                            )}
                            {/* Add topic at bottom */}
                            <div className="px-4 py-2 border-t border-border">
                              <button
                                type="button"
                                onClick={() =>
                                  openAddTopic(selectedSubject.id, chapter.id)
                                }
                                className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                Add topic
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center">
            <div>
              <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-display font-semibold text-foreground/50 mb-1">
                Select a subject
              </p>
              <p className="text-sm text-muted-foreground">
                Choose a subject from the left to view its chapters and topics
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Dialogs ── */}

      {/* Subject dialog */}
      <Dialog
        open={subjectDialog.open}
        onOpenChange={(o) => setSubjectDialog({ open: o })}
      >
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display">
              {subjectDialog.editing ? "Edit Subject" : "Add Subject"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              placeholder="Subject name"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveSubject()}
              className="bg-muted/30 border-border"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSubjectDialog({ open: false })}
            >
              Cancel
            </Button>
            <Button onClick={saveSubject}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chapter dialog */}
      <Dialog
        open={!!chapterDialog?.open}
        onOpenChange={(o) => !o && setChapterDialog(null)}
      >
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display">
              {chapterDialog?.editing ? "Edit Chapter" : "Add Chapter"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              placeholder="Chapter name"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveChapter()}
              className="bg-muted/30 border-border"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChapterDialog(null)}>
              Cancel
            </Button>
            <Button onClick={saveChapter}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Topic dialog */}
      <Dialog
        open={!!topicDialog?.open}
        onOpenChange={(o) => !o && setTopicDialog(null)}
      >
        <DialogContent className="sm:max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display">
              {topicDialog?.editing ? "Edit Topic" : "Add Topic"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Topic Name *</Label>
              <Input
                placeholder="e.g. Integration by Parts"
                value={topicForm.name}
                onChange={(e) =>
                  setTopicForm((f) => ({ ...f, name: e.target.value }))
                }
                className="bg-muted/30 border-border"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                placeholder="Add study notes..."
                value={topicForm.notes}
                onChange={(e) =>
                  setTopicForm((f) => ({ ...f, notes: e.target.value }))
                }
                className="bg-muted/30 border-border resize-none h-24"
              />
            </div>
            <div className="space-y-2">
              <Label>Reference Links</Label>
              {topicForm.references.map((ref, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: mutable input list requires index key
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder="https://..."
                    value={ref}
                    onChange={(e) => {
                      const refs = [...topicForm.references];
                      refs[i] = e.target.value;
                      setTopicForm((f) => ({ ...f, references: refs }));
                    }}
                    className="bg-muted/30 border-border text-sm"
                  />
                  {topicForm.references.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0"
                      onClick={() =>
                        setTopicForm((f) => ({
                          ...f,
                          references: f.references.filter((_, j) => j !== i),
                        }))
                      }
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={() =>
                  setTopicForm((f) => ({
                    ...f,
                    references: [...f.references, ""],
                  }))
                }
              >
                <Plus className="w-3 h-3 mr-1" />
                Add reference
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTopicDialog(null)}>
              Cancel
            </Button>
            <Button onClick={saveTopic}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteDialog}
        onOpenChange={(o) => !o && setDeleteDialog(null)}
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              Delete {deleteDialog?.type}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteDialog?.label}&rdquo; will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/80"
              onClick={confirmDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
