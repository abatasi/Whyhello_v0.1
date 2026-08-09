import { Router, type IRouter, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { callsTable, contactsTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import twilio from "twilio";

export const callsRouter: IRouter = Router();
export const contactCallsRouter: IRouter = Router({ mergeParams: true });

// ── Helpers ────────────────────────────────────────────────────────────────

function getUserId(req: Request): string | null {
  const auth = getAuth(req);
  return (auth?.sessionClaims?.userId as string | undefined) ?? auth?.userId ?? null;
}

function getOrigin(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers["host"] || "localhost";
  return `${proto}://${host}`;
}

function getTwilioConfig() {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
    authToken: process.env.TWILIO_AUTH_TOKEN ?? "",
    apiKey: process.env.TWILIO_API_KEY ?? "",
    apiSecret: process.env.TWILIO_API_SECRET ?? "",
    twimlAppSid: process.env.TWILIO_TWIML_APP_SID ?? "",
    phoneNumber: process.env.TWILIO_PHONE_NUMBER ?? "",
  };
}

/** Phone mode only needs account credentials + a from-number. No TwiML App needed. */
function isPhoneModeConfigured(): boolean {
  const c = getTwilioConfig();
  return !!(c.accountSid && c.authToken && c.phoneNumber);
}

/** Browser SDK mode additionally requires an API key pair and a TwiML App SID. */
function isBrowserModeConfigured(): boolean {
  const c = getTwilioConfig();
  return !!(c.accountSid && c.authToken && c.apiKey && c.apiSecret && c.twimlAppSid && c.phoneNumber);
}

function notConfigured(res: Response, mode: "phone" | "browser" = "phone") {
  const missing =
    mode === "browser"
      ? "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, TWILIO_API_KEY, TWILIO_API_SECRET, and TWILIO_TWIML_APP_SID"
      : "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER";
  res.status(503).json({ error: `Twilio not configured. Please add ${missing} to your environment secrets.` });
}

// ── Twilio webhook signature validation ──────────────────────────────────────
// Returns true if the request has a valid Twilio HMAC-SHA1 signature.
// If TWILIO_AUTH_TOKEN is not yet set (pre-setup), allows through so the UI
// can still receive its first setup request.

function requireTwilioSignature(req: Request, res: Response): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    // Fail closed: reject all webhook calls until Twilio is fully configured.
    // This prevents unauthenticated mutation of call records.
    res.status(503).send("Twilio not configured — add TWILIO_AUTH_TOKEN to accept webhooks");
    return false;
  }

  const signature = (req.headers["x-twilio-signature"] as string | undefined) ?? "";
  if (!signature) {
    res.status(403).send("Forbidden: missing X-Twilio-Signature header");
    return false;
  }

  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const host = (req.headers["x-forwarded-host"] as string) || (req.headers["host"] as string) || "";
  // Reconstruct the exact URL Twilio signed, including any query string
  const fullUrl = `${proto}://${host}${req.originalUrl}`;

  const isValid = twilio.validateRequest(authToken, signature, fullUrl, req.body ?? {});
  if (!isValid) {
    console.warn("Twilio webhook rejected: invalid signature for URL", fullUrl);
    res.status(403).send("Forbidden: invalid Twilio signature");
    return false;
  }
  return true;
}

// ── SSRF guard for Twilio recording URLs ──────────────────────────────────────
// Only fetch recordings from verified Twilio domains with credentials.

function isTwilioRecordingUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      (parsed.hostname === "api.twilio.com" || parsed.hostname.endsWith(".twilio.com"))
    );
  } catch {
    return false;
  }
}

// ── POST /api/calls/token — generate Access Token for Twilio Voice SDK ──────

callsRouter.post("/token", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  if (!isConfigured()) { notConfigured(res); return; }

  try {
    const { accountSid, apiKey, apiSecret, twimlAppSid } = getTwilioConfig();
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const token = new AccessToken(accountSid, apiKey, apiSecret, {
      identity: userId,
      ttl: 3600,
    });
    const grant = new VoiceGrant({ outgoingApplicationSid: twimlAppSid, incomingAllow: false });
    token.addGrant(grant);

    res.json({ token: token.toJwt() });
  } catch (err) {
    console.error("Token generation error:", err);
    res.status(500).json({ error: "Failed to generate access token" });
  }
});

// ── POST /api/calls/initiate — create call record + start the call ──────────

