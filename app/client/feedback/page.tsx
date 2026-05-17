"use client";

import { useCallback, useEffect, useState, ChangeEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Star, CheckCircle2, MessageCirclePlus } from "lucide-react";
import { fetchCurrentUserWithRole } from "@/lib/auth";
import {
  insertReview,
  listCottages,
  listReviewsForUser,
  type FontanaCottageRow,
  type FontanaReviewRow
} from "@/lib/fontana-data";

type Rating = 1 | 2 | 3 | 4 | 5;

type ReviewRow = FontanaReviewRow & { cottage?: { name: string } | null };

type FeedbackModalStep = "form" | "confirmSubmit" | "confirmCancel" | "success";

export default function ClientFeedbackPage() {
  const [rating, setRating] = useState<Rating>(4);
  const [hoverRating, setHoverRating] = useState<Rating | null>(null);
  const [title, setTitle] = useState("");
  const [feedback, setFeedback] = useState("");
  const [cottages, setCottages] = useState<FontanaCottageRow[]>([]);
  const [cottageId, setCottageId] = useState<string>("");
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [modalStep, setModalStep] = useState<FeedbackModalStep>("form");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);

  const loadCottages = useCallback(async () => {
    const { data } = await listCottages();
    setCottages(data ?? []);
    if (data?.[0]) setCottageId(data[0].id);
  }, []);

  const loadMyReviews = useCallback(async () => {
    setLoadingReviews(true);
    try {
      const current = await fetchCurrentUserWithRole();
      if (!current) {
        setReviews([]);
        return;
      }
      const { data, error } = await listReviewsForUser(current.dbUser.id);
      if (error) {
        setReviews([]);
        return;
      }
      setReviews(data ?? []);
    } catch {
      setReviews([]);
    } finally {
      setLoadingReviews(false);
    }
  }, []);

  useEffect(() => {
    void loadCottages();
  }, [loadCottages]);

  useEffect(() => {
    void loadMyReviews();
  }, [loadMyReviews]);

  const resetForm = () => {
    setRating(4);
    setTitle("");
    setFeedback("");
    setPhotoName(null);
    setSubmitError(null);
    if (cottages[0]) setCottageId(cottages[0].id);
  };

  const openAddFeedback = () => {
    resetForm();
    setModalStep("form");
    setShowFormDialog(true);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setPhotoName(file ? file.name : null);
  };

  const handlePrimarySubmit = () => {
    setModalStep("confirmSubmit");
  };

  const handleConfirmSubmit = async () => {
    setSubmitError(null);
    try {
      const current = await fetchCurrentUserWithRole();
      if (!current) {
        setSubmitError("Please sign in to submit a review.");
        return;
      }
      if (!feedback.trim()) {
        setSubmitError("Please enter your feedback.");
        return;
      }
      const { error: reviewErr } = await insertReview({
        user_id: current.dbUser.id,
        cottage_id: cottageId || null,
        rating,
        title: title.trim() || null,
        comment: feedback.trim()
      });
      if (reviewErr) {
        setSubmitError(reviewErr);
        return;
      }
      setModalStep("success");
      await loadMyReviews();
      resetForm();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to submit.");
    }
  };

  const handlePrimaryCancel = () => {
    setModalStep("confirmCancel");
  };

  const handleCancelYes = () => {
    setShowFormDialog(false);
    setModalStep("form");
    resetForm();
  };

  const hasReply = (r: ReviewRow) =>
    !!(r.admin_reply && String(r.admin_reply).trim().length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-md font-semibold tracking-tight">Feedback</h1>
          <p className="text-xs text-muted-foreground">
            Your reviews and replies from Fontana Blue Cold Spring.
          </p>
        </div>
        <Button type="button" size="sm" variant="reserve" className="w-fit gap-2" onClick={openAddFeedback}>
          <MessageCirclePlus className="h-4 w-4" />
          Add feedback
        </Button>
      </div>

      {submitError && !showFormDialog && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{submitError}</p>
      )}

      <div className="border border-gray-200 bg-white shadow-sm">
        <CardHeader className="border-b bg-muted/40 pb-3">
          <CardTitle className="text-sm font-semibold">Your feedback</CardTitle>
          <p className="text-xs text-muted-foreground">Resort reply status updates when staff respond.</p>
        </CardHeader>
        <CardContent className="pt-0">
          {loadingReviews ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading your reviews…</p>
          ) : reviews.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No feedback yet. Use <span className="font-medium">Add feedback</span> to leave a review.
            </p>
          ) : (
            <Table bordered={false}>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Date</TableHead>
                  <TableHead>Cottage</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead className="min-w-[140px]">Your comment</TableHead>
                  <TableHead className="whitespace-nowrap">Resort reply</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviews.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="align-top text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric"
                      })}
                    </TableCell>
                    <TableCell className="align-top text-sm">{r.cottage?.name ?? "General"}</TableCell>
                    <TableCell className="align-top">
                      <span className="inline-flex items-center gap-0.5 text-amber-500">
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star
                            key={i}
                            className={`h-3.5 w-3.5 ${i < r.rating ? "fill-amber-400 text-amber-500" : "text-muted-foreground/25"}`}
                          />
                        ))}
                      </span>
                    </TableCell>
                    <TableCell className="align-top max-w-[220px] text-xs text-muted-foreground">
                      {r.title ? <span className="font-medium text-foreground">{r.title}. </span> : null}
                      {r.comment}
                    </TableCell>
                    <TableCell className="align-top">
                      {hasReply(r) ? (
                        <div className="space-y-1">
                          <Badge variant="statusCompleted" className="rounded-full">
                            Replied
                          </Badge>
                          <p className="text-xs text-muted-foreground line-clamp-3">{r.admin_reply}</p>
                        </div>
                      ) : (
                        <Badge variant="statusPending" className="rounded-full">
                          Awaiting reply
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </div>

      <Dialog
        open={showFormDialog}
        onOpenChange={(open) => {
          setShowFormDialog(open);
          if (!open) {
            setSubmitError(null);
            setModalStep("form");
          }
        }}
      >
        <DialogContent
          showClose={modalStep === "form" || modalStep === "success"}
          className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
        >
          {modalStep === "form" ? (
            <>
              <DialogHeader className="border-b px-4 py-3">
                <DialogTitle className="text-base">Leave a review</DialogTitle>
                <DialogDescription className="text-xs">
                  Share your experience at Fontana Blue Cold Spring.
                </DialogDescription>
              </DialogHeader>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
                {submitError ? (
                  <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{submitError}</p>
                ) : null}

                <div className="space-y-1">
                  <Label className="text-xs">Cottage (optional)</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={cottageId}
                    onChange={(e) => setCottageId(e.target.value)}
                  >
                    <option value="">General / not specific</option>
                    {cottages.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Rate Your Experience</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map((value) => {
                        const v = value as Rating;
                        const activeValue = hoverRating ?? rating;
                        return (
                          <button
                            key={v}
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-transparent"
                            onMouseEnter={() => setHoverRating(v)}
                            onMouseLeave={() => setHoverRating(null)}
                            onClick={() => setRating(v)}
                          >
                            <Star
                              className={`h-5 w-5 ${
                                v <= activeValue ? "fill-yellow-400 text-yellow-400" : "text-slate-300"
                              }`}
                            />
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {rating >= 4 ? "Good" : rating === 3 ? "Okay" : "Needs improvement"}
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Review Title</Label>
                  <Input
                    className="h-9 text-sm"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Short title for your review"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Your Feedback</Label>
                  <Textarea
                    className="min-h-[90px] resize-none text-sm"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Tell us about your experience..."
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Upload Photo (optional)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="feedback-photo"
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleFileChange}
                    />
                    <label
                      htmlFor="feedback-photo"
                      className="inline-flex cursor-pointer items-center rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
                    >
                      Choose File
                    </label>
                    <p className="text-[0.7rem] text-muted-foreground">{photoName ?? "No file chosen"}</p>
                  </div>
                </div>
              </div>
              <DialogFooter className="flex-shrink-0 flex-row justify-end gap-2 border-t px-4 py-3 sm:justify-end">
                <Button type="button" variant="cancelMuted" size="sm" className="h-9" onClick={handlePrimaryCancel}>
                  Cancel
                </Button>
                <Button type="button" variant="save" size="sm" className="h-9" onClick={handlePrimarySubmit}>
                  Submit Review
                </Button>
              </DialogFooter>
            </>
          ) : null}

          {modalStep === "confirmSubmit" ? (
            <>
              <DialogHeader className="border-b px-4 py-3">
                <DialogTitle className="text-base">Submit review?</DialogTitle>
                <DialogDescription className="text-xs">
                  Confirm before your review is sent to the resort.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 px-4 py-4">
                {submitError ? <p className="text-xs text-red-600">{submitError}</p> : null}
                <p className="text-xs text-muted-foreground">
                  Are you sure you want to submit this review? You will not be able to edit it afterwards.
                </p>
              </div>
              <DialogFooter className="flex-shrink-0 flex-row justify-end gap-2 border-t px-4 py-3 sm:justify-end">
                <Button type="button" variant="cancelMuted" size="sm" className="h-9" onClick={() => setModalStep("form")}>
                  Back
                </Button>
                <Button type="button" variant="save" size="sm" className="h-9" onClick={() => void handleConfirmSubmit()}>
                  Submit
                </Button>
              </DialogFooter>
            </>
          ) : null}

          {modalStep === "confirmCancel" ? (
            <>
              <DialogHeader className="border-b px-4 py-3">
                <DialogTitle className="text-base">Cancel review?</DialogTitle>
                <DialogDescription className="text-xs">You can continue editing or close without saving.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 px-4 py-4">
                <p className="text-xs text-muted-foreground">
                  Close the form without submitting? Your current text will be cleared.
                </p>
              </div>
              <DialogFooter className="flex-shrink-0 flex-row justify-end gap-2 border-t px-4 py-3 sm:justify-end">
                <Button type="button" variant="cancelMuted" size="sm" className="h-9" onClick={() => setModalStep("form")}>
                  Keep editing
                </Button>
                <Button type="button" variant="destructive" size="sm" className="h-9" onClick={handleCancelYes}>
                  Yes, close
                </Button>
              </DialogFooter>
            </>
          ) : null}

          {modalStep === "success" ? (
            <>
              <DialogHeader className="border-b px-4 py-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-[#16A34A]" />
                  <DialogTitle className="text-base">Review submitted</DialogTitle>
                </div>
                <DialogDescription className="text-xs">
                  Thank you for your feedback.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 px-4 py-4">
                <p className="text-xs text-muted-foreground">
                  It helps us improve your experience at Fontana Blue Cold Spring.
                </p>
              </div>
              <DialogFooter className="flex-shrink-0 flex-row justify-end gap-2 border-t px-4 py-3 sm:justify-end">
                <Button
                  type="button"
                  variant="save"
                  size="sm"
                  className="h-9"
                  onClick={() => {
                    setShowFormDialog(false);
                    setModalStep("form");
                  }}
                >
                  OK
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
