import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Wallet, TrendingUp, Plus, Pencil, Trash2, DollarSign, PiggyBank, LineChart } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useBudget } from '../context/BudgetContext';
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';

export function Balance() {
    const { user } = useBudget();
    const [accounts, setAccounts] = useState([]);
    const [isAddingAccount, setIsAddingAccount] = useState(false);
    const [editingAccount, setEditingAccount] = useState(null);

    // Account Form State
    const [accountName, setAccountName] = useState('');
    const [accountType, setAccountType] = useState('checking');
    const [accountBalance, setAccountBalance] = useState('');

    // Investment Forecast State
    const [monthlyInvestment, setMonthlyInvestment] = useState('500');
    const [annualReturn, setAnnualReturn] = useState('7');
    const [years, setYears] = useState('10');
    const [forecastData, setForecastData] = useState([]);

    useEffect(() => {
        if (user.id) {
            fetchAccounts();
        }
    }, [user.id]);

    useEffect(() => {
        calculateForecast();
    }, [monthlyInvestment, annualReturn, years, accounts]);

    const fetchAccounts = async () => {
        const { data, error } = await supabase
            .from('accounts')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (data) {
            setAccounts(data);
        }
    };

    const handleAddAccount = async (e) => {
        e.preventDefault();

        const { data, error } = await supabase
            .from('accounts')
            .insert([{
                user_id: user.id,
                name: accountName,
                type: accountType,
                balance: parseFloat(accountBalance)
            }])
            .select()
            .single();

        if (data) {
            setAccounts(prev => [data, ...prev]);
            resetForm();
        }
    };

    const handleUpdateAccount = async (e) => {
        e.preventDefault();

        const { data, error } = await supabase
            .from('accounts')
            .update({
                name: accountName,
                type: accountType,
                balance: parseFloat(accountBalance)
            })
            .eq('id', editingAccount.id)
            .select()
            .single();

        if (data) {
            setAccounts(prev => prev.map(acc => acc.id === data.id ? data : acc));
            resetForm();
        }
    };

    const handleDeleteAccount = async (id) => {
        if (!window.confirm('Are you sure you want to delete this account?')) return;

        const { error } = await supabase
            .from('accounts')
            .delete()
            .eq('id', id);

        if (!error) {
            setAccounts(prev => prev.filter(acc => acc.id !== id));
        }
    };

    const handleEdit = (account) => {
        setEditingAccount(account);
        setAccountName(account.name);
        setAccountType(account.type);
        setAccountBalance(account.balance.toString());
        setIsAddingAccount(true);
    };

    const resetForm = () => {
        setAccountName('');
        setAccountType('checking');
        setAccountBalance('');
        setIsAddingAccount(false);
        setEditingAccount(null);
    };

    const calculateForecast = () => {
        const monthly = parseFloat(monthlyInvestment) || 0;
        const rate = (parseFloat(annualReturn) || 0) / 100 / 12; // Monthly rate
        const months = (parseInt(years) || 0) * 12;

        // Get current investment account balances
        const currentInvestmentBalance = accounts
            .filter(acc => acc.type === 'investment' || acc.type === 'retirement')
            .reduce((sum, acc) => sum + acc.balance, 0);

        const data = [];
        let balance = currentInvestmentBalance;

        // Calculate future value with compound interest
        for (let month = 0; month <= months; month++) {
            if (month > 0) {
                balance = balance * (1 + rate) + monthly;
            }

            // Add data point every 6 months for readability
            if (month % 6 === 0) {
                const totalContributions = currentInvestmentBalance + (monthly * month);
                const interest = balance - totalContributions;

                data.push({
                    month: month / 12,
                    balance: Math.round(balance),
                    contributions: Math.round(totalContributions),
                    interest: Math.round(interest)
                });
            }
        }

        setForecastData(data);
    };

    // Calculate totals by account type
    const accountsByType = accounts.reduce((acc, account) => {
        if (!acc[account.type]) {
            acc[account.type] = { total: 0, count: 0 };
        }
        acc[account.type].total += account.balance;
        acc[account.type].count += 1;
        return acc;
    }, {});

    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
    const investmentBalance = accounts
        .filter(acc => acc.type === 'investment' || acc.type === 'retirement')
        .reduce((sum, acc) => sum + acc.balance, 0);

    const accountTypeLabels = {
        checking: 'Checking',
        savings: 'Savings',
        investment: 'Investment',
        retirement: 'Retirement',
        crypto: 'Crypto',
        other: 'Other'
    };

    const accountTypeIcons = {
        checking: Wallet,
        savings: PiggyBank,
        investment: TrendingUp,
        retirement: TrendingUp,
        crypto: DollarSign,
        other: Wallet
    };

    return (
        <div className="space-y-8">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Balance
                        </CardTitle>
                        <Wallet size={18} className="text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            ${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Across {accounts.length} account{accounts.length !== 1 ? 's' : ''}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Investments
                        </CardTitle>
                        <TrendingUp size={18} className="text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            ${investmentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Investment & retirement accounts
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Forecast ({years} years)
                        </CardTitle>
                        <LineChart size={18} className="text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-primary">
                            ${forecastData.length > 0 ? forecastData[forecastData.length - 1].balance.toLocaleString() : '0'}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Projected value at {annualReturn}% annual return
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Accounts List */}
            <Card>
                <CardHeader>
                    <div className="flex items-start justify-between">
                        <div>
                            <CardTitle>Accounts</CardTitle>
                            <CardDescription>Manage your bank accounts, investments, and balances</CardDescription>
                        </div>
                        <Dialog open={isAddingAccount} onOpenChange={(open) => {
                            if (!open) resetForm();
                            else setIsAddingAccount(true);
                        }}>
                            <DialogTrigger asChild>
                                <Button className="gap-2">
                                    <Plus size={18} />
                                    Add Account
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[500px]">
                                <DialogHeader>
                                    <DialogTitle>{editingAccount ? 'Edit Account' : 'Add Account'}</DialogTitle>
                                    <DialogDescription>
                                        {editingAccount ? 'Update your account details.' : 'Add a new account to track your balance.'}
                                    </DialogDescription>
                                </DialogHeader>
                                <form onSubmit={editingAccount ? handleUpdateAccount : handleAddAccount} className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="account-name">Account Name</Label>
                                        <Input
                                            id="account-name"
                                            value={accountName}
                                            onChange={(e) => setAccountName(e.target.value)}
                                            placeholder="e.g. Chase Checking"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="account-type">Account Type</Label>
                                        <Select value={accountType} onValueChange={setAccountType}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="checking">Checking</SelectItem>
                                                <SelectItem value="savings">Savings</SelectItem>
                                                <SelectItem value="investment">Investment</SelectItem>
                                                <SelectItem value="retirement">Retirement (401k, IRA)</SelectItem>
                                                <SelectItem value="crypto">Crypto</SelectItem>
                                                <SelectItem value="other">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="account-balance">Current Balance</Label>
                                        <Input
                                            id="account-balance"
                                            type="number"
                                            step="0.01"
                                            value={accountBalance}
                                            onChange={(e) => setAccountBalance(e.target.value)}
                                            placeholder="0.00"
                                            required
                                        />
                                    </div>

                                    <DialogFooter>
                                        <Button type="submit">{editingAccount ? 'Update' : 'Add'} Account</Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardHeader>
                <CardContent>
                    {accounts.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Wallet size={48} className="mx-auto mb-4 opacity-20" />
                            <p>No accounts yet. Add one to get started!</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {Object.entries(accountTypeLabels).map(([type, label]) => {
                                const typeAccounts = accounts.filter(acc => acc.type === type);
                                if (typeAccounts.length === 0) return null;

                                const Icon = accountTypeIcons[type];

                                return (
                                    <div key={type}>
                                        <div className="flex items-center gap-2 mb-2 text-sm font-medium text-muted-foreground">
                                            <Icon size={16} />
                                            {label}
                                        </div>
                                        <div className="space-y-2 ml-6">
                                            {typeAccounts.map(account => (
                                                <div key={account.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                                                    <div>
                                                        <div className="font-medium">{account.name}</div>
                                                        <div className="text-sm text-muted-foreground">
                                                            Updated {new Date(account.updated_at || account.created_at).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <div className="text-right">
                                                            <div className="font-bold text-lg">
                                                                ${account.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleEdit(account)}
                                                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                            >
                                                                <Pencil size={16} />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleDeleteAccount(account.id)}
                                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                            >
                                                                <Trash2 size={16} />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Investment Forecast */}
            <Card>
                <CardHeader>
                    <CardTitle>Investment Forecast</CardTitle>
                    <CardDescription>Project your investment growth over time</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="monthly-investment">Monthly Investment</Label>
                            <Input
                                id="monthly-investment"
                                type="number"
                                value={monthlyInvestment}
                                onChange={(e) => setMonthlyInvestment(e.target.value)}
                                placeholder="500"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="annual-return">Annual Return (%)</Label>
                            <Input
                                id="annual-return"
                                type="number"
                                step="0.1"
                                value={annualReturn}
                                onChange={(e) => setAnnualReturn(e.target.value)}
                                placeholder="7"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="years">Time Period (Years)</Label>
                            <Input
                                id="years"
                                type="number"
                                value={years}
                                onChange={(e) => setYears(e.target.value)}
                                placeholder="10"
                            />
                        </div>
                    </div>

                    {forecastData.length > 0 && (
                        <>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RechartsLineChart data={forecastData}>
                                        <XAxis
                                            dataKey="month"
                                            label={{ value: 'Years', position: 'insideBottom', offset: -5 }}
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                                        />
                                        <YAxis
                                            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                                        />
                                        <Tooltip
                                            formatter={(value) => `$${value.toLocaleString()}`}
                                            contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                        />
                                        <Legend />
                                        <Line
                                            type="monotone"
                                            dataKey="balance"
                                            stroke="hsl(var(--primary))"
                                            strokeWidth={3}
                                            name="Total Value"
                                            dot={false}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="contributions"
                                            stroke="#94a3b8"
                                            strokeWidth={2}
                                            strokeDasharray="5 5"
                                            name="Total Contributions"
                                            dot={false}
                                        />
                                    </RechartsLineChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                                <div className="text-center">
                                    <div className="text-sm text-muted-foreground">Total Contributions</div>
                                    <div className="text-xl font-bold mt-1">
                                        ${forecastData[forecastData.length - 1].contributions.toLocaleString()}
                                    </div>
                                </div>
                                <div className="text-center">
                                    <div className="text-sm text-muted-foreground">Interest Earned</div>
                                    <div className="text-xl font-bold text-green-600 mt-1">
                                        +${forecastData[forecastData.length - 1].interest.toLocaleString()}
                                    </div>
                                </div>
                                <div className="text-center">
                                    <div className="text-sm text-muted-foreground">Final Balance</div>
                                    <div className="text-xl font-bold text-primary mt-1">
                                        ${forecastData[forecastData.length - 1].balance.toLocaleString()}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Spending Reports */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="flex flex-col">
                    <CardHeader>
                        <CardTitle>Spending by Category</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 min-h-[300px]">
                        {(() => {
                            const { categories } = useBudget();
                            const data = categories
                                .filter(c => !c.name.toLowerCase().includes('income') && c.spent > 0)
                                .map(c => ({
                                    name: c.name,
                                    value: c.spent,
                                    color: c.color
                                }));

                            return data.length > 0 ? (
                                <div className="w-full h-[300px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={data}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={100}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {data.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                formatter={(value) => `$${value.toLocaleString()}`}
                                                contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                            />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                                    <p>No spending data available yet.</p>
                                    <p className="text-sm mt-2">Add some transactions to see the breakdown.</p>
                                </div>
                            );
                        })()}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Monthly Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {(() => {
                            const { categories } = useBudget();
                            return categories
                                .filter(cat => cat.spent > 0 || cat.budget > 0)
                                .map(cat => (
                                    <div key={cat.id} className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                                        <div className="flex items-center gap-3">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                                            <span className="font-medium">{cat.name}</span>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold">${cat.spent.toLocaleString()}</div>
                                            <div className="text-xs text-muted-foreground">of ${cat.budget.toLocaleString()}</div>
                                        </div>
                                    </div>
                                ));
                        })()}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
