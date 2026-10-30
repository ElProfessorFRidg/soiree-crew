import { z } from "zod";

// Input contracts. Every field the client may set is listed; anything else is dropped (SEC-02, mass assignment).

const uuid = z.string().uuid();
const ms = z.number().int().nonnegative();

export const drinkSchema = z.object({
  id: uuid,
  presetId: z.string().min(1).max(80),
  kind: z.string().min(1).max(30),
  volumeMl: z.number().positive().max(3000),
  abv: z.number().min(0).max(1),
  consumedAt: ms,
  loggedAt: ms,
  withFood: z.boolean(),
  /** O-85: none, light or full meal; wins over withFood when present. */
  food: z.enum(["none", "light", "full"]).optional(),
  name: z.string().min(1).max(40).optional(),
});

export const waterSchema = z.object({ id: uuid, at: ms });

export const profileSchema = z.object({
  weightKg: z.number().min(35).max(250),
  bodyModel: z.enum(["male", "female"]),
  declaredBody: z.enum(["male", "female", "other"]),
  heightCm: z.number().min(120).max(230).optional(),
  ageYears: z.number().int().min(18).max(100).optional(),
  healthConsentAt: ms,
});

export const preferencesPatchSchema = z
  .object({
    language: z.enum(["fr", "en", "es", "it", "de", "pt", "ru"]),
    legalCountry: z.string().min(2).max(8),
    driverCategory: z.enum(["standard", "novice", "professional"]),
    unitSystem: z.enum(["metric", "us_customary", "uk_imperial"]),
    bacUnit: z.string().min(1).max(30),
    currency: z.string().length(3),
    hourCycle: z.enum(["h12", "h23"]),
    dayBoundaryHour: z.number().int().min(0).max(12),
    personalLimit: z.number().min(0.1).max(3).nullable(),
    warnNearLimit: z.boolean(),
    waterReminderMinutes: z.number().int().min(10).max(240).nullable(),
    partyBudget: z.number().int().positive().max(10_000_000).nullable(),
    notifyRecap: z.boolean(),
    quietFromHour: z.number().int().min(0).max(23),
    quietToHour: z.number().int().min(0).max(23),
    rideApp: z.enum(["uber", "bolt", "heetch", "freenow", "g7"]).nullable(),
    mapsApp: z.enum(["apple", "google", "waze"]).nullable(),
  })
  .partial();

export const customDrinkSchema = z.object({
  id: uuid,
  name: z.string().min(1).max(40),
  volumeMl: z.number().positive().max(3000),
  abv: z.number().min(0).max(1),
  icon: z.string().min(1).max(20),
  order: z.number().int().min(0).max(10_000),
});

export const mutationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("drink.add"), drink: drinkSchema }),
  /** O-23: a drink already logged, changed (time, volume, strength, food). */
  z.object({ kind: z.literal("drink.edit"), drink: drinkSchema }),
  z.object({ kind: z.literal("drink.remove"), drink: drinkSchema.pick({ id: true }) }),
  z.object({ kind: z.literal("water.add"), water: waterSchema }),
  z.object({ kind: z.literal("water.remove"), water: waterSchema.pick({ id: true }) }),
  z.object({ kind: z.literal("profile.set"), profile: profileSchema }),
  z.object({ kind: z.literal("preferences.set"), patch: preferencesPatchSchema }),
  z.object({ kind: z.literal("uiLevel.set") }),
  z.object({ kind: z.literal("customDrink.set"), drink: customDrinkSchema }),
  z.object({ kind: z.literal("customDrink.remove"), drink: customDrinkSchema.pick({ id: true }) }),
]);

export type MutationInput = z.infer<typeof mutationSchema>;

export const mutationBatchSchema = z.object({
  mutations: z
    .array(z.object({ key: z.string().min(8).max(80), mutation: z.unknown(), envelope: z.unknown().optional() }))
    .min(1)
    .max(100),
});

export const accountSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(24)
    .regex(/^[a-z0-9_.]+$/),
  displayName: z.string().trim().min(1).max(40),
  deviceLabel: z.string().max(60).optional(),
  // O-01: both or neither; without them the account lives on this phone and moves by code.
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)).optional(),
  password: z.string().min(10).max(200).optional(),
}).refine((input) => (input.email === undefined) === (input.password === undefined), { message: "email_and_password" });

export const passwordSchema = z.string().min(10).max(200);

export const CREW_KINDS = ["friends", "school", "family", "work", "sport", "other"] as const;
export const crewSchema = z.object({ name: z.string().trim().min(1).max(40), kind: z.enum(CREW_KINDS).default("friends") });

export const partySchema = z.object({
  id: uuid,
  crewId: uuid,
  name: z.string().trim().max(60),
  mood: z.string().min(1).max(20),
  kind: z.enum(["party", "trip"]),
  startsAt: ms,
  endsAt: ms,
});

export const responseSchema = z.object({ response: z.enum(["going", "declined"]) });
