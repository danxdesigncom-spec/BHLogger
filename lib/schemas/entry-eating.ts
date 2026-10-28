import { z } from "zod";

const BreastSchema = z.object({
  method: z.literal("breast"),
  side: z.enum(["left", "right", "both"]).optional(),
  duration_min: z.number().positive().optional(),
});

const BottleSchema = z.object({
  method: z.literal("bottle"),
  contents: z.enum(["breast_milk", "formula", "other"]).optional(),
  amount_ml: z.number().positive().optional(),
});

// Reactions shared by meal and snack
const reactions = z
  .array(
    z.enum([
      "refused",
      "gagged",
      "vomited",
      "rash_hives",
      "fussy",
      "coughing_choking",
      "trouble_breathing",
    ]),
  )
  .default([]);

const MealSchema = z.object({
  method: z.literal("meal"),
  meal_type: z.enum(["breakfast", "lunch", "dinner"]).optional(),
  // 0 = None, 25 = A little, 50 = Half, 75 = Most, 100 = All (EAT-04)
  portion_pct: z.number().min(0).max(100).optional(),
  food_groups: z
    .array(z.enum(["fruit", "vegetables", "grains", "protein", "dairy", "sweets_snacks"]))
    .default([]),
  food_ids: z.array(z.string()).default([]),
  new_food: z.boolean().default(false),
  reactions,
});

const SnackSchema = MealSchema.extend({ method: z.literal("snack") });

const DrinkSchema = z.object({
  method: z.literal("drink"),
  contents: z.enum(["water", "milk", "juice", "other"]).optional(),
  amount_ml: z.number().positive().optional(),
});

// EAT-10: tube feeding. The PRD gives these volumes in ml, so they're shown in ml whatever the household unit.
const TubeSchema = z.object({
  method: z.literal("tube"),
  formula_id: z.string().optional(),
  amount_ml: z.number().positive().max(5000),
  delivery: z.enum(["bolus", "continuous"]).optional(),
  flush_ml: z.number().positive().max(1000).optional(),
});

export const EatingDataSchema = z.discriminatedUnion("method", [
  BreastSchema,
  BottleSchema,
  MealSchema,
  SnackSchema,
  DrinkSchema,
  TubeSchema,
]);

export type EatingData = z.infer<typeof EatingDataSchema>;
