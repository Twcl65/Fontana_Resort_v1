"use client";

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { ImagePlus, Pencil, Archive, List, Loader2, X } from "lucide-react";
import { PageToolbar } from "@/components/ui/page-toolbar";
import {
  archiveCottage,
  insertCottage,
  listCottages,
  normalizeCottageAmenities,
  updateCottage,
  type CottageAmenity,
  type FontanaCottageRow
} from "@/lib/fontana-data";
import { uploadCottageImage } from "@/lib/cottage-upload";

type CottageStatus = "Available" | "Maintenance" | "Archived";
type Amenity = "Fan" | "Grill" | "Tables" | "Karaoke";
export type CottageCategory = "A-House" | "Cottages" | "Function Hall";

type AmenityRow = { name: Amenity; imageUrl: string };

type Cottage = {
  id: string;
  name: string;
  category: CottageCategory;
  capacity: number;
  rateNight: string;
  status: CottageStatus;
  amenities: Amenity[];
  amenityDetails: CottageAmenity[];
  galleryUrls: string[];
  imageUrl: string;
};

type CottageForm = {
  galleryUrls: string[];
  name: string;
  category: CottageCategory;
  capacity: string;
  rateNight: string;
  amenityRows: AmenityRow[];
  status: CottageStatus;
};

const ALL_AMENITIES: Amenity[] = ["Fan", "Grill", "Tables", "Karaoke"];
const CATEGORY_OPTIONS: CottageCategory[] = ["A-House", "Cottages", "Function Hall"];

const DIALOG_CONTENT_CLASS =
  "flex max-h-[calc(100vh-2rem)] w-[calc(100vw-1.25rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 top-[1rem] translate-y-0 lg:max-w-4xl";

/** Native select aligned with `Input` styling (no extra chrome). */
const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

function money(value: string) {
  return `₱${Number(value || 0).toLocaleString()}`;
}

function rowToCottage(row: FontanaCottageRow): Cottage {
  const details = normalizeCottageAmenities(row.amenities);
  const names = details
    .map((d) => d.name)
    .filter((n): n is Amenity => ALL_AMENITIES.includes(n as Amenity));
  const gallery =
    row.image_urls && row.image_urls.length > 0
      ? row.image_urls
      : row.image_url
        ? [row.image_url]
        : [];
  return {
    id: row.id,
    name: row.name,
    category: row.category as CottageCategory,
    capacity: row.capacity,
    rateNight: String(row.rate_night),
    status: row.status as CottageStatus,
    amenities: names.length ? names : ["Fan"],
    amenityDetails: details,
    galleryUrls: gallery,
    imageUrl: gallery[0] || row.image_url || ""
  };
}

function amenityRowsFromCottage(c: Cottage): AmenityRow[] {
  return ALL_AMENITIES.filter((n) => c.amenities.includes(n)).map((name) => ({
    name,
    imageUrl: c.amenityDetails.find((d) => d.name === name)?.image_url ?? ""
  }));
}

function buildRowPayload(form: CottageForm) {
  const amenityPayload = form.amenityRows.map((r) => ({
    name: r.name,
    image_url: r.imageUrl.trim() || null
  }));
  return {
    name: form.name.trim(),
    category: form.category,
    capacity: Number(form.capacity) || 1,
    rate_night: Number(form.rateNight) || 0,
    amenities: amenityPayload,
    status: form.status,
    image_urls: form.galleryUrls,
    image_url: form.galleryUrls[0] ?? null
  };
}

