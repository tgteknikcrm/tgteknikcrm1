"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Box,
  Briefcase,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Cog,
  FileText,
  HardDrive,
  Image as ImageIcon,
  Loader2,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Tag,
  Trash2,
  Wrench,
} from "lucide-react";
import { ProductImageGallery } from "./product-image-gallery";
import { ProductDrawingsTab } from "./[id]/product-drawings-tab";
import { ProductCadTab } from "./[id]/product-cad-tab";
import { toast } from "sonner";
import {
  HEAT_TREATMENT_PRESETS,
  MATERIAL_PRESETS,
  PRODUCT_CATEGORY_PRESETS,
  PRODUCT_PROCESS_LABEL,
  PRODUCT_STATUS_LABEL,
  SURFACE_TREATMENT_PRESETS,
  TOLERANCE_CLASS_PRESETS,
  type Machine,
  type Product,
  type ProductCurrency,
  type ProductMachineCycle,
  type ProductProcess,
  type ProductStatus,
  type ProductTool,
  type Tool,
} from "@/lib/supabase/types";
import { saveProduct, type SaveProductInput } from "./actions";
import { cn } from "@/lib/utils";

interface Props {
  // Both create + edit; null/undefined = create flow.
  product?: Product | null;
  existingTools?: ProductTool[];
  /** Per-machine timing override rows already saved for this product. */
  existingMachineCycles?: ProductMachineCycle[];
  tools: Tool[];
  machines: Pick<Machine, "id" | "name">[];
}

// In-memory shape for the per-machine matrix. Strings so empty fields
// stay empty (vs. forcing 0). Empty → null on save → fallback to product
// default at runtime.
interface MachineCycleRow {
  machine_id: string;
  cycle_seconds: string;
  swap_seconds: string;
  setup_seconds: string;
  parts_per_setup: string;
}

interface ToolRow {
  tool_id: string;
  quantity_used: number;
}

const STATUSES: ProductStatus[] = ["aktif", "taslak", "pasif"];
const PROCESSES: ProductProcess[] = [
  "tornalama",
  "frezeleme",
  "tornalama_frezeleme",
  "taslama",
  "erozyon",
  "lazer",
  "diger",
];
const CURRENCIES: ProductCurrency[] = ["TRY", "USD", "EUR"];

/**
 * Comprehensive product master form.
 *
 * 9 collapsible sections — same component drives /products/new and the
 * Bilgiler tab on /products/[id]. Submitting bumps SaveProduct and
 * either redirects to the detail page (create) or refreshes (edit).
 */
