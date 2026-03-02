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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  AlarmClock,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Edit2,
  Filter,
  MapPin,
  Plus,
  SortAsc,
  SortDesc,
  Trash2,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { getSeedExams } from "../seedData";
import type { Exam } from "../types";

// ── localStorage helpers ──────────────────────────────────────
const LS_KEY = "exams_local";

const BIGINT_KEYS = new Set(["dateTime", "progress"]);

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

function loadExams(): Exam[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw, bigIntReviver) as Exam[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      /* ignore */
    }
  }
  const seed = getSeedExams();
  saveExamsToStorage(seed);
  return seed;
}

function saveExamsToStorage(exams: Exam[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(exams, bigIntReplacer));
}

// ── display helpers ───────────────────────────────────────────
const EXAM_TYPES = ["Quiz", "Midterm", "Final", "Assignment", "Lab", "Other"];

const TYPE_COLORS: Record<string, string> = {
  Quiz: "bg-accent/20 text-accent border-accent/30",
  Midterm: "bg-primary/20 text-primary border-primary/30",
  Final: "bg-destructive/20 text-destructive border-destructive/30",
  Assignment: "bg-success/20 text-success border-success/30",
  Lab: "bg-warning/20 text-warning border-warning/30",
  Other: "bg-muted text-muted-foreground border-border",
};

function getCountdown(nanos: bigint): string {
  const ms = Number(nanos / 1_000_000n);
  const now = Date.now();
  const diff = ms - now;
  if (diff < 0) return "Past";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days === 0 && hours === 0) return "Today!";
  if (days === 0) return `${hours}h remaining`;
  if (days === 1 && hours === 0) return "Tomorrow";
  if (days === 1) return `Tomorrow, ${hours}h`;
  return `${days}d ${hours}h`;
}

function getCountdownUrgency(nanos: bigint): "urgent" | "soon" | "ok" | "past" {
  const ms = Number(nanos / 1_000_000n);
  const diff = ms - Date.now();
  if (diff < 0) return "past";
  if (diff < 24 * 60 * 60 * 1000) return "urgent";
  if (diff < 3 * 24 * 60 * 60 * 1000) return "soon";
  return "ok";
}

