import { z } from "zod";

export const ActivityDataSchema = z
  .object({
    // Key from option_lists or a built-in activity slug (ACT-01)
    activity_id: z.string(),
    // 1 = Disliked … 5 = Loved it; null = "not rated" (ACT-02)
    enjoyment: z.number().int().min(1).max(5).nullable().default(null),
    duration_min: z.number().positive().optional(),
  })
  .strict();

export type ActivityData = z.infer<typeof ActivityDataSchema>;
