import { z } from 'zod';

const slug = z.string().min(1).max(100);

export const joinSchema = z.object({
  slug,
  sessionId: z.string().min(1).max(100),
  // Restored/generated names can be long (the curated joke list has a 111-char name),
  // so the join cap is generous; manual renames stay capped at 50 via nameSchema.
  name: z.string().max(120).transform((s) => s.trim()).optional(),
  voter: z.boolean().optional(),
});
export const slugOnlySchema = z.object({ slug });
export const voteSchema = z.object({ slug, vote: z.union([z.string().max(100), z.number()]) });
export const cardPackSchema = z.object({ slug, cardPack: z.string().min(1).max(200) });
export const nameSchema = z.object({ slug, name: z.string().min(1).max(50).transform((s) => s.trim()) });
export const labelSchema = z.object({ slug, label: z.string().max(200).optional().default('') });
export const toggleSchema = z.object({ slug, targetSessionId: z.string().min(1).max(100), voter: z.boolean() });

export type JoinPayload = z.infer<typeof joinSchema>;
export type VotePayload = z.infer<typeof voteSchema>;
export type CardPackPayload = z.infer<typeof cardPackSchema>;
export type NamePayload = z.infer<typeof nameSchema>;
export type LabelPayload = z.infer<typeof labelSchema>;
export type TogglePayload = z.infer<typeof toggleSchema>;
