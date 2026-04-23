import { AppUserRole } from "@/lib/auth";
import {
  getAdminMessageThreads,
  listMessagesForClient,
  listPaymentsAdmin,
  listPaymentsForUser,
  listReservationsAdmin,
  listReservationsForUser,
  listReviews,
} from "@/lib/fontana-data";

export type AppNotificationType = "payment" | "booking" | "reservation" | "message" | "review";

export type AppNotificationItem = {
  id: string;
  type: AppNotificationType;
  title: string;
  description: string;
  time: string;
  createdAt: string;
  isNew: boolean;
};

function relativeTime(iso: string): string {
  const now = Date.now();
  const at = new Date(iso).getTime();
  const diffMs = Math.max(0, now - at);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < hour) return `${Math.max(1, Math.floor(diffMs / minute))} min ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)} hr ago`;
  return `${Math.floor(diffMs / day)} day(s) ago`;
}

function pushEvent(
  list: AppNotificationItem[],
  event: Omit<AppNotificationItem, "time" | "isNew">
) {
  const created = new Date(event.createdAt).getTime();
  const isRecent = Date.now() - created <= 24 * 60 * 60 * 1000;
  list.push({
    ...event,
    time: relativeTime(event.createdAt),
    isNew: isRecent,
  });
}

export async function getNotificationsForUser(role: AppUserRole, userId: string): Promise<AppNotificationItem[]> {
  const items: AppNotificationItem[] = [];

  if (role === "admin" || role === "cashier") {
    const [reservationsRes, paymentsRes, messagesRes, reviewsRes] = await Promise.all([
      listReservationsAdmin(),
      listPaymentsAdmin(),
      getAdminMessageThreads(),
      listReviews(),
    ]);

    if (!reservationsRes.error) {
      const pending = reservationsRes.data.filter((r) => r.reservation_status === "Pending").slice(0, 3);
      for (const r of pending) {
        pushEvent(items, {
          id: `res-pending-${r.id}`,
          type: "reservation",
          title: "Pending reservation",
          description: `${r.reference_code} is waiting for confirmation.`,
          createdAt: r.created_at ?? new Date().toISOString(),
        });
      }
    }

    if (!paymentsRes.error) {
      const pendingPayments = paymentsRes.data.filter((p) => p.status === "Pending").slice(0, 3);
      for (const p of pendingPayments) {
        pushEvent(items, {
          id: `pay-pending-${p.id}`,
          type: "payment",
          title: "Payment needs verification",
          description: `Booking ${p.reservation?.reference_code ?? "Unknown"} has a pending payment.`,
          createdAt: p.created_at ?? new Date().toISOString(),
        });
      }
    }

    if (!messagesRes.error) {
      for (const thread of messagesRes.data.slice(0, 3)) {
        pushEvent(items, {
          id: `msg-${thread.clientUserId}-${thread.lastAt}`,
          type: "message",
          title: "Client message thread updated",
          description: `${thread.clientName}: ${thread.preview}`,
          createdAt: thread.lastAt,
        });
      }
    }

    if (!reviewsRes.error) {
      for (const review of reviewsRes.data.slice(0, 2)) {
        pushEvent(items, {
          id: `review-${review.id}`,
          type: "review",
          title: "New guest review",
          description: review.title?.trim() || review.comment.slice(0, 60),
          createdAt: review.created_at,
        });
      }
    }
  } else {
    const [reservationsRes, paymentsRes, messagesRes] = await Promise.all([
      listReservationsForUser(userId),
      listPaymentsForUser(userId),
      listMessagesForClient(userId),
    ]);

    if (!reservationsRes.error) {
      const confirmed = reservationsRes.data.filter((r) => r.reservation_status === "Confirmed").slice(0, 3);
      for (const r of confirmed) {
        pushEvent(items, {
          id: `res-confirmed-${r.id}`,
          type: "booking",
          title: "Reservation confirmed",
          description: `${r.reference_code} has been approved.`,
          createdAt: r.created_at ?? new Date().toISOString(),
        });
      }
    }

    if (!paymentsRes.error) {
      const paymentEvents = paymentsRes.data
        .filter((p) => p.status === "Verified" || p.status === "Rejected")
        .slice(0, 3);
      for (const p of paymentEvents) {
        pushEvent(items, {
          id: `payment-${p.id}`,
          type: "payment",
          title: p.status === "Verified" ? "Payment verified" : "Payment rejected",
          description: `Booking ${p.reservation?.reference_code ?? "Unknown"} payment is ${p.status.toLowerCase()}.`,
          createdAt: p.created_at ?? new Date().toISOString(),
        });
      }
    }

    if (!messagesRes.error) {
      const staffMessages = messagesRes.data
        .filter((m) => m.sender_user_id !== userId)
        .slice(-3)
        .reverse();
      for (const m of staffMessages) {
        pushEvent(items, {
          id: `msg-client-${m.id}`,
          type: "message",
          title: "New staff reply",
          description: m.body.slice(0, 70),
          createdAt: m.created_at,
        });
      }
    }
  }

  return items
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);
}
