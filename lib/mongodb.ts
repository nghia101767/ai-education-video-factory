import mongoose from "mongoose";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

type Cached = { connection: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
const globalForMongoose = globalThis as typeof globalThis & { mongooseCache?: Cached };
const cached = globalForMongoose.mongooseCache ?? { connection: null, promise: null };
globalForMongoose.mongooseCache = cached;

export async function connectToDatabase() {
  if (cached.connection) return cached.connection;
  if (!cached.promise) cached.promise = mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 3000 });
  try { cached.connection = await cached.promise; logger.info("MongoDB connected"); }
  catch (error) { cached.promise = null; throw error; }
  return cached.connection;
}