callsRouter.post("/initiate", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }

  const { contactId, mode, userPhone } = req.body as {
    contactId: number;
    mode: "browser" | "phone";
    userPhone?: string;
  };

  if (!contactId) { res.status(400).json({ error: "contactId is required" }); return; }

  // Check config based on the requested mode so phone mode works without a TwiML App SID
  if (mode === "browser") {
    if (!isBrowserModeConfigured()) { notConfigured(res, "browser"); return; }
  } else {
    if (!isPhoneModeConfigured()) { notConfigured(res, "phone"); return; }
    if (!userPhone?.trim()) {
      res.status(400).json({ error: "userPhone is required for phone mode" }); return;
    }
  }

  try {
    const [contact] = await db.select({
      id: contactsTable.id,
      firstName: contactsTable.firstName,
      lastName: contactsTable.lastName,
      phone: contactsTable.phone,
      jobTitle: contactsTable.jobTitle,
    }).from(contactsTable).where(eq(contactsTable.id, contactId));

    if (!contact) { res.status(404).json({ error: "Contact not found" }); return; }
    if (!contact.phone?.trim()) { res.status(400).json({ error: "Contact has no phone number" }); return; }

    const config = getTwilioConfig();
    const origin = getOrigin(req);

    // Create call record
    const [call] = await db.insert(callsTable).values({
      contactId,
      userId,
      callMode: mode,
      status: "initiated",
    }).returning();

    if (mode === "phone") {
      // Use Twilio REST API to call the user's phone, then bridge to contact
      const client = twilio(config.accountSid, config.authToken);
      // Note: trial accounts block statusCallbackEvent and statusCallbackMethod —
      // use only the base parameters Twilio trial permits.
      const twilioCall = await client.calls.create({
        to: userPhone!.trim(),
        from: config.phoneNumber,
        url: `${origin}/api/calls/bridge-twiml?callId=${call.id}&contactPhone=${encodeURIComponent(contact.phone)}`,
        statusCallback: `${origin}/api/calls/status?callId=${call.id}`,
      });
      await db.update(callsTable)
        .set({ twilioCallSid: twilioCall.sid, status: "ringing", updatedAt: new Date() })
        .where(eq(callsTable.id, call.id));
      res.json({ call: { ...call, twilioCallSid: twilioCall.sid }, mode: "phone" });
      return;
    }

    // Browser mode — generate access token for the Voice SDK
    const { AccessToken } = twilio.jwt;
    const { VoiceGrant } = AccessToken;
    const token = new AccessToken(config.accountSid, config.apiKey, config.apiSecret, {
      identity: userId,
      ttl: 3600,
    });
    const grant = new VoiceGrant({ outgoingApplicationSid: config.twimlAppSid, incomingAllow: false });
    token.addGrant(grant);

    res.json({
      call,
      token: token.toJwt(),
      contactPhone: contact.phone,
      contactName: `${contact.firstName} ${contact.lastName}`.trim(),
      mode: "browser",
    });
  } catch (err) {
    console.error("Initiate call error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to initiate call" });
  }
});

// ── POST /api/calls/outbound-twiml — TwiML App webhook (browser mode) ───────
// Called by Twilio when the browser SDK dials out. Must be publicly accessible.

callsRouter.post("/outbound-twiml", async (req: Request, res: Response) => {
  if (!requireTwilioSignature(req, res)) return;

  // Twilio always provides CallSid; callId comes from Device.connect({ params: { callId } })
  const { To, CallSid, callId } = req.body as { To?: string; CallSid?: string; callId?: string };
  const config = getTwilioConfig();
  const origin = getOrigin(req);

  // Correlate: store the real Twilio CallSid on the call record so that
  // status/recording callbacks can reliably find it by CallSid alone.
  if (callId && CallSid) {
    db.update(callsTable)
      .set({ twilioCallSid: CallSid, status: "ringing", updatedAt: new Date() })
      .where(eq(callsTable.id, parseInt(callId)))
      .catch((err) => console.error("Failed to associate CallSid with call record:", err));
  }

  const response = new twilio.twiml.VoiceResponse();

  if (!To) {
    response.say("Sorry, no destination number was provided.");
    res.type("text/xml").send(response.toString());
    return;
  }

  // Embed callId in callback URLs so child-leg callbacks can find the record.
  // When Twilio dials the contact it creates a NEW child CallSid — different from
  // the parent SDK leg we stored. The signed callId hint is the reliable correlation.
  const callbackSuffix = callId ? `?callId=${encodeURIComponent(callId)}` : "";

  const dial = response.dial({
    callerId: config.phoneNumber || undefined,
    record: "record-from-ringing",
    recordingStatusCallback: `${origin}/api/calls/recording${callbackSuffix}`,
    recordingStatusCallbackEvent: ["completed"],
  } as Parameters<typeof response.dial>[0]);

  // Add statusCallback on the <Number> so we receive the child-leg completion
  // event with final duration and status for this call record.
  (dial as ReturnType<typeof response.dial>).number({
    statusCallback: `${origin}/api/calls/status${callbackSuffix}`,
    statusCallbackEvent: ["completed"],
    statusCallbackMethod: "POST",
  } as Parameters<ReturnType<typeof response.dial>["number"]>[0], To);

  res.type("text/xml").send(response.toString());
});

