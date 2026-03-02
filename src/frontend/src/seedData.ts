import type { Exam, Folder, Note, Subject } from "./types";

const now = Date.now();
const day = 24 * 60 * 60 * 1000;

export function getSeedExams(): Exam[] {
  return [
    {
      id: "exam-1",
      title: "Calculus II Midterm",
      subject: "Mathematics",
      completed: false,
      progress: 65n,
      examType: "Midterm",
      dateTime: BigInt(now + 2 * day) * 1_000_000n,
      location: "Room 201, Science Building",
    },
    {
      id: "exam-2",
      title: "Organic Chemistry Final",
      subject: "Chemistry",
      completed: false,
      progress: 40n,
      examType: "Final",
      dateTime: BigInt(now + 7 * day) * 1_000_000n,
      location: "Lecture Hall A",
    },
    {
      id: "exam-3",
      title: "Data Structures Quiz 4",
      subject: "Computer Science",
      completed: false,
      progress: 80n,
      examType: "Quiz",
      dateTime: BigInt(now + 1 * day) * 1_000_000n,
      location: "Online — Zoom",
    },
    {
      id: "exam-4",
      title: "World History Assignment",
      subject: "History",
      completed: true,
      progress: 100n,
      examType: "Assignment",
      dateTime: BigInt(now - 3 * day) * 1_000_000n,
      location: "Submit via Portal",
    },
  ];
}

export function getSeedSubjects(): Subject[] {
  return [
    {
      id: "subj-1",
      name: "Mathematics",
      chapters: [
        {
          id: "ch-1-1",
          name: "Integration Techniques",
          topics: [
            {
              id: "t-1-1-1",
              name: "Integration by Parts",
              completed: true,
              order: 0n,
              notes: "Remember the LIATE rule for choosing u and dv.",
              references: [
                "https://en.wikipedia.org/wiki/Integration_by_parts",
              ],
            },
            {
              id: "t-1-1-2",
              name: "Trigonometric Substitution",
              completed: true,
              order: 1n,
              notes: "Use for integrals with √(a²−x²), √(a²+x²), or √(x²−a²).",
              references: [],
            },
            {
              id: "t-1-1-3",
              name: "Partial Fractions",
              completed: false,
              order: 2n,
              notes: "",
              references: [
                "https://www.khanacademy.org/math/ap-calculus-bc/bc-integration-new/bc-6-9/a/partial-fraction-review",
              ],
            },
          ],
        },
        {
          id: "ch-1-2",
          name: "Sequences and Series",
          topics: [
            {
              id: "t-1-2-1",
              name: "Convergence Tests",
              completed: false,
              order: 0n,
              notes: "Ratio test, root test, integral test, comparison test.",
              references: [],
            },
            {
              id: "t-1-2-2",
              name: "Taylor Series",
              completed: false,
              order: 1n,
              notes: "",
              references: [],
            },
            {
              id: "t-1-2-3",
              name: "Power Series",
              completed: false,
              order: 2n,
              notes: "Radius and interval of convergence.",
              references: [],
            },
          ],
        },
      ],
    },
    {
      id: "subj-2",
      name: "Computer Science",
      chapters: [
        {
          id: "ch-2-1",
          name: "Trees and Graphs",
          topics: [
            {
              id: "t-2-1-1",
              name: "Binary Search Trees",
              completed: true,
              order: 0n,
              notes: "Insertion, deletion, search all O(log n) average case.",
              references: ["https://visualgo.net/en/bst"],
            },
            {
              id: "t-2-1-2",
              name: "AVL Trees",
              completed: true,
              order: 1n,
              notes: "Self-balancing BST with rotation operations.",
              references: [],
            },
            {
              id: "t-2-1-3",
              name: "Graph Traversal (BFS/DFS)",
              completed: false,
              order: 2n,
              notes: "",
              references: [],
            },
            {
              id: "t-2-1-4",
              name: "Dijkstra's Algorithm",
              completed: false,
              order: 3n,
              notes: "Shortest path — priority queue implementation.",
              references: [],
            },
          ],
        },
        {
          id: "ch-2-2",
          name: "Sorting Algorithms",
          topics: [
            {
              id: "t-2-2-1",
              name: "Merge Sort",
              completed: true,
              order: 0n,
              notes: "Divide and conquer, O(n log n) always.",
              references: [],
            },
            {
              id: "t-2-2-2",
              name: "Heap Sort",
              completed: false,
              order: 1n,
              notes: "",
              references: [],
            },
          ],
        },
      ],
    },
  ];
}

export function getSeedFolders(): Folder[] {
  return [
    { id: "folder-1", name: "Mathematics", parentId: undefined },
    { id: "folder-2", name: "Computer Science", parentId: undefined },
    { id: "folder-3", name: "Calculus Notes", parentId: "folder-1" },
  ];
}

export function getSeedNotes(): Note[] {
  return [
    {
      id: "note-1",
      title: "Integration by Parts Cheat Sheet",
      content:
        "Formula: ∫u dv = uv − ∫v du\n\nLIATE Rule:\n- L: Logarithmic\n- I: Inverse trig\n- A: Algebraic\n- T: Trigonometric\n- E: Exponential\n\nChoose u as the function that appears earliest in LIATE.",
      createdAt: BigInt(now - 5 * day) * 1_000_000n,
      tags: ["calculus", "formulas", "important"],
      pinned: true,
      folderId: "folder-3",
      favorite: true,
    },
    {
      id: "note-2",
      title: "Convergence Tests Summary",
      content:
        "1. Ratio Test: lim |a_{n+1}/a_n|\n   < 1: converges absolutely\n   > 1: diverges\n   = 1: inconclusive\n\n2. Root Test: lim |a_n|^{1/n}\n   Same criteria as ratio test\n\n3. Integral Test: If f(x) is positive, continuous, decreasing...",
      createdAt: BigInt(now - 2 * day) * 1_000_000n,
      tags: ["calculus", "series"],
      pinned: false,
      folderId: "folder-3",
      favorite: false,
    },
    {
      id: "note-3",
      title: "Graph Algorithms Overview",
      content:
        "BFS — uses queue, finds shortest path in unweighted graphs\nDFS — uses stack/recursion, detects cycles\n\nDijkstra:\n- Priority queue (min-heap)\n- O((V + E) log V)\n- Only non-negative weights\n\nBellman-Ford:\n- Handles negative weights\n- O(VE)",
      createdAt: BigInt(now - 1 * day) * 1_000_000n,
      tags: ["algorithms", "graphs", "exam-prep"],
      pinned: false,
      folderId: "folder-2",
      favorite: true,
    },
    {
      id: "note-4",
      title: "Sorting Complexity Table",
      content:
        "| Algorithm    | Best    | Avg     | Worst   | Space |\n|-------------|---------|---------|---------|-------|\n| Merge Sort  | O(n lgn)| O(n lgn)| O(n lgn)| O(n)  |\n| Quick Sort  | O(n lgn)| O(n lgn)| O(n²)  | O(lgn)|\n| Heap Sort   | O(n lgn)| O(n lgn)| O(n lgn)| O(1)  |\n| Tim Sort    | O(n)    | O(n lgn)| O(n lgn)| O(n)  |",
      createdAt: BigInt(now) * 1_000_000n,
      tags: ["algorithms", "complexity"],
      pinned: false,
      folderId: "folder-2",
      favorite: false,
    },
  ];
}