export default function AdminCottagesPage() {
  const [cottages, setCottages] = useState<Cottage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CottageCategory | "all">("all");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<Cottage | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CottageForm>({
    galleryUrls: [],
    name: "",
    category: "Cottages",
    capacity: "",
    rateNight: "",
    amenityRows: [],
    status: "Available"
  });
  const [uploadBusy, setUploadBusy] = useState<string | null>(null);

  const loadCottages = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await listCottages({ includeArchived: true });
    if (error) setLoadError(error);
    setCottages((data ?? []).map(rowToCottage));
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadCottages();
  }, [loadCottages]);

  const editingCottage = useMemo(() => cottages.find((c) => c.id === editingId) ?? null, [cottages, editingId]);

  const resetForm = () => {
    setForm({
      galleryUrls: [],
      name: "",
      category: "Cottages",
      capacity: "",
      rateNight: "",
      amenityRows: [],
      status: "Available"
    });
  };

  const openAddDialog = () => {
    resetForm();
    setIsAddOpen(true);
  };

  const openEditDialog = (cottage: Cottage) => {
    setEditingId(cottage.id);
    setForm({
      galleryUrls: [...cottage.galleryUrls],
      name: cottage.name,
      category: cottage.category,
      capacity: String(cottage.capacity),
      rateNight: cottage.rateNight,
      amenityRows: amenityRowsFromCottage(cottage),
      status: cottage.status
    });
    setIsEditOpen(true);
  };

  const toggleAmenity = (amenity: Amenity) => {
    setForm((prev) => {
      const exists = prev.amenityRows.some((r) => r.name === amenity);
      if (exists) {
        return { ...prev, amenityRows: prev.amenityRows.filter((r) => r.name !== amenity) };
      }
      return { ...prev, amenityRows: [...prev.amenityRows, { name: amenity, imageUrl: "" }].sort((a, b) => ALL_AMENITIES.indexOf(a.name) - ALL_AMENITIES.indexOf(b.name)) };
    });
  };

  const removeGalleryAt = (index: number) => {
    setForm((prev) => ({
      ...prev,
      galleryUrls: prev.galleryUrls.filter((_, i) => i !== index)
    }));
  };

  const onGalleryFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploadBusy("gallery");
    setLoadError(null);
    try {
      const next: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (!f.type.startsWith("image/")) continue;
        const { url, error } = await uploadCottageImage(f, "gallery");
        if (error) {
          setLoadError(error);
          break;
        }
        if (url) next.push(url);
      }
      if (next.length) {
        setForm((prev) => ({ ...prev, galleryUrls: [...prev.galleryUrls, ...next] }));
      }
    } finally {
      setUploadBusy(null);
    }
  };

  const onAmenityImage = async (amenity: Amenity, file: File | null) => {
    if (!file) return;
    setUploadBusy(`amenity-${amenity}`);
    setLoadError(null);
    try {
      const { url, error } = await uploadCottageImage(file, "amenity");
      if (error) {
        setLoadError(error);
        return;
      }
      if (url) {
        setForm((prev) => ({
          ...prev,
          amenityRows: prev.amenityRows.map((r) => (r.name === amenity ? { ...r, imageUrl: url } : r))
        }));
      }
    } finally {
      setUploadBusy(null);
    }
  };

  const handleAddCottage = async () => {
    if (!form.name.trim()) return;
    const { data, error } = await insertCottage(buildRowPayload(form) as Omit<FontanaCottageRow, "id" | "created_at" | "updated_at">);
    if (error) {
      setLoadError(error);
      return;
    }
    if (data) setCottages((prev) => [rowToCottage(data), ...prev]);
    setIsAddOpen(false);
    resetForm();
  };

  const handleUpdateCottage = async () => {
    if (!editingId) return;
    const { error: updateErr } = await updateCottage(editingId, buildRowPayload(form) as Partial<FontanaCottageRow>);
    if (updateErr) {
      setLoadError(updateErr);
      return;
    }
    await loadCottages();
    setIsEditOpen(false);
    setEditingId(null);
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    const { error } = await archiveCottage(archiveTarget.id);
    if (error) {
      setLoadError(error);
      return;
    }
    await loadCottages();
    setIsArchiveOpen(false);
    setArchiveTarget(null);
  };

  const openArchiveDialog = (cottage: Cottage) => {
    setArchiveTarget(cottage);
    setIsArchiveOpen(true);
  };

  const visibleCottages = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cottages.filter((c) => {
      if (categoryFilter !== "all" && c.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        c.id.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
      );
    });
  }, [cottages, search, categoryFilter]);

  const previewSrc = (c: Cottage) => c.galleryUrls[0] || c.imageUrl || "";

  return (
    <div className="space-y-6">
      {loadError && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{loadError}</p>
      )}
      {loading ? <p className="text-sm text-muted-foreground">Loading cottages...</p> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-md font-semibold tracking-tight">Manage Cottages</h1>
          <p className="text-xs text-muted-foreground">Add, edit, or remove cottages shown to guests.</p>
        </div>
        <Button variant="save" className="shrink-0" size="sm" onClick={openAddDialog}>
          Add cottage
        </Button>
      </div>

      <PageToolbar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search by name or ID...">
        <div className="flex flex-wrap gap-1.5">
          <Button type="button" size="sm" variant={categoryFilter === "all" ? "reserve" : "outline"} className="h-8 text-xs" onClick={() => setCategoryFilter("all")}>
            All
          </Button>
          {CATEGORY_OPTIONS.map((cat) => (
            <Button key={cat} type="button" size="sm" variant={categoryFilter === cat ? "reserve" : "outline"} className="h-8 text-xs" onClick={() => setCategoryFilter(cat)}>
              {cat}
            </Button>
          ))}
        </div>
      </PageToolbar>

      <div className="border border-border bg-card">
        <CardHeader className="flex flex-col gap-3 border-b bg-muted/40 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-sm font-semibold">All cottages</CardTitle>
          <Button asChild size="sm" variant="outline" className="h-8 w-fit text-xs">
            <Link href="/admin/cottages/all" className="inline-flex items-center gap-1.5">
              <List className="h-3.5 w-3.5" />
              View All Cottages
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="pt-4">
          {!loading && cottages.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No cottages yet. Add one to get started.</p>
          ) : !loading && visibleCottages.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No cottages match your search or category.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleCottages.map((cottage) => (
                <div key={cottage.id} className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                  <div className="flex h-40 items-center justify-center bg-slate-100 text-slate-500">
                    {previewSrc(cottage) ? (
                      <img src={previewSrc(cottage)} alt={cottage.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs">No image</span>
                    )}
                  </div>
                  <div className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-mono text-[0.65rem] text-muted-foreground">{cottage.id}</p>
                        <h3 className="text-sm font-semibold leading-tight">{cottage.name}</h3>
                        <p className="mt-0.5 text-[0.65rem] text-muted-foreground">{cottage.category}</p>
                      </div>
                      <Badge
                        variant={
                          cottage.status === "Available"
                            ? "statusActive"
                            : cottage.status === "Archived"
                              ? "statusArchived"
                              : "statusPending"
                        }
                        className="rounded-full"
                      >
                        {cottage.status}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>Capacity: {cottage.capacity} guests</p>
                      <p>Rate/Night: {money(cottage.rateNight)}</p>
                      <p>Photos: {cottage.galleryUrls.length || (previewSrc(cottage) ? 1 : 0)}</p>
                      <p>Amenities: {cottage.amenities.join(", ") || "None"}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 border-t pt-3">
                      <Button type="button" variant="edit" className="h-8 text-xs" onClick={() => openEditDialog(cottage)}>
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="archive"
                        className="h-8 text-xs"
                        disabled={cottage.status === "Archived"}
                        onClick={() => openArchiveDialog(cottage)}
                      >
                        <Archive className="mr-1 h-3.5 w-3.5" />
                        Archive
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className={DIALOG_CONTENT_CLASS} showClose>
          <DialogHeader className="shrink-0 space-y-1 border-b px-4 py-3 text-left">
            <DialogTitle className="text-base">Add cottage</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              First photo is the cover. Optional image per amenity.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <CottageFormFields
              form={form}
              setForm={setForm}
              toggleAmenity={toggleAmenity}
              onGalleryFiles={onGalleryFiles}
              removeGalleryAt={removeGalleryAt}
              onAmenityImage={onAmenityImage}
              uploadBusy={uploadBusy}
              showArchivedStatus={false}
            />
          </div>
          <DialogFooter className="shrink-0 gap-2 border-t px-4 py-3 sm:justify-end">
            <Button type="button" variant="cancelMuted" size="sm" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="save" size="sm" onClick={handleAddCottage}>
              Add cottage
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className={DIALOG_CONTENT_CLASS} showClose>
          <DialogHeader className="shrink-0 space-y-1 border-b px-4 py-3 text-left">
            <DialogTitle className="text-base">Edit cottage</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Update fields and images as needed.</DialogDescription>
            {editingCottage && <p className="pt-0.5 font-mono text-[0.65rem] text-muted-foreground">ID: {editingCottage.id}</p>}
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            <CottageFormFields
              form={form}
              setForm={setForm}
              toggleAmenity={toggleAmenity}
              onGalleryFiles={onGalleryFiles}
              removeGalleryAt={removeGalleryAt}
              onAmenityImage={onAmenityImage}
              uploadBusy={uploadBusy}
              showArchivedStatus
            />
          </div>
          <DialogFooter className="shrink-0 gap-2 border-t px-4 py-3 sm:justify-end">
            <Button type="button" variant="cancelMuted" size="sm" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="update" size="sm" onClick={handleUpdateCottage}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isArchiveOpen}
        onOpenChange={(open) => {
          setIsArchiveOpen(open);
          if (!open) setArchiveTarget(null);
        }}
      >
        <DialogContent className="max-w-sm gap-2 p-4">
          <DialogHeader>
            <DialogTitle>Archive cottage?</DialogTitle>
            <DialogDescription>
              Guests will no longer see <span className="font-medium text-foreground">{archiveTarget?.name ?? "this cottage"}</span>.
              You can set it back to Available or Maintenance from Edit.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="cancelMuted" onClick={() => { setIsArchiveOpen(false); setArchiveTarget(null); }}>
              Cancel
            </Button>
            <Button type="button" variant="archive" onClick={() => void confirmArchive()}>
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CottageFormFields({
  form,
  setForm,
  toggleAmenity,
  onGalleryFiles,
  removeGalleryAt,
  onAmenityImage,
  uploadBusy,
  showArchivedStatus = false
}: {
  form: CottageForm;
  setForm: Dispatch<SetStateAction<CottageForm>>;
  toggleAmenity: (amenity: Amenity) => void;
  onGalleryFiles: (files: FileList | null) => void;
  removeGalleryAt: (index: number) => void;
  onAmenityImage: (amenity: Amenity, file: File | null) => void;
  uploadBusy: string | null;
  /** When true (edit flow), admin can restore from Archived */
  showArchivedStatus?: boolean;
}) {
  const categorySelectOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const c of [form.category, ...CATEGORY_OPTIONS]) {
      if (!c || seen.has(c)) continue;
      seen.add(c);
      out.push(c);
    }
    return out;
  }, [form.category]);

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <div className="space-y-3">
        <Label className="text-xs">Cottage photos</Label>
        <p className="text-[0.7rem] text-muted-foreground">The first image is the cover on the booking page.</p>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium hover:bg-muted/50">
            {uploadBusy === "gallery" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
            Add photos
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                void onGalleryFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {form.galleryUrls.map((url, i) => (
            <div key={`${url}-${i}`} className="group relative aspect-video overflow-hidden rounded-md border border-input">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
                onClick={() => removeGalleryAt(i)}
                aria-label="Remove photo"
              >
                <X className="h-3 w-3" />
              </button>
              {i === 0 ? (
                <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[0.6rem] text-white">Cover</span>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-1">
          <Label className="text-xs">Name</Label>
          <Input className="h-9 text-sm" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Cottage name" />
        </div>

        <div className="space-y-1">
          <Label htmlFor="cottage-category" className="text-xs">
            Category
          </Label>
          <select
            id="cottage-category"
            className={SELECT_CLASS}
            value={form.category}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                category: e.target.value as CottageCategory
              }))
            }
          >
            {categorySelectOptions.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Capacity</Label>
            <Input className="h-9 text-sm" type="number" value={form.capacity} onChange={(e) => setForm((prev) => ({ ...prev, capacity: e.target.value }))} placeholder="0" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Rate / night</Label>
            <Input className="h-9 text-sm" type="number" value={form.rateNight} onChange={(e) => setForm((prev) => ({ ...prev, rateNight: e.target.value }))} placeholder="0" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Status</Label>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {(showArchivedStatus
              ? (["Available", "Maintenance", "Archived"] as CottageStatus[])
              : (["Available", "Maintenance"] as CottageStatus[])
            ).map((status) => (
              <label key={status} className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-xs">
                <input type="radio" name="cottage-status" checked={form.status === status} onChange={() => setForm((prev) => ({ ...prev, status }))} className="h-3.5 w-3.5" />
                {status}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2 border-t border-border pt-4">
          <Label className="text-xs">Amenities</Label>
          <p className="text-[0.7rem] text-muted-foreground">Optional image upload for each selected amenity.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {ALL_AMENITIES.map((amenity) => (
              <label key={amenity} className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-xs">
                <input type="checkbox" checked={form.amenityRows.some((r) => r.name === amenity)} onChange={() => toggleAmenity(amenity)} className="h-3.5 w-3.5" />
                {amenity}
              </label>
            ))}
          </div>
          <div className="space-y-3">
            {form.amenityRows.map((row) => (
              <div key={row.name} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="min-w-[5rem] text-sm font-medium">{row.name}</div>
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  {row.imageUrl ? (
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-input">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={row.imageUrl} alt="" className="h-full w-full object-cover" />
                    </div>
                  ) : null}
                  <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-[0.65rem] hover:bg-muted/50">
                    {uploadBusy === `amenity-${row.name}` ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        void onAmenityImage(row.name, f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
