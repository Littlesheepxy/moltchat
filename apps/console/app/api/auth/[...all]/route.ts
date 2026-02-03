/**
 * Better Auth API Route Handler
 * Handles all /api/auth/* requests
 */

import { auth } from "@/lib/auth-server";
import { toNextJsHandler } from "better-auth/next-js";

// Export handlers for all HTTP methods
export const { GET, POST } = toNextJsHandler(auth);
