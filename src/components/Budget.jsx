import React, { useState, useEffect } from 'react';
import { useBudget } from '../context/BudgetContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Calendar, ChevronLeft, ChevronRight, Copy, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

export function Budget() {
    const { categories, transactions, getMonthlyBudgets, setMonthlyBudget, copyMonthBudget, addCategory, deleteCategory } = useBudget();
    const [selectedMonth, setSelectedMonth] = useState(new Date());
    const [monthlyBudgets, setMonthlyBudgets] = useState({});
    const [editingCategory, setEditingCategory] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryBudget, setNewCategoryBudget] = useState('');
    const [selectedCategories, setSelectedCategories] = useState(new Set());

    const monthKey = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}-01`;

    useEffect(() => {
        loadMonthlyBudgets();
    }, [selectedMonth]);

    const loadMonthlyBudgets = async () => {
        const budgets = await getMonthlyBudgets(monthKey);
        const budgetMap = {};
        budgets.forEach(b => {
            budgetMap[b.category_id] = b.budget;
        });
        setMonthlyBudgets(budgetMap);
    };

    const previousMonth = () => {
        setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1));
    };

    const currentMonth = () => {
        setSelectedMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    };

    const handleEdit = (categoryId, currentBudget) => {
        setEditingCategory(categoryId);
        setEditValue(currentBudget?.toString() || '');
    };

    const handleSave = async (categoryId) => {
        if (editValue !== '') {
            await setMonthlyBudget(categoryId, monthKey, parseFloat(editValue));
            await loadMonthlyBudgets();
        }
        setEditingCategory(null);
        setEditValue('');
    };

    const handleCopyFromDefault = async () => {
        for (const category of categories) {
            await setMonthlyBudget(category.id, monthKey, category.budget);
        }
        await loadMonthlyBudgets();
    };

    const handleCopyFromPreviousMonth = async () => {
        const prevMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1);
        const prevMonthKey = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}-01`;
        await copyMonthBudget(prevMonthKey, monthKey);
        await loadMonthlyBudgets();
    };

    const getBudgetForCategory = (categoryId) => {
        return monthlyBudgets[categoryId];
    };

    const getDefaultBudget = (categoryId) => {
        return categories.find(c => c.id === categoryId)?.budget || 0;
    };

    const isCurrentMonth = () => {
        const now = new Date();
        return selectedMonth.getFullYear() === now.getFullYear() &&
            selectedMonth.getMonth() === now.getMonth();
    };

    const [newCategoryType, setNewCategoryType] = useState('expense');

    const handleAddCategory = async (e) => {
        e.preventDefault();
        if (newCategoryName && newCategoryBudget) {
            let finalName = newCategoryName;
            if (newCategoryType === 'income' && !finalName.toLowerCase().includes('income')) {
                finalName = `${finalName} (Income)`;
            }

            await addCategory(finalName, parseFloat(newCategoryBudget));
            setNewCategoryName('');
            setNewCategoryBudget('');
            setNewCategoryType('expense');
            setIsAddingCategory(false);
        }
    };

    const handleDeleteCategory = async (categoryId, categoryName) => {
        if (window.confirm(`Are you sure you want to delete the "${categoryName}" category? This will also delete all associated transactions.`)) {
            await deleteCategory(categoryId);
        }
    };

    const toggleSelectAll = () => {
        if (selectedCategories.size === categories.length) {
            setSelectedCategories(new Set());
        } else {
            setSelectedCategories(new Set(categories.map(c => c.id)));
        }
    };

    const toggleSelectCategory = (id) => {
        const newSelected = new Set(selectedCategories);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedCategories(newSelected);
    };

    const handleBulkDelete = async () => {
        if (selectedCategories.size === 0) return;

        if (window.confirm(`Are you sure you want to delete ${selectedCategories.size} categor${selectedCategories.size === 1 ? 'y' : 'ies'}? This will also delete all associated transactions.`)) {
            for (const id of selectedCategories) {
                await deleteCategory(id);
            }
            setSelectedCategories(new Set());
        }
    };

    const monthName = selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Separate Income and Expense categories
    const incomeCategories = categories.filter(c => c.name.toLowerCase().includes('income'));
    const expenseCategories = categories.filter(c => !c.name.toLowerCase().includes('income'));

    // Get date range for selected month
    const monthStart = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
    const monthEnd = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0);
    monthStart.setHours(0, 0, 0, 0);
    monthEnd.setHours(23, 59, 59, 999);

    // Filter transactions for selected month
    const monthTransactions = transactions.filter(t => {
        const tDate = new Date(t.date);
        return tDate >= monthStart && tDate <= monthEnd;
    });

    // Calculate actual income from transactions
    const incomeCategoryIds = new Set(incomeCategories.map(c => c.id));
    const actualIncome = monthTransactions
        .filter(t => incomeCategoryIds.has(t.category_id))
        .reduce((sum, t) => sum + Number(t.amount), 0);

    // Calculate Totals
    const totalIncome = incomeCategories.reduce((sum, cat) => {
        const monthly = getBudgetForCategory(cat.id);
        return sum + (monthly !== undefined ? monthly : (cat.budget || 0));
    }, 0);

    const totalExpenses = expenseCategories.reduce((sum, cat) => {
        const monthly = getBudgetForCategory(cat.id);
        return sum + (monthly !== undefined ? monthly : (cat.budget || 0));
    }, 0);

    const leftToBudget = totalIncome - totalExpenses;

    return (
        <div className="space-y-6">
            {/* Month Selector */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Calendar size={20} className="text-muted-foreground" />
                            <div>
                                <CardTitle>{monthName}</CardTitle>
                                <CardDescription>
                                    {isCurrentMonth() && <Badge variant="outline">Current Month</Badge>}
                                </CardDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" onClick={previousMonth}>
                                <ChevronLeft size={16} />
                            </Button>
                            <Button variant="outline" onClick={currentMonth}>
                                Today
                            </Button>
                            <Button variant="outline" size="icon" onClick={nextMonth}>
                                <ChevronRight size={16} />
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Budget Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm">
                            <div className="text-sm font-medium text-muted-foreground">Income</div>
                            <div className="text-2xl font-bold text-green-600 mt-1">
                                ${actualIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </div>
                            <div className="text-xs text-muted-foreground mt-2">
                                Budgeted: ${totalIncome.toLocaleString()}
                            </div>
                            <div className="text-xs text-muted-foreground mt-3 space-y-1">
                                {incomeCategories.map(cat => (
                                    <div key={cat.id} className="flex items-center gap-2">
                                        <span>{cat.name}:</span>
                                        {editingCategory === cat.id ? (
                                            <div className="flex items-center gap-1">
                                                <Input
                                                    type="number"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    className="w-24 h-6 text-xs"
                                                    autoFocus
                                                />
                                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleSave(cat.id)}>
                                                    <span className="sr-only">Save</span>
                                                    ✓
                                                </Button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => handleEdit(cat.id, getBudgetForCategory(cat.id) ?? cat.budget)}
                                                className="hover:underline cursor-pointer"
                                            >
                                                ${(getBudgetForCategory(cat.id) ?? cat.budget).toLocaleString()}
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm">
                            <div className="text-sm font-medium text-muted-foreground">Total Expenses</div>
                            <div className="text-2xl font-bold mt-1">
                                ${totalExpenses.toLocaleString()}
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <Button variant="outline" className="gap-2" onClick={handleCopyFromDefault}>
                            <Copy size={16} />
                            Copy from Default Budgets
                        </Button>
                        <Button variant="outline" className="gap-2" onClick={handleCopyFromPreviousMonth}>
                            <Copy size={16} />
                            Copy from Previous Month
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Budget List */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Category Budgets</CardTitle>
                            <CardDescription>
                                Click on a budget amount to set a custom value for this month
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            {selectedCategories.size > 0 && (
                                <Button
                                    variant="destructive"
                                    className="gap-2"
                                    onClick={handleBulkDelete}
                                >
                                    <Trash2 size={16} />
                                    Delete {selectedCategories.size}
                                </Button>
                            )}
                            <Dialog open={isAddingCategory} onOpenChange={setIsAddingCategory}>
                                <DialogTrigger asChild>
                                    <Button className="gap-2">
                                        <Plus size={18} />
                                        Add Category
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[500px]">
                                    <DialogHeader>
                                        <DialogTitle>Add Category</DialogTitle>
                                        <DialogDescription>
                                            Create a new budget category with a default monthly budget.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <form onSubmit={handleAddCategory} className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="category-type">Type</Label>
                                            <Select value={newCategoryType} onValueChange={setNewCategoryType}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="expense">Expense</SelectItem>
                                                    <SelectItem value="income">Income</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="category-name">Category Name</Label>
                                            <Input
                                                id="category-name"
                                                value={newCategoryName}
                                                onChange={(e) => setNewCategoryName(e.target.value)}
                                                placeholder="e.g. Groceries"
                                                autoFocus
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="category-budget">Default Budget</Label>
                                            <Input
                                                id="category-budget"
                                                type="number"
                                                value={newCategoryBudget}
                                                onChange={(e) => setNewCategoryBudget(e.target.value)}
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <DialogFooter>
                                            <Button type="submit">Add Category</Button>
                                        </DialogFooter>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        <div className="flex items-center p-4 border-b">
                            <Checkbox
                                checked={expenseCategories.length > 0 && selectedCategories.size === expenseCategories.length}
                                onCheckedChange={toggleSelectAll}
                                className="mr-4"
                            />
                            <div className="text-sm font-medium text-muted-foreground">
                                Select All
                            </div>
                        </div>
                        {expenseCategories.map(category => {
                            const monthlyBudget = getBudgetForCategory(category.id);
                            const defaultBudget = getDefaultBudget(category.id);
                            const displayBudget = monthlyBudget !== undefined ? monthlyBudget : defaultBudget;
                            const isCustom = monthlyBudget !== undefined;

                            return (
                                <div key={category.id} className="flex items-center justify-between p-4 border rounded-lg">
                                    <div className="flex items-center gap-4">
                                        <Checkbox
                                            checked={selectedCategories.has(category.id)}
                                            onCheckedChange={() => toggleSelectCategory(category.id)}
                                        />
                                        <div
                                            className="w-3 h-3 rounded-full"
                                            style={{ backgroundColor: category.color }}
                                        />
                                        <div>
                                            <div className="font-medium">{category.name}</div>
                                            <div className="text-sm text-muted-foreground">
                                                Default: ${defaultBudget.toLocaleString()}
                                                {isCustom && <Badge variant="secondary" className="ml-2">Custom</Badge>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {editingCategory === category.id ? (
                                            <>
                                                <Input
                                                    type="number"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    className="w-32"
                                                    autoFocus
                                                />
                                                <Button size="sm" onClick={() => handleSave(category.id)}>
                                                    Save
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => setEditingCategory(null)}
                                                >
                                                    Cancel
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                <Button
                                                    variant="outline"
                                                    onClick={() => handleEdit(category.id, displayBudget)}
                                                    className="font-mono"
                                                >
                                                    ${displayBudget.toLocaleString()}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDeleteCategory(category.id, category.name)}
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                >
                                                    <Trash2 size={16} />
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
