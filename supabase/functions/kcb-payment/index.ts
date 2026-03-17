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
  total_billed: number;
  total_paid: number;
  credit_carried: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const HEADERS = {
  "Content-Type": "application/json",
};

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  const requestId = crypto.randomUUID();

  try {
    if (req.method !== "POST") {
      return respond(405, { error: "Method not allowed" });
    }

    const authError = verifyWebhookSecret(req);
    if (authError) {
      console.warn(`[${requestId}] Auth failed: ${authError}`);
      return respond(401, { error: "Unauthorized" });
    }

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) {
      console.error(`[${requestId}] Missing env vars`);
      return respond(500, { error: "Server configuration error" });
    }

    const db = makeDbClient(supabaseUrl, supabaseKey);

    if (payload.reference) {
      const [dupPayment, dupUnmatched] = await Promise.all([
        db.get(`p_payments?transaction_reference=eq.${enc(payload.reference)}&select=id`),
        db.get(`unmatched_bank_payments?reference=eq.${enc(payload.reference)}&select=id`),
      ]);

      if (dupPayment.length > 0 || dupUnmatched.length > 0) {
        console.info(`[${requestId}] Duplicate reference rejected: ${payload.reference}`);
        return respond(200, {
          status: "duplicate",
          message: "Payment with this reference already recorded",
        });
      }
    }

    let student: Student | null = await db
      .get(`students?Reg_no=eq.${enc(payload.admission_number)}&select=id,first_name,last_name,Reg_no`)
      .then((rows) => rows[0] ?? null);

    let matchType: "exact" | "fuzzy" | "unmatched" = "exact";

    if (!student && payload.narration) {
      const fuzzyMatch = await fuzzyMatchByName(db, payload.narration);
      if (fuzzyMatch) {
        student = fuzzyMatch;
        matchType = "fuzzy";
        console.info(`[${requestId}] Fuzzy name match found: ${student.Reg_no}`);
      }
    }

    if (!student) {
      console.info(`[${requestId}] No student match — saving to unmatched_bank_payments`);
      await saveUnmatched(db, requestId, payload);
      return respond(200, {
        status: "unmatched",
        message: "Payment stored in unmatched queue — student not found",
      });
    }

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

    // ── 10. Resolve the term from payload hint ────────────────────────────────
    const { term: resolvedTerm, year: resolvedYear } = await resolveTerm(
      db,
      student.id,
      payload.term,
      payload.academic_year,
    );

    // ── 11. Load ALL fee records for this student in the resolved academic year ─
    //    Sorted Term 1 → Term 3.
    const allFeeRecordsForYear: StudentFee[] = await db.get(
      `student_fees?student_id=eq.${student.id}&academic_year=eq.${enc(resolvedYear)}&order=term.asc`,
    );

    if (allFeeRecordsForYear.length === 0) {
      console.info(`[${requestId}] No student_fees records for ${resolvedYear} — saving to unmatched`);
      await saveUnmatched(db, requestId, payload, {
        note: `Student found (${student.Reg_no}) but no fee records for ${resolvedYear}.`,
      });
      return respond(200, {
        status: "unmatched",
        message: `Student found but no fee records for ${resolvedYear}`,
      });
    }

    // ── 12. Waterfall allocation starting from the first term (Term 1) ─────────
    //    Distribute the incoming payment across term records in order:
    //      Term 1 gets paid first, then Term 2, then Term 3.
    //    Any surplus after all terms are cleared becomes credit on the
    //    LAST record (no further terms exist to absorb it).
    //
    //    Example:
    //      Term 1 outstanding = 50,000  |  Term 2 outstanding = 40,000
    //      Payment = 60,000
    //      → Term 1 receives 50,000 → fully cleared
    //      → Term 2 receives 10,000 → balance drops to 30,000
    //      → No credit left over

    const allocationTargets = allFeeRecordsForYear; // already sorted Term 1 → Term 3

    const allocations: Array<{ record: StudentFee; allocated: number }> = [];
    let remaining = payload.amount;

    for (const record of allocationTargets) {
      if (remaining <= 0) break;
      const owed = Math.max(0, record.outstanding_balance ?? 0);
      const allocate = owed > 0 ? Math.min(remaining, owed) : 0;
      if (allocate > 0 || record === allocationTargets[allocationTargets.length - 1]) {
        // Always include the last target so surplus credit lands somewhere
        allocations.push({ record, allocated: allocate });
        remaining -= allocate;
      }
    }

    // If there is still remaining (all terms fully paid) put surplus on last record
    if (remaining > 0 && allocations.length > 0) {
      allocations[allocations.length - 1].allocated += remaining;
      remaining = 0;
    }

    console.info(`[${requestId}] Waterfall allocation:`, allocations.map(
      (a) => `${a.record.term} ← KES ${a.allocated}`,
    ));

    // ── 13. Insert one p_payments row (linked to first / primary target) ──────
    //    We record the full payment amount once against the earliest term
    //    being paid. The balance updates below reflect the split.
    const primaryTarget = allocations[0].record;
    const isCrossTermPayment = allocations.length > 1;

    const paymentRow = {
      student_id:            student.id,
      fee_id:                primaryTarget.id,
      amount_paid:           payload.amount,
      payment_method:        "kcb_bank",
      transaction_reference: payload.reference ?? null,
      status:                "completed",
      notes:                 buildNotes(payload, isCrossTermPayment, resolvedTerm, allocations),
      payment_date:          new Date().toISOString(),
      term:                  primaryTarget.term,
      academic_year:         primaryTarget.academic_year,
      reference_number:      buildRefNumber(payload),
    };

    console.info(`[${requestId}] Inserting payment row:`, JSON.stringify(paymentRow));
    const inserted = await db.post("p_payments", paymentRow);
    console.info(`[${requestId}] Payment insert OK, id=${inserted?.id}`);

    // ── 14. Update each term's student_fees record with its allocation ─────────
    //    We directly set total_paid and recalculate outstanding_balance so
    //    the numbers are correct regardless of whether Supabase triggers fire.
    for (const { record, allocated } of allocations) {
      if (allocated <= 0) continue;

      const newTotalPaid       = (record.total_paid ?? 0) + allocated;
      const newOutstanding     = Math.max(0,
        (record.total_billed ?? 0) - newTotalPaid - (record.credit_carried ?? 0),
      );
      // Credit only arises on the last term if payment exceeds total billed
      const newCredit = record === allocations[allocations.length - 1].record
        ? Math.max(0, newTotalPaid - (record.total_billed ?? 0))
        : 0;
      const newStatus = deriveStatus(newOutstanding, record.total_billed ?? 0, newTotalPaid);

      const patchPayload = {
        total_paid:          newTotalPaid,
        outstanding_balance: newOutstanding,
        credit_carried:      newCredit,
        status:              newStatus,
        last_payment_date:   new Date().toISOString().split("T")[0],
        updated_at:          new Date().toISOString(),
      };

      console.info(`[${requestId}] PATCHing student_fees id=${record.id} (${record.term}):`, JSON.stringify(patchPayload));
      await db.patch(`student_fees?id=eq.${record.id}`, patchPayload);
      console.info(`[${requestId}] PATCH OK for ${record.term}`);

      console.info(
        `[${requestId}] Updated ${record.term}: paid +${allocated}, ` +
        `outstanding ${record.outstanding_balance} → ${newOutstanding}` +
        (newCredit > 0 ? `, credit ${newCredit}` : ""),
      );
    }

    // ── 15. Fetch final balance of primary target for response ────────────────
    const updatedFees: StudentFee[] = await db.get(`student_fees?id=eq.${primaryTarget.id}`);
    const updatedFee = updatedFees[0];

    console.info(`[${requestId}] Payment recorded successfully`, {
      student: student.Reg_no,
      payment_id: inserted?.id,
      terms_updated: allocations.length,
    });

    return respond(200, {
      success: true,
      message: "Payment recorded successfully",
      student: `${student.first_name} ${student.last_name}`,
      admission_number: student.Reg_no,
      term: primaryTarget.term,
      academic_year: primaryTarget.academic_year,
      updated_balance: updatedFee?.outstanding_balance ?? 0,
      ...(isCrossTermPayment && {
        cross_term_payment: true,
        allocation: allocations.map((a) => ({
          term: a.record.term,
          allocated: a.allocated,
        })),
      }),
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${requestId}] Unhandled error: ${message}`, err);
    return respond(500, {
      error: "Internal server error",
      detail: message,   // ← remove this line once root cause is found
      request_id: requestId,
    });
  }
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

function verifyWebhookSecret(req: Request): string | null {
  const secret = Deno.env.get("WEBHOOK_SECRET");

  if (!secret) {
    console.warn("WEBHOOK_SECRET not set — running in development mode, auth skipped");
    return null;
  }

  const provided = req.headers.get("x-webhook-secret");

  if (!provided) {
    return "Missing x-webhook-secret header";
  }

  if (!safeEqual(provided, secret)) {
    return "Invalid webhook secret";
  }

  return null;
}

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

// ─── Validation ───────────────────────────────────────────────────────────────

function validatePayload(raw: Record<string, unknown>): {
  ok: boolean;
  errors?: string[];
  payload?: PaymentPayload;
} {
  const errors: string[] = [];

  const amount = Number(raw.amount);
  if (!raw.amount || isNaN(amount) || amount <= 0) {
    errors.push("amount must be a positive number");
  }

  if (!raw.admission_number || typeof raw.admission_number !== "string" || !raw.admission_number.trim()) {
    errors.push("admission_number is required");
  }

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

    async patch(path: string, updates: Record<string, unknown>): Promise<void> {
      const res = await fetch(`${url}/rest/v1/${path}`, {
        method: "PATCH",
        headers: { ...baseHeaders, "Prefer": "return=minimal" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`DB PATCH failed [${path}]: ${text}`);
      }
    },
  };
}

// ─── Fuzzy name matching ──────────────────────────────────────────────────────

async function fuzzyMatchByName(
  db: ReturnType<typeof makeDbClient>,
  narration: string,
): Promise<Student | null> {
  try {
    const noiseWords = new Set(["fee", "fees", "kcb", "bank", "payment", "school", "term", "the", "for", "and"]);
    const words = narration
      .split(/[\s\-\/,]+/)
      .map((w) => w.replace(/[^a-zA-Z]/g, "").toLowerCase())
      .filter((w) => w.length >= 3 && !noiseWords.has(w));

    if (words.length === 0) return null;

    const orFilters = words
      .map((w) => `first_name.ilike.*${enc(w)}*,last_name.ilike.*${enc(w)}*`)
      .join(",");

    const candidates: Student[] = await db.get(
      `students?or=(${orFilters})&select=id,first_name,last_name,Reg_no&limit=20`,
    );

    if (candidates.length === 0) return null;

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

    return bestScore >= 2 ? bestMatch : null;
  } catch (err) {
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

  const withBalance = await db.get(
    `student_fees?student_id=eq.${studentId}&outstanding_balance=gt.0&order=academic_year.desc,term.desc&limit=1`,
  );
  if (withBalance.length > 0) {
    return { term: withBalance[0].term, year: withBalance[0].academic_year };
  }

  const recent = await db.get(
    `student_fees?student_id=eq.${studentId}&order=academic_year.desc,term.desc&limit=1`,
  );
  if (recent.length > 0) {
    return { term: recent[0].term, year: recent[0].academic_year };
  }

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
  });

  console.info(`[${requestId}] Saved to unmatched_bank_payments`);
}

// ─── Misc helpers ─────────────────────────────────────────────────────────────

/** Extract numeric term from "Term 1", "Term 2", etc. */
function termNumber(termStr: string | undefined | null): number {
  if (!termStr) return 0;
  const match = termStr.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

/** Derive fee status from balance figures */
function deriveStatus(outstanding: number, billed: number, paid: number): string {
  if (outstanding <= 0 && paid > billed) return "overpaid";
  if (outstanding <= 0) return "paid";
  if (paid > 0) return "partial";
  return "pending";
}

function buildNotes(
  payload: PaymentPayload,
  isCrossTermPayment: boolean,
  originalTerm: string,
  allocations: Array<{ record: StudentFee; allocated: number }>,
): string {
  const base = payload.narration ? `KCB Bank: ${payload.narration}` : "KCB Bank Fee Deposit";
  if (isCrossTermPayment) {
    const breakdown = allocations
      .map((a) => `${a.record.term}: KES ${a.allocated.toLocaleString()}`)
      .join(", ");
    return `${base} [Cross-term allocation — ${breakdown}]`;
  }
  return base;
}

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