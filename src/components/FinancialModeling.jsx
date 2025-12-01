import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useBudget } from '../context/BudgetContext';
import { create, all } from 'mathjs';
import {
    LineChart as RechartsLineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Legend,
    ReferenceLine
} from 'recharts';
import { TrendingUp, Activity, Target, Clock3 } from 'lucide-react';

const math = create(all, {});

const formatCompact = (value, currency) => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1
}).format(value);

export function FinancialModeling() {
    const { transactions, categories, settings, formatCurrency } = useBudget();

    const {
        monthlySeries,
        averageIncome,
        averageExpenses,
        monthlyNet,
        savingsRate
    } = useMemo(() => {
        if (!transactions?.length) {
            return {
                monthlySeries: [],
                averageIncome: 0,
                averageExpenses: 0,
                monthlyNet: 0,
                savingsRate: 0
            };
        }

        const categoryLookup = new Map(
            categories.map(cat => [cat.id, (cat.name || '').toLowerCase()])
        );

        const bucketMap = new Map();

        transactions.forEach(tx => {
            if (!tx.date) return;
            const txDate = new Date(tx.date);
            if (Number.isNaN(txDate.getTime())) return;
            const bucketKey = `${txDate.getFullYear()}-${txDate.getMonth()}`;
            if (!bucketMap.has(bucketKey)) {
                bucketMap.set(bucketKey, { income: 0, expenses: 0 });
            }

            const catId = tx.category_id || tx.categoryId;
            const catName = categoryLookup.get(catId) || '';
            const isIncome = catName.includes('income');
            const bucket = bucketMap.get(bucketKey);
            const amount = Number(tx.amount) || 0;

            if (isIncome) {
                bucket.income += amount;
            } else {
                bucket.expenses += amount;
            }
        });

        const now = new Date();
        const monthlySeries = [];

        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            const bucket = bucketMap.get(key) || { income: 0, expenses: 0 };

            monthlySeries.push({
                key,
                label: d.toLocaleDateString('en-US', { month: 'short' }),
                income: Math.round(bucket.income),
                expenses: Math.round(bucket.expenses),
                net: Math.round(bucket.income - bucket.expenses)
            });
        }

        const incomeValues = monthlySeries.map(m => m.income).filter(v => v > 0);
        const expenseValues = monthlySeries.map(m => m.expenses).filter(v => v > 0);

        const averageIncome = incomeValues.length ? math.round(math.mean(incomeValues), 2) : 0;
        const averageExpenses = expenseValues.length ? math.round(math.mean(expenseValues), 2) : 0;
        const monthlyNet = averageIncome - averageExpenses;
        const savingsRate = averageIncome > 0 ? (monthlyNet / averageIncome) * 100 : 0;

        return { monthlySeries, averageIncome, averageExpenses, monthlyNet, savingsRate };
    }, [transactions, categories]);

    const monthlyBurn = Math.max(averageExpenses - averageIncome, 0);

    const [cashOnHand, setCashOnHand] = useState('5000');
    const [currentSavings, setCurrentSavings] = useState('5000');
    const [monthlyContribution, setMonthlyContribution] = useState('500');
    const [targetAmount, setTargetAmount] = useState('20000');
    const [expectedReturn, setExpectedReturn] = useState('7');
    const [inflationRate, setInflationRate] = useState('2');
    const [projectionYears, setProjectionYears] = useState('10');
    const defaultsInitialized = useRef(false);

    useEffect(() => {
        if (!defaultsInitialized.current && (averageIncome > 0 || averageExpenses > 0)) {
            const seed = Math.max(Math.round(Math.max(averageExpenses, averageIncome)), 1000);
            setCashOnHand(seed.toString());
            setCurrentSavings(seed.toString());
            const contribution = monthlyNet > 0
                ? Math.max(Math.round(monthlyNet), 100)
                : Math.max(Math.round(averageIncome * 0.15), 150);
            setMonthlyContribution(contribution.toString());
            setTargetAmount(Math.max(seed * 3, 10000).toString());
            defaultsInitialized.current = true;
        }
    }, [averageIncome, averageExpenses, monthlyNet]);

    const numericSavings = Math.max(Number(currentSavings) || 0, 0);
    const numericContribution = Math.max(Number(monthlyContribution) || 0, 0);
    const numericTarget = Math.max(Number(targetAmount) || 0, 0);
    const numericCash = Math.max(Number(cashOnHand) || 0, 0);
    const monthlyRate = ((Number(expectedReturn) || 0) / 100) / 12;
    const monthlyInflation = ((Number(inflationRate) || 0) / 100) / 12;
    const projectionYearsNumber = Math.max(Number(projectionYears) || 1, 1);

    const monthsToTarget = useMemo(() => {
        if (numericTarget <= numericSavings) return 0;
        if (numericContribution <= 0 && monthlyRate <= 0) return Infinity;

        if (monthlyRate === 0) {
            return numericContribution <= 0
                ? Infinity
                : Math.ceil((numericTarget - numericSavings) / numericContribution);
        }

        const numerator = numericContribution + monthlyRate * numericTarget;
        const denominator = numericContribution + monthlyRate * numericSavings;

        if (numerator <= 0 || denominator <= 0) return Infinity;

        const value = math.log(numerator / denominator) / math.log(1 + monthlyRate);
        return value;
    }, [numericContribution, numericSavings, numericTarget, monthlyRate]);

    const projectedTimeline = useMemo(() => {
        const optimistRate = monthlyRate + (0.02 / 12);
        const pessimistRate = Math.max(monthlyRate - (0.02 / 12), -0.01);
        const rows = [];

        let base = numericSavings;
        let optimistic = numericSavings;
        let pessimistic = numericSavings;

        const months = projectionYearsNumber * 12;
        const startYear = new Date().getFullYear();

        for (let month = 1; month <= months; month++) {
            base = base * (1 + monthlyRate) + numericContribution;
            optimistic = optimistic * (1 + optimistRate) + numericContribution;
            pessimistic = Math.max(pessimistic * (1 + pessimistRate) + numericContribution, 0);

            if (month % 12 === 0) {
                const year = startYear + (month / 12);
                const inflationFactor = math.pow(1 + monthlyInflation, month);

                rows.push({
                    year,
                    base: Math.round(base),
                    optimistic: Math.round(optimistic),
                    pessimistic: Math.round(pessimistic),
                    real: inflationFactor > 0 ? Math.round(base / inflationFactor) : Math.round(base)
                });
            }
        }

        return rows;
    }, [monthlyRate, numericContribution, numericSavings, monthlyInflation, projectionYearsNumber]);

    const finalProjection = projectedTimeline[projectedTimeline.length - 1];

    const runwayMonths = monthlyBurn > 0
        ? Math.max(parseFloat((numericCash / monthlyBurn).toFixed(1)), 0)
        : null;

    const targetDate = Number.isFinite(monthsToTarget)
        ? new Date(new Date().setMonth(new Date().getMonth() + Math.ceil(monthsToTarget)))
        : null;

    const formatPercent = (value) => `${(value || 0).toFixed(1)}%`;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                    <TrendingUp className="text-primary" />
                    Financial Modeling
                </h1>
                <p className="text-muted-foreground mt-1 max-w-2xl">
                    Run quick scenarios using your actual cash flow. The models below rely on the last six
                    months of categorized transactions and physics-backed math (via mathjs) to project runway,
                    savings velocity, and long-term growth.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Avg Monthly Income</CardDescription>
                        <CardTitle className="text-2xl">{formatCurrency(averageIncome || 0)}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-muted-foreground text-sm flex items-center gap-1">
                        <Activity size={16} />
                        {monthlySeries.length ? 'Based on recent deposits' : 'Awaiting data'}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Avg Monthly Expenses</CardDescription>
                        <CardTitle className="text-2xl">{formatCurrency(averageExpenses || 0)}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-muted-foreground text-sm flex items-center gap-1">
                        <Target size={16} />
                        {monthlySeries.length ? 'Includes all non-income categories' : 'Awaiting data'}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Savings Rate</CardDescription>
                        <CardTitle className="text-2xl">
                            {Number.isFinite(savingsRate) ? formatPercent(savingsRate) : '—'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-muted-foreground text-sm flex items-center gap-1">
                        <Clock3 size={16} />
                        {monthlyNet >= 0 ? 'You are net positive' : 'You are burning cash'}
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle>Runway Calculator</CardTitle>
                        <CardDescription>
                            Estimate how many months you can operate at your current burn rate.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="cash-on-hand">Liquid cash / savings</Label>
                            <Input
                                id="cash-on-hand"
                                type="number"
                                min="0"
                                value={cashOnHand}
                                onChange={(e) => setCashOnHand(e.target.value)}
                            />
                        </div>
                        <div className="rounded-lg border p-4 bg-muted/50 space-y-2">
                            <div className="flex justify-between text-sm text-muted-foreground">
                                <span>Monthly burn</span>
                                <span>{formatCurrency(monthlyBurn)}</span>
                            </div>
                            <div className="flex justify-between text-sm text-muted-foreground">
                                <span>Monthly net</span>
                                <span className={monthlyNet >= 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive'}>
                                    {formatCurrency(monthlyNet)}
                                </span>
                            </div>
                            <div className="border-t pt-3">
                                <p className="text-xs uppercase text-muted-foreground tracking-wide">Runway</p>
                                <p className="text-2xl font-semibold">
                                    {runwayMonths === null
                                        ? '∞ months'
                                        : `${runwayMonths} month${runwayMonths === 1 ? '' : 's'}`}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {runwayMonths === null
                                        ? 'You are net cash-flow positive.'
                                        : `Assumes ${settings.currency} ${monthlyBurn.toFixed(0)} spent per month.`}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Historical Cash Flow</CardTitle>
                        <CardDescription>
                            Six-month trend of categorized income vs. expenses.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="h-64">
                        {monthlySeries.length ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <RechartsLineChart data={monthlySeries}>
                                    <XAxis dataKey="label" />
                                    <YAxis tickFormatter={(value) => formatCompact(value, settings.currency)} />
                                    <Tooltip formatter={(value) => formatCurrency(value)} />
                                    <Legend />
                                    <Line type="monotone" dataKey="income" stroke="#22c55e" strokeWidth={2} dot={false} />
                                    <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} dot={false} />
                                    <ReferenceLine y={0} stroke="#a1a1aa" strokeDasharray="3 3" />
                                </RechartsLineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="text-sm text-muted-foreground flex items-center justify-center h-full">
                                Import or create transactions to see the trend.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Goal & Growth Modeling</CardTitle>
                    <CardDescription>
                        Change the assumptions and we will recompute the future value using compound interest formulas.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="current-savings">Current invested savings</Label>
                            <Input
                                id="current-savings"
                                type="number"
                                min="0"
                                value={currentSavings}
                                onChange={(e) => setCurrentSavings(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="monthly-contribution">Monthly contribution</Label>
                            <Input
                                id="monthly-contribution"
                                type="number"
                                min="0"
                                value={monthlyContribution}
                                onChange={(e) => setMonthlyContribution(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="target-amount">Target amount</Label>
                            <Input
                                id="target-amount"
                                type="number"
                                min="0"
                                value={targetAmount}
                                onChange={(e) => setTargetAmount(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="expected-return">Expected annual return (%)</Label>
                            <Input
                                id="expected-return"
                                type="number"
                                min="-20"
                                max="30"
                                step="0.1"
                                value={expectedReturn}
                                onChange={(e) => setExpectedReturn(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="inflation-rate">Inflation assumption (%)</Label>
                            <Input
                                id="inflation-rate"
                                type="number"
                                min="0"
                                max="15"
                                step="0.1"
                                value={inflationRate}
                                onChange={(e) => setInflationRate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="projection-years">Projection horizon (years)</Label>
                            <Input
                                id="projection-years"
                                type="number"
                                min="1"
                                max="40"
                                value={projectionYears}
                                onChange={(e) => setProjectionYears(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="rounded-lg border p-4">
                            <p className="text-xs uppercase text-muted-foreground tracking-wide">Months to target</p>
                            <p className="text-2xl font-semibold mt-1">
                                {!Number.isFinite(monthsToTarget)
                                    ? 'Not reachable'
                                    : `${Math.max(Math.ceil(monthsToTarget), 0)} months`}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                {targetDate
                                    ? `Projected date: ${targetDate.toLocaleDateString()}`
                                    : 'Increase contributions or returns to reach your goal.'}
                            </p>
                        </div>
                        <div className="rounded-lg border p-4">
                            <p className="text-xs uppercase text-muted-foreground tracking-wide">Base case</p>
                            <p className="text-2xl font-semibold mt-1">
                                {formatCurrency(finalProjection?.base || numericSavings)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Nominal value after {projectionYearsNumber} year(s).
                            </p>
                        </div>
                        <div className="rounded-lg border p-4">
                            <p className="text-xs uppercase text-muted-foreground tracking-wide">Real purchasing power</p>
                            <p className="text-2xl font-semibold mt-1">
                                {formatCurrency(finalProjection?.real || numericSavings)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Adjusted for the inflation assumption above.
                            </p>
                        </div>
                    </div>

                    <div className="h-72">
                        {projectedTimeline.length ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <RechartsLineChart data={projectedTimeline}>
                                    <XAxis dataKey="year" />
                                    <YAxis tickFormatter={(value) => formatCompact(value, settings.currency)} />
                                    <Tooltip formatter={(value) => formatCurrency(value)} />
                                    <Legend />
                                    <Line type="monotone" dataKey="base" stroke="#3b82f6" strokeWidth={2} dot={false} name="Expected" />
                                    <Line type="monotone" dataKey="optimistic" stroke="#10b981" strokeWidth={2} dot={false} name="Optimistic (+2%)" />
                                    <Line type="monotone" dataKey="pessimistic" stroke="#f97316" strokeWidth={2} dot={false} name="Conservative (-2%)" />
                                    <Line type="monotone" dataKey="real" stroke="#94a3b8" strokeDasharray="4 4" dot={false} name="Real (inflation adjusted)" />
                                </RechartsLineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="text-sm text-muted-foreground flex items-center justify-center h-full">
                                Provide a contribution or return rate to see the projection.
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
