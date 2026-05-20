"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { ArrowLeft, Eye, Image as ImageIcon } from "lucide-react";
import { cottageAmenityNames, listCottages, type FontanaCottageRow } from "@/lib/fontana-data";

type CottageStatus = "Available" | "Maintenance" | "Archived";

function money(value: number) {
  return `₱${Number(value || 0).toLocaleString()}`;
}

function amenitiesLabel(row: FontanaCottageRow) {
  const names = cottageAmenityNames(row.amenities);
  return names.length ? names.join(", ") : "—";
}

export default function AdminAllCottagesPage() {
  const [cottages, setCottages] = useState<FontanaCottageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedCottage, setSelectedCottage] = useState<FontanaCottageRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await listCottages({ includeArchived: true });
    if (error) setLoadError(error);
    setCottages(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-full">
          <Link href="/admin/cottages" aria-label="Back to cottages">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-md font-semibold tracking-tight">All cottages</h1>
          <p className="text-xs text-muted-foreground">
            Table list view of all cottages.
          </p>
        </div>
      </div>

      {loadError && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {loadError}
        </p>
      )}

      <Card className="border border-border bg-card">
        <CardHeader className="border-b bg-muted/40 pb-3">
          <CardTitle className="text-sm font-semibold">Cottage list</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading cottages…</p>
          ) : cottages.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No cottages yet.</p>
          ) : (
          <Table bordered={false}>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Rate/Day</TableHead>
                <TableHead>Amenities</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cottages.map((cottage) => (
                <TableRow key={cottage.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{cottage.id}</TableCell>
                  <TableCell className="font-medium">{cottage.name}</TableCell>
                  <TableCell className="text-sm">{cottage.capacity} guests</TableCell>
                  <TableCell className="text-sm">{money(cottage.rate_night)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {amenitiesLabel(cottage)}
                  </TableCell>
                  <TableCell>
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
                      {cottage.status as CottageStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="view"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => {
                        setSelectedCottage(cottage);
                        setIsViewOpen(true);
                      }}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={isViewOpen}
        onOpenChange={(open) => {
          setIsViewOpen(open);
          if (!open) setSelectedCottage(null);
        }}
      >
        <DialogContent className="max-w-md gap-2 p-4">
          <DialogHeader>
            <DialogTitle>Cottage Information</DialogTitle>
            <DialogDescription>Details for selected cottage.</DialogDescription>
          </DialogHeader>
          {selectedCottage && (
            <div className="grid gap-2.5 text-sm">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Cottage Picture</p>
                <div className="relative flex h-28 items-center justify-center overflow-hidden rounded-md border border-input bg-slate-100 text-slate-500">
                  {selectedCottage.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- admin may paste any image URL
                    <img
                      src={selectedCottage.image_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-xs">
                      <ImageIcon className="h-5 w-5" />
                      <span>No image URL</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-[120px,1fr] gap-2 text-xs">
                <p className="text-muted-foreground">ID</p>
                <p className="font-medium">{selectedCottage.id}</p>
                <p className="text-muted-foreground">Name</p>
                <p className="font-medium">{selectedCottage.name}</p>
                <p className="text-muted-foreground">Capacity</p>
                <p>{selectedCottage.capacity} guests</p>
                <p className="text-muted-foreground">Rate/Day</p>
                <p>{money(selectedCottage.rate_night)}</p>
                <p className="text-muted-foreground">Amenities</p>
                <p>{amenitiesLabel(selectedCottage)}</p>
                <p className="text-muted-foreground">Status</p>
                <p>{selectedCottage.status}</p>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button type="button" variant="cancelMuted" onClick={() => setIsViewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
