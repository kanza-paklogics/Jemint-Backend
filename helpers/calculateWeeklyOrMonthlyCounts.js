// Helper function to calculate counts with periods and include pricing plan name
const calculateWeeklyOrMonthlyCounts = (users, isWeekly) => {
  let userJoinDates = [];
  let countWithPeriod = [];

  if (isWeekly == 1) {
    userJoinDates = users.map((user) => {
      const date = new Date(user.createdAt);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      const weekStartDate = new Date(date); // Copy the date to avoid modifying the original date
      weekStartDate.setDate(date.getDate() - dayOfWeek + 1); // Calculate the start of the week (Monday)
      const weekEndDate = new Date(weekStartDate);
      weekEndDate.setDate(weekStartDate.getDate() + 6); // Calculate the end of the week (Sunday)
      const planName = user["pricing_plan.name"];

      return {
        week: `${year}-${month}-${day}`, // Use yyyy-mm-dd for the key
        weekStartDate: weekStartDate.toISOString().split("T")[0], // Convert to yyyy-mm-dd
        weekEndDate: weekEndDate.toISOString().split("T")[0], // Convert to yyyy-mm-dd
        planName,
      };
    }); // Extract weekly join dates (yyyy-mm-dd)
  } else if (isWeekly == 0) {
    userJoinDates = users.map((user) => {
      const date = new Date(user.createdAt);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const planName = user["pricing_plan.name"];
      return {
        date: `${year}-${month}-${day}`, // Use yyyy-mm-dd for the key
        planName,
      };
    }); // Extract daily join dates (yyyy-mm-dd)
  }

  // Count users for each period and planName and populate countWithPeriod
  const counts = {};

  userJoinDates.forEach((dateObj) => {
    const dateKey = dateObj.week || dateObj.date; // Use the same format for the key
    counts[dateKey] = counts[dateKey] || {};
    counts[dateKey][dateObj.planName] =
      (counts[dateKey][dateObj.planName] || 0) + 1;
  });

  // Sort the data chronologically
  countWithPeriod.sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();

    return dateA - dateB;
  });

  // If isWeekly is false, combine monthly counts
  if (isWeekly == 0) {
    const monthlyCounts = {};

    Object.entries(counts).forEach(([dateKey, planCounts]) => {
      const monthKey = dateKey.substr(0, 7); // Extract the yyyy-mm part
      monthlyCounts[monthKey] = monthlyCounts[monthKey] || {};

      Object.entries(planCounts).forEach(([planName, count]) => {
        monthlyCounts[monthKey][planName] =
          (monthlyCounts[monthKey][planName] || 0) + count;
      });
    });

    countWithPeriod = Object.entries(monthlyCounts).map(
      ([period, planCounts]) => {
        return {
          period,
          ...planCounts,
        };
      }
    );
  } else {
    // Include week start date and end date in the response
    countWithPeriod = Object.entries(counts).map(([period, planCounts]) => {
      const dateObj = userJoinDates.find((dateObj) => dateObj.week === period);
      return {
        weekStartDate: dateObj ? dateObj.weekStartDate : null,
        weekEndDate: dateObj ? dateObj.weekEndDate : null,
        ...planCounts,
      };
    });
  }

  return countWithPeriod;
};

module.exports = calculateWeeklyOrMonthlyCounts;
