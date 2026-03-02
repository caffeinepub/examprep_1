import { Toaster } from "@/components/ui/sonner";
import { BookOpen, Calendar, FileText, GraduationCap } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import ExamsTab from "./pages/ExamsTab";
import NotesTab from "./pages/NotesTab";
import SyllabusTab from "./pages/SyllabusTab";

type Tab = "exams" | "syllabus" | "notes";

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("exams");

  const tabs = [
    { id: "exams" as Tab, label: "Exams", icon: Calendar },
    { id: "syllabus" as Tab, label: "Syllabus", icon: BookOpen },
    { id: "notes" as Tab, label: "Notes", icon: FileText },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md bg-primary/20 border border-primary/30 flex items-center justify-center">
                <GraduationCap className="w-4 h-4 text-primary" />
              </div>
              <span className="font-display font-semibold text-foreground tracking-tight text-base">
                ExamPrep
              </span>
            </div>

            {/* Navigation */}
            <nav className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  type="button"
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`
                    relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium
                    transition-all duration-200
                    ${
                      activeTab === id
                        ? "text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }
                  `}
                >
                  {activeTab === id && (
                    <motion.span
                      layoutId="tab-bg"
                      className="absolute inset-0 bg-primary rounded-md"
                      style={{ borderRadius: 6 }}
                      transition={{
                        type: "spring",
                        bounce: 0.2,
                        duration: 0.4,
                      }}
                    />
                  )}
                  <Icon className="w-3.5 h-3.5 relative z-10" />
                  <span className="relative z-10">{label}</span>
                </button>
              ))}
            </nav>

            <div className="w-24" />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {activeTab === "exams" && <ExamsTab />}
            {activeTab === "syllabus" && <SyllabusTab />}
            {activeTab === "notes" && <NotesTab />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-3 px-6">
        <p className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()}.{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(
              window.location.hostname,
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            Built with ♥ using caffeine.ai
          </a>
        </p>
      </footer>

      <Toaster position="bottom-right" theme="dark" />
    </div>
  );
}
