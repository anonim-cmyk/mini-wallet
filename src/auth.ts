import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthedRequest extends Request {
  userId?: string;
}

export function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = header.slice("Bearer ".length);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!);

    if (typeof payload !== "object" || typeof payload.sub !== "string") {
      return res.status(401).json({ error: "Unauthorized" });
    }
    req.userId = payload.sub;

    return next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}
