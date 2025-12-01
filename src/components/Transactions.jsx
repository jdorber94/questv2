import React, { useState } from 'react';
import { useBudget } from '../context/BudgetContext';
import { CSVImport } from './CSVImport';
import { Plus, Search, Filter, Trash2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

export function Transactions() {
    const { transactions, categories, addTransaction, updateTransaction, deleteTransaction, deleteTransactions, getCategoryName } = useBudget();
    const [isAdding, setIsAdding] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState(null);
    const [selectedTransactions, setSelectedTransactions] = useState(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');

    // Form State
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [amount, setAmount] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [note, setNote] = useState('');

    const handleEdit = (transaction) => {
        setEditingTransaction(transaction);
        setDate(transaction.date);
        setAmount(transaction.amount.toString());
        setCategoryId(transaction.category_id);
        setNote(transaction.note || '');
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (amount && categoryId) {
            if (editingTransaction) {
                updateTransaction(editingTransaction.id, { date, amount, categoryId, note });
                setEditingTransaction(null);
            } else {
                addTransaction({ date, amount, categoryId, note });
            }
            resetForm();
        }
    };

    const resetForm = () => {
        setAmount('');
        setNote('');
        setCategoryId('');
        setDate(new Date().toISOString().split('T')[0]);
        setIsAdding(false);
        setEditingTransaction(null);
    };

    const toggleSelectAll = () => {
        if (selectedTransactions.size === filteredTransactions.length) {
            setSelectedTransactions(new Set());
        } else {
            setSelectedTransactions(new Set(filteredTransactions.map(t => t.id)));
        }
    };

    const toggleSelectTransaction = (id) => {
        const newSelected = new Set(selectedTransactions);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedTransactions(newSelected);
    };

    const handleBulkDelete = async () => {
        if (selectedTransactions.size === 0) return;

        if (window.confirm(`Are you sure you want to delete ${selectedTransactions.size} transaction(s)?`)) {
            await deleteTransactions(Array.from(selectedTransactions));
            setSelectedTransactions(new Set());
        }
    };

    // Filter transactions
    const filteredTransactions = transactions.filter(t => {
        const matchesSearch = searchQuery === '' ||
            t.note?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            getCategoryName(t.category_id).toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.date.includes(searchQuery);

        const matchesCategory = filterCategory === 'all' || t.category_id === filterCategory;

        return matchesSearch && matchesCategory;
    });

    return (
        <div className="space-y-8">
            {/* CSV Import Section */}
            <CSVImport />

            <Card>
                <CardHeader className="space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="relative flex-1 max-w-sm w-full">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search transactions..."
                                className="pl-8"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            {selectedTransactions.size > 0 && (
                                <Button
                                    variant="destructive"
                                    className="gap-2"
                                    onClick={handleBulkDelete}
                                >
                                    <Trash2 size={16} />
                                    Delete {selectedTransactions.size}
                                </Button>
                            )}
                            <Select value={filterCategory} onValueChange={setFilterCategory}>
                                <SelectTrigger className="w-[180px]">
                                    <Filter size={16} className="mr-2" />
                                    <SelectValue placeholder="All Categories" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Categories</SelectItem>
                                    {categories.map(cat => (
                                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Dialog open={isAdding || editingTransaction !== null} onOpenChange={(open) => {
                                if (!open) resetForm();
                                else setIsAdding(true);
                            }}>
                                <DialogTrigger asChild>
                                    <Button className="gap-2">
                                        <Plus size={18} />
                                        Add Transaction
                                    </Button>
                                </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>{editingTransaction ? 'Edit Transaction' : 'Add Transaction'}</DialogTitle>
                            <DialogDescription>
                                {editingTransaction ? 'Update transaction details.' : 'Log a new expense. Click save when you\'re done.'}
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="date">Date</Label>
                                    <Input
                                        id="date"
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="amount">Amount</Label>
                                    <Input
                                        id="amount"
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder="0.00"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="category">Category</Label>
                                <Select value={categoryId} onValueChange={setCategoryId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categories.map(cat => (
                                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="note">Note (optional)</Label>
                                <Input
                                    id="note"
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    placeholder="What was this for?"
                                />
                            </div>

                            <DialogFooter>
                                <Button type="submit">{editingTransaction ? 'Update' : 'Save'} Transaction</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]">
                                    <Checkbox
                                        checked={filteredTransactions.length > 0 && selectedTransactions.size === filteredTransactions.length}
                                        onCheckedChange={toggleSelectAll}
                                    />
                                </TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Note</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="w-[100px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredTransactions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                        {searchQuery || filterCategory !== 'all'
                                            ? 'No transactions match your filters.'
                                            : 'No transactions yet. Add one to get started!'}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredTransactions.map((t) => (
                                    <TableRow key={t.id}>
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedTransactions.has(t.id)}
                                                onCheckedChange={() => toggleSelectTransaction(t.id)}
                                            />
                                        </TableCell>
                                        <TableCell className="font-medium">{t.date}</TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className="font-normal">
                                                {getCategoryName(t.category_id)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">{t.note || '-'}</TableCell>
                                        <TableCell className="text-right font-medium">
                                            ${Number(t.amount).toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleEdit(t)}
                                                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                >
                                                    <Pencil size={16} />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => deleteTransaction(t.id)}
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                >
                                                    <Trash2 size={16} />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
