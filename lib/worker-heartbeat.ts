import { Schema, model, models } from "mongoose";
const WorkerHeartbeatSchema = new Schema({ workerId: { type: String, required: true, unique: true }, status: { type: String, enum: ["running", "stopping"], default: "running" }, capabilities: { type: [String], default: [] }, lastSeenAt: { type: Date, required: true, index: true } }, { timestamps: true });
export const WorkerHeartbeat = models.WorkerHeartbeat || model("WorkerHeartbeat", WorkerHeartbeatSchema);