export function ProductForm({
  product,
  existingTools = [],
  existingMachineCycles = [],
  tools,
  machines,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isEdit = !!product;

  // ── Identification
  const [code, setCode] = useState(product?.code ?? "");
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [customer, setCustomer] = useState(product?.customer ?? "");
  const [customerPartNo, setCustomerPartNo] = useState(
    product?.customer_part_no ?? "",
  );
  const [customerDrawingRef, setCustomerDrawingRef] = useState(
    product?.customer_drawing_ref ?? "",
  );

  // ── Classification
  const [category, setCategory] = useState(product?.category ?? "");
  const [status, setStatus] = useState<ProductStatus>(product?.status ?? "aktif");
  const [revision, setRevision] = useState(product?.revision ?? "");
  const [revisionDate, setRevisionDate] = useState(
    product?.revision_date ?? "",
  );
  const [tagsInput, setTagsInput] = useState(product?.tags?.join(", ") ?? "");

  // ── Material / surface / heat
  const [material, setMaterial] = useState(product?.material ?? "");
  const [surfaceTreatment, setSurfaceTreatment] = useState(
    product?.surface_treatment ?? "",
  );
  const [heatTreatment, setHeatTreatment] = useState(
    product?.heat_treatment ?? "",
  );
  const [hardness, setHardness] = useState(product?.hardness ?? "");

  // ── Dimensions
  const [weightKg, setWeightKg] = useState(
    product?.weight_kg != null ? String(product.weight_kg) : "",
  );
  const [lengthMm, setLengthMm] = useState(
    product?.length_mm != null ? String(product.length_mm) : "",
  );
  const [widthMm, setWidthMm] = useState(
    product?.width_mm != null ? String(product.width_mm) : "",
  );
  const [heightMm, setHeightMm] = useState(
    product?.height_mm != null ? String(product.height_mm) : "",
  );
  const [diameterMm, setDiameterMm] = useState(
    product?.diameter_mm != null ? String(product.diameter_mm) : "",
  );
  const [toleranceClass, setToleranceClass] = useState(
    product?.tolerance_class ?? "",
  );
  const [surfaceFinishRa, setSurfaceFinishRa] = useState(
    product?.surface_finish_ra != null ? String(product.surface_finish_ra) : "",
  );

  // ── Manufacturing
  const [processType, setProcessType] = useState<ProductProcess | "">(
    product?.process_type ?? "",
  );
  const [cycleTime, setCycleTime] = useState(
    product?.cycle_time_minutes != null
      ? String(product.cycle_time_minutes)
      : "",
  );
  const [setupTime, setSetupTime] = useState(
    product?.setup_time_minutes != null
      ? String(product.setup_time_minutes)
      : "",
  );
  const [cleanupTime, setCleanupTime] = useState(
    product?.cleanup_time_minutes != null
      ? String(product.cleanup_time_minutes)
      : "",
  );
  const [partsPerSetup, setPartsPerSetup] = useState(
    product?.parts_per_setup != null ? String(product.parts_per_setup) : "",
  );
  const [defaultMachineId, setDefaultMachineId] = useState(
    product?.default_machine_id ?? "none",
  );

  // ── Commercial
  const [defaultQty, setDefaultQty] = useState(
    product?.default_quantity != null ? String(product.default_quantity) : "",
  );
  const [minOrderQty, setMinOrderQty] = useState(
    product?.min_order_qty != null ? String(product.min_order_qty) : "",
  );
  const [unitPrice, setUnitPrice] = useState(
    product?.unit_price != null ? String(product.unit_price) : "",
  );
  const [currency, setCurrency] = useState<ProductCurrency>(
    product?.currency ?? "TRY",
  );

  // ── Notes
  const [notes, setNotes] = useState(product?.notes ?? "");

  // ── Default tool list
  const [rows, setRows] = useState<ToolRow[]>(
    existingTools.map((t) => ({
      tool_id: t.tool_id,
      quantity_used: t.quantity_used,
    })),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerSelected, setPickerSelected] = useState<Set<string>>(new Set());

  // Per-machine timing matrix. One row per existing machine; values
  // empty by default (= "use product default"). On save we serialize
  // only rows that have at least one non-empty field.
  const initialCyclesMap = new Map<string, ProductMachineCycle>();
  for (const c of existingMachineCycles ?? []) {
    initialCyclesMap.set(c.machine_id, c);
  }
  const [machineCycles, setMachineCycles] = useState<MachineCycleRow[]>(() =>
    machines.map((m) => {
      const ex = initialCyclesMap.get(m.id);
      return {
        machine_id: m.id,
        cycle_seconds:
          ex?.cycle_seconds != null ? String(ex.cycle_seconds) : "",
        swap_seconds:
          ex?.swap_seconds != null ? String(ex.swap_seconds) : "",
        setup_seconds:
          ex?.setup_seconds != null ? String(ex.setup_seconds) : "",
        parts_per_setup:
          ex?.parts_per_setup != null ? String(ex.parts_per_setup) : "",
      };
    }),
  );

  // ── Wizard step state.
  //    Pre-save steps (0-5): Temel/Sınıf/Boyut/İmalat/Takım/Ticari+Özet
  //    Post-save steps (6-8): Görseller/Teknik Resim/CAD-CAM
  //
  //    For NEW products, post-save steps are gated on `savedId` being set
  //    (storage uploads need a product id). Step 5's "Oluştur" submit
  //    creates the product, fills savedId, advances to step 6.
  //
  //    For EDIT mode, the user came from /products/[id] — they already
  //    have all those upload tabs there, so we keep the wizard at 6 steps
  //    and let "Kaydet" act like before (redirect-or-stay).
  const [step, setStep] = useState<number>(0);
  const [savedId, setSavedId] = useState<string | null>(product?.id ?? null);
  const PRE_SAVE_STEPS = [
    { key: "temel", label: "Temel Bilgi", icon: FileText },
    { key: "sinif", label: "Sınıf & Malzeme", icon: Tag },
    { key: "boyut", label: "Boyutlar", icon: Box },
    { key: "imalat", label: "İmalat", icon: Cog },
    { key: "takim", label: "Takım", icon: Wrench },
    { key: "ozet", label: "Ticari & Özet", icon: CircleDollarSign },
  ] as const;
  const POST_SAVE_STEPS = [
    { key: "gorseller", label: "Görseller", icon: ImageIcon },
    { key: "teknik_resim", label: "Teknik Resim", icon: FileText },
    { key: "cad_cam", label: "CAD/CAM", icon: HardDrive },
  ] as const;
  const STEPS: { key: string; label: string; icon: typeof FileText }[] = isEdit
    ? [...PRE_SAVE_STEPS]
    : [...PRE_SAVE_STEPS, ...POST_SAVE_STEPS];
  const isLastStep = step === STEPS.length - 1;
  const isFirstStep = step === 0;
  const PRE_SAVE_LAST = PRE_SAVE_STEPS.length - 1; // = 5 → "Ticari & Özet"
  const isPostSaveStep = step > PRE_SAVE_LAST;

  const usedToolIds = useMemo(
    () => new Set(rows.map((r) => r.tool_id)),
    [rows],
  );
  const pickerList = useMemo(() => {
    const q = pickerSearch.trim().toLocaleLowerCase("tr");
    return tools.filter((t) => {
      if (usedToolIds.has(t.id)) return false;
      if (!q) return true;
      const hay = [t.name, t.code, t.size, t.location, t.type, t.supplier]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr");
      return hay.includes(q);
    });
  }, [tools, usedToolIds, pickerSearch]);

  function togglePicker(id: string) {
    setPickerSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function addSelectedTools() {
    if (pickerSelected.size === 0) return;
    setRows((prev) => [
      ...prev,
      ...Array.from(pickerSelected).map((tool_id) => ({
        tool_id,
        quantity_used: 1,
      })),
    ]);
    setPickerSelected(new Set());
    setPickerOpen(false);
  }
  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.tool_id !== id));
  }
  function updateRow(id: string, qty: number) {
    setRows((prev) =>
      prev.map((r) => (r.tool_id === id ? { ...r, quantity_used: qty } : r)),
    );
  }

  function parseNumber(s: string): number | null {
    if (!s.trim()) return null;
    const n = Number(s.replace(",", "."));
    if (!Number.isFinite(n)) return null;
    return n;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) {
      toast.error("Ürün kodu gerekli");
      return;
    }
    if (!name.trim()) {
      toast.error("Ürün adı gerekli");
      return;
    }
    const tags = tagsInput
      .split(/[,\n]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    const payload: SaveProductInput = {
      id: product?.id,
      code: code.trim(),
      name: name.trim(),
      description: description || null,
      customer: customer || null,
      customer_part_no: customerPartNo || null,
      customer_drawing_ref: customerDrawingRef || null,
      category: category || null,
      status,
      revision: revision || null,
      revision_date: revisionDate || null,
      tags,
      material: material || null,
      surface_treatment: surfaceTreatment || null,
      heat_treatment: heatTreatment || null,
      hardness: hardness || null,
      weight_kg: parseNumber(weightKg),
      length_mm: parseNumber(lengthMm),
      width_mm: parseNumber(widthMm),
      height_mm: parseNumber(heightMm),
      diameter_mm: parseNumber(diameterMm),
      tolerance_class: toleranceClass || null,
      surface_finish_ra: parseNumber(surfaceFinishRa),
      process_type: (processType || null) as ProductProcess | null,
      cycle_time_minutes: parseNumber(cycleTime),
      cleanup_time_minutes: parseNumber(cleanupTime),
      setup_time_minutes: parseNumber(setupTime),
      parts_per_setup: parseNumber(partsPerSetup),
      default_machine_id: defaultMachineId === "none" ? null : defaultMachineId,
      default_quantity: parseNumber(defaultQty),
      min_order_qty: parseNumber(minOrderQty),
      unit_price: parseNumber(unitPrice),
      currency,
      notes: notes || null,
      tools: rows.map((r) => ({
        tool_id: r.tool_id,
        quantity_used: r.quantity_used,
      })),
      // Per-machine timing override rows. Send only rows that have at
      // least one non-empty field; the action upserts (machine_id ∈ rows)
      // and deletes (machine_id ∉ rows but exists in DB) accordingly.
      machine_cycles: machineCycles
        .map((r) => {
          const cycle = r.cycle_seconds.trim() === "" ? null : Number(r.cycle_seconds);
          const swap = r.swap_seconds.trim() === "" ? null : Number(r.swap_seconds);
          const setup = r.setup_seconds.trim() === "" ? null : Number(r.setup_seconds);
          const pps = r.parts_per_setup.trim() === "" ? null : Number(r.parts_per_setup);
          const hasAny =
            cycle != null || swap != null || setup != null || pps != null;
          return hasAny
            ? {
                machine_id: r.machine_id,
                cycle_seconds: cycle,
                swap_seconds: swap,
                setup_seconds: setup,
                parts_per_setup: pps,
              }
            : null;
        })
        .filter(
          (
            x,
          ): x is {
            machine_id: string;
            cycle_seconds: number | null;
            swap_seconds: number | null;
            setup_seconds: number | null;
            parts_per_setup: number | null;
          } => x !== null,
        ),
    };

    startTransition(async () => {
      const r = await saveProduct(payload);
      if ("error" in r && r.error) {
        toast.error(r.error);
        return;
      }
      const newId = "id" in r ? r.id : null;
      if (isEdit) {
        toast.success("Ürün güncellendi");
        router.refresh();
        return;
      }
      // NEW product: don't redirect — advance to post-save upload steps
      // (Görseller / Teknik Resim / CAD-CAM) so the user can upload media
      // in the same flow. The wizard footer's "Bitir" on the last step
      // performs the redirect to /products/[id].
      if (newId) {
        toast.success("Ürün oluşturuldu — şimdi görselleri ekleyebilirsin");
        setSavedId(newId);
        setStep(PRE_SAVE_LAST + 1); // → Görseller step
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* ── Stepper indicator ── */}
      <Stepper steps={STEPS} current={step} onJump={setStep} />

      {/* ── Step 0: Identification ── */}
      {step === 0 && (
      <Section
        icon={FileText}
        title="Tanımlama"
        description="Ürün kodu, adı, müşteri ve referanslar"
        defaultOpen
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Ürün Kodu *" hint="ör. FLN-50-A">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              required
              placeholder="FLN-50-A"
              className="font-mono uppercase"
            />
          </Field>
          <Field label="Ürün Adı *">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Flanş Ø50"
            />
          </Field>
          <Field label="Müşteri">
            <Input
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="Acme Sanayi A.Ş."
            />
          </Field>
          <Field label="Müşteri Parça No">
            <Input
              value={customerPartNo}
              onChange={(e) => setCustomerPartNo(e.target.value)}
              placeholder="ACM-FLN-2025-01"
            />
          </Field>
          <Field label="Müşteri Çizim Ref">
            <Input
              value={customerDrawingRef}
              onChange={(e) => setCustomerDrawingRef(e.target.value)}
              placeholder="DWG-001 Rev.B"
            />
          </Field>
        </div>
        <Field label="Açıklama">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Kısa açıklama, özel notlar"
          />
        </Field>
      </Section>
      )}

      {/* ── Step 1: Classification + Material ── */}
      {step === 1 && (
      <Section
        icon={Tag}
        title="Sınıflandırma & Durum"
        description="Kategori, durum, revizyon ve etiketler"
        defaultOpen
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Kategori">
            <ComboBox
              value={category}
              onChange={setCategory}
              options={PRODUCT_CATEGORY_PRESETS}
              placeholder="Mil, Flanş, Kalıp Parçası…"
            />
          </Field>
          <Field label="Durum">
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as ProductStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {PRODUCT_STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Revizyon" hint="A, B, 01, 02…">
            <Input
              value={revision}
              onChange={(e) => setRevision(e.target.value)}
              placeholder="A"
            />
          </Field>
          <Field label="Revizyon Tarihi">
            <Input
              type="date"
              value={revisionDate}
              onChange={(e) => setRevisionDate(e.target.value)}
            />
          </Field>
          <Field label="Etiketler" hint="virgülle ayır">
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="acil, otomotiv, prototip"
              className="sm:col-span-2"
            />
          </Field>
        </div>
      </Section>
      )}

      {step === 1 && (
      <Section
        icon={Sparkles}
        title="Malzeme & Yüzey"
        description="Malzeme, yüzey işlemi, ısıl işlem, sertlik"
        defaultOpen
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Malzeme">
            <ComboBox
              value={material}
              onChange={setMaterial}
              options={MATERIAL_PRESETS}
              placeholder="Çelik (4140), Alüminyum (6061)…"
            />
          </Field>
          <Field label="Sertlik" hint="ör. HRC 45-50, HB 200">
            <Input
              value={hardness}
              onChange={(e) => setHardness(e.target.value)}
              placeholder="HRC 45-50"
            />
          </Field>
          <Field label="Yüzey İşlemi">
            <ComboBox
              value={surfaceTreatment}
              onChange={setSurfaceTreatment}
              options={SURFACE_TREATMENT_PRESETS}
              placeholder="Eloksal, Krom, Çinko…"
            />
          </Field>
          <Field label="Isıl İşlem">
            <ComboBox
              value={heatTreatment}
              onChange={setHeatTreatment}
              options={HEAT_TREATMENT_PRESETS}
              placeholder="Sertleştirme, Tavlama…"
            />
          </Field>
        </div>
      </Section>
      )}

      {/* ── Step 2: Dimensions ── */}
      {step === 2 && (
      <Section
        icon={Box}
        title="Boyutlar & Toleranslar"
        description="Ölçüler (mm), ağırlık, tolerans sınıfı, yüzey kalitesi"
        defaultOpen
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <NumberField label="Uzunluk (mm)" value={lengthMm} onChange={setLengthMm} />
          <NumberField label="Genişlik (mm)" value={widthMm} onChange={setWidthMm} />
          <NumberField label="Yükseklik (mm)" value={heightMm} onChange={setHeightMm} />
          <NumberField label="Çap (mm)" value={diameterMm} onChange={setDiameterMm} />
          <NumberField
            label="Ağırlık (kg)"
            value={weightKg}
            onChange={setWeightKg}
            step="0.001"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Tolerans Sınıfı">
            <ComboBox
              value={toleranceClass}
              onChange={setToleranceClass}
              options={TOLERANCE_CLASS_PRESETS}
              placeholder="ISO 2768-fH…"
            />
          </Field>
          <NumberField
            label="Yüzey Pürüzlülüğü Ra (μm)"
            value={surfaceFinishRa}
            onChange={setSurfaceFinishRa}
            step="0.1"
          />
        </div>
      </Section>
      )}

      {/* ── Step 3: Manufacturing ── */}
      {step === 3 && (
      <Section
        icon={Cog}
        title="İmalat"
        description="Proses tipi, ayar süresi, işleme süresi, temizlik ve bağlanan adet"
        defaultOpen
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Field label="Proses Tipi">
            <Select
              value={processType || "none"}
              onValueChange={(v) =>
                setProcessType(v === "none" ? "" : (v as ProductProcess))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Yok —</SelectItem>
                {PROCESSES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRODUCT_PROCESS_LABEL[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <MinSecField
            label="Ayar Süresi"
            value={setupTime}
            onChange={setSetupTime}
            hint="iş başında 1 kerelik"
          />
          <MinSecField
            label="Cycle / Tek Parça"
            value={cycleTime}
            onChange={setCycleTime}
            hint="ekran elapsed ÷ parça"
          />
          <MinSecField
            label="Temizlik / Swap"
            value={cleanupTime}
            onChange={setCleanupTime}
            hint="kapı açılışı · paralelse 0"
          />
          <NumberField
            label="Bağlanan Adet"
            value={partsPerSetup}
            onChange={setPartsPerSetup}
            hint="bağlamada parça"
          />
        </div>
        <div className="rounded-lg bg-muted/40 border border-dashed p-4 text-[12px] text-muted-foreground space-y-2">
          <div className="font-semibold text-foreground text-sm">
            Yeni model — kullanıcı mantığı:
          </div>
          <ul className="list-disc list-inside space-y-1">
            <li>
              <strong>Cycle</strong>: Tek parça için. 2 parça paralel işleniyorsa
              → ekrandaki süreyi 2&apos;ye böl.
              <br />
              <span className="opacity-70">
                Örn: Twin-spindle 5:30 / 2 parça → cycle = 2:45/parça
              </span>
            </li>
            <li>
              <strong>Swap</strong>: Bağlama değişiminde tezgah duruyor mu?
              <br />
              <span className="opacity-70">
                Tek/çift mengene seri = 1 dk · Twin-spindle veya pallet changer
                (paralel yükleme) = <strong>0</strong>
              </span>
            </li>
            <li>
              <strong>Setup</strong>: 1 KEZ iş başında. Tahminden farklı
              sürerse sistem otomatik kaydeder, ekstra süre için sebep sorar.
            </li>
          </ul>
          <div className="pt-1 border-t font-semibold text-foreground text-sm">
            Toplam = setup + qty × cycle + ⌈qty/bağlanan⌉ × swap
          </div>
          <div className="text-[11px] opacity-80">
            Örn 50 parça: tek mengene (cycle 5, swap 1, pps 1) →{" "}
            <strong>320 dk</strong>. Twin-spindle (cycle 2:45, swap 0, pps 2) →{" "}
            <strong>145 dk</strong>. ETA çalışma çizelgesini bilir (yemek,
            hafta sonu) ve makine arıza/bakım durumunda durur.
          </div>
        </div>

        {/* Per-machine timing override matrix */}
        {machines.length > 0 && (
          <MachineCyclesMatrix
            machines={machines}
            value={machineCycles}
            onChange={setMachineCycles}
          />
        )}
      </Section>
      )}

      {/* ── Step 5: Commercial ── */}
      {step === 5 && (
      <Section
        icon={CircleDollarSign}
        title="Ticari"
        description="Sipariş adedi, birim fiyat ve para birimi"
        defaultOpen
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <NumberField
            label="Tipik Sipariş Adedi"
            value={defaultQty}
            onChange={setDefaultQty}
          />
          <NumberField
            label="Min. Sipariş Adedi"
            value={minOrderQty}
            onChange={setMinOrderQty}
          />
          <NumberField
            label="Birim Fiyat"
            value={unitPrice}
            onChange={setUnitPrice}
            step="0.01"
          />
          <Field label="Para Birimi">
            <Select
              value={currency}
              onValueChange={(v) => setCurrency(v as ProductCurrency)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </Section>
      )}

      {/* ── Step 4: Tools ── */}
      {step === 4 && (
      <Section
        icon={Wrench}
        title="Varsayılan Takım Listesi"
        description="İş bu üründen seçildiğinde job_tools'a otomatik kopyalanır"
        defaultOpen
      >
        <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Wrench className="size-3.5" /> Takımlar
              <Badge variant="outline" className="h-5 text-[10px] ml-1">
                {rows.length}
              </Badge>
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs gap-1"
              onClick={() => setPickerOpen((v) => !v)}
              disabled={tools.length === 0 || rows.length >= tools.length}
            >
              <Plus className="size-3.5" />
              Takım Ekle
            </Button>
          </div>

          {rows.length === 0 ? (
            <div className="text-xs text-muted-foreground italic py-2">
              Henüz takım eklenmedi.
            </div>
          ) : (
            <div className="space-y-1.5">
              {rows.map((r) => {
                const tool = tools.find((t) => t.id === r.tool_id);
                return (
                  <div
                    key={r.tool_id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-background border"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">
                        {tool?.name ?? "—"}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {tool?.code ?? ""}
                        {tool?.size ? ` · ${tool.size}` : ""}
                      </div>
                    </div>
                    <Input
                      type="number"
                      min={1}
                      value={r.quantity_used}
                      onChange={(e) =>
                        updateRow(r.tool_id, Number(e.target.value) || 1)
                      }
                      className="w-20 h-8 text-sm tabular-nums"
                    />
                    <span className="text-xs text-muted-foreground">adet</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRow(r.tool_id)}
                      className="size-7"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {pickerOpen && (
            <div className="rounded-md border bg-background p-2 space-y-2 mt-2 animate-tg-fade-in">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="Takım ara…"
                  className="pl-9 h-8"
                  autoFocus
                />
              </div>
              <div className="max-h-56 overflow-y-auto divide-y rounded border">
                {pickerList.length === 0 ? (
                  <div className="p-3 text-center text-xs text-muted-foreground">
                    Eşleşen takım yok.
                  </div>
                ) : (
                  pickerList.map((t) => {
                    const checked = pickerSelected.has(t.id);
                    return (
                      <label
                        key={t.id}
                        className={cn(
                          "flex items-center gap-2.5 px-2 py-1.5 cursor-pointer transition",
                          "hover:bg-muted/60",
                          checked && "bg-primary/5",
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => togglePicker(t.id)}
                        />
                        <div className="text-sm font-medium truncate flex-1">
                          {t.name}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {t.code ?? ""}
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
              <div className="flex justify-end gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPickerOpen(false)}
                >
                  Kapat
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={addSelectedTools}
                  disabled={pickerSelected.size === 0}
                >
                  <Plus className="size-3.5" />
                  Ekle ({pickerSelected.size})
                </Button>
              </div>
            </div>
          )}
        </div>
      </Section>
      )}

      {/* ── Step 4 (continued): Tools done. Step 5 = Notlar + final summary ── */}
      {step === 5 && (
      <Section
        icon={Briefcase}
        title="Notlar"
        description="İşleme özel hatırlatmalar, prosedür notları"
        defaultOpen
      >
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Operatör için notlar, kritik uyarılar"
          className="text-base"
        />
      </Section>
      )}

      {/* ── Step 5: Final summary card (read-only review) ── */}
      {step === 5 && (
        <ReviewSummary
          fields={[
            { label: "Ürün Kodu", value: code },
            { label: "Ürün Adı", value: name },
            { label: "Müşteri", value: customer },
            { label: "Kategori", value: category },
            { label: "Malzeme", value: material },
            { label: "Sertlik", value: hardness },
            {
              label: "Boyut",
              value: [
                lengthMm && `${lengthMm}×${widthMm}×${heightMm}mm`,
                diameterMm && `Ø${diameterMm}mm`,
                weightKg && `${weightKg}kg`,
              ]
                .filter(Boolean)
                .join(" · "),
            },
            { label: "Proses", value: processType ? PRODUCT_PROCESS_LABEL[processType as ProductProcess] : "" },
            {
              label: "Süreler",
              value: [
                cycleTime && `cycle ${cycleTime} dk`,
                setupTime && `ayar ${setupTime} dk`,
                cleanupTime && `temizlik ${cleanupTime} dk`,
              ]
                .filter(Boolean)
                .join(" · "),
            },
            { label: "Bağlama Adedi", value: partsPerSetup },
            { label: "Takım Sayısı", value: rows.length > 0 ? `${rows.length} adet` : "" },
            {
              label: "Fiyat",
              value: unitPrice ? `${unitPrice} ${currency}` : "",
            },
          ]}
        />
      )}

      {/* ── Step 6: Görseller (post-save, needs savedId) ── */}
      {step === 6 && savedId && (
        <PostSaveStep
          icon={ImageIcon}
          title="Ürün Görselleri"
          description="Müşteri kataloğu, atölye referansı veya operatör tanıma için ürünün resimleri. İstersen bu adımı atla — sonradan da eklenebilir."
        >
          <ProductImageGallery productId={savedId} images={[]} />
        </PostSaveStep>
      )}

      {/* ── Step 7: Teknik Resim (post-save) ── */}
      {step === 7 && savedId && (
        <PostSaveStep
          icon={FileText}
          title="Teknik Resimler"
          description="PDF veya görsel dosyalar — operatör imalat öncesi bakar. Fabric.js ile balon/açıklama eklenebilir."
        >
          <ProductDrawingsTab productId={savedId} items={[]} />
        </PostSaveStep>
      )}

      {/* ── Step 8: CAD/CAM (post-save) ── */}
      {step === 8 && savedId && (
        <PostSaveStep
          icon={HardDrive}
          title="CAD / CAM Programları"
          description="NC, G-code, STEP, STL, DXF, PDF formatları kabul edilir. Makine bağlama opsiyonel — sonra da yapılır."
        >
          <ProductCadTab productId={savedId} items={[]} machines={machines} />
        </PostSaveStep>
      )}

      {/* ── Wizard navigation footer ── */}
      <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 bg-background/95 backdrop-blur border-t flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/products")}
        >
          İptal
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={isFirstStep || (isPostSaveStep && step === PRE_SAVE_LAST + 1)}
            className="h-11 px-4 gap-1.5"
            title={
              isPostSaveStep && step === PRE_SAVE_LAST + 1
                ? "Kaydedilmiş ürüne dönülemez — kapat ve detay sayfasından düzenle"
                : undefined
            }
          >
            <ChevronLeft className="size-4" /> Geri
          </Button>

          {/* Step 5 (PRE_SAVE_LAST): submit form to save */}
          {step === PRE_SAVE_LAST ? (
            <Button type="submit" disabled={pending} className="h-11 px-5 gap-1.5">
              {pending && <Loader2 className="size-4 animate-spin" />}
              <Check className="size-4" />
              {isEdit ? "Kaydet" : "Oluştur"}
              {!isEdit && <ChevronRight className="size-4" />}
            </Button>
          ) : isPostSaveStep && !isLastStep ? (
            // Steps 6, 7: skip / next (no save needed — uploads are
            // committed on each file action)
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  setStep((s) => Math.min(STEPS.length - 1, s + 1))
                }
                className="h-11 px-3"
              >
                Atla
              </Button>
              <Button
                type="button"
                onClick={() =>
                  setStep((s) => Math.min(STEPS.length - 1, s + 1))
                }
                className="h-11 px-5 gap-1.5"
              >
                Sonraki <ChevronRight className="size-4" />
              </Button>
            </>
          ) : isLastStep && isPostSaveStep ? (
            // Step 8 (last in NEW flow): finish wizard → detail page
            <Button
              type="button"
              onClick={() => {
                if (savedId) router.push(`/products/${savedId}`);
              }}
              className="h-11 px-5 gap-1.5"
            >
              <Check className="size-4" /> Bitir
            </Button>
          ) : (
            // Pre-save steps 0-4 (and step 5 in edit mode is handled above)
            <Button
              type="button"
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              className="h-11 px-5 gap-1.5"
            >
              İleri <ChevronRight className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

/* ── MachineCyclesMatrix ──────────────────────────────────────────
   Per-makine override matrix. One row per machine; values empty by
   default (= "use product default"). UI exposes:
     Cycle  ·  Swap  ·  Bağlanan  ·  Setup
   Stored as seconds (Cycle/Swap/Setup) + integer (parts_per_setup).
   Empty inputs are saved as NULL so the runtime resolver falls back
   to the product's default values.
   ──────────────────────────────────────────────────────────────── */
function MachineCyclesMatrix({
  machines,
  value,
  onChange,
}: {
  machines: Pick<Machine, "id" | "name">[];
  value: MachineCycleRow[];
  onChange: (next: MachineCycleRow[]) => void;
}) {
  function patch(machineId: string, patch: Partial<MachineCycleRow>) {
    onChange(
      value.map((r) => (r.machine_id === machineId ? { ...r, ...patch } : r)),
    );
  }
  const machineMap = new Map(machines.map((m) => [m.id, m.name]));

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/30">
        <div className="text-sm font-bold">Makine Bazlı Süreler</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          Aynı ürün farklı tezgahta farklı sürebilir. Boş alanlar yukarıdaki
          varsayılan değeri kullanır.
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Makine</th>
              <th className="px-3 py-2 text-right font-semibold">Cycle (sn)</th>
              <th className="px-3 py-2 text-right font-semibold">Swap (sn)</th>
              <th className="px-3 py-2 text-right font-semibold">Bağlanan</th>
              <th className="px-3 py-2 text-right font-semibold">Setup (sn)</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {value.map((row) => (
              <tr key={row.machine_id} className="hover:bg-muted/20 transition">
                <td className="px-3 py-2 font-medium">
                  {machineMap.get(row.machine_id) ?? "—"}
                </td>
                <td className="px-2 py-1.5 text-right">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={row.cycle_seconds}
                    onChange={(e) =>
                      patch(row.machine_id, { cycle_seconds: e.target.value })
                    }
                    placeholder="varsay."
                    className="w-24 h-9 px-2 rounded border bg-background text-right tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </td>
                <td className="px-2 py-1.5 text-right">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={row.swap_seconds}
                    onChange={(e) =>
                      patch(row.machine_id, { swap_seconds: e.target.value })
                    }
                    placeholder="varsay."
                    className="w-24 h-9 px-2 rounded border bg-background text-right tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </td>
                <td className="px-2 py-1.5 text-right">
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={row.parts_per_setup}
                    onChange={(e) =>
                      patch(row.machine_id, {
                        parts_per_setup: e.target.value,
                      })
                    }
                    placeholder="varsay."
                    className="w-20 h-9 px-2 rounded border bg-background text-right tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </td>
                <td className="px-2 py-1.5 text-right">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={row.setup_seconds}
                    onChange={(e) =>
                      patch(row.machine_id, { setup_seconds: e.target.value })
                    }
                    placeholder="varsay."
                    className="w-24 h-9 px-2 rounded border bg-background text-right tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 bg-muted/20 border-t text-[11px] text-muted-foreground">
        Twin-spindle: Cycle/parça (paralel parça başına) yaz, Swap = 0
        bırak. Pallet changer: Swap = 0 (operatör paralel takıyor).
      </div>
    </div>
  );
}

/* ── PostSaveStep — uniform wrapper for upload steps shown after the
   product is saved. Adds a header with icon + description so the user
   knows what's expected. ─────────────────────────────────────────── */
function PostSaveStep({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b bg-primary/5 flex items-start gap-3">
        <div className="size-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="text-lg font-semibold">{title}</div>
          <div className="text-sm text-muted-foreground mt-0.5">{description}</div>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

/* ── Stepper indicator (numbered circles + connecting line) ── */
function Stepper({
  steps,
  current,
  onJump,
}: {
  steps: { key: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
  current: number;
  onJump: (n: number) => void;
}) {
  return (
    <nav aria-label="Wizard adımları" className="overflow-x-auto -mx-2 px-2 pb-1">
      <ol className="flex items-stretch min-w-max gap-1">
        {steps.map((s, i) => {
          const done = i < current;
          const active = i === current;
          const Icon = s.icon;
          return (
            <li key={s.key} className="flex items-center">
              <button
                type="button"
                onClick={() => done && onJump(i)}
                disabled={!done}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border transition",
                  done && "cursor-pointer hover:bg-emerald-500/15",
                  active && "bg-primary/10 border-primary text-primary font-semibold",
                  !active && !done &&
                    "bg-muted/30 border-muted text-muted-foreground",
                  done && "bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
                )}
              >
                <span
                  className={cn(
                    "size-7 rounded-full flex items-center justify-center text-sm font-bold tabular-nums shrink-0",
                    active && "bg-primary text-primary-foreground",
                    done && "bg-emerald-500 text-white",
                    !active && !done && "bg-muted",
                  )}
                >
                  {done ? <Check className="size-4" /> : i + 1}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1.5 text-sm whitespace-nowrap">
                  <Icon className="size-3.5" />
                  {s.label}
                </span>
              </button>
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    "w-4 sm:w-6 h-px mx-1",
                    done ? "bg-emerald-500/60" : "bg-muted",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* ── ReviewSummary (final step) — read-only key/value list ── */
function ReviewSummary({
  fields,
}: {
  fields: { label: string; value: string | number | null | undefined }[];
}) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b bg-primary/5">
        <div className="text-base font-semibold flex items-center gap-2">
          <Check className="size-4 text-primary" /> Son Kontrol
        </div>
        <div className="text-sm text-muted-foreground mt-0.5">
          Aşağıdaki bilgiler kaydedilecek. Geri tuşuyla düzenleyebilirsin.
        </div>
      </div>
      <dl className="divide-y">
        {fields.map((f) => (
          <div
            key={f.label}
            className="flex items-baseline gap-3 px-4 py-2.5"
          >
            <dt className="text-sm font-medium text-muted-foreground w-44 shrink-0">
              {f.label}
            </dt>
            <dd className="text-base font-medium flex-1 truncate">
              {f.value || (
                <span className="text-muted-foreground/60 italic">—</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Section — collapsible card with icon header. Default closed except
   for the first one (Identification) so the form isn't a giant wall
   of inputs on first paint. State persists per-section while form
   is mounted.
   ────────────────────────────────────────────────────────────────── */
function Section({
  icon: Icon,
  title,
  description,
  defaultOpen = false,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full flex items-center gap-3 px-5 py-4 text-left transition",
          "hover:bg-muted/40",
        )}
      >
        <div className="size-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold">{title}</div>
          {description && (
            <div className="text-sm text-muted-foreground mt-0.5">{description}</div>
          )}
        </div>
        {open ? (
          <ChevronDown className="size-5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="size-5 text-muted-foreground shrink-0" />
        )}
      </button>
      {open && <div className="border-t p-5 space-y-4">{children}</div>}
    </div>
  );
}

/* Field — label + control wrapper. */
function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2 [&_input]:h-11 [&_input]:text-base [&_textarea]:text-base [&_button[role=combobox]]:h-11 [&_button[role=combobox]]:text-base", className)}>
      <Label className="text-base font-medium">
        {label}
        {hint && (
          <span className="text-sm text-muted-foreground font-normal ml-1.5">
            ({hint})
          </span>
        )}
      </Label>
      {children}
    </div>
  );
}

/* NumberField — small wrapper that keeps formatting consistent. */
function NumberField({
  label,
  value,
  onChange,
  step,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step?: string;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <Input
        type="number"
        inputMode="decimal"
        step={step ?? "1"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="tabular-nums"
      />
    </Field>
  );
}

/**
 * MinSecField — twin inputs for "X dk Y sn", stored externally as a
 * decimal-minutes string (e.g. 5.5 for 5 dk 30 sn). Some shop
 * operations finish in seconds, not whole minutes — INT-only fields
 * silently truncated those to 0 and broke the timeline math.
 *
 * Internal: keep both panes as separate strings so users can clear
 * either independently; merge to "M.X" decimal-minutes on commit.
 */
function MinSecField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  const decimal = parseFloat(value);
  const totalSeconds =
    Number.isFinite(decimal) && decimal >= 0 ? Math.round(decimal * 60) : 0;
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;

  function commit(nextMins: number, nextSecs: number) {
    const totalSec = Math.max(0, nextMins * 60 + nextSecs);
    if (totalSec === 0) {
      onChange("");
      return;
    }
    const decimalMin = totalSec / 60;
    // Trim trailing zeros so "5.50" → "5.5" and integers stay "5".
    onChange(
      Number.isInteger(decimalMin)
        ? String(decimalMin)
        : decimalMin.toFixed(4).replace(/\.?0+$/, ""),
    );
  }

  return (
    <Field label={label} hint={hint ? `${hint} · dk + sn` : "dk + sn"}>
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <Input
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            value={value === "" && mins === 0 ? "" : String(mins)}
            onChange={(e) => {
              const v = e.target.value;
              const next = v === "" ? 0 : Math.max(0, parseInt(v, 10) || 0);
              commit(next, secs);
            }}
            className="tabular-nums pr-8"
            placeholder="0"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">
            dk
          </span>
        </div>
        <div className="relative flex-1">
          <Input
            type="number"
            inputMode="numeric"
            min="0"
            max="59"
            step="1"
            value={value === "" && secs === 0 ? "" : String(secs)}
            onChange={(e) => {
              const v = e.target.value;
              let next = v === "" ? 0 : Math.max(0, parseInt(v, 10) || 0);
              // Allow operator to type "75" and have it roll into 1 dk 15 sn
              // — friendlier than a hard cap.
              if (next >= 60) {
                const extraMin = Math.floor(next / 60);
                next = next % 60;
                commit(mins + extraMin, next);
                return;
              }
              commit(mins, next);
            }}
            className="tabular-nums pr-8"
            placeholder="0"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">
            sn
          </span>
        </div>
      </div>
    </Field>
  );
}

/* ComboBox — input + datalist for autocomplete from preset values
   while still allowing free-form text. */
function ComboBox({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  const idRef = useRef(`cb-${Math.random().toString(36).slice(2, 8)}`);
  // ^ Math.random fine here — only used for an internal id that's
  // never serialized into the SSR HTML (datalist id is the only
  // surface, and it's stable across re-renders thanks to useRef).
  // Stamped post-mount via useEffect so SSR + first-client render
  // line up.
  const [stableId, setStableId] = useState<string | null>(null);
  useEffect(() => setStableId(idRef.current), []);
  return (
    <>
      <Input
        list={stableId ?? undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {stableId && (
        <datalist id={stableId}>
          {options.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      )}
    </>
  );
}
