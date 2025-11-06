import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Download,
  FileJson,
  Image as ImageIcon,
  LayoutGrid,
  Loader2,
  Play,
  RefreshCw,
  Settings,
  Sparkles,
  Upload,
} from "lucide-react";

// ================== Types matching backend JSON ==================
export type Dialogue = {
  speaker?: string;
  text: string;
  bubble?: {
    type?: "speech" | "thought" | "narration";
    position?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";
  };
};

export type Panel = {
  id: string;
  prompt?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  dialogues?: Dialogue[];
  seed?: number;
  style?: string;
  background?: string;
};

export type Page = {
  index: number; // 0-based
  panels: Panel[]; // 4 per page (2x2)
};

export type ComicProject = {
  title: string;
  pages: Page[]; // 4 pages
  characters?: string[];
  synopsis?: string;
  createdAt?: string;
  runId?: string;
};

// ================== Mock data so you can demo now ==================
const mockProject = (): ComicProject => {
  const title = "The Coffee Quest";
  const characters = ["Kai", "Robo-Barista-7"];
  const synopsis =
    "Kai races to brew the last bag of beans while the cafe's AI barista learns about humanity one espresso at a time.";
  const pages: Page[] = Array.from({ length: 4 }).map((_, pi) => ({
    index: pi,
    panels: Array.from({ length: 4 }).map((__, i) => ({
      id: `p${pi}x${i}`,
      prompt: `Panel ${i + 1} on page ${pi + 1} showing Kai and Robo-Barista-7 continuing the coffee adventure, cozy manga style, consistent characters, cafe background.`,
      imageUrl: `https://picsum.photos/seed/coffee_${pi}_${i}/800/800`,
      thumbnailUrl: `https://picsum.photos/seed/coffee_${pi}_${i}/400/400`,
      dialogues: [
        {
          speaker: i % 2 === 0 ? "Kai" : "Robo-Barista-7",
          text: i % 2 === 0 ? "We’re almost out of beans!" : "Optimizing brew parameters… trust the algorithm.",
          bubble: { type: "speech", position: i % 2 === 0 ? "top-left" : "top-right" },
        },
      ],
      seed: 1234 + i,
      style: "manga-ink",
      background: "cozy cafe interior",
    })),
  }));
  return { title, pages, characters, synopsis, createdAt: new Date().toISOString() };
};

// ================== PDF export helper (html2canvas + jsPDF) ==================
async function exportNodeToPDF(node: HTMLElement, filename: string) {
  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF } = await import("jspdf");

  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageEls = Array.from(node.querySelectorAll<HTMLElement>("[data-comic-page]"));
  for (let i = 0; i < pageEls.length; i++) {
    const el = pageEls[i];
    const canvas = await html2canvas(el, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL("image/png");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 24;
    const usableW = pageWidth - margin * 2;
    const usableH = pageHeight - margin * 2;
    pdf.addImage(imgData, "PNG", margin, margin, usableW, usableH);
    if (i < pageEls.length - 1) pdf.addPage();
  }
  pdf.save(filename);
}

// ================== API placeholders (swap with your backend) ==================
const API = {
  createStory: async (payload: any): Promise<ComicProject> => {
    await new Promise((r) => setTimeout(r, 500));
    const base = mockProject();
    return { ...base, title: payload?.title || base.title };
  },
  startGeneration: async (_project: ComicProject): Promise<{ runId: string }> => {
    await new Promise((r) => setTimeout(r, 400));
    return { runId: Math.random().toString(36).slice(2) };
  },
  pollStatus: async (_runId: string): Promise<Partial<ComicProject>> => {
    await new Promise((r) => setTimeout(r, 800));
    // simulate that images came back
    return mockProject();
  },
};

// ================== Small UI helpers (plain HTML + Tailwind) ==================
const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div className="grid gap-1.5">
    <label className="text-sm font-medium text-gray-700">{label}</label>
    {children}
    {hint ? <p className="text-xs text-gray-500">{hint}</p> : null}
  </div>
);

const Bubble: React.FC<{ text: string; position?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center" }> = ({
  text,
  position = "top-left",
}) => (
  <div
    className={[
      "absolute max-w-[80%] rounded-2xl px-3 py-2 shadow-md bg-white/90 backdrop-blur border text-xs leading-snug",
      position.includes("top") ? "top-2" : "bottom-2",
      position.includes("left")
        ? "left-2"
        : position.includes("right")
        ? "right-2"
        : "left-1/2 -translate-x-1/2",
    ].join(" ")}
  >
    {text}
  </div>
);

