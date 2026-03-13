import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Create a new task
export const createTask = mutation({
    args: {
        userId: v.id("users"),
        title: v.string(),
        description: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("tasks", {
            userId: args.userId,
            title: args.title,
            description: args.description,
            status: "pending",
            createdAt: Date.now(),
        });
    },
});

// Get user tasks
export const getUserTasks = query({
    args: { userId: v.id("users") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("tasks")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .order("desc")
            .collect();
    },
});

// Update task status
export const updateTaskStatus = mutation({
    args: {
        taskId: v.id("tasks"),
        status: v.union(v.literal("pending"), v.literal("in_progress"), v.literal("completed")),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.taskId, { status: args.status });
    },
});
