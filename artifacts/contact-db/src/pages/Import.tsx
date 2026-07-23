import { useEffect, useRef, useState } from "react";
import { Upload, Download, CheckCircle2, AlertCircle, XCircle, FileText, ChevronRight, Loader2, Info } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ColumnDef {
  name: string;
  required: boolean;
  type: string;
  example: string;
  notes: string;
}

interface TemplateConfig {
  key: string;
  label: string;
  description: string;
  columns: ColumnDef[];
}

interface PreviewData {
  headers: string[];
  rows: Record<string, string>[];
  total: number;
}

interface ImportResult {
  inserted: number;
  skipped: number;
  errors: { row: number; reason: string }[];
}

// ── CSV client-side preview parser ────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let inQuotes = false;
  let current = "";
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseCSVPreview(text: string): PreviewData {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim().split("\n").filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [], total: 0 };
  const headers = parseCSVLine(lines[0]).map(h => h.trim());
  const dataLines = lines.slice(1);
  const rows = dataLines.slice(0, 5).map(line => {
    const vals = parseCSVLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = (vals[i] ?? "").trim(); });
    return obj;
  });
  return { headers, rows, total: dataLines.length };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TableSidebarItem({
  tpl,
  active,
  onClick,
}: {
  tpl: TemplateConfig;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3 rounded-lg flex items-center justify-between gap-2 transition-colors",
        active
          ? "bg-primary text-primary-foreground font-medium"
          : "hover:bg-accent text-muted-foreground hover:text-foreground",
      )}
    >
      <span className="text-sm">{tpl.label}</span>
      {active && <ChevronRight className="h-4 w-4 flex-shrink-0" />}
    </button>
  );
}

