const required = (name: string, fallback?: string) => {
  const value = process.env[name] || fallback;
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
};
export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  appUrl: required("APP_URL", "http://web.ai-education-video-factory.orb.local"),
  mongoUri: required("MONGODB_URI", "mongodb://localhost:27017/ai_education_video_factory"),
  storageRoot: required("STORAGE_ROOT", "./storage"),
};
