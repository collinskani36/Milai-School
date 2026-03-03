/**
 * KCB Bank Payment Webhook — Production-Ready Edge Function
 *
 * Environment variables required (set in Supabase Dashboard → Edge Functions → Secrets):
 *   SUPABASE_URL        — your project URL (auto-set by Supabase)
 *   SERVICE_ROLE_KEY    — your service role key (auto-set by Supabase)
 *   WEBHOOK_SECRET      — a strong random string you generate and share with the bank
 *                         Generate one with: openssl rand -hex 32
 *
 * When going live with a real bank:
 *   1. Generate WEBHOOK_SECRET:  openssl rand -hex 32
 *   2. Add it to Supabase secrets
 *   3. Give the bank your edge function URL + the secret
 *   4. Tell them to send it as:  x-webhook-secret: <secret>
 *      (Some banks use x-api-key or Authorization: Bearer — adjust the header
 *       name in verifyWebhookSecret() to match whatever the bank uses)
 *   5. If the bank signs payloads with HMAC instead of a plain secret, replace
 *      the simple equality check with an HMAC-SHA256 verification — see the
 *      commented verifyHmac() function at the bottom of this file.
 *   6. Ask the bank for their outbound IP range and add it to Supabase's
 *      allowed list (Dashboard → Settings → Network).
 */

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PaymentPayload {
  amount: number;
  admission_number: string;
  reference?: string;
  bank_account?: string;
  narration?: string;
  term?: string;
  academic_year?: string;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  Reg_no: string;
}

interface StudentFee {
  id: string;
  term: string;
  academic_year: string;
  outstanding_balance: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const HEADERS = {
  "Content-Type": "application/json",
};

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  const requestId = crypto.randomUUID(); // trace ID for every request in logs

  try {
    // ── 1. Only accept POST ──────────────────────────────────────────────────
    if (req.method !== "POST") {
      return respond(405, { error: "Method not allowed" });
    }

    // ── 2. Authenticate the request ─────────────────────────────────────────
    const authError = verifyWebhookSecret(req);
    if (authError) {
      // Log locally but never tell the caller WHY auth failed
      console.warn(`[${requestId}] Auth failed: ${authError}`);
      return respond(401, { error: "Unauthorized" });
    }

    // ── 3. Parse and validate body ──────────────────────────────────────────
    let raw: Record<string, unknown>;
    try {
      raw = await req.json();
    } catch {
      return respond(400, { error: "Invalid JSON body" });
    }

    const validation = validatePayload(raw);
    if (!validation.ok) {
      console.warn(`[${requestId}] Validation failed:`, validation.errors);
      return respond(400, { error: "Invalid payload", details: validation.errors });
    }

    const payload = validation.payload!;

    console.info(`[${requestId}] Processing payment`, {
      admission_number: payload.admission_number,
      amount: payload.amount,
      reference: payload.reference,
    });

    // ── 4. Load env ──────────────────────────────────────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) {
      console.error(`[${requestId}] Missing env vars`);
      return respond(500, { error: "Server configuration error" });
    }

    const db = makeDbClient(supabaseUrl, supabaseKey);

    // ── 5. Idempotency — check reference across BOTH tables ─────────────────
    //    This prevents duplicate rows if the bank retries the webhook.
    if (payload.reference) {
      const [dupPayment, dupUnmatched] = await Promise.all([
        db.get(`p_payments?transaction_reference=eq.${enc(payload.reference)}&select=id`),
        db.get(`unmatched_bank_payments?reference=eq.${enc(payload.reference)}&select=id`),
      ]);

      if (dupPayment.length > 0 || dupUnmatched.length > 0) {
        console.info(`[${requestId}] Duplicate reference rejected: ${payload.reference}`);
        // Return 200 so the bank doesn't keep retrying — we already have it
        return respond(200, {
          status: "duplicate",
          message: "Payment with this reference already recorded",
        });
      }
    }

    // ── 6. Look up student by Reg_no ─────────────────────────────────────────
    let student: Student | null = await db
      .get(`students?Reg_no=eq.${enc(payload.admission_number)}&select=id,first_name,last_name,Reg_no`)
      .then((rows) => rows[0] ?? null);

