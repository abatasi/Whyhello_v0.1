import { type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

type DbUser = typeof usersTable.$inferSelect;

declare global {
  namespace Express {
    interface Request {
      dbUser?: DbUser;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const auth = getAuth(req);
  // sessionClaims.userId = legacy Replit Auth subject ID (for migrated users)
  // or Clerk native ID (for new users). Use this for all local DB lookups.
  const userId = (auth?.sessionClaims?.userId as string | undefined) ?? auth?.userId;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // JIT provisioning: find or create the local user row on first authenticated request.
  let [dbUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!dbUser) {
    const [inserted] = await db
      .insert(usersTable)
      .values({ id: userId })
      .onConflictDoNothing()
      .returning();
    if (inserted) {
      dbUser = inserted;
    } else {
      [dbUser] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);
    }
  }

  if (!dbUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  req.dbUser = dbUser;
  next();
}
