import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type ReceiptPayload = {
  receiptId: string;
  referenceCode: string;
  guestName: string;
  guestEmail?: string | null;
  cottageName: string;
  reservationDateLabel: string;
  paymentMethod: string;
  paymentStatus: string;
  amount: number;
  paidAt?: string | null;
  issuedBy: string;
};

export function generateReceiptPdf(payload: ReceiptPayload) {
  const doc = new jsPDF();
  const amountLabel = `P${Number(payload.amount).toLocaleString()}`;
  const paidDate = payload.paidAt ? new Date(payload.paidAt).toLocaleString() : "N/A";
  const issuedAt = new Date().toLocaleString();
  const receiptNo = `OR-${payload.receiptId.slice(0, 8).toUpperCase()}`;

  doc.setFillColor(30, 64, 175);
  doc.rect(0, 0, 210, 32, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text("FONTANA BLUE RESORT", 14, 14);
  doc.setFontSize(10);
  doc.text("Jasaan, Misamis Oriental, Philippines", 14, 20);
  doc.text("Official Receipt", 14, 26);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.text(`Receipt No: ${receiptNo}`, 145, 14);
  doc.text(`Issued Date: ${new Date().toLocaleDateString()}`, 145, 20);
  doc.text(`Issued Time: ${new Date().toLocaleTimeString()}`, 145, 26);
  doc.setDrawColor(180, 180, 180);
  doc.line(14, 36, 196, 36);

  doc.setFontSize(11);
  doc.text(`Received from: ${payload.guestName}`, 14, 44);
  doc.text(`Email: ${payload.guestEmail?.trim() || "N/A"}`, 14, 50);
  doc.text(`Reservation Ref: ${payload.referenceCode}`, 14, 56);

  autoTable(doc, {
    startY: 64,
    theme: "grid",
    head: [["Particulars", "Reservation Date", "Payment Method", "Status", "Amount"]],
    body: [
      [`Reservation payment for ${payload.cottageName}`, payload.reservationDateLabel, payload.paymentMethod, payload.paymentStatus, amountLabel],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 64, 175] },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 100;
  doc.setFontSize(11);
  doc.text(`Total Amount Paid: ${amountLabel}`, 140, finalY + 10);
  doc.setFontSize(10);
  doc.text(`Payment Recorded: ${paidDate}`, 14, finalY + 16);
  doc.text(`Issued By: ${payload.issuedBy}`, 14, finalY + 22);
  doc.text(`Issued At: ${issuedAt}`, 14, finalY + 28);
  doc.line(14, finalY + 38, 90, finalY + 38);
  doc.text("Authorized Cashier / Admin Signature", 14, finalY + 43);
  doc.setFontSize(9);
  doc.text("This receipt is system-generated and valid without seal.", 14, finalY + 50);

  doc.save(`receipt-${payload.referenceCode}-${payload.receiptId.slice(0, 8)}.pdf`);
}
