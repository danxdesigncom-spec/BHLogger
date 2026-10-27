import { z } from "zod";

const BehaviorSchema = z.object({
  key: z.string(),
  severity: z.enum(["mild", "moderate", "severe"]).optional(),
  duration_min: z.number().positive().optional(),
});

export const MoodDataSchema = z
  .object({
    // "moment" = a point-in-time log; "day" = MOOD-06 end-of-day rating
    scope: z.enum(["moment", "day"]),
    // 1 = worst … 5 = best; labels adapt to care stage (Appendix A)
    level: z.number().int().min(1).max(5),
    // Keys from option_lists or built-in feelings list (MOOD-02)
    feelings: z.array(z.string()).default([]),
    // MOOD-03: notable behaviors with optional severity and duration
    behaviors: z.array(BehaviorSchema).default([]),
  })
  .strict();

export type MoodData = z.infer<typeof MoodDataSchema>;