function formatDate(nanos: bigint): string {
  const ms = Number(nanos / 1_000_000n);
  return new Date(ms).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(nanos: bigint): string {
  const ms = Number(nanos / 1_000_000n);
  return new Date(ms).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

interface ExamFormData {
  title: string;
  subject: string;
  date: string;
  time: string;
  location: string;
  examType: string;
  progress: number;
}

const emptyForm: ExamFormData = {
  title: "",
  subject: "",
  date: "",
  time: "10:00",
  location: "",
  examType: "Midterm",
  progress: 0,
};

export default function ExamsTab() {
  // Single source of truth: plain state, persisted synchronously to localStorage
  const [exams, setExams] = useState<Exam[]>(() => loadExams());

  function updateExams(next: Exam[]) {
    saveExamsToStorage(next);
    setExams(next);
  }

  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [filterSubject, setFilterSubject] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [showDialog, setShowDialog] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<ExamFormData>(emptyForm);
  const [dismissedBanners, setDismissedBanners] = useState<Set<string>>(
    new Set(),
  );
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [tick, setTick] = useState(0);

  // Live countdown tick every minute
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const subjects = [...new Set(exams.map((e) => e.subject))];

  const urgentExams = exams
    .filter((e) => {
      if (e.completed) return false;
      const u = getCountdownUrgency(e.dateTime);
      return u === "urgent" || u === "soon";
    })
    .filter((e) => !dismissedBanners.has(e.id));

  const filtered = exams
    .filter((e) => filterSubject === "all" || e.subject === filterSubject)
    .sort((a, b) => {
      const diff = Number(a.dateTime - b.dateTime);
      return sortOrder === "asc" ? diff : -diff;
    });

  function openCreate() {
    setEditingExam(null);
    setForm(emptyForm);
    setShowDialog(true);
  }

  function openEdit(exam: Exam) {
    setEditingExam(exam);
    const ms = Number(exam.dateTime / 1_000_000n);
    const d = new Date(ms);
    setForm({
      title: exam.title,
      subject: exam.subject,
      date: d.toISOString().split("T")[0],
      time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
      location: exam.location,
      examType: exam.examType,
      progress: Number(exam.progress),
    });
    setShowDialog(true);
  }

  function handleSave() {
    if (!form.title || !form.date) {
      toast.error("Title and date are required");
      return;
    }
    const dateMs = new Date(`${form.date}T${form.time}`).getTime();
    const exam: Exam = {
      id: editingExam?.id ?? crypto.randomUUID(),
      title: form.title,
      subject: form.subject,
      completed: editingExam?.completed ?? false,
      progress: BigInt(form.progress),
      examType: form.examType,
      dateTime: BigInt(dateMs) * 1_000_000n,
      location: form.location,
    };
    if (editingExam) {
      updateExams(exams.map((e) => (e.id === exam.id ? exam : e)));
      toast.success("Exam updated");
    } else {
      updateExams([...exams, exam]);
      toast.success("Exam added");
    }
    setShowDialog(false);
  }

  function handleToggleComplete(exam: Exam) {
    const updated = { ...exam, completed: !exam.completed };
    updateExams(exams.map((e) => (e.id === exam.id ? updated : e)));
    toast.success(exam.completed ? "Marked incomplete" : "Marked complete");
  }

  function handleDelete(id: string) {
    updateExams(exams.filter((e) => e.id !== id));
    toast.success("Exam deleted");
    setDeleteId(null);
  }

  const calendarYear = calendarDate.getFullYear();
  const calendarMonth = calendarDate.getMonth();
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(calendarYear, calendarMonth, 1).getDay();

  const examsOnDay = useCallback(
    (day: number) => {
      const start = new Date(calendarYear, calendarMonth, day).getTime();
      const end = start + 24 * 60 * 60 * 1000;
      return exams.filter((e) => {
        const ms = Number(e.dateTime / 1_000_000n);
        return ms >= start && ms < end;
      });
    },
    [exams, calendarYear, calendarMonth],
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Urgent banners */}
      <AnimatePresence>
        {urgentExams.map((exam) => {
          const urgency = getCountdownUrgency(exam.dateTime);
          return (
            <motion.div
              key={exam.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className={`rounded-xl px-4 py-3 flex items-center gap-3 border ${
                urgency === "urgent"
                  ? "bg-destructive/10 border-destructive/30 text-destructive"
                  : "bg-warning/10 border-warning/30 text-warning"
              }`}
            >
              <AlarmClock className="w-4 h-4 shrink-0" />
              <p className="text-sm font-medium flex-1">
                <span className="font-semibold">{exam.title}</span>{" "}
                {urgency === "urgent" ? "is today!" : "is in less than 3 days!"}{" "}
                ({getCountdown(exam.dateTime)})
              </p>
              <button
                type="button"
                onClick={() =>
                  setDismissedBanners((s) => new Set([...s, exam.id]))
                }
                className="opacity-60 hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={filterSubject} onValueChange={setFilterSubject}>
            <SelectTrigger className="w-40 h-8 text-sm bg-card border-border">
              <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="All subjects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All subjects</SelectItem>
              {subjects.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            className="h-8 text-sm gap-1.5"
            onClick={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
          >
            {sortOrder === "asc" ? (
              <SortAsc className="w-3.5 h-3.5" />
            ) : (
              <SortDesc className="w-3.5 h-3.5" />
            )}
            {sortOrder === "asc" ? "Oldest first" : "Newest first"}
          </Button>

          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "list"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              List
            </button>
            <button
              type="button"
              onClick={() => setViewMode("calendar")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "calendar"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              Calendar
            </button>
          </div>
        </div>

        <Button onClick={openCreate} size="sm" className="h-8 gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          Add Exam
        </Button>
      </div>

      {/* Calendar view */}
      {viewMode === "calendar" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-card rounded-xl border border-border p-5 card-glow"
        >
          {/* Calendar header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-foreground">
              {calendarDate.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </h3>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() =>
                  setCalendarDate(new Date(calendarYear, calendarMonth - 1))
                }
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() =>
                  setCalendarDate(new Date(calendarYear, calendarMonth + 1))
                }
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
          {/* Days of week */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div
                key={d}
                className="text-center text-xs font-medium text-muted-foreground py-1"
              >
                {d}
              </div>
            ))}
          </div>
          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDayOfMonth }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: empty calendar cells
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayExams = examsOnDay(day);
              const isToday =
                new Date().getDate() === day &&
                new Date().getMonth() === calendarMonth &&
                new Date().getFullYear() === calendarYear;
              return (
                <div
                  key={day}
                  className={`min-h-[52px] rounded-lg p-1.5 border text-xs transition-colors ${
                    isToday
                      ? "border-primary/50 bg-primary/10"
                      : "border-border bg-muted/20 hover:bg-muted/40"
                  }`}
                >
                  <span
                    className={`font-medium text-xs block mb-0.5 ${isToday ? "text-primary" : "text-muted-foreground"}`}
                  >
                    {day}
                  </span>
                  {dayExams.map((e) => (
                    <div
                      key={e.id}
                      className={`rounded px-1 py-0.5 text-[10px] font-medium truncate mb-0.5 ${
                        TYPE_COLORS[e.examType] ?? TYPE_COLORS.Other
                      }`}
                    >
                      {e.title}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* List view */}
      {viewMode === "list" && (
        <div className="space-y-3" key={tick}>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <CalendarDays className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <p className="font-display font-semibold text-foreground/60 mb-1">
                No exams yet
              </p>
              <p className="text-sm text-muted-foreground">
                Add your first exam to get started
              </p>
            </div>
          ) : (
            filtered.map((exam, idx) => {
              const urgency = getCountdownUrgency(exam.dateTime);
              const countdown = getCountdown(exam.dateTime);
              return (
                <motion.div
                  key={exam.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className={`group bg-card rounded-xl border transition-all duration-200 hover:shadow-card-hover ${
                    exam.completed
                      ? "border-border opacity-60"
                      : urgency === "urgent"
                        ? "border-destructive/30"
                        : urgency === "soon"
                          ? "border-warning/30"
                          : "border-border card-glow"
                  }`}
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Complete toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleComplete(exam)}
                        className="mt-0.5 shrink-0 text-muted-foreground hover:text-success transition-colors"
                      >
                        {exam.completed ? (
                          <CheckCircle2 className="w-5 h-5 text-success" />
                        ) : (
                          <Circle className="w-5 h-5" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <h3
                              className={`font-display font-semibold text-base leading-tight ${
                                exam.completed
                                  ? "line-through text-muted-foreground"
                                  : "text-foreground"
                              }`}
                            >
                              {exam.title}
                            </h3>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {exam.subject}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Badge
                              className={`text-xs px-2 py-0.5 border ${TYPE_COLORS[exam.examType] ?? TYPE_COLORS.Other}`}
                              variant="outline"
                            >
                              {exam.examType}
                            </Badge>
                            {!exam.completed && (
                              <span
                                className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                                  urgency === "urgent"
                                    ? "bg-destructive/10 text-destructive border-destructive/30"
                                    : urgency === "soon"
                                      ? "bg-warning/10 text-warning border-warning/30"
                                      : urgency === "past"
                                        ? "bg-muted text-muted-foreground border-border"
                                        : "bg-accent/10 text-accent border-accent/30"
                                }`}
                              >
                                {countdown}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Meta row */}
                        <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(exam.dateTime)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(exam.dateTime)}
                          </span>
                          {exam.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {exam.location}
                            </span>
                          )}
                        </div>

                        {/* Progress */}
                        <div className="mt-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              Prep progress
                            </span>
                            <span className="text-xs font-medium text-foreground">
                              {Number(exam.progress)}%
                            </span>
                          </div>
                          <Progress
                            value={Number(exam.progress)}
                            className="h-1.5"
                          />
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => openEdit(exam)}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteId(exam.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingExam ? "Edit Exam" : "Add Exam"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="e.g. Calculus II Midterm"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                className="bg-muted/30 border-border"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                placeholder="e.g. Mathematics"
                value={form.subject}
                onChange={(e) =>
                  setForm((f) => ({ ...f, subject: e.target.value }))
                }
                className="bg-muted/30 border-border"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={form.date}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, date: e.target.value }))
                  }
                  className="bg-muted/30 border-border"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="time">Time</Label>
                <Input
                  id="time"
                  type="time"
                  value={form.time}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, time: e.target.value }))
                  }
                  className="bg-muted/30 border-border"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="e.g. Room 201"
                value={form.location}
                onChange={(e) =>
                  setForm((f) => ({ ...f, location: e.target.value }))
                }
                className="bg-muted/30 border-border"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Exam Type</Label>
              <Select
                value={form.examType}
                onValueChange={(v) => setForm((f) => ({ ...f, examType: v }))}
              >
                <SelectTrigger className="bg-muted/30 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXAM_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Prep Progress</Label>
                <span className="text-sm font-medium text-primary">
                  {form.progress}%
                </span>
              </div>
              <Slider
                min={0}
                max={100}
                step={5}
                value={[form.progress]}
                onValueChange={([v]) => setForm((f) => ({ ...f, progress: v }))}
                className="w-full"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editingExam ? "Save Changes" : "Add Exam"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              Delete Exam?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/80"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
