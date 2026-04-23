"use client";

import { useCallback, useEffect, useState } from "react";
import { PageToolbar } from "@/components/ui/page-toolbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Star, MessageSquareReply, Trash2 } from "lucide-react";
import { deleteReview, listReviews, updateReviewAdminReply, type FontanaReviewRow } from "@/lib/fontana-data";

type ReviewRow = FontanaReviewRow & {
  cottage?: { name: string } | null;
  author?: { full_name: string | null; email: string } | null;
};

function Stars({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${i < count ? "fill-amber-400 text-amber-500" : "text-muted-foreground/30"}`} />
      ))}
    </span>
  );
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [isReplyOpen, setIsReplyOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState<ReviewRow | null>(null);
  const [replyText, setReplyText] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await listReviews();
    if (err) setError(err);
    setReviews(data as ReviewRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openReplyDialog = (review: ReviewRow) => {
    setSelectedReview(review);
    setReplyText(review.admin_reply ?? "");
    setIsReplyOpen(true);
  };

  const openDeleteDialog = (review: ReviewRow) => {
    setSelectedReview(review);
    setIsDeleteOpen(true);
  };

  const handleSendReply = async () => {
    if (!selectedReview) return;
    const { error: replyErr } = await updateReviewAdminReply(selectedReview.id, replyText.trim() || null);
    if (replyErr) {
      setError(replyErr);
      return;
    }
    setIsReplyOpen(false);
    setSelectedReview(null);
    setReplyText("");
    await load();
  };

  const handleDeleteReview = async () => {
    if (!selectedReview) return;
    const { error: delErr } = await deleteReview(selectedReview.id);
    if (delErr) {
      setError(delErr);
      return;
    }
    setIsDeleteOpen(false);
    setSelectedReview(null);
    await load();
  };

  const filteredReviews = reviews.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const guest = r.author?.full_name ?? r.author?.email ?? "";
    const cottage = r.cottage?.name ?? "";
    return (
      r.id.toLowerCase().includes(q) ||
      guest.toLowerCase().includes(q) ||
      cottage.toLowerCase().includes(q) ||
      r.comment.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>
      )}
      {loading ? <p className="text-sm text-muted-foreground">Loading reviews...</p> : null}
      <div>
        <h1 className="text-md font-semibold tracking-tight">Reviews</h1>
        <p className="text-xs text-muted-foreground">Guest feedback stored in the database.</p>
      </div>

      <PageToolbar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search reviews, guest, cottage..." />

      <div className="border border-border bg-card">
        <CardHeader className="border-b bg-muted/40 pb-3">
          <CardTitle className="text-base font-semibold">All reviews</CardTitle>
          <p className="text-xs text-muted-foreground">Reply to store an admin response on the review.</p>
        </CardHeader>
        <CardContent className="pt-0">
          <Table bordered={false}>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Guest</TableHead>
                <TableHead>Cottage</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead className="min-w-[200px]">Comment</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && reviews.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    No reviews yet.
                  </TableCell>
                </TableRow>
              )}
              {!loading && reviews.length > 0 && filteredReviews.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    No reviews match your search.
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                filteredReviews.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.id.slice(0, 8)}…</TableCell>
                  <TableCell className="font-medium">{r.author?.full_name ?? r.author?.email ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.cottage?.name ?? "—"}</TableCell>
                  <TableCell>
                    <Stars count={r.rating} />
                  </TableCell>
                  <TableCell className="max-w-xs text-sm text-muted-foreground">{r.comment}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="reserve"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => openReplyDialog(r)}
                      >
                        <MessageSquareReply className="h-3.5 w-3.5" />
                        Reply
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => openDeleteDialog(r)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </div>

      <Dialog
        open={isReplyOpen}
        onOpenChange={(open) => {
          setIsReplyOpen(open);
          if (!open) {
            setSelectedReview(null);
            setReplyText("");
          }
        }}
      >
        <DialogContent className="max-w-md gap-2 p-4">
          <DialogHeader>
            <DialogTitle>Reply to review</DialogTitle>
            <DialogDescription>
              This saves as <span className="font-medium">admin reply</span> on the review record.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <p className="rounded-md border border-border bg-muted/40 p-2 text-xs text-muted-foreground">{selectedReview?.comment}</p>
            <textarea
              className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Write your reply..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="cancelMuted" onClick={() => setIsReplyOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="save" onClick={() => void handleSendReply()}>
              Save reply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isDeleteOpen}
        onOpenChange={(open) => {
          setIsDeleteOpen(open);
          if (!open) setSelectedReview(null);
        }}
      >
        <DialogContent className="max-w-sm gap-2 p-4">
          <DialogHeader>
            <DialogTitle>Delete review</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this review{" "}
              <span className="font-medium text-foreground">{selectedReview?.id.slice(0, 8)}…</span>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="cancelMuted" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => void handleDeleteReview()}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