    // ── 7. If no exact match, try fuzzy name match from narration ────────────
    //    Useful when a parent miskeys the reg number but writes the name correctly.
    //    We flag these as "probable_match" so admin confirms before it posts.
    let matchType: "exact" | "fuzzy" | "unmatched" = "exact";

    if (!student && payload.narration) {
      const fuzzyMatch = await fuzzyMatchByName(db, payload.narration);
      if (fuzzyMatch) {
        student = fuzzyMatch;
        matchType = "fuzzy";
        console.info(`[${requestId}] Fuzzy name match found: ${student.Reg_no}`);
      }
    }

    // ── 8. No student found at all → save to unmatched ──────────────────────
    if (!student) {
      console.info(`[${requestId}] No student match — saving to unmatched_bank_payments`);
      await saveUnmatched(db, requestId, payload);
      return respond(200, {
        status: "unmatched",
        message: "Payment stored in unmatched queue — student not found",
      });
    }

    // ── 9. Fuzzy match → also save to unmatched for admin confirmation ───────
    //    We never auto-post a fuzzy match directly to p_payments.
    //    The admin reviews it in the dashboard and allocates manually.
    if (matchType === "fuzzy") {
      console.info(`[${requestId}] Fuzzy match — routing to unmatched queue for admin confirmation`);
      await saveUnmatched(db, requestId, payload, {
        note: `Probable match: ${student.first_name} ${student.last_name} (${student.Reg_no}). Reg number provided: ${payload.admission_number}. Admin must confirm.`,
      });
      return respond(200, {
        status: "probable_match",
        message: "Probable student match found — queued for admin confirmation",
        probable_student: `${student.first_name} ${student.last_name} (${student.Reg_no})`,
      });
    }

    // ── 10. Exact match — determine term/year ────────────────────────────────
    const { term: currentTerm, year: currentYear } = await resolveTerm(
      db,
      student.id,
      payload.term,
      payload.academic_year,
    );

    console.info(`[${requestId}] Using term: ${currentTerm} / ${currentYear}`);

    // ── 11. Find the student_fees record ─────────────────────────────────────
    const studentFees: StudentFee[] = await db.get(
      `student_fees?student_id=eq.${student.id}&term=eq.${enc(currentTerm)}&academic_year=eq.${enc(currentYear)}`,
    );

    const studentFee = studentFees[0] ?? null;

    if (!studentFee) {
      console.info(`[${requestId}] No student_fees record for ${currentTerm}/${currentYear} — saving to unmatched`);
      await saveUnmatched(db, requestId, payload, {
        note: `Student found (${student.Reg_no}) but no fee record for ${currentTerm} / ${currentYear}.`,
      });
      return respond(200, {
        status: "unmatched",
        message: `Student found but no fee record for ${currentTerm} / ${currentYear}`,
      });
    }

    // ── 12. Insert into p_payments ───────────────────────────────────────────
    const paymentRow = {
      student_id:            student.id,
      fee_id:                studentFee.id,
      amount_paid:           payload.amount,
      payment_method:        "kcb_bank",
      transaction_reference: payload.reference ?? null,
      status:                "completed",
      notes:                 payload.narration
                               ? `KCB Bank: ${payload.narration}`
                               : "KCB Bank Fee Deposit",
      payment_date:          new Date().toISOString(),
      term:                  currentTerm,
      academic_year:         currentYear,
      reference_number:      buildRefNumber(payload),
    };

    const inserted = await db.post("p_payments", paymentRow);

    // ── 13. Fetch updated balance for response ───────────────────────────────
    const updatedFees: StudentFee[] = await db.get(`student_fees?id=eq.${studentFee.id}`);
    const updatedFee = updatedFees[0];

    console.info(`[${requestId}] Payment recorded successfully`, {
      student: student.Reg_no,
      payment_id: inserted?.id,
    });

    return respond(200, {
      success: true,
      message: "Payment recorded successfully",
      student: `${student.first_name} ${student.last_name}`,
      admission_number: student.Reg_no,
      term: currentTerm,
      academic_year: currentYear,
      updated_balance: updatedFee?.outstanding_balance ?? 0,
    });

  } catch (err) {
    // Never expose internal error details to the caller
    console.error(`[${requestId}] Unhandled error:`, err);
    return respond(500, {
      error: "Internal server error",
      request_id: requestId, // safe to return — useful for tracing in logs
    });
  }
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