// ── POST /api/calls/bridge-twiml — phone-forwarding bridge ──────────────────
// Called by Twilio when the user's forwarded phone is answered.

callsRouter.post("/bridge-twiml", async (req: Request, res: Response) => {
  if (!requireTwilioSignature(req, res)) return;

  const contactPhone = (req.query.contactPhone ?? req.body.contactPhone) as string;
  const callId = (req.query.callId ?? req.body.callId) as string;
  const config = getTwilioConfig();
  const origin = getOrigin(req);

  const response = new twilio.twiml.VoiceResponse();

  if (!contactPhone) {
    response.say("Sorry, the contact phone number is missing.");
    res.type("text/xml").send(response.toString());
    return;
  }

  response.say({ voice: "alice" }, "Connecting you now.");

  const callbackSuffix = callId ? `?callId=${encodeURIComponent(callId)}` : "";

  const dial = response.dial({
    callerId: config.phoneNumber || undefined,
    record: "record-from-ringing",
    recordingStatusCallback: `${origin}/api/calls/recording${callbackSuffix}`,
    recordingStatusCallbackEvent: ["completed"],
  } as Parameters<typeof response.dial>[0]);

  // Child-leg status callback captures contact-leg duration/completion
  (dial as ReturnType<typeof response.dial>).number({
    statusCallback: `${origin}/api/calls/status${callbackSuffix}`,
    statusCallbackEvent: ["completed"],
    statusCallbackMethod: "POST",
  } as Parameters<ReturnType<typeof response.dial>["number"]>[0], contactPhone);

  res.type("text/xml").send(response.toString());
});

// ── POST /api/calls/status — Twilio status webhook ───────────────────────────

callsRouter.post("/status", async (req: Request, res: Response) => {
  if (!requireTwilioSignature(req, res)) return;

  const { CallSid, CallStatus, CallDuration } = req.body as {
    CallSid?: string; CallStatus?: string; CallDuration?: string;
  };
  // callId in query string is trusted only after signature validation above;
  // it's the hint we embedded in the URL. Primary lookup is by Twilio's CallSid.
  const callId = req.query.callId as string | undefined;

  try {
    const updates: Partial<typeof callsTable.$inferInsert> = { updatedAt: new Date() };
    if (CallStatus) updates.status = CallStatus;
    if (CallDuration) updates.durationSeconds = parseInt(CallDuration);

    // Prefer callId from the signed URL (reliable for child-leg callbacks where
    // CallSid is the dialed-party SID, not the stored parent SID).
    let updated = false;
    if (callId) {
      const rows = await db.update(callsTable)
        .set(updates)
        .where(eq(callsTable.id, parseInt(callId)))
        .returning();
      updated = rows.length > 0;
    }
    // Fallback: look up by stored Twilio CallSid (works for phone-mode user-leg callbacks)
    if (!updated && CallSid) {
      updates.twilioCallSid = CallSid;
      await db.update(callsTable).set(updates).where(eq(callsTable.twilioCallSid, CallSid));
    }
  } catch (err) {
    console.error("Status callback error:", err);
  }

  res.sendStatus(204);
});

// ── POST /api/calls/recording — Twilio recording webhook ─────────────────────

