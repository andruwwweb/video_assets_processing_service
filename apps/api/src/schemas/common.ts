import { z } from 'zod'

/** `:id` path param shared by entity routes. */
export const IdParam = z.object({ id: z.string().uuid() })

/** Error envelope returned by the error handler. */
export const ErrorResponse = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().nullable(),
  }),
})