/**
 * Verifies the shared webhook secret sent by the bank.
 *
 * In DEVELOPMENT:
 *   If WEBHOOK_SECRET env var is not set, the check is skipped entirely.
 *   This lets you test locally without configuring secrets.
 *
 * In PRODUCTION:
 *   WEBHOOK_SECRET must be set. Any request without the correct header is rejected.
 *
 * Header name: x-webhook-secret
 *   Adjust this to match whatever header your bank uses.
 *   Common alternatives: x-api-key, Authorization (as "Bearer <secret>")
 */
function verifyWebhookSecret(req: Request): string | null {
  const secret = Deno.env.get("WEBHOOK_SECRET");

  if (!secret) {
    // Dev mode — warn but allow through
    console.warn("WEBHOOK_SECRET not set — running in development mode, auth skipped");
    return null;
  }

  const provided = req.headers.get("x-webhook-secret");

  if (!provided) {
    return "Missing x-webhook-secret header";
  }

  // Constant-time comparison to prevent timing attacks
  if (!safeEqual(provided, secret)) {
    return "Invalid webhook secret";
  }

  return null; // null = auth passed
}

/**
 * Constant-time string comparison.
 * Prevents attackers from guessing the secret one character at a time
 * by measuring response timing.
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}

/**
 * HMAC-SHA256 verification — use this instead of safeEqual if your bank
 * signs the request body rather than sending a plain secret.
 *
 * Usage: replace the safeEqual() call in verifyWebhookSecret() with:
 *   const signature = req.headers.get("x-signature") ?? "";
 *   const body = await req.text(); // must read body here, before req.json()
 *   if (!await verifyHmac(body, signature, secret)) return "Invalid signature";
 *
async function verifyHmac(body: string, signature: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const sigBytes = hexToBytes(signature);
  const bodyBytes = new TextEncoder().encode(body);
  return crypto.subtle.verify("HMAC", key, sigBytes, bodyBytes);
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}
*/

// ─── Validation ───────────────────────────────────────────────────────────────

