import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    users: defineTable({
        username: v.string(),
        password: v.string(), // In a real app we'd hash this, but we'll do plaintext for MVP
        isAdmin: v.boolean(),
    }).index("by_username", ["username"]),

    tasks: defineTable({
        title: v.string(),
        description: v.optional(v.string()),
        status: v.union(v.literal("pending"), v.literal("in_progress"), v.literal("completed")),
        userId: v.id("users"),
        createdAt: v.number(),
    }).index("by_user", ["userId"]),

    time_entries: defineTable({
        taskId: v.id("tasks"),
        userId: v.id("users"),
        hours: v.number(),
        isOvertime: v.boolean(),
        date: v.string(), // YYYY-MM-DD format
        createdAt: v.number(),
    }).index("by_user", ["userId"]).index("by_task", ["taskId"])
});
