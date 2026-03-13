import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Log time entry (manual or from stream timer)
export const logTime = mutation({
    args: {
        userId: v.id("users"),
        taskId: v.id("tasks"),
        hours: v.number(),
        isOvertime: v.boolean(),
        date: v.string(),
        startTime: v.optional(v.number()),
        endTime: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("time_entries", {
            userId: args.userId,
            taskId: args.taskId,
            hours: args.hours,
            isOvertime: args.isOvertime,
            date: args.date,
            startTime: args.startTime,
            endTime: args.endTime,
            createdAt: Date.now(),
        });
    },
});

// Get total hours per user (all time)
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
            if (entry.isOvertime) otHours += entry.hours;
            else regularHours += entry.hours;
        });

        return { regularHours, otHours, totalHours: regularHours + otHours };
    },
});

// Get all time logs for a user
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

// Get time entries for a user within a date range (for weekly calendar)
export const getUserEntriesByWeek = query({
    args: {
        userId: v.id("users"),
        startDate: v.string(), // YYYY-MM-DD (Monday)
        endDate: v.string(),   // YYYY-MM-DD (Sunday)
    },
    handler: async (ctx, args) => {
        const entries = await ctx.db
            .query("time_entries")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .collect();
        // Filter by date range
        return entries.filter(e => e.date >= args.startDate && e.date <= args.endDate);
    }
});
