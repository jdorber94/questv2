import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const BudgetContext = createContext();

const defaultCategories = [
    { name: 'Income', budget: 0, color: '#10b981' },
    { name: 'Housing', budget: 1200, color: '#6366f1' },
    { name: 'Food & Dining', budget: 400, color: '#f59e0b' },
    { name: 'Transportation', budget: 200, color: '#f97316' },
    { name: 'Shopping', budget: 200, color: '#ec4899' },
    { name: 'Entertainment', budget: 150, color: '#8b5cf6' },
    { name: 'Healthcare', budget: 150, color: '#14b8a6' },
    { name: 'Investments', budget: 500, color: '#3b82f6' },
    { name: 'Fees', budget: 50, color: '#ef4444' },
    { name: 'Transfers', budget: 0, color: '#64748b' },
    { name: 'Other', budget: 100, color: '#9ca3af' },
];

export function BudgetProvider({ children }) {
    const [categories, setCategories] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [monthlyBudgets, setMonthlyBudgets] = useState([]);
    const [settings, setSettings] = useState({ currency: 'USD', theme: 'light', smartCategorization: false });
    const [user, setUser] = useState({ name: 'User', email: '', avatar: '' });
    const [loading, setLoading] = useState(true);

    // Fetch user profile
    useEffect(() => {
        fetchUserProfile();
    }, []);

    // Fetch categories and transactions
    useEffect(() => {
        if (user.id) {
            fetchCategories();
            fetchTransactions();
        }
    }, [user.id]);

    // Apply theme
    useEffect(() => {
        if (settings.theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [settings.theme]);

    const fetchUserProfile = async () => {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', authUser.id)
                .single();

            if (data) {
                setUser({ id: authUser.id, ...data });
            } else if (error && error.code === 'PGRST116') {
                // Profile doesn't exist, create it
                const { data: newProfile } = await supabase
                    .from('profiles')
                    .insert([{ id: authUser.id, email: authUser.email, name: authUser.email?.split('@')[0] || 'User' }])
                    .select()
                    .single();
                if (newProfile) {
                    setUser({ id: authUser.id, ...newProfile });
                }
            }
        }
        setLoading(false);
    };

    const fetchCategories = async () => {
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true });

        if (data && data.length > 0) {
            // Calculate spent for each category
            const categoriesWithSpent = await Promise.all(
                data.map(async (cat) => {
                    const { data: txns } = await supabase
                        .from('transactions')
                        .select('amount')
                        .eq('category_id', cat.id);
                    const spent = txns?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
                    return { ...cat, spent };
                })
            );
            setCategories(categoriesWithSpent);
        } else if (!error) {
            // No categories yet, create defaults
            const { data: newCategories } = await supabase
                .from('categories')
                .insert(defaultCategories.map(cat => ({ ...cat, user_id: user.id })))
                .select();
            if (newCategories) {
                setCategories(newCategories.map(cat => ({ ...cat, spent: 0 })));
            }
        }
    };

    const fetchTransactions = async () => {
        const { data } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', user.id)
            .order('date', { ascending: false });

        if (data) {
            setTransactions(data);
        }
    };

    const addTransaction = async (transaction) => {
        const { data, error } = await supabase
            .from('transactions')
            .insert([{
                user_id: user.id,
                category_id: transaction.categoryId,
                amount: Number(transaction.amount),
                date: transaction.date || new Date().toISOString().split('T')[0],
                note: transaction.note || null
            }])
            .select()
            .single();

        if (data) {
            setTransactions(prev => [data, ...prev]);
            // Update category spent
            fetchCategories();
        }
    };

    const updateTransaction = async (id, transaction) => {
        const { data, error } = await supabase
            .from('transactions')
            .update({
                category_id: transaction.categoryId,
                amount: Number(transaction.amount),
                date: transaction.date,
                note: transaction.note || null
            })
            .eq('id', id)
            .select()
            .single();

        if (data) {
            setTransactions(prev => prev.map(t => t.id === id ? data : t));
            fetchCategories();
        }
    };

    const deleteTransaction = async (id) => {
        const { error } = await supabase
            .from('transactions')
            .delete()
            .eq('id', id);

        if (!error) {
            setTransactions(prev => prev.filter(t => t.id !== id));
            fetchCategories();
        }
    };

    const deleteTransactions = async (ids) => {
        const { error } = await supabase
            .from('transactions')
            .delete()
            .in('id', ids);

        if (!error) {
            setTransactions(prev => prev.filter(t => !ids.includes(t.id)));
            fetchCategories();
        }
    };

    const updateCategoryBudget = async (id, amount) => {
        const { error } = await supabase
            .from('categories')
            .update({ budget: Number(amount) })
            .eq('id', id);

        if (!error) {
            setCategories(prev => prev.map(cat =>
                cat.id === id ? { ...cat, budget: Number(amount) } : cat
            ));
        }
    };

    const addCategory = async (name, budget) => {
        // Check if category with this name already exists
        const existingCategory = categories.find(c => c.name.toLowerCase() === name.toLowerCase());
        if (existingCategory) {
            console.log(`Category "${name}" already exists, skipping creation`);
            return existingCategory;
        }

        const { data, error } = await supabase
            .from('categories')
            .insert([{
                user_id: user.id,
                name,
                budget: Number(budget),
                color: `#${Math.floor(Math.random() * 16777215).toString(16)}`
            }])
            .select()
            .single();

        if (data) {
            setCategories(prev => [...prev, { ...data, spent: 0 }]);
            return data;
        } else if (error) {
            // If error is due to unique constraint, fetch the existing category
            if (error.code === '23505') { // Unique constraint violation
                const { data: existing } = await supabase
                    .from('categories')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('name', name)
                    .single();
                return existing;
            }
        }
    };

    const deleteCategory = async (id) => {
        const { error } = await supabase
            .from('categories')
            .delete()
            .eq('id', id);

        if (!error) {
            setCategories(prev => prev.filter(c => c.id !== id));
        }
    };

    const updateSettings = (newSettings) => {
        setSettings(prev => ({ ...prev, ...newSettings }));
    };

    const updateUser = async (newUser) => {
        const { error } = await supabase
            .from('profiles')
            .update({
                name: newUser.name,
                email: newUser.email,
                avatar_url: newUser.avatar
            })
            .eq('id', user.id);

        if (!error) {
            setUser(prev => ({ ...prev, ...newUser }));
        }
    };

    const clearData = async () => {
        if (window.confirm('Are you sure you want to clear all data? This cannot be undone.')) {
            // Delete all transactions
            await supabase.from('transactions').delete().eq('user_id', user.id);
            // Delete all categories
            await supabase.from('categories').delete().eq('user_id', user.id);

            setTransactions([]);
            setCategories([]);
            setSettings({ currency: 'USD', theme: 'light' });

            // Recreate default categories
            fetchCategories();
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: settings.currency,
        }).format(amount);
    };

    const getCategoryName = (id) => {
        return categories.find(c => c.id === id)?.name || 'Unknown';
    };

    // Monthly Budget Functions
    const getMonthlyBudgets = async (month) => {
        const { data } = await supabase
            .from('monthly_budgets')
            .select('*')
            .eq('user_id', user.id)
            .eq('month', month);

        return data || [];
    };

    const setMonthlyBudget = async (categoryId, month, budget) => {
        const { data, error } = await supabase
            .from('monthly_budgets')
            .upsert({
                user_id: user.id,
                category_id: categoryId,
                month: month,
                budget: Number(budget),
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id,category_id,month'
            })
            .select()
            .single();

        return data;
    };

    const getBudgetsForRange = async (startMonth, endMonth) => {
        const { data } = await supabase
            .from('monthly_budgets')
            .select('*')
            .eq('user_id', user.id)
            .gte('month', startMonth)
            .lte('month', endMonth);

        return data || [];
    };

    const copyMonthBudget = async (fromMonth, toMonth) => {
        // Get budgets from source month
        const { data: sourceBudgets } = await supabase
            .from('monthly_budgets')
            .select('*')
            .eq('user_id', user.id)
            .eq('month', fromMonth);

        if (sourceBudgets && sourceBudgets.length > 0) {
            // Copy to target month
            const newBudgets = sourceBudgets.map(b => ({
                user_id: user.id,
                category_id: b.category_id,
                month: toMonth,
                budget: b.budget
            }));

            await supabase
                .from('monthly_budgets')
                .upsert(newBudgets, {
                    onConflict: 'user_id,category_id,month'
                });
        }
    };

    const getMonthlySpending = async (categoryId, month) => {
        // Get first and last day of month
        const date = new Date(month);
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];

        const { data } = await supabase
            .from('transactions')
            .select('amount')
            .eq('user_id', user.id)
            .eq('category_id', categoryId)
            .gte('date', firstDay)
            .lte('date', lastDay);

        return data?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    };

    const value = {
        categories,
        transactions,
        settings,
        user,
        loading,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        deleteTransactions,
        updateCategoryBudget,
        addCategory,
        deleteCategory,
        getCategoryName,
        updateSettings,
        updateUser,
        clearData,
        formatCurrency,
        getMonthlyBudgets,
        setMonthlyBudget,
        copyMonthBudget,

        getMonthlySpending,
        getBudgetsForRange
    };

    return (
        <BudgetContext.Provider value={value}>
            {children}
        </BudgetContext.Provider>
    );
}

export function useBudget() {
    const context = useContext(BudgetContext);
    if (!context) {
        throw new Error('useBudget must be used within a BudgetProvider');
    }
    return context;
}
