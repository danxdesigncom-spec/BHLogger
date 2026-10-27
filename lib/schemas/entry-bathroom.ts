import { z } from "zod";

export const BathroomDataSchema = z
  .object({
    kind: z.enum(["bm", "pee", "both", "dry"]),
    location: z.enum(["diaper", "toilet", "accident"]).optional(),
    // Which stool scale is in use for this entry
    scale: z.enum(["aiss", "bristol"]).optional(),
    // AISS (4-point): "watery" | "soft" | "formed" | "hard"
    // Bristol (7-point): 1–7
    consistency: z
      .union([z.enum(["watery", "soft", "formed", "hard"]), z.number().int().min(1).max(7)])
      .optional(),
    size: z.enum(["small", "medium", "large"]).optional(),
    color: z
      .enum(["yellow", "green", "brown", "black", "red", "white_pale_clay", "other"])
      .optional(),
    flags: z
      .array(z.enum(["straining_pain", "blood", "mucus", "diaper_rash", "blowout_leak"]))
      .default([]),
  })
  .strict();

export type BathroomData = z.infer<typeof BathroomDataSchema>;