callsRouter.post("/recording", async (req: Request, res: Response) => {
  if (!requireTwilioSignature(req, res)) return;

  const { RecordingSid, RecordingUrl, RecordingStatus, CallSid } = req.body as {
    RecordingSid?: string; RecordingUrl?: string; RecordingStatus?: string; CallSid?: string;
  };

  if (RecordingStatus !== "completed") { res.sendStatus(204); return; }
  if (!RecordingUrl) { res.sendStatus(204); return; }

  const mp3Url = RecordingUrl.endsWith(".mp3") ? RecordingUrl : `${RecordingUrl}.mp3`;

  // SSRF guard: reject any recording URL that is not on a Twilio domain
  if (!isTwilioRecordingUrl(mp3Url)) {
    console.error("Rejected recording URL with non-Twilio domain:", mp3Url);
    res.sendStatus(400);
    return;
  }

  // callId is embedded in the signed recording callback URL — reliable for child-leg
  // callbacks where RecordingSid/CallSid belong to the contact-leg (not the stored parent SID).
  const callId = req.query.callId as string | undefined;

  try {
    let call: typeof callsTable.$inferSelect | undefined;

    // Prefer callId from the signed URL — works for both browser and phone child-leg callbacks
    if (callId) {
      const [updated] = await db.update(callsTable)
        .set({ recordingSid: RecordingSid, recordingUrl: mp3Url, updatedAt: new Date() })
        .where(eq(callsTable.id, parseInt(callId)))
        .returning();
      call = updated;
    }

    // Fallback: look up by stored Twilio CallSid (covers phone-mode user-leg SID if callId was absent)
    if (!call && CallSid) {
      const [updated] = await db.update(callsTable)
        .set({ recordingSid: RecordingSid, recordingUrl: mp3Url, updatedAt: new Date() })
        .where(eq(callsTable.twilioCallSid, CallSid))
        .returning();
      call = updated;
    }

    if (call) {
      transcribeAndSummarize(call.id, mp3Url).catch((err) =>
        console.error("Transcription/summary error for call", call!.id, err)
      );
    } else {
      console.warn("Recording callback: could not find call record for callId=%s CallSid=%s", callId, CallSid);
    }
  } catch (err) {
    console.error("Recording callback error:", err);
  }

  res.sendStatus(204);
});

// ── Transcription + AI summary (runs asynchronously after recording) ─────────

async function transcribeAndSummarize(callId: number, recordingUrl: string): Promise<void> {
  // Defense-in-depth: re-validate the URL is on a Twilio domain before
  // making a credentialed request (even though the recording handler checks first).
  if (!isTwilioRecordingUrl(recordingUrl)) {
    throw new Error(`Refusing to fetch recording from non-Twilio URL: ${recordingUrl}`);
  }

  const config = getTwilioConfig();

  // Download the recording using Twilio credentials
  const authHeader = "Basic " + Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64");
  const audioRes = await fetch(recordingUrl, { headers: { Authorization: authHeader } });
  if (!audioRes.ok) throw new Error(`Failed to download recording: ${audioRes.status}`);

  const audioBuffer = Buffer.from(await audioRes.arrayBuffer());

  // Write to temp file (Whisper API requires a File object)
  const { writeFile, unlink } = await import("node:fs/promises");
  const { createReadStream } = await import("node:fs");
  const tmpPath = `/tmp/call-recording-${callId}-${Date.now()}.mp3`;
  await writeFile(tmpPath, audioBuffer);

  let transcript = "";
  try {
    const stream = createReadStream(tmpPath) as unknown as File;
    const transcription = await openai.audio.transcriptions.create({
      file: stream,
      model: "whisper-1",
    });
    transcript = transcription.text ?? "";
  } finally {
    await unlink(tmpPath).catch(() => {});
  }

  if (!transcript.trim()) {
    await db.update(callsTable)
      .set({ transcription: "(No speech detected)", updatedAt: new Date() })
      .where(eq(callsTable.id, callId));
    return;
  }

  // Save transcription
  const [call] = await db.update(callsTable)
    .set({ transcription: transcript, updatedAt: new Date() })
    .where(eq(callsTable.id, callId))
    .returning();

  if (!call) return;

  // Load contact for context
  const [contact] = await db.select({
    firstName: contactsTable.firstName,
    lastName: contactsTable.lastName,
    jobTitle: contactsTable.jobTitle,
  }).from(contactsTable).where(eq(contactsTable.id, call.contactId));

  const contactLabel = contact
    ? `${contact.firstName} ${contact.lastName}`.trim() + (contact.jobTitle ? `, ${contact.jobTitle}` : "")
    : "the contact";

  // Generate AI summary
  const aiResponse = await openai.chat.completions.create({
    model: "gpt-5-mini",
    messages: [{
      role: "user",
      content: `You are summarizing a B2B sales call with ${contactLabel}.

Transcript:
${transcript}

Provide a concise structured summary:

Summary: <2-3 sentence overview of the conversation>

Key Points:
• <key insight or topic discussed>
• <another key point>
• <etc.>

Follow-ups:
• <action item or next step>
• <etc. — write "None identified" if none>`,
    }],
  });

  const aiSummary = aiResponse.choices[0]?.message?.content ?? "";
  await db.update(callsTable)
    .set({ aiSummary, updatedAt: new Date() })
    .where(eq(callsTable.id, callId));
}