const PanelView: React.FC<{ panel: Panel }> = ({ panel }) => (
  <div className="relative aspect-[1/1] overflow-hidden rounded-xl border bg-gray-100">
    {panel.imageUrl ? (
      <img src={panel.imageUrl} alt={panel.prompt || panel.id} className="h-full w-full object-cover" />
    ) : (
      <div className="h-full w-full grid place-items-center text-gray-500">
        <ImageIcon className="h-8 w-8 mb-2" />
        <span className="text-xs">Image pending</span>
      </div>
    )}
    {panel.dialogues?.map((d, idx) => (
      <Bubble key={idx} text={d.text} position={d.bubble?.position} />
    ))}
  </div>
);

const PageGrid: React.FC<{ page: Page }> = ({ page }) => (
  <div className="grid grid-cols-2 gap-3" data-comic-page>
    {page.panels.map((p) => (
      <PanelView key={p.id} panel={p} />
    ))}
  </div>
);

// ================== MAIN COMPONENT ==================
export default function ComicAIDemo() {
  const [project, setProject] = useState<ComicProject | null>(null);
  const [mockMode, setMockMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("The Coffee Quest");
  const [style, setStyle] = useState("manga-ink");
  const [theme, setTheme] = useState("cozy cafe, lighthearted");
  const [jsonInput, setJsonInput] = useState("");
  const pageWrapRef = useRef<HTMLDivElement>(null);

  const ready = Boolean(project);

  const handleCreateStory = async () => {
    setLoading(true);
    try {
      const created = await API.createStory({ title, style, theme });
      setProject(created);
    } finally {
      setLoading(false);
    }
  };

  const handleStartGeneration = async () => {
    if (!project) return;
    setLoading(true);
    try {
      const { runId } = await API.startGeneration(project);
      // in a real app you'd poll repeatedly; we simulate one poll
      const update = await API.pollStatus(runId);
      setProject((prev) => ({ ...(prev || mockProject()), ...(update as ComicProject) }));
    } finally {
      setLoading(false);
    }
  };

  const handleImportJSON = () => {
    try {
      const parsed: ComicProject = JSON.parse(jsonInput);
      setProject(parsed);
    } catch {
      alert("Invalid JSON");
    }
  };

  const handleExportPDF = async () => {
    if (!pageWrapRef.current) return;
    await exportNodeToPDF(pageWrapRef.current, `${project?.title || "comic"}.pdf`);
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-white to-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-6 md:py-10">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">ComicAI Demo</h1>
            <p className="text-sm text-gray-500">Automated multi-panel comic creation • Frontend by Jason</p>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={mockMode}
                onChange={(e) => setMockMode(e.target.checked)}
              />
              Mock mode
            </label>

            <button
              onClick={handleExportPDF}
              disabled={!ready}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-white disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Export PDF
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: Controls */}
          <div className="lg:col-span-1 space-y-6">
            {/* Story Setup */}
            <div className="rounded-xl border bg-white shadow-sm">
              <div className="p-4 border-b">
                <h3 className="font-semibold flex items-center gap-2">
                  <Sparkles className="h-5 w-5" /> Story Setup
                </h3>
                <p className="text-sm text-gray-500">Use this to request a structured JSON story from the LLM.</p>
              </div>
              <div className="p-4 space-y-4">
                <Field label="Title">
                  <input
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., The Coffee Quest"
                  />
                </Field>

                <Field label="Style" hint="e.g., manga-ink, western-color, watercolor">
                  <input
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                  />
                </Field>

                <Field label="Theme/Prompt to LLM">
                  <textarea
                    rows={3}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                  />
                </Field>
              </div>
              <div className="p-4 border-t flex gap-3">
                <button
                  onClick={handleCreateStory}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-white disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Generate Story JSON
                </button>

                <button
                  onClick={() => setProject(mockProject())}
                  className="inline-flex items-center gap-2 rounded-lg bg-gray-200 px-3 py-2 text-gray-900 hover:bg-gray-300"
                >
                  <RefreshCw className="h-4 w-4" />
                  Mock Story
                </button>
              </div>
            </div>

            {/* Image Generation */}
            <div className="rounded-xl border bg-white shadow-sm">
              <div className="p-4 border-b">
                <h3 className="font-semibold flex items-center gap-2">
                  <LayoutGrid className="h-5 w-5" /> Image Generation
                </h3>
                <p className="text-sm text-gray-500">Dispatch image jobs to Stability/Leonardo via backend.</p>
              </div>
              <div className="p-4">
                <p className="text-sm text-gray-500 mb-2">
                  This will call <code className="rounded bg-gray-100 px-1">POST /api/generate</code> and begin polling{" "}
                  <code className="rounded bg-gray-100 px-1">/api/status</code>.
                </p>
              </div>
              <div className="p-4 border-t">
                <button
                  onClick={handleStartGeneration}
                  disabled={!ready || loading}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 hover:bg-gray-100 disabled:opacity-50"
                >
                  <ImageIcon className="h-4 w-4" />
                  Start Generation
                </button>
              </div>
            </div>

            {/* Import/Export JSON */}
            <div className="rounded-xl border bg-white shadow-sm">
              <div className="p-4 border-b">
                <h3 className="font-semibold flex items-center gap-2">
                  <FileJson className="h-5 w-5" /> Import/Export JSON
                </h3>
                <p className="text-sm text-gray-500">Load a story from backend or paste JSON.</p>
              </div>
              <div className="p-4 space-y-3">
                <textarea
                  rows={6}
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder="Paste ComicProject JSON here"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex gap-3">
                  <button
                    onClick={handleImportJSON}
                    className="inline-flex items-center gap-2 rounded-lg bg-gray-200 px-3 py-2 text-gray-900 hover:bg-gray-300"
                  >
                    <Upload className="h-4 w-4" />
                    Import
                  </button>
                  <button
                    onClick={() => navigator.clipboard.writeText(JSON.stringify(project, null, 2))}
                    disabled={!ready}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 hover:bg-gray-100 disabled:opacity-50"
                  >
                    Copy Current JSON
                  </button>
                </div>
              </div>
            </div>

            {/* API Endpoints notes */}
            <div className="rounded-xl border bg-white shadow-sm">
              <div className="p-4 border-b">
                <h3 className="font-semibold flex items-center gap-2">
                  <Settings className="h-5 w-5" /> API Endpoints
                </h3>
                <p className="text-sm text-gray-500">Swap to real endpoints when your Node backend is live.</p>
              </div>
              <div className="p-4">
                <ul className="text-sm list-disc ml-5 space-y-1 text-gray-600">
                  <li>
                    <code className="rounded bg-gray-100 px-1">POST /api/story</code> → returns{" "}
                    <code className="rounded bg-gray-100 px-1">ComicProject</code> (prompts, dialogues)
                  </li>
                  <li>
                    <code className="rounded bg-gray-100 px-1">POST /api/generate</code> → returns{" "}
                    <code className="rounded bg-gray-100 px-1">{`{ runId }`}</code>
                  </li>
                  <li>
                    <code className="rounded bg-gray-100 px-1">GET /api/status?runId=</code> → streams panel image URLs
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* RIGHT: Preview */}
          <div className="lg:col-span-2">
            <div className="rounded-xl border bg-white shadow-sm">
              <div className="p-4 border-b">
                <h3 className="font-semibold">Preview</h3>
                <p className="text-sm text-gray-500">4 pages × 4 panels. Click Export to save as PDF.</p>
              </div>

              <div className="p-4">
                {!project ? (
                  <div className="h-64 grid place-items-center text-gray-500">
                    <p>No story yet. Generate or paste JSON to preview.</p>
                  </div>
                ) : (
                  <div ref={pageWrapRef} className="space-y-6">
                    {project.pages.map((page) => (
                      <motion.div
                        key={page.index}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: page.index * 0.05 }}
                        className="rounded-2xl border p-4 bg-white"
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <h4 className="font-medium">Page {page.index + 1}</h4>
                          <span className="text-xs text-gray-500">{project.title}</span>
                        </div>
                        <PageGrid page={page} />
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <div className="text-xs text-gray-400 mt-6">
          Tip: Replace the API functions in this file with real <code>fetch()</code> calls once your backend is live.
        </div>
      </div>
    </div>
  );
}
