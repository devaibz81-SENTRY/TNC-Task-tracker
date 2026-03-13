import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// MVP Login
export const login = query({
    args: {
        username: v.string(),
        pin: v.string(),
    },
    handler: async (ctx, args) => {
        const user = await ctx.db
            .query("users")
            .withIndex("by_username", (q) => q.eq("username", args.username))
            .unique();

        if (!user) {
            return { success: false, message: "User not found" };
        }

        if (user.pin !== args.pin) {
            return { success: false, message: "Incorrect PIN" };
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

        // Generate a random 4-digit PIN
        const pin = Math.floor(1000 + Math.random() * 9000).toString();

        const userId = await ctx.db.insert("users", {
            username: args.username,
            pin: pin,
            isAdmin: args.isAdmin
        });

        return {
            success: true,
            pin: pin, // Return the generated PIN so the user can see it
            user: {
                _id: userId,
                username: args.username,
                isAdmin: args.isAdmin
            }
        };
    },
});
