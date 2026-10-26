import { clerkClient, getAuth } from "@clerk/express";
import type { Request } from "express";

// Match the existing master navigation identity, but authorize on the server
// using Clerk's verified primary email, never submitted email/role/DB fields.
const MASTER_EMAIL = "abatasi@gmail.com";
export function isMasterIdentity(user: {
  primaryEmailAddressId: string | null;
  emailAddresses: { id: string; emailAddress: string; verification: { status: string } | null }[];
}) {
  return user.emailAddresses.some(email => email.id === user.primaryEmailAddressId &&
    email.emailAddress.trim().toLowerCase() === MASTER_EMAIL &&
    email.verification?.status === "verified");
}

export async function hasMasterAccess(req: Request): Promise<boolean> {
  const userId = getAuth(req)?.userId;
  if (!userId) return false;
  return isMasterIdentity(await clerkClient.users.getUser(userId));
}
