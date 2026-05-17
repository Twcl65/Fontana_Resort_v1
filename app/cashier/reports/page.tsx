"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getDashboardStats, listPaymentsAdmin, listReservationsAdmin } from "@/lib/fontana-data";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function CashierReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    cottages: 0,
    activeReservations: 0,
    pendingPayments: 0,
    totalReservations: 0,
    verifiedPayments: 0,
    refundedReservations: 0,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [dashboard, payments, reservations] = await Promise.all([
      getDashboardStats(),
      listPaymentsAdmin(),
      listReservationsAdmin(),
    ]);
    if (dashboard.error) setError(dashboard.error);
    if (payments.error) setError(payments.error);
    if (reservations.error) setError(reservations.error);
    setStats({
      cottages: dashboard.data.cottages,
      activeReservations: dashboard.data.activeReservations,
      pendingPayments: dashboard.data.pendingPayments,
      totalReservations: reservations.data.length,
      verifiedPayments: payments.data.filter((p) => p.status === "Verified").length,
      refundedReservations: reservations.data.filter((r) => r.payment_status === "Refunded").length,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const exportCashierReportPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Fontana Blue Cold Spring - Cashier Report", 14, 16);
    autoTable(doc, {
      startY: 24,
      head: [["Metric", "Value"]],
      body: [
        ["Total cottages", String(stats.cottages)],
        ["Active reservations", String(stats.activeReservations)],
        ["Pending payments", String(stats.pendingPayments)],
        ["All reservations", String(stats.totalReservations)],
        ["Verified payments", String(stats.verifiedPayments)],
        ["Refunded reservations", String(stats.refundedReservations)],
      ],
      theme: "grid",
      styles: { fontSize: 10 },
      headStyles: { fillColor: [30, 64, 175] },
    });
    doc.save(`cashier-report-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>
      ) : null}
      <div>
        <h1 className="text-md font-semibold tracking-tight">Cashier Reports</h1>
        <p className="text-xs text-muted-foreground">Operational summary for reservations and payments.</p>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading reports...</p> : null}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total cottages</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.cottages}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Active reservations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.activeReservations}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pending payments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.pendingPayments}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">All reservations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalReservations}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Verified payments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.verifiedPayments}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Refunded reservations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.refundedReservations}</p>
          </CardContent>
        </Card>
      </section>
      <div>
        <Button onClick={exportCashierReportPdf}>Generate Cashier Report PDF</Button>
      </div>
    </div>
  );
}
