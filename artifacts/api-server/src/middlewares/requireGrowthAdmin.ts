import { getAuth } from "@clerk/express";
import type { RequestHandler } from "express";

const configuredAdminIds = new Set(
  (process.env.AI_LAUNCHPAD_ADMIN_USER_IDS ?? "")
    .split(/[,\s]+/)
    .map((id) => id.trim())
    .filter(Boolean),
);

export const requireGrowthAdmin: RequestHandler = (req, res, next) => {
  const { userId } = getAuth(req);

  if (!userId) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }

  if (configuredAdminIds.size === 0 || !configuredAdminIds.has(userId)) {
    res.status(403).json({
      error:
        "This account is not authorized for campaign administration. Add its Clerk user ID to AI_LAUNCHPAD_ADMIN_USER_IDS in project secrets.",
    });
    return;
  }

  next();
};
