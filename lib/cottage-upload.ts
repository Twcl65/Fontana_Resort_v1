import { supabase } from "@/lib/supabaseClient";

const BUCKET = "cottage-images";

/** Upload an image for cottages or amenities. Requires bucket `cottage-images` and admin storage policies. */
export async function uploadCottageImage(
  file: File,
  subfolder: "gallery" | "amenity"
): Promise<{ url: string | null; error: string | null }> {
  const ext =
    file.name
      .split(".")
      .pop()
      ?.replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase() || "jpg";
  const path = `${subfolder}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false
  });
  if (error) return { url: null, error: error.message };
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return { url: pub.publicUrl, error: null };
}
