import { z } from 'zod';

// MongoDB ObjectIds are 24-character hex strings
const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId format');

export const createBookingSchema = z.object({
  serviceId: objectIdSchema.optional(), // Making optional since they could be passing it with different names, but we add Passthrough
  amount: z.number().min(1, "Amount must be greater than 0").optional(),
  customer_location: z.object({
    type: z.literal("Point"),
    coordinates: z.tuple([
      z.number().min(-180).max(180), // Longitude
      z.number().min(-90).max(90)    // Latitude
    ])
  }).optional()
}).passthrough();
