import { z } from "zod";

export const connectionDiagnosticCheckIdSchema = z.enum([
  "browser-network",
  "firebase-auth",
  "firebase-token",
  "firestore-client",
  "realtime-database-client",
  "vercel-function",
  "firebase-admin",
  "server-authorization",
  "realtime-database-server",
]);

export const connectionDiagnosticStatusSchema = z.enum([
  "success",
  "warning",
  "error",
  "skipped",
]);

export const connectionDiagnosticCheckSchema = z
  .object({
    id: connectionDiagnosticCheckIdSchema,
    label: z.string().min(1),
    status: connectionDiagnosticStatusSchema,
    message: z.string().min(1),
    recommendation: z.string().min(1).optional(),
  })
  .strict();

export const connectionDiagnosticResponseSchema = z
  .object({
    checkedAt: z.number().int().nonnegative(),
    checks: z.array(connectionDiagnosticCheckSchema).min(1),
  })
  .strict();

export type ConnectionDiagnosticCheck = z.infer<
  typeof connectionDiagnosticCheckSchema
>;
export type ConnectionDiagnosticStatus = z.infer<
  typeof connectionDiagnosticStatusSchema
>;
export type ConnectionDiagnosticResponse = z.infer<
  typeof connectionDiagnosticResponseSchema
>;
