import React from 'react';
import { useBudget } from '../context/BudgetContext';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Wallet, TrendingUp, AlertCircle, ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export function Overview() {
    const { categories, transactions, getBudgetsForRange } = useBudget();
    const [selectedDate, setSelectedDate] = React.useState(new Date());
    const [viewMode, setViewMode] = React.useState('monthly'); // 'weekly', 'monthly', 'quarterly', 'yearly'
    const [budgetedIncome, setBudgetedIncome] = React.useState(0);
    const [monthlyBudgets, setMonthlyBudgets] = React.useState([]);

    // Calculate date range based on viewMode and selectedDate
    const getDateRange = () => {
        const start = new Date(selectedDate);
        const end = new Date(selectedDate);

        switch (viewMode) {
            case 'weekly':
                const day = start.getDay();
                const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is sunday
                start.setDate(diff);
                end.setDate(start.getDate() + 6);
                break;
            case 'monthly':
                start.setDate(1);
                end.setMonth(start.getMonth() + 1);
                end.setDate(0);
                break;
            case 'quarterly':
                const quarter = Math.floor(start.getMonth() / 3);
                start.setMonth(quarter * 3, 1);
                end.setMonth(start.getMonth() + 3, 0);
                break;
            case 'yearly':
                start.setMonth(0, 1);
                end.setMonth(11, 31);
                break;
        }
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    };

    const { start, end } = getDateRange();

    // Fetch budgeted income and all budgets when range changes
    React.useEffect(() => {
        const fetchBudgets = async () => {
            const startMonthStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`;
            const endMonthStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-01`;

            const budgets = await getBudgetsForRange(startMonthStr, endMonthStr);
            setMonthlyBudgets(budgets);

            const incomeCategoryIds = categories.filter(c => c.name.toLowerCase().includes('income')).map(c => c.id);

            let total = 0;

            // Helper to get budget for a specific category and month
            const getBudget = (catId, monthStr) => {
                const found = budgets.find(b => b.category_id === catId && b.month === monthStr);
                if (found) return found.budget;
                return categories.find(c => c.id === catId)?.budget || 0;
            };

            // Iterate through months in range
            const current = new Date(start);
            current.setDate(1); // Ensure we start at first of month

            while (current <= end) {
                const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-01`;

                incomeCategoryIds.forEach(id => {
                    total += getBudget(id, monthKey);
                });

                current.setMonth(current.getMonth() + 1);
            }

            // Pro-rate for weekly view
            if (viewMode === 'weekly') {
                total = total / 4.33; // Approx weeks in a month
            }

            setBudgetedIncome(total);
        };

        fetchBudgets();
    }, [start.toISOString(), end.toISOString(), categories, viewMode]); // Re-run when range or categories change

    // Filter transactions for the range
    const rangeTransactions = transactions.filter(t => {
        const tDate = new Date(t.date);
        return tDate >= start && tDate <= end;
    });

    const incomeCategories = categories.filter(c => c.name.toLowerCase().includes('income'));
    const expenseCategories = categories.filter(c => !c.name.toLowerCase().includes('income'));
    const incomeCategoryIds = new Set(incomeCategories.map(c => c.id));

    // Calculate Actuals
    const actualIncome = rangeTransactions
        .filter(t => incomeCategoryIds.has(t.category_id))
        .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalSpent = rangeTransactions
        .filter(t => !incomeCategoryIds.has(t.category_id))
        .reduce((sum, t) => sum + Number(t.amount), 0);

    // Use Budgeted Income for the "Total Income" card as requested
    // But maybe show Actual Income as a secondary stat?
    // User said: "take income from monthly budget for the overview income"
    const displayIncome = budgetedIncome;

    const remaining = displayIncome - totalSpent;

    // Prepare chart data - EXPENSES ONLY (exclude income)
    const sortedTransactions = [...rangeTransactions]
        .filter(t => !incomeCategoryIds.has(t.category_id))
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    // Chart grouping depends on viewMode
    let chartData = [];

    if (viewMode === 'yearly') {
        // Group by Month
        const monthlyData = {};
        for (let i = 0; i < 12; i++) {
            const d = new Date(start.getFullYear(), i, 1);
            const key = d.toLocaleString('default', { month: 'short' });
            monthlyData[key] = 0;
        }

        sortedTransactions.forEach(t => {
            const d = new Date(t.date);
            const key = d.toLocaleString('default', { month: 'short' });
            if (monthlyData[key] !== undefined) monthlyData[key] += Number(t.amount);
        });

        chartData = Object.entries(monthlyData).map(([name, amount]) => ({ date: name, amount }));
    } else {
        // Daily grouping for others
        const spendingByDate = sortedTransactions.reduce((acc, t) => {
            acc[t.date] = (acc[t.date] || 0) + Number(t.amount);
            return acc;
        }, {});

        // Fill days
        const current = new Date(start);
        while (current <= end) {
            // Don't go into future
            if (current > new Date()) break;

            const dateStr = current.toISOString().split('T')[0];
            chartData.push({
                date: current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                amount: spendingByDate[dateStr] || 0
            });
            current.setDate(current.getDate() + 1);
        }
    }

    const navigate = (direction) => {
        const newDate = new Date(selectedDate);
        switch (viewMode) {
            case 'weekly': newDate.setDate(newDate.getDate() + (direction * 7)); break;
            case 'monthly': newDate.setMonth(newDate.getMonth() + direction); break;
            case 'quarterly': newDate.setMonth(newDate.getMonth() + (direction * 3)); break;
            case 'yearly': newDate.setFullYear(newDate.getFullYear() + direction); break;
        }
        setSelectedDate(newDate);
    };

    const jumpToToday = () => setSelectedDate(new Date());

    const getRangeLabel = () => {
        const options = { month: 'short', day: 'numeric', year: 'numeric' };
        if (viewMode === 'monthly') return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        if (viewMode === 'yearly') return start.getFullYear().toString();
        return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
    };

    return (
        <div className="space-y-8">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <SummaryCard
                    title="Income"
                    value={`$${actualIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                    icon={Wallet}
                    className="text-green-600"
                />
                <SummaryCard
                    title="Total Expenses"
                    value={`$${totalSpent.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                    icon={TrendingUp}
                />
                <SummaryCard
                    title="Net Savings"
                    value={`$${(actualIncome - totalSpent).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                    icon={ArrowUpRight}
                    className={(actualIncome - totalSpent) >= 0 ? "text-green-600" : "text-destructive"}
                />
            </div>

            {/* Charts Section */}
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <CardTitle>{viewMode === 'yearly' ? 'Monthly Spending' : 'Daily Spending'}</CardTitle>

                            <div className="flex flex-col sm:flex-row gap-2">
                                {/* View Mode Selector */}
                                <div className="flex bg-muted p-1 rounded-md">
                                    {['weekly', 'monthly', 'quarterly', 'yearly'].map(mode => (
                                        <button
                                            key={mode}
                                            onClick={() => setViewMode(mode)}
                                            className={cn(
                                                "px-3 py-1.5 text-sm font-medium rounded-sm capitalize transition-all",
                                                viewMode === mode ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            {mode}
                                        </button>
                                    ))}
                                </div>

                                {/* Date Navigator */}
                                <div className="flex items-center gap-2 bg-card border rounded-md p-1 shadow-sm">
                                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                                        <ChevronLeft size={16} />
                                    </Button>
                                    <div className="min-w-[140px] text-center font-medium text-sm">
                                        {getRangeLabel()}
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => navigate(1)}>
                                        <ChevronRight size={16} />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={jumpToToday} className="ml-2">
                                        Today
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    />
                                    <XAxis
                                        dataKey="date"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                                        dy={10}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="amount"
                                        stroke="hsl(var(--primary))"
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#colorAmount)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Category Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {expenseCategories.map(cat => {
                            // Calculate spent for this category in this range
                            const catSpent = rangeTransactions
                                .filter(t => t.category_id === cat.id)
                                .reduce((sum, t) => sum + Number(t.amount), 0);

                            // Calculate budget using monthly budgets
                            let catBudget = 0;
                            const current = new Date(start);
                            current.setDate(1);

                            while (current <= end) {
                                const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-01`;
                                const found = monthlyBudgets.find(b => b.category_id === cat.id && b.month === monthKey);
                                catBudget += found ? found.budget : (cat.budget || 0);
                                current.setMonth(current.getMonth() + 1);
                            }

                            // Pro-rate for weekly view
                            if (viewMode === 'weekly') {
                                catBudget = catBudget / 4.33;
                            }

                            const percent = catBudget > 0 ? Math.min(100, Math.round((catSpent / catBudget) * 100)) : 0;

                            return (
                                <div key={cat.id} className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="font-medium">{cat.name}</span>
                                        <div className="flex items-center gap-2">
                                            <span className={cn("text-xs font-medium", percent > 100 ? "text-destructive" : "text-muted-foreground")}>
                                                {percent}%
                                            </span>
                                            <div className="text-muted-foreground">
                                                ${catSpent.toLocaleString(undefined, { maximumFractionDigits: 0 })} / ${catBudget.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </div>
                                        </div>
                                    </div>
                                    <Progress value={percent} className={cn("h-2", percent > 90 && "bg-destructive/20 [&>div]:bg-destructive")} />
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    {/* Insights */}

                    <Card className="bg-secondary/30 border-none">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <AlertCircle size={18} className="text-primary" />
                                Insights
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                {remaining > 0
                                    ? `You've saved $${remaining.toLocaleString(undefined, { maximumFractionDigits: 0 })} this period! Great job.`
                                    : `You've spent $${Math.abs(remaining).toLocaleString(undefined, { maximumFractionDigits: 0 })} more than your budgeted income.`
                                }
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function SummaryCard({ title, value, icon: Icon, className }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    {title}
                </CardTitle>
                {Icon && <Icon size={18} className="text-muted-foreground" />}
            </CardHeader>
            <CardContent>
                <div className={cn("text-2xl font-bold", className)}>{value}</div>
            </CardContent>
        </Card>
    );
}
