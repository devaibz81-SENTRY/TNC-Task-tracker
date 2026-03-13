import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// MVP Login
export const login = query({
    args: {
        username: v.string(),
        password: v.string(),
    },
    handler: async (ctx, args) => {
        const user = await ctx.db
            .query("users")
            .withIndex("by_username", (q) => q.eq("username", args.username))
            .unique();

        if (!user) {
            return { success: false, message: "User not found" };
        }

        if (user.password !== args.password) {
            return { success: false, message: "Incorrect password" };
        }

        return {
            success: true,
            user: {
                _id: user._id,
                username: user.username,
                isAdmin: user.isAdmin
            }
        };
    },
});

// MVP Signup
export const signup = mutation({
    args: {
        username: v.string(),
        password: v.string(),
        isAdmin: v.boolean()
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("users")
            .withIndex("by_username", (q) => q.eq("username", args.username))
            .unique();

        if (existing) {
            return { success: false, message: "Username already exists" };
        }

        const userId = await ctx.db.insert("users", {
            username: args.username,
            password: args.password,
            isAdmin: args.isAdmin
        });

        return {
            success: true,
            user: {
                _id: userId,
                username: args.username,
                isAdmin: args.isAdmin
            }
        };
    },
});