// ── GET /api/calls/setup-info — webhook URLs for Twilio console setup ────────
// NOTE: must be defined BEFORE the /:id wildcard route to prevent shadowing.

callsRouter.get("/setup-info", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  const origin = getOrigin(req);
  res.json({
    configured: isConfigured(),
    webhooks: {
      voiceUrl: `${origin}/api/calls/outbound-twiml`,
      statusCallback: `${origin}/api/calls/status`,
      recordingCallback: `${origin}/api/calls/recording`,
    },
    instructions: [
      "1. In Twilio Console → Voice → TwiML Apps → your app → set Voice Request URL to the voiceUrl above (HTTP POST)",
      "2. The statusCallback and recordingCallback are set automatically per-call — no console config needed",
      "3. Make sure your TWILIO_PHONE_NUMBER is a Twilio number with Voice capability",
    ],
  });
});

// ── GET /api/calls/:id/recording — server-side proxy for Twilio audio ────────
// Streams the recording from Twilio with Basic auth credentials so the browser
// never needs to supply credentials. Scoped to the owning user.
// NOTE: must be defined BEFORE the /:id wildcard route.

callsRouter.get("/:id/recording", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }

  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid call id" }); return; }

  try {
    const [call] = await db.select({
      recordingUrl: callsTable.recordingUrl,
      userId: callsTable.userId,
    }).from(callsTable).where(and(eq(callsTable.id, id), eq(callsTable.userId, userId)));

    if (!call || !call.recordingUrl) {
      res.status(404).json({ error: "Recording not found" }); return;
    }

    // SSRF guard — recording URLs come from Twilio webhooks but we re-validate
    if (!isTwilioRecordingUrl(call.recordingUrl)) {
      res.status(400).json({ error: "Invalid recording URL domain" }); return;
    }

    if (!isConfigured()) { notConfigured(res); return; }
    const config = getTwilioConfig();
    const authHeader = "Basic " + Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64");

    const upstream = await fetch(call.recordingUrl, { headers: { Authorization: authHeader } });
    if (!upstream.ok) {
      res.status(502).json({ error: "Failed to fetch recording from Twilio" }); return;
    }

    res.setHeader("Content-Type", upstream.headers.get("content-type") ?? "audio/mpeg");
    const length = upstream.headers.get("content-length");
    if (length) res.setHeader("Content-Length", length);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("Accept-Ranges", "bytes");

    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.send(buffer);
  } catch (err) {
    console.error("Recording proxy error:", err);
    res.status(500).json({ error: "Failed to stream recording" });
  }
});

// ── GET /api/calls/:id — fetch single call (used by PostCallPanel polling) ───

callsRouter.get("/:id", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid call id" }); return; }
  try {
    const [call] = await db.select()
      .from(callsTable)
      .where(and(eq(callsTable.id, id), eq(callsTable.userId, userId)));
    if (!call) { res.status(404).json({ error: "Call not found" }); return; }
    res.json(call);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch call" });
  }
});

// ── PATCH /api/calls/:id — save user notes ───────────────────────────────────

callsRouter.patch("/:id", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid call id" }); return; }
  const { notes } = req.body as { notes?: string };

  try {
    const [call] = await db.update(callsTable)
      .set({ notes: notes ?? null, updatedAt: new Date() })
      .where(and(eq(callsTable.id, id), eq(callsTable.userId, userId)))
      .returning();
    if (!call) { res.status(404).json({ error: "Call not found" }); return; }
    res.json(call);
  } catch (err) {
    res.status(500).json({ error: "Failed to update call" });
  }
});

// ── GET /api/contacts/:id/calls — call history for a contact ─────────────────

contactCallsRouter.get("/", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  const contactId = parseInt(String((req.params as Record<string, string>).id ?? ""));
  if (!contactId) { res.status(400).json({ error: "Invalid contactId" }); return; }

  try {
    const calls = await db.select()
      .from(callsTable)
      .where(and(eq(callsTable.contactId, contactId), eq(callsTable.userId, userId)))
      .orderBy(desc(callsTable.createdAt));
    res.json(calls);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch calls" });
  }
});
