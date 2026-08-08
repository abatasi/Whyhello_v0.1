import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { userEmailAccountsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "node:crypto";
import type { UserEmailAccountRow } from "@workspace/db/schema";
import { getAuth } from "@clerk/express";

const router: IRouter = Router();

function getUserId(req: Request): string | null {
  const auth = getAuth(req);
  return (auth?.sessionClaims?.userId as string | undefined) ?? auth?.userId ?? null;
}

function getOrigin(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers["host"] || "localhost";
  return `${proto}://${host}`;
}

function setOAuthCookie(res: Response, data: object) {
  res.cookie("email_oauth_state", JSON.stringify(data), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60 * 1000,
  });
}

function getFrontendOrigin(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers["host"] || "localhost";
  return `${proto}://${host}`;
}

async function refreshGmailToken(account: UserEmailAccountRow): Promise<string | null> {
  if (!account.refreshToken) return null;
  try {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: account.refreshToken,
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        grant_type: "refresh_token",
      }),
    });
    const data = await r.json() as { access_token?: string; expires_in?: number };
    if (!data.access_token) return null;
    const tokenExpiry = data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null;
    await db.update(userEmailAccountsTable)
      .set({ accessToken: data.access_token, ...(tokenExpiry ? { tokenExpiry } : {}) })
      .where(eq(userEmailAccountsTable.id, account.id));
    return data.access_token;
  } catch (err) {
    console.error("Gmail token refresh error:", err);
    return null;
  }
}

async function refreshMicrosoftToken(account: UserEmailAccountRow): Promise<string | null> {
  if (!account.refreshToken) return null;
  try {
    const r = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: account.refreshToken,
        client_id: process.env.MICROSOFT_CLIENT_ID ?? "",
        client_secret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
        grant_type: "refresh_token",
        scope: "https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access",
      }),
    });
    const data = await r.json() as { access_token?: string; expires_in?: number };
    if (!data.access_token) return null;
    const tokenExpiry = data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null;
    await db.update(userEmailAccountsTable)
      .set({ accessToken: data.access_token, ...(tokenExpiry ? { tokenExpiry } : {}) })
      .where(eq(userEmailAccountsTable.id, account.id));
    return data.access_token;
  } catch (err) {
    console.error("Microsoft token refresh error:", err);
    return null;
  }
}

export async function getValidAccessToken(account: UserEmailAccountRow): Promise<string | null> {
  const isExpired = account.tokenExpiry && account.tokenExpiry < new Date(Date.now() + 60 * 1000);
  if (!isExpired) return account.accessToken;
  if (account.provider === "gmail") return refreshGmailToken(account);
  if (account.provider === "outlook") return refreshMicrosoftToken(account);
  return null;
}

export async function sendViaGmail(
  accessToken: string,
  toEmail: string,
  toName: string | null,
  subject: string,
  body: string,
  htmlBody?: string,
) {
  const toHeader = toName ? `"${toName}" <${toEmail}>` : toEmail;
  const raw = [
    `To: ${toHeader}`,
    `Subject: ${subject || "(no subject)"}`,
    `MIME-Version: 1.0`,
    `Content-Type: ${htmlBody ? "text/html" : "text/plain"}; charset=UTF-8`,
    ``,
    htmlBody ?? body,
  ].join("\r\n");

  const encoded = Buffer.from(raw).toString("base64url");

  const r = await fetch("https://www.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: encoded }),
  });

  if (!r.ok) {
    const err = await r.json();
    throw new Error(`Gmail API error: ${JSON.stringify(err)}`);
  }
}

export async function sendViaOutlook(
  accessToken: string,
  toEmail: string,
  toName: string | null,
  subject: string,
  body: string,
  htmlBody?: string,
) {
  const r = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        subject: subject || "(no subject)",
        body: { contentType: htmlBody ? "HTML" : "Text", content: htmlBody ?? body },
        toRecipients: [{ emailAddress: { address: toEmail, ...(toName ? { name: toName } : {}) } }],
      },
      saveToSentItems: true,
    }),
  });

  if (!r.ok && r.status !== 202) {
    const errText = await r.text();
    throw new Error(`Outlook API error: ${errText}`);
  }
}

router.get("/", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const accounts = await db
      .select({
        id: userEmailAccountsTable.id,
        provider: userEmailAccountsTable.provider,
        email: userEmailAccountsTable.email,
        displayName: userEmailAccountsTable.displayName,
        createdAt: userEmailAccountsTable.createdAt,
      })
      .from(userEmailAccountsTable)
      .where(eq(userEmailAccountsTable.userId, userId));
    res.json(accounts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch accounts" });
  }
});

router.delete("/:id", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    await db.delete(userEmailAccountsTable)
      .where(and(eq(userEmailAccountsTable.id, id), eq(userEmailAccountsTable.userId, userId)));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to disconnect account" });
  }
});

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SCOPES = "openid email profile https://www.googleapis.com/auth/gmail.send";

router.get("/auth/google", (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) { res.status(503).json({ error: "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." }); return; }

  const state = crypto.randomBytes(16).toString("hex");
  const origin = getOrigin(req);
  const redirectUri = `${origin}/api/email-accounts/auth/google/callback`;

  setOAuthCookie(res, { state, userId, provider: "google" });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  res.redirect(`${GOOGLE_AUTH_URL}?${params}`);
});