function DropZone({
  onFile,
  file,
  disabled,
}: {
  onFile: (f: File) => void;
  file: File | null;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={cn(
        "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors select-none",
        dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-accent/40",
        disabled && "opacity-50 pointer-events-none",
        file && "border-primary/40 bg-primary/5",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
      {file ? (
        <div className="flex flex-col items-center gap-2">
          <FileText className="h-8 w-8 text-primary" />
          <p className="font-medium text-sm">{file.name}</p>
          <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB · Click to change</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Upload className="h-8 w-8 text-muted-foreground" />
          <p className="font-medium text-sm">Drop your CSV here or click to browse</p>
          <p className="text-xs text-muted-foreground">CSV format · Max 25 MB</p>
        </div>
      )}
    </div>
  );
}

function PreviewTable({ preview }: { preview: PreviewData }) {
  if (preview.total === 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Preview</p>
        <span className="text-xs text-muted-foreground">
          Showing {Math.min(5, preview.total)} of {preview.total} row{preview.total !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="rounded-lg border overflow-x-auto">
        <table className="text-xs w-full">
          <thead>
            <tr className="bg-muted/50 border-b">
              {preview.headers.map(h => (
                <th key={h} className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row, i) => (
              <tr key={i} className="border-b last:border-0 hover:bg-accent/40">
                {preview.headers.map(h => (
                  <td key={h} className="px-3 py-2 max-w-[200px] truncate whitespace-nowrap text-muted-foreground">
                    {row[h] || <span className="opacity-30 italic">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ResultBanner({ result }: { result: ImportResult }) {
  return (
    <div className="rounded-xl border p-4 space-y-3">
      <p className="font-medium text-sm">Import complete</p>
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
          <CheckCircle2 className="h-4 w-4" />
          <span><strong>{result.inserted}</strong> inserted</span>
        </div>
        {result.skipped > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
            <AlertCircle className="h-4 w-4" />
            <span><strong>{result.skipped}</strong> skipped (already exist)</span>
          </div>
        )}
        {result.errors.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            <XCircle className="h-4 w-4" />
            <span><strong>{result.errors.length}</strong> error{result.errors.length !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>
      {result.errors.length > 0 && (
        <div className="space-y-1 mt-2">
          <p className="text-xs font-medium text-muted-foreground">Errors:</p>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {result.errors.map((e, i) => (
              <p key={i} className="text-xs text-destructive bg-destructive/5 rounded px-2 py-1">
                Row {e.row}: {e.reason}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Import() {
  const [templates, setTemplates] = useState<TemplateConfig[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>("companies");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    document.title = "Import · Whyhello";
    return () => { document.title = "Whyhello"; };
  }, []);

  useEffect(() => {
    fetch("/api/bulk-upload/templates")
      .then(r => r.json())
      .then(setTemplates);
  }, []);

  const selected = templates.find(t => t.key === selectedKey);

  function selectTable(key: string) {
    setSelectedKey(key);
    setFile(null);
    setPreview(null);
    setResult(null);
  }

  function handleFile(f: File) {
    setFile(f);
    setResult(null);
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      setPreview(parseCSVPreview(text));
    };
    reader.readAsText(f);
  }

  async function handleImport() {
    if (!file || !selectedKey) return;
    setImporting(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/bulk-upload/${selectedKey}`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setResult(data);
    } catch (err) {
      setResult({ inserted: 0, skipped: 0, errors: [{ row: 0, reason: String(err) }] });
    } finally {
      setImporting(false);
    }
  }

  function handleDownloadTemplate() {
    if (!selectedKey) return;
    const a = document.createElement("a");
    a.href = `/api/bulk-upload/template/${selectedKey}`;
    a.download = `${selectedKey}_template.csv`;
    a.click();
  }

  return (
    <Shell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Data Import</h1>
          <p className="text-muted-foreground mt-1">
            Download a template, fill it with your data, and upload it to bulk-load records into the platform.
          </p>
        </div>

        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className="w-52 flex-shrink-0 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-3">Tables</p>
            {templates.map(tpl => (
              <TableSidebarItem
                key={tpl.key}
                tpl={tpl}
                active={tpl.key === selectedKey}
                onClick={() => selectTable(tpl.key)}
              />
            ))}
          </aside>

          {/* Main content */}
          {selected ? (
            <div className="flex-1 min-w-0 space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">{selected.label}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{selected.description}</p>
                </div>
                <Button variant="outline" className="flex-shrink-0 gap-2" onClick={handleDownloadTemplate}>
                  <Download className="h-4 w-4" />
                  Download template
                </Button>
              </div>

              {/* Column reference */}
              <div className="rounded-xl border overflow-hidden">
                <div className="px-4 py-3 bg-muted/40 border-b flex items-center gap-2">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Column reference</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/20">
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-36">Column</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-20">Required</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-24">Type</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Example</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.columns.map((col, i) => (
                        <tr key={col.name} className={cn("border-b last:border-0", i % 2 === 0 ? "" : "bg-muted/10")}>
                          <td className="px-4 py-2.5">
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{col.name}</code>
                          </td>
                          <td className="px-4 py-2.5">
                            {col.required ? (
                              <span className="text-xs font-medium text-destructive">Yes</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">Optional</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">{col.type}</td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">{col.example}</td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">{col.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Upload */}
              <div className="space-y-4">
                <p className="text-sm font-medium">Upload your CSV</p>
                <DropZone onFile={handleFile} file={file} disabled={importing} />
              </div>

              {/* Preview */}
              {preview && preview.total > 0 && (
                <PreviewTable preview={preview} />
              )}

              {/* Import button */}
              {file && !result && (
                <div className="flex items-center gap-3">
                  <Button
                    onClick={handleImport}
                    disabled={importing || !file}
                    className="gap-2"
                  >
                    {importing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Importing…
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Import {preview?.total ? `${preview.total} row${preview.total !== 1 ? "s" : ""}` : ""}
                      </>
                    )}
                  </Button>
                  {!importing && (
                    <Button
                      variant="ghost"
                      onClick={() => { setFile(null); setPreview(null); setResult(null); }}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              )}

              {/* Results */}
              {result && (
                <div className="space-y-3">
                  <ResultBanner result={result} />
                  <Button
                    variant="outline"
                    onClick={() => { setFile(null); setPreview(null); setResult(null); }}
                  >
                    Import another file
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Loading…
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
