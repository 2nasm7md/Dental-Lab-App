import { z } from 'zod';

export const portfolioSchema = z.object({
  title: z.string().min(2).max(120),
  category: z.string().max(60).optional().or(z.literal('')),
  description: z.string().max(1000).optional().or(z.literal('')),
  before_image_url: z.string().url(),
  after_image_url: z.string().url(),
});

export type PortfolioInput = z.infer<typeof portfolioSchema>;
