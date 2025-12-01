/**
 * Aggregates financial data into a text summary for the AI context.
 * 
 * @param {Array} categories - List of categories with budget and spent info
 * @param {Array} transactions - List of all transactions
 * @param {Object} settings - User settings (currency, etc.)
 * @returns {String} Formatted text summary
 */
export function aggregateFinancialData(categories, transactions, settings) {
    const currency = settings?.currency || 'USD';
    const now = new Date();
    const currentMonth = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Calculate All-Time Spending
    const allTimeSpent = transactions.reduce((sum, t) => {
        const catId = t.category_id || t.categoryId;
        const cat = categories.find(c => c.id === catId);
        const isIncome = cat && cat.name.toLowerCase().includes('income');
        return !isIncome ? sum + Number(t.amount) : sum;
    }, 0);

    // Calculate Monthly Totals
    const monthlySpendingByCategory = {};
    let monthlyTotalSpent = 0;
    let monthlyTotalIncome = 0;

    const currentMonthTxns = transactions.filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    currentMonthTxns.forEach(t => {
        const amount = Number(t.amount);
        const catId = t.category_id || t.categoryId;
        const cat = categories.find(c => c.id === catId);
        const catName = cat ? cat.name : 'Uncategorized';

        if (cat && cat.name.toLowerCase().includes('income')) {
            monthlyTotalIncome += amount;
        } else {
            monthlyTotalSpent += amount;
            monthlySpendingByCategory[catName] = (monthlySpendingByCategory[catName] || 0) + amount;
        }
    });

    // Calculate Spending Trends (Last 6 Months)
    const monthlyTrends = [];
    for (let i = 0; i < 6; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthName = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); // e.g., "October 2025"

        const monthTxns = transactions.filter(t => {
            const td = new Date(t.date);
            return td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear();
        });

        const income = monthTxns.reduce((sum, t) => {
            const catId = t.category_id || t.categoryId; // Handle both cases safely
            const cat = categories.find(c => c.id === catId);
            return (cat && cat.name.toLowerCase().includes('income')) ? sum + Number(t.amount) : sum;
        }, 0);

        const expenses = monthTxns.reduce((sum, t) => {
            const catId = t.category_id || t.categoryId;
            const cat = categories.find(c => c.id === catId);
            // Overview logic: If it's not income, it's an expense (including uncategorized)
            const isIncome = cat && cat.name.toLowerCase().includes('income');
            return !isIncome ? sum + Number(t.amount) : sum;
        }, 0);

        const breakdown = {};
        monthTxns.forEach(t => {
            const catId = t.category_id || t.categoryId;
            const cat = categories.find(c => c.id === catId);
            const isIncome = cat && cat.name.toLowerCase().includes('income');

            if (!isIncome) {
                const catName = cat ? cat.name : 'Uncategorized';
                breakdown[catName] = (breakdown[catName] || 0) + Number(t.amount);
            }
        });

        if (income > 0 || expenses > 0) {
            monthlyTrends.push({
                month: monthName, // "October 2025"
                month_simple: d.toLocaleDateString('en-US', { month: 'long' }), // "October"
                income: Number(income.toFixed(2)),
                expenses: Number(expenses.toFixed(2)),
                savings: Number((income - expenses).toFixed(2)),
                breakdown: breakdown // { "Food": 500, "Rent": 1000 }
            });
        }
    }

    // Construct structured data object
    const data = {
        current_date: now.toLocaleDateString(),
        currency: currency,
        summary: {
            total_transactions: transactions.length,
            all_time_spending: Number(allTimeSpent.toFixed(2)),
            current_month: {
                name: currentMonth,
                income: Number(monthlyTotalIncome.toFixed(2)),
                expenses: Number(monthlyTotalSpent.toFixed(2)),
                net_savings: Number((monthlyTotalIncome - monthlyTotalSpent).toFixed(2))
            }
        },
        budgets: categories
            .filter(c => !c.name.toLowerCase().includes('income'))
            .map(c => ({
                category: c.name,
                budget: c.budget,
                spent: monthlySpendingByCategory[c.name] || 0,
                status: (monthlySpendingByCategory[c.name] || 0) > c.budget ? 'OVER_BUDGET' : 'OK'
            })),
        monthly_trends: monthlyTrends,
        recent_transactions: transactions.slice(0, 10).map(t => ({
            date: t.date,
            description: t.description,
            amount: Number(t.amount),
            category: categories.find(c => c.id === t.categoryId)?.name || 'Uncategorized'
        }))
    };

    return JSON.stringify(data, null, 2);
}
