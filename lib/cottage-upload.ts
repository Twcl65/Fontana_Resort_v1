import { getCustomerAuthToken } from "@/lib/customer-api-client";

const BUCKET = "cottage-images";

/** Upload an image for cottages or amenities via the customer DB storage bucket. */
export async function uploadCottageImage(
  file: File,
  subfolder: "gallery" | "amenity"
): Promise<{ url: string | null; error: string | null }> {
  try {
    const token = await getCustomerAuthToken();
    const form = new FormData();
    form.append("file", file);
    form.append("subfolder", subfolder);

    const res = await fetch("/api/upload/cottage-image", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const data = (await res.json()) as { url?: string; error?: string };
    if (!res.ok) {
      return { url: null, error: data.error ?? "Upload failed." };
    }
    return { url: data.url ?? null, error: null };
  } catch (err) {
    return { url: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export { BUCKET };
