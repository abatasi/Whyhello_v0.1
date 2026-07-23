import { useState, useEffect } from "react";
import { Link, useParams } from "wouter";
import { Factory, ArrowLeft, ExternalLink, Loader2, FileText } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { cn } from "@/lib/utils";

interface IndustryInsight {
  id: number;
  industryId: number | null;
  title: string;
  url: string;
  source: string | null;
  mediaType: string | null;
  description: string | null;
  publishedDate: string | null;
}

interface IndustryDetail {
  id: number;
  name: string;
  description: string | null;
  insights: IndustryInsight[];
}

const MEDIA_COLORS: Record<string, string> = {
  article: "bg-blue-50 text-blue-600 border-blue-100",
  podcast: "bg-orange-50 text-orange-600 border-orange-100",
  video: "bg-red-50 text-red-600 border-red-100",
  report: "bg-emerald-50 text-emerald-600 border-emerald-100",
  press_release: "bg-purple-50 text-purple-600 border-purple-100",
  social: "bg-sky-50 text-sky-600 border-sky-100",
  linkedin_post: "bg-sky-50 text-sky-600 border-sky-100",
  blog_post: "bg-teal-50 text-teal-600 border-teal-100",
};

function MediaTypeBadge({ type }: { type: string | null }) {
  if (!type) return null;
  const label = type.replace(/_/g, " ");
  const color = MEDIA_COLORS[type] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border", color)}>
      {label}
    </span>
  );
}

export default function IndustryDetail() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<IndustryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    document.title = "Industry · Whyhello";
    setLoading(true);
    fetch(`/api/industries/${params.id}`)
      .then(r => {
        if (r.status === 404) { setNotFound(true); setLoading(false); return null; }
        return r.json();
      })
      .then(d => {
        if (d) {
          setData(d);
          document.title = `${d.name} · Whyhello`;
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => { document.title = "Whyhello"; };
  }, [params.id]);

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      </Shell>
    );
  }

  if (notFound || !data) {
    return (
      <Shell>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center">
          <p className="text-muted-foreground text-sm">Industry not found.</p>
          <Link href="/industries">
            <span className="text-primary text-sm hover:underline cursor-pointer">← Back to Industries</span>
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <Link href="/industries">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 cursor-pointer w-fit">
            <ArrowLeft className="h-4 w-4" />
            Industries
          </div>
        </Link>

        <div className="flex items-start gap-4 mb-8">
          <div className="h-12 w-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
            <Factory className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{data.name}</h1>
            {data.description && (
              <p className="text-muted-foreground mt-1 text-sm">{data.description}</p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              {data.insights.length} insight{data.insights.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {data.insights.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3 rounded-xl border border-dashed">
            <FileText className="h-8 w-8 opacity-20" />
            <p className="text-sm">No insights yet. Use Import → Industry Insights to add them.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Insights</h2>
            <div className="rounded-xl border divide-y overflow-hidden">
              {data.insights.map(insight => (
                <div key={insight.id} className="px-4 py-4 hover:bg-accent/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {insight.mediaType && <MediaTypeBadge type={insight.mediaType} />}
                        {insight.source && (
                          <span className="text-xs text-muted-foreground">{insight.source}</span>
                        )}
                        {insight.publishedDate && (
                          <span className="text-xs text-muted-foreground">{insight.publishedDate}</span>
                        )}
                      </div>
                      <a
                        href={insight.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-sm hover:text-primary hover:underline transition-colors flex items-center gap-1.5 group"
                      >
                        {insight.title}
                        <ExternalLink className="h-3.5 w-3.5 opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0" />
                      </a>
                      {insight.description && (
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{insight.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
