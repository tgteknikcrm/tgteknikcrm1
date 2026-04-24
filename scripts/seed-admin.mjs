// One-shot script to bootstrap the first admin user.
// Usage: node scripts/seed-admin.mjs
//
// Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
// Creates an auth user; the on_auth_user_created trigger creates the profile
// and promotes them to admin because their phone matches +905426469070.
//
// Idempotent: if the admin already exists, the script reports and exits.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1]] ??= m[2];
  }
}

loadEnv();

const ADMIN_PHONE = "+905426469070";
const ADMIN_PASSWORD = process.argv[2] || "80148014";
const ADMIN_NAME = "TG Teknik Yönetici";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const digits = ADMIN_PHONE.replace(/\D/g, "");
const virtualEmail = `${digits}@tgteknik.local`;

console.log(`Creating admin: ${ADMIN_PHONE} (${virtualEmail})`);

const { data, error } = await supabase.auth.admin.createUser({
  email: virtualEmail,
  password: ADMIN_PASSWORD,
  email_confirm: true,
  user_metadata: { full_name: ADMIN_NAME, phone: ADMIN_PHONE },
});

if (error) {
  if (error.message.toLowerCase().includes("already")) {
    console.log("Admin already exists. No changes made.");
    process.exit(0);
  }
  console.error("Failed:", error.message);
  process.exit(1);
}

console.log("OK. User id:", data.user?.id);

// Verify the trigger promoted the role to admin.
const { data: profile } = await supabase
  .from("profiles")
  .select("id, full_name, phone, role, active")
  .eq("id", data.user.id)
  .single();

console.log("Profile:", profile);
if (profile?.role !== "admin") {
  console.warn("Profile role is not admin — promoting manually.");
  const { error: upErr } = await supabase
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", data.user.id);
  if (upErr) {
    console.error("Promotion failed:", upErr.message);
    process.exit(1);
  }
  console.log("Promoted to admin.");
}
