import { query } from "./_generated/server";

export const getAdminData = query({
    handler: async (ctx) => {
        // 1. Get all users
        const users = await ctx.db.query("users").collect();

        // 2. Get all tasks
        const tasks = await ctx.db.query("tasks").collect();

        // 3. Get all time entries
        const timeEntries = await ctx.db.query("time_entries").collect();

        // 4. Aggregate data per user
        const aggregatedData = users.map(user => {
            const userTasks = tasks.filter(t => t.userId === user._id);
            const userTime = timeEntries.filter(te => te.userId === user._id);

            let regularHours = 0;
            let otHours = 0;

            userTime.forEach(te => {
                if (te.isOvertime) otHours += te.hours;
                else regularHours += te.hours;
            });

            return {
                _id: user._id,
                username: user.username,
                isAdmin: user.isAdmin,
                taskCount: userTasks.length,
                completedTaskCount: userTasks.filter(t => t.status === "completed").length,
                regularHours,
                otHours,
                totalHours: regularHours + otHours,
                // attach raw for exports
                tasks: userTasks,
                timeEntries: userTime
            };
        });

        return aggregatedData;
    }
});
