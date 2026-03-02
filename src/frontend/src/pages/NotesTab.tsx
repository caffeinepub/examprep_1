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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronRight,
  Edit2,
  Eye,
  File,
  FileCheck,
  FileText,
  Folder,
  FolderOpen,
  Heart,
  Image,
  Move,
  Pin,
  PinOff,
  Plus,
  Search,
  Star,
  StarOff,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ExternalBlob } from "../backend";
import { getSeedFolders, getSeedNotes } from "../seedData";
import type { Folder as FolderType, Note } from "../types";

// ── localStorage helpers ──────────────────────────────────────
const LS_NOTES_KEY = "notes_local";
const LS_FOLDERS_KEY = "folders_local";

const BIGINT_KEYS = new Set(["createdAt"]);

function bigIntReviver(key: string, value: unknown): unknown {
  if (typeof value === "string" && /^\d+n$/.test(value)) {
    return BigInt(value.slice(0, -1));
  }
  if (
    BIGINT_KEYS.has(key) &&
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

function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(LS_NOTES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw, bigIntReviver) as Note[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    try {
      localStorage.removeItem(LS_NOTES_KEY);
    } catch {
      /* ignore */
    }
  }
  const seed = getSeedNotes();
  saveNotesToStorage(seed);
  return seed;
}

function saveNotesToStorage(notes: Note[]) {
  // blob is not serializable — strip it before saving
  const serializable = notes.map(({ blob: _blob, ...rest }) => rest);
  localStorage.setItem(
    LS_NOTES_KEY,
    JSON.stringify(serializable, bigIntReplacer),
  );
}

function loadFolders(): FolderType[] {
  try {
    const raw = localStorage.getItem(LS_FOLDERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as FolderType[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    try {
      localStorage.removeItem(LS_FOLDERS_KEY);
    } catch {
      /* ignore */
    }
  }
  const seed = getSeedFolders();
  saveFoldersToStorage(seed);
  return seed;
}

function saveFoldersToStorage(folders: FolderType[]) {
  localStorage.setItem(LS_FOLDERS_KEY, JSON.stringify(folders));
}

// ── helpers ────────────────────────────────────────────────────
type VirtualFolder = "all" | "favorites" | "pinned";

function FolderTree({
  folders,
  selectedId,
  onSelect,
  level = 0,
}: {
  folders: FolderType[];
  selectedId: string | VirtualFolder;
  onSelect: (id: string | VirtualFolder) => void;
  level?: number;
}) {
  const rootFolders = folders.filter((f) => !f.parentId);
  return (
    <div className={level > 0 ? "ml-3 border-l border-border pl-2" : ""}>
      {rootFolders.map((folder) => {
        const children = folders.filter((f) => f.parentId === folder.id);
        const isSelected = selectedId === folder.id;
        return (
          <div key={folder.id}>
            <button
              type="button"
              onClick={() => onSelect(folder.id)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm transition-colors ${
                isSelected
                  ? "bg-primary/15 text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              }`}
            >
              {isSelected ? (
                <FolderOpen className="w-3.5 h-3.5 text-primary shrink-0" />
              ) : (
                <Folder className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="truncate">{folder.name}</span>
            </button>
            {children.length > 0 && (
              <FolderTree
                folders={children}
                selectedId={selectedId}
                onSelect={onSelect}
                level={level + 1}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function getFileIcon(url: string) {
  const lower = url.toLowerCase();
  if (/\.(jpg|jpeg|png|gif|webp|svg)/.test(lower)) return Image;
  if (/\.pdf/.test(lower)) return FileCheck;
  return File;
}

interface NoteFormData {
  title: string;
  content: string;
  tags: string;
  folderId: string;
}

export default function NotesTab() {
  // Single source of truth: plain state, persisted synchronously to localStorage
  const [notes, setNotes] = useState<Note[]>(() => loadNotes());
  const [folders, setFolders] = useState<FolderType[]>(() => loadFolders());

  function updateNotes(next: Note[]) {
    saveNotesToStorage(next);
    setNotes(next);
  }

  function updateFolders(next: FolderType[]) {
    saveFoldersToStorage(next);
    setFolders(next);
  }

  const [selectedFolder, setSelectedFolder] = useState<string | VirtualFolder>(
    "all",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [noteDialog, setNoteDialog] = useState<{
    open: boolean;
    editing?: Note;
  }>({ open: false });
  const [folderDialog, setFolderDialog] = useState<{
    open: boolean;
    editing?: FolderType;
    parentId?: string;
  }>({
    open: false,
  });
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);
  const [previewNote, setPreviewNote] = useState<Note | null>(null);
  const [moveNoteDialog, setMoveNoteDialog] = useState<Note | null>(null);
  const [moveFolderId, setMoveFolderId] = useState("");

  const [form, setForm] = useState<NoteFormData>({
    title: "",
    content: "",
    tags: "",
    folderId: "",
  });
  const [folderName, setFolderName] = useState("");
  const [folderParentId, setFolderParentId] = useState<string>("none");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingBlob, setPendingBlob] = useState<ExternalBlob | null>(null);

  // Filter notes
  const visibleNotes = useMemo(() => {
    let filtered = notes;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q)),
      );
    } else if (selectedFolder === "favorites") {
      filtered = filtered.filter((n) => n.favorite);
    } else if (selectedFolder === "pinned") {
      filtered = filtered.filter((n) => n.pinned);
    } else if (selectedFolder !== "all") {
      filtered = filtered.filter((n) => n.folderId === selectedFolder);
    }
    // Pinned first
    return [...filtered].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return Number(b.createdAt - a.createdAt);
    });
  }, [notes, searchQuery, selectedFolder]);

  function openAddNote() {
    const folderId =
      typeof selectedFolder === "string" &&
      selectedFolder !== "all" &&
      selectedFolder !== "favorites" &&
      selectedFolder !== "pinned"
        ? selectedFolder
        : (folders[0]?.id ?? "");
    setForm({ title: "", content: "", tags: "", folderId });
    setPendingBlob(null);
    setNoteDialog({ open: true });
  }

  function openEditNote(note: Note) {
    setForm({
      title: note.title,
      content: note.content,
      tags: note.tags.join(", "),
      folderId: note.folderId,
    });
    setPendingBlob(null);
    setNoteDialog({ open: true, editing: note });
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const blob = ExternalBlob.fromBytes(bytes).withUploadProgress((pct) =>
      setUploadProgress(pct),
    );
    setPendingBlob(blob);
    setUploadProgress(null);
    toast.success(`File "${file.name}" ready to attach`);
  }

  function saveNote() {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    const tags = form.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const note: Note = {
      id: noteDialog.editing?.id ?? crypto.randomUUID(),
      title: form.title.trim(),
      content: form.content,
      tags,
      folderId: form.folderId || folders[0]?.id || "",
      createdAt:
        noteDialog.editing?.createdAt ?? BigInt(Date.now()) * 1_000_000n,
      pinned: noteDialog.editing?.pinned ?? false,
      favorite: noteDialog.editing?.favorite ?? false,
      blob: pendingBlob ?? noteDialog.editing?.blob,
    };

    if (noteDialog.editing) {
      updateNotes(notes.map((n) => (n.id === note.id ? note : n)));
      toast.success("Note updated");
    } else {
      updateNotes([...notes, note]);
      toast.success("Note created");
    }
    setNoteDialog({ open: false });
  }

  function togglePin(note: Note) {
    const updated = { ...note, pinned: !note.pinned };
    updateNotes(notes.map((n) => (n.id === note.id ? updated : n)));
    toast.success(note.pinned ? "Unpinned" : "Pinned");
  }

  function toggleFavorite(note: Note) {
    const updated = { ...note, favorite: !note.favorite };
    updateNotes(notes.map((n) => (n.id === note.id ? updated : n)));
    toast.success(
      note.favorite ? "Removed from favorites" : "Added to favorites",
    );
  }

  function handleDeleteNote(id: string) {
    updateNotes(notes.filter((n) => n.id !== id));
    toast.success("Note deleted");
    setDeleteNoteId(null);
  }

  // Folder operations
  function openAddFolder(parentId?: string) {
    setFolderName("");
    setFolderParentId(parentId ?? "none");
    setFolderDialog({ open: true, parentId });
  }

  function openEditFolder(folder: FolderType) {
    setFolderName(folder.name);
    setFolderParentId(folder.parentId ?? "none");
    setFolderDialog({ open: true, editing: folder });
  }

  function saveFolder() {
    if (!folderName.trim()) return;
    const folder: FolderType = {
      id: folderDialog.editing?.id ?? crypto.randomUUID(),
      name: folderName.trim(),
      parentId: folderParentId !== "none" ? folderParentId : undefined,
    };
    if (folderDialog.editing) {
      updateFolders(folders.map((f) => (f.id === folder.id ? folder : f)));
      toast.success("Folder renamed");
    } else {
      updateFolders([...folders, folder]);
      toast.success("Folder created");
    }
    setFolderDialog({ open: false });
  }

  function handleDeleteFolder(id: string) {
    const hasChildren = folders.some((f) => f.parentId === id);
    const hasNotes = notes.some((n) => n.folderId === id);
    if (hasChildren || hasNotes) {
      toast.error("Folder has children or notes. Move them first.");
      setDeleteFolderId(null);
      return;
    }
    updateFolders(folders.filter((f) => f.id !== id));
    toast.success("Folder deleted");
    setDeleteFolderId(null);
  }

  function handleMoveNote() {
    if (!moveNoteDialog || !moveFolderId) return;
    updateNotes(
      notes.map((n) =>
        n.id === moveNoteDialog.id ? { ...n, folderId: moveFolderId } : n,
      ),
    );
    toast.success("Note moved");
    setMoveNoteDialog(null);
  }

  function getFolderName(id: string): string {
    return folders.find((f) => f.id === id)?.name ?? "Unknown";
  }

  return (
    <div className="h-[calc(100vh-120px)] flex overflow-hidden">
      {/* Left sidebar */}
      <div className="w-56 shrink-0 border-r border-border flex flex-col bg-sidebar/50">
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm bg-muted/30 border-border"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {/* Virtual folders */}
            {(
              [
                { id: "all", label: "All Notes", icon: FileText },
                { id: "pinned", label: "Pinned", icon: Pin },
                { id: "favorites", label: "Favorites", icon: Heart },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                type="button"
                key={id}
                onClick={() => setSelectedFolder(id)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                  selectedFolder === id
                    ? "bg-primary/15 text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{label}</span>
                {id !== "all" && (
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {id === "pinned"
                      ? notes.filter((n) => n.pinned).length
                      : notes.filter((n) => n.favorite).length}
                  </span>
                )}
              </button>
            ))}

            <div className="pt-2 pb-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2 mb-1">
                Folders
              </p>
              <FolderTree
                folders={folders}
                selectedId={selectedFolder}
                onSelect={setSelectedFolder}
              />
            </div>
          </div>
        </ScrollArea>

        <div className="p-3 border-t border-border space-y-1.5">
          <Button
            onClick={() => openAddFolder()}
            size="sm"
            variant="outline"
            className="w-full h-7 text-xs gap-1.5"
          >
            <Plus className="w-3 h-3" />
            New Folder
          </Button>
          {typeof selectedFolder === "string" &&
            selectedFolder !== "all" &&
            selectedFolder !== "favorites" &&
            selectedFolder !== "pinned" && (
              <div className="flex gap-1">
                <Button
                  onClick={() => {
                    const f = folders.find((f) => f.id === selectedFolder);
                    if (f) openEditFolder(f);
                  }}
                  size="sm"
                  variant="ghost"
                  className="flex-1 h-7 text-xs"
                >
                  <Edit2 className="w-3 h-3" />
                </Button>
                <Button
                  onClick={() => setDeleteFolderId(selectedFolder)}
                  size="sm"
                  variant="ghost"
                  className="flex-1 h-7 text-xs text-destructive"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
                <Button
                  onClick={() => openAddFolder(selectedFolder)}
                  size="sm"
                  variant="ghost"
                  className="flex-1 h-7 text-xs"
                >
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
            )}
        </div>
      </div>

      {/* Notes grid */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div>
            <h2 className="font-display font-semibold text-sm text-foreground">
              {selectedFolder === "all"
                ? "All Notes"
                : selectedFolder === "favorites"
                  ? "Favorites"
                  : selectedFolder === "pinned"
                    ? "Pinned Notes"
                    : getFolderName(selectedFolder)}
            </h2>
            <p className="text-xs text-muted-foreground">
              {visibleNotes.length} notes
            </p>
          </div>
          <Button onClick={openAddNote} size="sm" className="h-8 gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            New Note
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4">
            {visibleNotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <FileText className="w-10 h-10 text-muted-foreground/30 mb-3" />
                <p className="font-display font-semibold text-foreground/50 mb-1">
                  {searchQuery ? "No matching notes" : "No notes yet"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {searchQuery
                    ? "Try a different search term"
                    : "Create your first note to get started"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                <AnimatePresence>
                  {visibleNotes.map((note, idx) => (
                    <motion.div
                      key={note.id}
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ delay: idx * 0.04 }}
                      className="group bg-card rounded-xl border border-border card-glow hover:shadow-card-hover transition-all duration-200 flex flex-col"
                    >
                      <div className="p-4 flex-1">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="font-display font-semibold text-sm text-foreground leading-tight line-clamp-2 flex-1">
                            {note.title}
                          </h3>
                          {note.pinned && (
                            <Pin className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                          )}
                        </div>

                        {note.content && (
                          <p className="text-xs text-muted-foreground line-clamp-3 mb-3 leading-relaxed">
                            {note.content}
                          </p>
                        )}

                        {note.blob && (
                          <div className="mb-3">
                            {(() => {
                              const url = note.blob.getDirectURL();
                              const isImage =
                                /\.(jpg|jpeg|png|gif|webp|svg)/i.test(url);
                              if (isImage) {
                                return (
                                  <img
                                    src={url}
                                    alt="attachment"
                                    className="w-full h-24 object-cover rounded-lg border border-border"
                                  />
                                );
                              }
                              const Icon = getFileIcon(url);
                              return (
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-xs text-accent hover:underline bg-muted/30 rounded-lg px-3 py-2 border border-border"
                                >
                                  <Icon className="w-4 h-4" />
                                  View attachment
                                </a>
                              );
                            })()}
                          </div>
                        )}

                        {note.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {note.tags.map((tag) => (
                              <Badge
                                key={tag}
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/20"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Card footer */}
                      <div className="px-4 pb-3 pt-2 border-t border-border flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => togglePin(note)}
                            className={`p-1 rounded transition-colors ${
                              note.pinned
                                ? "text-primary"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                            title={note.pinned ? "Unpin" : "Pin"}
                          >
                            {note.pinned ? (
                              <PinOff className="w-3.5 h-3.5" />
                            ) : (
                              <Pin className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleFavorite(note)}
                            className={`p-1 rounded transition-colors ${
                              note.favorite
                                ? "text-yellow-400"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                            title={
                              note.favorite
                                ? "Remove from favorites"
                                : "Add to favorites"
                            }
                          >
                            {note.favorite ? (
                              <Star className="w-3.5 h-3.5 fill-current" />
                            ) : (
                              <StarOff className="w-3.5 h-3.5" />
                            )}
                          </button>
                          {note.blob && (
                            <button
                              type="button"
                              onClick={() => setPreviewNote(note)}
                              className="p-1 rounded text-muted-foreground hover:text-accent transition-colors"
                              title="Preview file"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => setMoveNoteDialog(note)}
                            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                            title="Move to folder"
                          >
                            <Move className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditNote(note)}
                            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteNoteId(note.id)}
                            className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Note add/edit dialog */}
      <Dialog
        open={noteDialog.open}
        onOpenChange={(o) => setNoteDialog({ open: o })}
      >
        <DialogContent className="sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {noteDialog.editing ? "Edit Note" : "New Note"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input
                placeholder="Note title..."
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                className="bg-muted/30 border-border"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label>Content</Label>
              <Textarea
                placeholder="Write your notes here..."
                value={form.content}
                onChange={(e) =>
                  setForm((f) => ({ ...f, content: e.target.value }))
                }
                className="bg-muted/30 border-border resize-none h-32"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Folder</Label>
              <Select
                value={form.folderId}
                onValueChange={(v) => setForm((f) => ({ ...f, folderId: v }))}
              >
                <SelectTrigger className="bg-muted/30 border-border">
                  <SelectValue placeholder="Select folder" />
                </SelectTrigger>
                <SelectContent>
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Tags</Label>
              <Input
                placeholder="calculus, formulas, important (comma-separated)"
                value={form.tags}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tags: e.target.value }))
                }
                className="bg-muted/30 border-border"
              />
              <p className="text-xs text-muted-foreground">
                Separate tags with commas
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Attachment</Label>
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.txt"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-3.5 h-3.5" />
                  {pendingBlob ? "Change file" : "Upload file"}
                </Button>
                {uploadProgress !== null && (
                  <span className="text-xs text-muted-foreground self-center">
                    {uploadProgress}%
                  </span>
                )}
                {pendingBlob && (
                  <span className="text-xs text-success self-center flex items-center gap-1">
                    <FileCheck className="w-3 h-3" />
                    File ready
                  </span>
                )}
                {noteDialog.editing?.blob && !pendingBlob && (
                  <span className="text-xs text-muted-foreground self-center">
                    Existing file attached
                  </span>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNoteDialog({ open: false })}
            >
              Cancel
            </Button>
            <Button onClick={saveNote}>
              {noteDialog.editing ? "Save Changes" : "Create Note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Folder dialog */}
      <Dialog
        open={folderDialog.open}
        onOpenChange={(o) => setFolderDialog({ open: o })}
      >
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display">
              {folderDialog.editing ? "Rename Folder" : "New Folder"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                placeholder="Folder name"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveFolder()}
                className="bg-muted/30 border-border"
                autoFocus
              />
            </div>
            {!folderDialog.editing && (
              <div className="space-y-1.5">
                <Label>Parent Folder (optional)</Label>
                <Select
                  value={folderParentId}
                  onValueChange={setFolderParentId}
                >
                  <SelectTrigger className="bg-muted/30 border-border">
                    <SelectValue placeholder="No parent (root)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No parent (root)</SelectItem>
                    {folders.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFolderDialog({ open: false })}
            >
              Cancel
            </Button>
            <Button onClick={saveFolder}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move note dialog */}
      <Dialog
        open={!!moveNoteDialog}
        onOpenChange={(o) => !o && setMoveNoteDialog(null)}
      >
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display">Move Note</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-1.5">
            <Label>Select destination folder</Label>
            <Select value={moveFolderId} onValueChange={setMoveFolderId}>
              <SelectTrigger className="bg-muted/30 border-border">
                <SelectValue placeholder="Choose folder" />
              </SelectTrigger>
              <SelectContent>
                {folders.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveNoteDialog(null)}>
              Cancel
            </Button>
            <Button onClick={handleMoveNote} disabled={!moveFolderId}>
              Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog
        open={!!previewNote}
        onOpenChange={(o) => !o && setPreviewNote(null)}
      >
        <DialogContent className="sm:max-w-2xl bg-card border-border max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="font-display">
              {previewNote?.title}
            </DialogTitle>
          </DialogHeader>
          {previewNote?.blob &&
            (() => {
              const url = previewNote.blob.getDirectURL();
              const isImage = /\.(jpg|jpeg|png|gif|webp|svg)/i.test(url);
              const isPdf = /\.pdf/i.test(url);
              if (isImage) {
                return (
                  <img src={url} alt="preview" className="w-full rounded-lg" />
                );
              }
              if (isPdf) {
                return (
                  <iframe
                    src={url}
                    className="w-full h-96 rounded-lg border border-border"
                    title="PDF preview"
                  />
                );
              }
              return (
                <div className="text-center py-8">
                  <File className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline text-sm"
                  >
                    Open file in new tab
                  </a>
                </div>
              );
            })()}
        </DialogContent>
      </Dialog>

      {/* Delete note confirmation */}
      <AlertDialog
        open={!!deleteNoteId}
        onOpenChange={(o) => !o && setDeleteNoteId(null)}
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              Delete Note?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/80"
              onClick={() => deleteNoteId && handleDeleteNote(deleteNoteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete folder confirmation */}
      <AlertDialog
        open={!!deleteFolderId}
        onOpenChange={(o) => !o && setDeleteFolderId(null)}
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              Delete Folder?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the folder. Notes inside must be
              moved first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/80"
              onClick={() =>
                deleteFolderId && handleDeleteFolder(deleteFolderId)
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