function validatePayload(raw: Record<string, unknown>): {
  ok: boolean;
  errors?: string[];
  payload?: PaymentPayload;
} {
  const errors: string[] = [];

  // amount
  const amount = Number(raw.amount);
  if (!raw.amount || isNaN(amount) || amount <= 0) {
    errors.push("amount must be a positive number");
  }

  // admission_number
  if (!raw.admission_number || typeof raw.admission_number !== "string" || !raw.admission_number.trim()) {
    errors.push("admission_number is required");
  }

  // reference — optional but if present must be a non-empty string
  if (raw.reference !== undefined && raw.reference !== null) {
    if (typeof raw.reference !== "string" || !raw.reference.trim()) {
      errors.push("reference must be a non-empty string if provided");
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    payload: {
      amount,
      admission_number: (raw.admission_number as string).trim(),
      reference:     raw.reference     ? String(raw.reference).trim()     : undefined,
      bank_account:  raw.bank_account  ? String(raw.bank_account).trim()  : undefined,
      narration:     raw.narration     ? String(raw.narration).trim()      : undefined,
      term:          raw.term          ? String(raw.term).trim()           : undefined,
      academic_year: raw.academic_year ? String(raw.academic_year).trim() : undefined,
    },
  };
}

// ─── DB client ────────────────────────────────────────────────────────────────

function makeDbClient(url: string, key: string) {
  const baseHeaders = {
    "apikey": key,
    "Authorization": `Bearer ${key}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };

  return {
    async get(path: string): Promise<any[]> {
      const res = await fetch(`${url}/rest/v1/${path}`, {
        method: "GET",
        headers: baseHeaders,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`DB GET failed [${path}]: ${text}`);
      }
      return res.json();
    },

    async post(table: string, row: Record<string, unknown>): Promise<any> {
      const res = await fetch(`${url}/rest/v1/${table}`, {
        method: "POST",
        headers: { ...baseHeaders, "Prefer": "return=representation" },
        body: JSON.stringify([row]),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`DB POST failed [${table}]: ${text}`);
      }
      const data = await res.json();
      return data[0];
    },
  };
}

// ─── Fuzzy name matching ──────────────────────────────────────────────────────

/**
 * Tries to find a student by matching words from the narration against
 * first_name + last_name combinations in the database.
 *
 * Strategy:
 *   - Extract capitalised words from the narration (likely a name)
 *   - Fetch students whose names contain any of those words
 *   - Score each candidate by how many name words appear in the narration
 *   - Return the highest scorer only if score >= 2 (at least 2 name words matched)
 *     to avoid false positives on common single-word names
 */
async function fuzzyMatchByName(
  db: ReturnType<typeof makeDbClient>,
  narration: string,
): Promise<Student | null> {
  try {
    // Extract words 3+ chars long, ignore numbers and common noise words
    const noiseWords = new Set(["fee", "fees", "kcb", "bank", "payment", "school", "term", "the", "for", "and"]);
    const words = narration
      .split(/[\s\-\/,]+/)
      .map((w) => w.replace(/[^a-zA-Z]/g, "").toLowerCase())
      .filter((w) => w.length >= 3 && !noiseWords.has(w));

    if (words.length === 0) return null;

    // Query students whose first or last name matches any extracted word
    // Using ilike for case-insensitive matching
    const orFilters = words
      .map((w) => `first_name.ilike.*${enc(w)}*,last_name.ilike.*${enc(w)}*`)
      .join(",");

    const candidates: Student[] = await db.get(
      `students?or=(${orFilters})&select=id,first_name,last_name,Reg_no&limit=20`,
    );

    if (candidates.length === 0) return null;

    // Score each candidate
    let bestMatch: Student | null = null;
    let bestScore = 0;

    for (const candidate of candidates) {
      const fullName = `${candidate.first_name} ${candidate.last_name}`.toLowerCase();
      const nameWords = fullName.split(/\s+/).filter((w) => w.length >= 3);
      const score = nameWords.filter((nw) => words.some((w) => nw.includes(w) || w.includes(nw))).length;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = candidate;
      }
    }

    // Require at least 2 matching name words to reduce false positives
    return bestScore >= 2 ? bestMatch : null;
  } catch (err) {
    // Fuzzy match is best-effort — don't let it crash the whole request
    console.warn("Fuzzy match error (non-fatal):", err);
    return null;
  }
}

// ─── Term resolution ──────────────────────────────────────────────────────────

async function resolveTerm(
  db: ReturnType<typeof makeDbClient>,
  studentId: string,
  termHint?: string,
  yearHint?: string,
): Promise<{ term: string; year: string }> {
  if (termHint && yearHint) {
    return { term: termHint, year: yearHint };
  }

  // 1. Prefer the term with an outstanding balance
  const withBalance = await db.get(
    `student_fees?student_id=eq.${studentId}&outstanding_balance=gt.0&order=academic_year.desc,term.desc&limit=1`,
  );
  if (withBalance.length > 0) {
    return { term: withBalance[0].term, year: withBalance[0].academic_year };
  }

  // 2. Fall back to most recent term regardless of balance
  const recent = await db.get(
    `student_fees?student_id=eq.${studentId}&order=academic_year.desc,term.desc&limit=1`,
  );
  if (recent.length > 0) {
    return { term: recent[0].term, year: recent[0].academic_year };
  }

  // 3. Derive from calendar month
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const term = month <= 4 ? "Term 1" : month <= 8 ? "Term 2" : "Term 3";
  return { term, year: `${year}-${year + 1}` };
}

// ─── Save to unmatched queue ──────────────────────────────────────────────────

async function saveUnmatched(
  db: ReturnType<typeof makeDbClient>,
  requestId: string,
  payload: PaymentPayload,
  extra?: { note?: string },
): Promise<void> {
  const narration = [payload.narration, extra?.note].filter(Boolean).join(" | ");

  await db.post("unmatched_bank_payments", {
    admission_number: payload.admission_number,
    amount:           payload.amount,
    reference:        payload.reference        ?? null,
    bank_account:     payload.bank_account     ?? null,
    narration:        narration || null,
    recorded_at:      new Date().toISOString(),
    // No 'status' or 'student_id' — columns don't exist in this table
  });

  console.info(`[${requestId}] Saved to unmatched_bank_payments`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function respond(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

function enc(value: string): string {
  return encodeURIComponent(value);
}

function buildRefNumber(payload: PaymentPayload): string {
  const parts = [
    payload.bank_account ? `Acc: ${payload.bank_account}` : null,
    payload.reference ?? null,
  ].filter(Boolean);
  return parts.join(" - ") || "N/A";
}