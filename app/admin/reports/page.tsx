"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getDashboardStats, listPaymentsAdmin, listReservationsAdmin, listReviews } from "@/lib/fontana-data";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function AdminReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    cottages: 0,
    activeReservations: 0,
    pendingPayments: 0,
    totalReservations: 0,
    totalPayments: 0,
    totalReviews: 0,
  });
  const [reservations, setReservations] = useState<Awaited<ReturnType<typeof listReservationsAdmin>>["data"]>([]);
  const [payments, setPayments] = useState<Awaited<ReturnType<typeof listPaymentsAdmin>>["data"]>([]);
  const [reviews, setReviews] = useState<Awaited<ReturnType<typeof listReviews>>["data"]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [dash, res, pay, rev] = await Promise.all([
      getDashboardStats(),
      listReservationsAdmin(),
      listPaymentsAdmin(),
      listReviews(),
    ]);

    if (dash.error) setError(dash.error);
    if (res.error) setError(res.error);
    if (pay.error) setError(pay.error);
    if (rev.error) setError(rev.error);

    setReservations(res.data);
    setPayments(pay.data);
    setReviews(rev.data);
    setStats({
      cottages: dash.data.cottages,
      activeReservations: dash.data.activeReservations,
      pendingPayments: dash.data.pendingPayments,
      totalReservations: res.data.length,
      totalPayments: pay.data.length,
      totalReviews: rev.data.length,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totalRevenue = useMemo(
    () => payments.filter((p) => p.status === "Verified").reduce((sum, p) => sum + Number(p.amount ?? 0), 0),
    [payments]
  );

  const exportReservations = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("Fontana Blue Cold Spring - Reservations Report", 14, 14);
    autoTable(doc, {
      startY: 20,
      head: [["Reference", "Guest", "Email", "Cottage", "Check-in", "Check-out", "Status", "Payment", "Total"]],
      body: reservations.map((r) => [
        r.reference_code,
        r.guest_profile?.full_name ?? r.guest_name ?? "",
        r.guest_profile?.email ?? r.guest_email ?? "",
        r.cottage?.name ?? "",
        r.check_in,
        r.check_out,
        r.reservation_status,
        r.payment_status,
        `P${Number(r.total_amount).toLocaleString()}`,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 64, 175] },
    });
    doc.save(`admin-reservations-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const exportPayments = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("Fontana Blue Cold Spring - Payments Report", 14, 14);
    autoTable(doc, {
      startY: 20,
      head: [["Payment ID", "Reference", "Guest", "Amount", "Method", "Status", "Date"]],
      body: payments.map((p) => [
        p.id.slice(0, 10),
        p.reservation?.reference_code ?? "",
        p.reservation?.guest_profile?.full_name ?? p.reservation?.guest_name ?? "",
        `P${Number(p.amount).toLocaleString()}`,
        p.method,
        p.status,
        p.created_at ? new Date(p.created_at).toLocaleDateString() : "",
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 64, 175] },
    });
    doc.save(`admin-payments-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const exportReviews = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("Fontana Blue Cold Spring - Reviews Report", 14, 14);
    autoTable(doc, {
      startY: 20,
      head: [["Review ID", "Author", "Cottage", "Rating", "Comment", "Admin Reply", "Date"]],
      body: reviews.map((r) => [
        r.id.slice(0, 10),
        r.author?.full_name ?? r.author?.email ?? "",
        r.cottage?.name ?? "",
        String(r.rating),
        r.comment,
        r.admin_reply ?? "",
        new Date(r.created_at).toLocaleDateString(),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 64, 175] },
    });
    doc.save(`admin-reviews-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>
      ) : null}
      <div>
        <h1 className="text-md font-semibold tracking-tight">Reports</h1>
        <p className="text-xs text-muted-foreground">Generate and export operational reports for resort management.</p>
      </div>
      {loading ? <p className="text-sm text-muted-foreground">Loading reports...</p> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total cottages</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.cottages}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Active reservations</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.activeReservations}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Pending payments</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.pendingPayments}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total reservations</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.totalReservations}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total payments</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.totalPayments}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Verified revenue</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{`P${totalRevenue.toLocaleString()}`}</p></CardContent></Card>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button onClick={exportReservations}>Generate Reservations Report</Button>
        <Button variant="outline" onClick={exportPayments}>Generate Payments Report</Button>
        <Button variant="outline" onClick={exportReviews}>Generate Reviews Report</Button>
      </div>
    </div>
  );
}
