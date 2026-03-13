import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    users: defineTable({
        username: v.string(),
        pin: v.string(), // 4-digit PIN for MVP
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
        startTime: v.optional(v.number()), // epoch ms for stream timer
        endTime: v.optional(v.number()),   // epoch ms for stream timer
        createdAt: v.number(),
    }).index("by_user", ["userId"]).index("by_task", ["taskId"]).index("by_date", ["userId", "date"])
});
