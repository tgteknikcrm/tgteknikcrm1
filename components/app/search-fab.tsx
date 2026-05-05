"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  Loader2,
  Factory,
  Users,
  Wrench,
  FileText,
  ShoppingCart,
  Truck,
  Image as ImageIcon,
  ClipboardCheck,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toolImagePublicUrl } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type Group = {
  key: string;
  label: string;
  icon: LucideIcon;
  items: {
    id: string;
    title: string;
    subtitle?: string;
    href: string;
    thumb?: string | null;
  }[];
};

export function SearchFab() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Keyboard shortcut: Cmd/Ctrl+K or "/"
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isModK =
        (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      const isSlash =
        e.key === "/" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement);
      if (isModK || isSlash) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    // Custom event so other components (e.g. the Topbar search button) can
    // open this command palette without dispatching synthetic keyboard events.
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("tg-open-search", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("tg-open-search", onOpen);
    };
  }, []);

  const runSearch = useCallback(async (term: string) => {
    const supabase = createClient();
    const like = `%${term}%`;

    const [machines, operators, tools, jobs, orders, suppliers, drawings, qcSpecs] =
      await Promise.all([
        supabase
          .from("machines")
          .select("id, name, model, type")
          .or(`name.ilike.${like},model.ilike.${like},type.ilike.${like}`)
          .limit(5),
        supabase
          .from("operators")
          .select("id, full_name, employee_no, phone")
          .or(
            `full_name.ilike.${like},employee_no.ilike.${like},phone.ilike.${like}`,
          )
          .limit(5),
        supabase
          .from("tools")
          .select("id, code, name, type, location, image_path")
          .or(
            `name.ilike.${like},code.ilike.${like},type.ilike.${like},location.ilike.${like}`,
          )
          .limit(5),
        supabase
          .from("jobs")
          .select("id, job_no, customer, part_name, part_no")
          .or(
            `job_no.ilike.${like},customer.ilike.${like},part_name.ilike.${like},part_no.ilike.${like}`,
          )
          .limit(5),
        supabase
          .from("purchase_orders")
          .select("id, order_no, supplier:suppliers(name)")
          .or(`order_no.ilike.${like},notes.ilike.${like}`)
          .limit(5),
        supabase
          .from("suppliers")
          .select("id, name, contact_person, phone")
          .or(
            `name.ilike.${like},contact_person.ilike.${like},phone.ilike.${like}`,
          )
          .limit(5),
        supabase
          .from("drawings")
          .select("id, title, revision, file_type")
          .or(`title.ilike.${like},revision.ilike.${like}`)
          .limit(5),
        supabase
          .from("quality_specs")
          .select("id, bubble_no, description, job_id, jobs(part_name, customer)")
          .or(`description.ilike.${like}`)
          .limit(5),
      ]);

    type OrderItem = { id: string; order_no: string | null; supplier: { name: string } | null };
    type QcSpecItem = {
      id: string;
      bubble_no: number | null;
      description: string;
      job_id: string;
      jobs: { part_name: string; customer: string } | null;
    };

    const next: Group[] = [
      {
        key: "machines",
        label: "Makineler",
        icon: Factory,
        items: (machines.data ?? []).map((m) => ({
          id: m.id,
          title: m.name,
          subtitle: [m.type, m.model].filter(Boolean).join(" · ") || undefined,
          href: `/machines/${m.id}`,
        })),
      },
      {
        key: "operators",
        label: "Operatörler",
        icon: Users,
        items: (operators.data ?? []).map((o) => ({
          id: o.id,
          title: o.full_name,
          subtitle: [o.employee_no, o.phone].filter(Boolean).join(" · ") || undefined,
          href: `/operators`,
        })),
      },
      {
        key: "tools",
        label: "Takımlar",
        icon: Wrench,
        items: (tools.data ?? []).map((t) => ({
          id: t.id,
          title: t.name,
          subtitle: [t.code, t.type, t.location].filter(Boolean).join(" · ") || undefined,
          href: `/tools?q=${encodeURIComponent(t.name)}`,
          thumb: toolImagePublicUrl(t.image_path),
        })),
      },
      {
        key: "jobs",
        label: "İşler",
        icon: FileText,
        items: (jobs.data ?? []).map((j) => ({
          id: j.id,
          title: j.part_name,
          subtitle: [j.job_no, j.customer, j.part_no].filter(Boolean).join(" · ") || undefined,
          href: `/jobs`,
        })),
      },
      {
        key: "orders",
        label: "Siparişler",
        icon: ShoppingCart,
        items: (orders.data as unknown as OrderItem[] | null ?? []).map((o) => ({
          id: o.id,
          title: o.order_no || "—",
          subtitle: o.supplier?.name || undefined,
          href: `/orders/${o.id}`,
        })),
      },
      {
        key: "suppliers",
        label: "Tedarikçiler",
        icon: Truck,
        items: (suppliers.data ?? []).map((s) => ({
          id: s.id,
          title: s.name,
          subtitle: [s.contact_person, s.phone].filter(Boolean).join(" · ") || undefined,
          href: `/suppliers`,
        })),
      },
      {
        key: "drawings",
        label: "Teknik Resimler",
        icon: ImageIcon,
        items: (drawings.data ?? []).map((d) => ({
          id: d.id,
          title: d.title,
          subtitle: [d.revision, d.file_type].filter(Boolean).join(" · ") || undefined,
          href: `/drawings`,
        })),
      },
      {
        key: "qc",
        label: "Kalite Spec'leri",
        icon: ClipboardCheck,
        items: (qcSpecs.data as unknown as QcSpecItem[] | null ?? []).map((s) => ({
          id: s.id,
          title:
            s.bubble_no !== null
              ? `#${s.bubble_no} · ${s.description}`
              : s.description,
          subtitle:
            [s.jobs?.part_name, s.jobs?.customer].filter(Boolean).join(" · ") ||
            undefined,
          href: `/quality/${s.job_id}`,
        })),
      },
    ].filter((g) => g.items.length > 0);

    setGroups(next);
  }, []);

  // Debounced search
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        await runSearch(term);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [q, runSearch]);

  const totalResults = useMemo(
    () => groups.reduce((s, g) => s + g.items.length, 0),
    [groups],
  );

  function onPick(href: string) {
    setOpen(false);
    setQ("");
    router.push(href);
  }

  return (
    <>
      {/* The floating button was removed — search is now opened from the
          topbar pill or via ⌘K / "/" / `tg-open-search` event. The dialog
          itself is kept; it's the actual command palette. */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl p-0 gap-0 top-[20%] translate-y-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Arama</DialogTitle>
            <DialogDescription>
              Makine, operatör, takım, iş, sipariş, tedarikçi, teknik resim
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 p-3 border-b">
            <Search className="size-4 text-muted-foreground shrink-0" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Makine, operatör, takım, iş, sipariş, tedarikçi..."
              className="border-0 shadow-none focus-visible:ring-0 h-9 px-0"
            />
            {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {q.trim().length < 2 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <Search className="size-6 mx-auto mb-2 opacity-40" />
                En az 2 harf yazıp arayabilirsin.
                <div className="mt-3 text-xs">
                  <span className="inline-flex items-center gap-1">
                    Kısayol:
                    <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                      /
                    </kbd>
                    ya da
                    <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                      ⌘K
                    </kbd>
                  </span>
                </div>
              </div>
            ) : totalResults === 0 && !loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Sonuç bulunamadı.
              </div>
            ) : (
              <div className="py-2">
                {groups.map((g) => (
                  <div key={g.key} className="mb-1">
                    <div className="px-4 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <g.icon className="size-3" />
                      {g.label}
                      <span className="opacity-60 normal-case tracking-normal">
                        ({g.items.length})
                      </span>
                    </div>
                    {g.items.map((it) => (
                      <Link
                        key={it.id}
                        href={it.href}
                        onClick={(e) => {
                          e.preventDefault();
                          onPick(it.href);
                        }}
                        className="flex items-start gap-3 px-4 py-2 hover:bg-accent transition-colors"
                      >
                        <div className="size-8 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5 overflow-hidden">
                          {it.thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={it.thumb}
                              alt=""
                              className="size-full object-cover"
                            />
                          ) : (
                            <g.icon className="size-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">
                            {it.title}
                          </div>
                          {it.subtitle && (
                            <div className="text-xs text-muted-foreground truncate">
                              {it.subtitle}
                            </div>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
