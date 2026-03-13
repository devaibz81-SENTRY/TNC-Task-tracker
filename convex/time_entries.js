import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Log time entry
export const logTime = mutation({
    args: {
        userId: v.id("users"),
        taskId: v.id("tasks"),
        hours: v.number(),
        isOvertime: v.boolean(),
        date: v.string(),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("time_entries", {
            userId: args.userId,
            taskId: args.taskId,
            hours: args.hours,
            isOvertime: args.isOvertime,
            date: args.date,
            createdAt: Date.now(),
        });
    },
});

// Get total hours per user
export const getUserTotals = query({
    args: { userId: v.id("users") },
    handler: async (ctx, args) => {
        const entries = await ctx.db
            .query("time_entries")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .collect();

        let regularHours = 0;
        let otHours = 0;

        entries.forEach(entry => {
            if (entry.isOvertime) {
                otHours += entry.hours;
            } else {
                regularHours += entry.hours;
            }
        });

        return { regularHours, otHours, totalHours: regularHours + otHours };
    },
});

// Get all time logs for a user securely
export const getUserTimeEntries = query({
    args: { userId: v.id("users") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("time_entries")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .order("desc")
            .collect();
    }
});
