import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, "utf8");
  envFile.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const [key, ...rest] = trimmed.split("=");
    if (!key) return;
    const value = rest.join("=").trim();
    if (!process.env[key]) process.env[key] = value;
  });
}

const url = process.env.NEXT_PUBLIC_SUPABASE_CUSTOMER_URL;
const key = process.env.SUPABASE_CUSTOMER_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    "Missing customer DB environment variables. Set NEXT_PUBLIC_SUPABASE_CUSTOMER_URL and SUPABASE_CUSTOMER_SERVICE_ROLE_KEY in .env."
  );
  process.exit(1);
}

const supabase = createClient(url, key);

const sampleCottages = [
  {
    name: "Cottage A - Pool View",
    category: "Cottages",
    capacity: 20,
    rate_night: 8500,
    status: "Available",
    amenities: ["Fan", "Grill", "Tables"],
    image_url:
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "A-House Deluxe",
    category: "A-House",
    capacity: 15,
    rate_night: 7200,
    status: "Available",
    amenities: ["Fan", "Tables", "Karaoke"],
    image_url:
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Ocean View Cottage",
    category: "Cottages",
    capacity: 10,
    rate_night: 9000,
    status: "Maintenance",
    amenities: ["Fan", "Grill"],
    image_url:
      "https://images.unsplash.com/photo-1523217582562-09d0def993a6?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Pickleball Hall",
    category: "Function Hall",
    capacity: 80,
    rate_night: 15000,
    status: "Available",
    amenities: ["Tables", "Karaoke"],
    image_url:
      "https://images.unsplash.com/photo-1519167758481-83f29daada0f?auto=format&fit=crop&w=1200&q=80",
  },
];

const tablesToCheck = [
  "fontana_users",
  "fontana_cottages",
  "fontana_reservations",
  "fontana_payments",
  "fontana_messages",
  "fontana_reviews",
  "fontana_events",
];

async function checkTableExists(table) {
  const { data, count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .limit(1);

  if (error) {
    return { exists: false, error: error.message };
  }

  return { exists: true, count: count ?? 0 };
}

async function main() {
  console.log("Customer DB test script starting...");

  for (const table of tablesToCheck) {
    const result = await checkTableExists(table);
    if (!result.exists) {
      console.error(
        `Table ${table} is missing or cannot be queried. Run supabase/fontana_users.sql and supabase/resort_schema.sql in the customer project first.`
      );
      process.exit(1);
    }
    console.log(`✓ ${table} exists`);
  }

  const { data: cottageRows, count: cottageCount, error: cottageCountError } = await supabase
    .from("fontana_cottages")
    .select("id", { count: "exact", head: true });

  if (cottageCountError) {
    console.error("Error checking cottages:", cottageCountError.message);
    process.exit(1);
  }

  if ((cottageCount ?? 0) === 0) {
    console.log("No cottages found. Inserting sample cottage rows...");
    const { error: insertError } = await supabase
      .from("fontana_cottages")
      .insert(sampleCottages);

    if (insertError) {
      console.error("Failed to seed sample cottages:", insertError.message);
      process.exit(1);
    }
    console.log("Sample cottages inserted.");
  } else {
    console.log(`fontana_cottages already has ${cottageCount} row(s).`);
  }

  const summary = {};
  for (const table of tablesToCheck) {
    const { count, error } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .limit(1);

    if (error) {
      console.error(`Unable to count rows for ${table}:`, error.message);
      continue;
    }
    summary[table] = count ?? 0;
  }

  console.log("\nCustomer DB validation summary:");
  Object.entries(summary).forEach(([table, count]) => {
    console.log(`- ${table}: ${count} row(s) detected`);
  });

  console.log("\nCustomer DB script completed.");
}

main().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