router.get("/auth/google/callback", async (req, res) => {
  const { code, state, error } = req.query as Record<string, string>;
  const origin = getFrontendOrigin(req);

  if (error) {
    res.redirect(`${origin}/settings?error=${encodeURIComponent(error)}`);
    return;
  }

  let cookieData: { state: string; userId: string; provider: string } | null = null;
  try { cookieData = JSON.parse(req.cookies?.email_oauth_state ?? "null"); } catch { /* skip */ }
  res.clearCookie("email_oauth_state", { path: "/" });

  if (!cookieData || cookieData.state !== state || cookieData.provider !== "google") {
    res.redirect(`${origin}/settings?error=invalid_state`);
    return;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
  const redirectUri = `${getOrigin(req)}/api/email-accounts/auth/google/callback`;

  try {
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    });
    const tokens = await tokenRes.json() as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!tokens.access_token) throw new Error("No access_token in response");

    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileRes.json() as { email?: string; name?: string };

    const tokenExpiry = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null;

    await db.insert(userEmailAccountsTable)
      .values({
        userId: cookieData.userId,
        provider: "gmail",
        email: profile.email ?? "",
        displayName: profile.name ?? null,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        ...(tokenExpiry ? { tokenExpiry } : {}),
      })
      .onConflictDoUpdate({
        target: [userEmailAccountsTable.userId, userEmailAccountsTable.provider],
        set: {
          email: profile.email ?? "",
          displayName: profile.name ?? null,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token ?? null,
          ...(tokenExpiry ? { tokenExpiry } : {}),
        },
      });

    res.redirect(`${origin}/settings?connected=gmail`);
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    res.redirect(`${origin}/settings?error=google_failed`);
  }
});

const MS_AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const MS_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const MS_SCOPES = "openid email profile offline_access https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read";

router.get("/auth/microsoft", (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  if (!clientId) { res.status(503).json({ error: "Microsoft OAuth not configured. Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET." }); return; }

  const state = crypto.randomBytes(16).toString("hex");
  const origin = getOrigin(req);
  const redirectUri = `${origin}/api/email-accounts/auth/microsoft/callback`;

  setOAuthCookie(res, { state, userId, provider: "microsoft" });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: MS_SCOPES,
    state,
    prompt: "select_account",
  });
  res.redirect(`${MS_AUTH_URL}?${params}`);
});

router.get("/auth/microsoft/callback", async (req, res) => {
  const { code, state, error } = req.query as Record<string, string>;
  const origin = getFrontendOrigin(req);

  if (error) {
    res.redirect(`${origin}/settings?error=${encodeURIComponent(error)}`);
    return;
  }

  let cookieData: { state: string; userId: string; provider: string } | null = null;
  try { cookieData = JSON.parse(req.cookies?.email_oauth_state ?? "null"); } catch { /* skip */ }
  res.clearCookie("email_oauth_state", { path: "/" });

  if (!cookieData || cookieData.state !== state || cookieData.provider !== "microsoft") {
    res.redirect(`${origin}/settings?error=invalid_state`);
    return;
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID ?? "";
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET ?? "";
  const redirectUri = `${getOrigin(req)}/api/email-accounts/auth/microsoft/callback`;

  try {
    const tokenRes = await fetch(MS_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code", scope: MS_SCOPES }),
    });
    const tokens = await tokenRes.json() as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!tokens.access_token) throw new Error("No access_token in response");

    const profileRes = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileRes.json() as { mail?: string; userPrincipalName?: string; displayName?: string };
    const email = profile.mail ?? profile.userPrincipalName ?? "";

    const tokenExpiry = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null;

    await db.insert(userEmailAccountsTable)
      .values({
        userId: cookieData.userId,
        provider: "outlook",
        email,
        displayName: profile.displayName ?? null,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        ...(tokenExpiry ? { tokenExpiry } : {}),
      })
      .onConflictDoUpdate({
        target: [userEmailAccountsTable.userId, userEmailAccountsTable.provider],
        set: {
          email,
          displayName: profile.displayName ?? null,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token ?? null,
          ...(tokenExpiry ? { tokenExpiry } : {}),
        },
      });

    res.redirect(`${origin}/settings?connected=outlook`);
  } catch (err) {
    console.error("Microsoft OAuth callback error:", err);
    res.redirect(`${origin}/settings?error=microsoft_failed`);
  }
});

router.post("/:id/send-test", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [account] = await db.select().from(userEmailAccountsTable)
      .where(and(eq(userEmailAccountsTable.id, id), eq(userEmailAccountsTable.userId, userId)));
    if (!account) { res.status(404).json({ error: "Account not found" }); return; }

    const accessToken = await getValidAccessToken(account);
    if (!accessToken) { res.status(401).json({ error: "Token invalid or expired. Please reconnect." }); return; }

    const [user] = await db.select({ email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    const toEmail = user?.email ?? userId;
    if (account.provider === "gmail") {
      await sendViaGmail(accessToken, toEmail, null, "Whyhello: Email connection verified", "Your email account is connected to Whyhello.");
    } else {
      await sendViaOutlook(accessToken, toEmail, null, "Whyhello: Email connection verified", "Your email account is connected to Whyhello.");
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Send test error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to send test email" });
  }
});

export default router;
