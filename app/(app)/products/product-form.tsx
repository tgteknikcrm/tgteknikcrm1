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
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Cog,
  FileText,
  Loader2,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Tag,
  Trash2,
  Wrench,
} from "lucide-react";
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
  tools: Tool[];
  machines: Pick<Machine, "id" | "name">[];
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
    };

    startTransition(async () => {
      const r = await saveProduct(payload);
      if ("error" in r && r.error) {
        toast.error(r.error);
        return;
      }
      const newId = "id" in r ? r.id : null;
      toast.success(isEdit ? "Ürün güncellendi" : "Ürün oluşturuldu");
      if (!isEdit && newId) {
        router.push(`/products/${newId}`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* ── Identification ── */}
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

      {/* ── Classification ── */}
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

      {/* ── Material / Surface / Heat ── */}
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

      {/* ── Dimensions ── */}
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

      {/* ── Manufacturing ── */}
      <Section
        icon={Cog}
        title="İmalat"
        description="Proses, makine, ayar süresi, parça başı süre, bağlama adedi"
        defaultOpen
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
          <Field label="Varsayılan Makine">
            <Select
              value={defaultMachineId}
              onValueChange={setDefaultMachineId}
            >
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Yok —</SelectItem>
                {machines.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <NumberField
            label="Ayar Süresi (dk)"
            value={setupTime}
            onChange={setSetupTime}
            hint="bir bağlama"
          />
          <NumberField
            label="İşleme Süresi (dk)"
            value={cycleTime}
            onChange={setCycleTime}
            step="0.1"
            hint="parça başı makine"
          />
          <NumberField
            label="Temizlik (dk)"
            value={cleanupTime}
            onChange={setCleanupTime}
            step="0.1"
            hint="parça başı"
          />
          <NumberField
            label="Bağlanan Adet"
            value={partsPerSetup}
            onChange={setPartsPerSetup}
            hint="aynı anda"
          />
        </div>
        <div className="rounded-lg bg-muted/40 border border-dashed p-3 text-[11px] text-muted-foreground space-y-1">
          <div>
            <span className="font-semibold text-foreground">
              Etkin İşleme:
            </span>{" "}
            işleme + temizlik (parça başı net süre — kapı açma + parça koy/al
            dahil)
          </div>
          <div>
            <span className="font-semibold text-foreground">Toplam:</span>{" "}
            ⌈adet / bağlama⌉ × ayar + adet × etkin_işleme. ETA hesabı{" "}
            <strong>çalışma çizelgesini</strong> bilir (yemek, hafta sonu).
          </div>
          <div className="text-[10px] opacity-70">
            Ayar süresi tahminidir — gerçek ayar bittiğinde sistem ölçtüğü
            süreyi kaydeder ve sonraki bağlamalar için ETA bunu kullanır.
          </div>
        </div>
      </Section>

      {/* ── Commercial ── */}
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

      {/* ── Default tool list ── */}
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

      {/* ── Notes ── */}
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
        />
      </Section>

      {/* Sticky footer */}
      <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 bg-background/95 backdrop-blur border-t flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/products")}
        >
          İptal
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {isEdit ? "Kaydet" : "Oluştur"}
        </Button>
      </div>
    </form>
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
          "w-full flex items-center gap-3 px-4 py-3 text-left transition",
          "hover:bg-muted/40",
        )}
      >
        <div className="size-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{title}</div>
          {description && (
            <div className="text-xs text-muted-foreground">{description}</div>
          )}
        </div>
        {open ? (
          <ChevronDown className="size-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="size-4 text-muted-foreground shrink-0" />
        )}
      </button>
      {open && <div className="border-t p-4 space-y-3">{children}</div>}
    </div>
  );
}

/* Field — label + control wrapper. */
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">
        {label}
        {hint && (
          <span className="text-muted-foreground font-normal ml-1">
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
