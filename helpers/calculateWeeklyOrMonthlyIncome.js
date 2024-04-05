const calculateWeeklyOrMonthlyIncome = (users, isWeekly) => {
  const userJoinDates = {};

  users.forEach((user) => {
    const date = new Date(user.createdAt);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const weekStartDate = new Date(date); // Copy the date to avoid modifying the original date
    weekStartDate.setDate(date.getDate() - dayOfWeek + 1); // Calculate the start of the week (Monday)
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekStartDate.getDate() + 6); // Calculate the end of the week (Sunday)
    const plansIncome = user["pricing_plan.price"];

    const key = isWeekly ? `${year}-${month}-${day}` : `${year}-${month}`;

    if (!userJoinDates[key]) {
      userJoinDates[key] = {
        plansIncome: 0,
      };
    }

    userJoinDates[key].plansIncome += plansIncome;
  });

  const incomeWithPeriod = Object.entries(userJoinDates)
    .map(([period, data]) => {
      if (isWeekly == 1) {
        const weekStartDate = new Date(period);
        weekStartDate.setDate(weekStartDate.getDate() - weekStartDate.getDay()); // Adjust to the start of the week
        const weekEndDate = new Date(weekStartDate);
        weekEndDate.setDate(weekStartDate.getDate() + 6); // Calculate the end of the week
        return {
          date: period,
          weekStartDate: weekStartDate.toISOString().split("T")[0],
          weekEndDate: weekEndDate.toISOString().split("T")[0],
          plansIncome: data.plansIncome,
        };
      } else if (isWeekly == 0) {
        if (!period.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // Skip entries that don't match the format yyyy-MM-dd
          return null;
        }
        const [year, month, day] = period.split("-");
        return {
          date: `${year}-${month}`,
          plansIncome: data.plansIncome,
        };
      }
    })
    .filter((item) => item !== null);

  // Sort the data chronologically
  incomeWithPeriod.sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();

    return dateA - dateB;
  });

  // Consolidate monthly income data
  if (isWeekly == 0) {
    const consolidatedData = {};
    incomeWithPeriod.forEach((item) => {
      const { date, plansIncome } = item;
      if (!consolidatedData[date]) {
        consolidatedData[date] = {
          date,
          plansIncome: 0,
        };
      }
      consolidatedData[date].plansIncome += plansIncome;
    });
    return Object.values(consolidatedData);
  }

  return incomeWithPeriod;
};

module.exports = calculateWeeklyOrMonthlyIncome;
