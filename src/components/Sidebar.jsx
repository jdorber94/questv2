
import React, { useState } from 'react';
import { LayoutDashboard, List, Wallet, BarChart3, Settings, Menu, X, User, Bot, Sparkles, LineChart } from 'lucide-react';
import { cn } from '../lib/utils';
import { useBudget } from '../context/BudgetContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'transactions', label: 'Transactions', icon: List },
    { id: 'budget', label: 'Budget', icon: Wallet },
    { id: 'balance', label: 'Balance', icon: BarChart3 },
    { id: 'modeling', label: 'Modeling', icon: LineChart },
    { id: 'advisor', label: 'AI Advisor', icon: Bot },
];

export function Sidebar({ activeTab, onTabChange }) {
    const { user } = useBudget();

    const handleTabChange = (tabId) => {
        onTabChange(tabId);
    };

    return (
        <>
            {/* Desktop Sidebar */}
            <div className="hidden lg:flex fixed top-0 left-0 h-screen bg-card border-r border-border flex-col p-6 w-64 z-40">
                <div className="mb-10 px-2">
                    <h1 className="text-xl font-bold text-foreground">NestGuard</h1>
                </div>

                <nav className="flex-1 space-y-2">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => handleTabChange(item.id)}
                                className={cn(
                                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                                    isActive
                                        ? "bg-secondary text-foreground"
                                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                                )}
                            >
                                <Icon size={20} />
                                {item.label}
                            </button>
                        );
                    })}
                </nav>

                <div className="mt-auto space-y-2 pt-6 border-t border-border">
                    <button
                        onClick={() => handleTabChange('settings')}
                        className={cn(
                            "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                            activeTab === 'settings'
                                ? "bg-secondary text-foreground"
                                : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                        )}
                    >
                        <Settings size={20} />
                        Settings
                    </button>
                    <button
                        onClick={() => handleTabChange('profile')}
                        className={cn(
                            "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors text-left",
                            activeTab === 'profile'
                                ? "bg-secondary text-foreground"
                                : "hover:bg-secondary/50"
                        )}
                    >
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={user.avatar} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {user.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium truncate">{user.name}</span>
                    </button>
                </div>
            </div>

            {/* Mobile Top Header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-card border-b border-border flex items-center justify-center px-4 z-50">
                <h1 className="text-lg font-bold text-foreground">NestGuard</h1>
            </div>

            {/* Mobile Bottom Navigation */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border flex items-center justify-around px-1 z-50">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => handleTabChange(item.id)}
                            className={cn(
                                "flex flex-col items-center justify-center gap-0.5 py-1 rounded-lg transition-colors flex-1",
                                isActive
                                    ? "text-primary"
                                    : "text-muted-foreground"
                            )}
                        >
                            <Icon size={18} />
                            <span className="text-[9px] font-medium">{item.label}</span>
                        </button>
                    );
                })}
                <button
                    onClick={() => handleTabChange('settings')}
                    className={cn(
                        "flex flex-col items-center justify-center gap-0.5 py-1 rounded-lg transition-colors flex-1",
                        activeTab === 'settings'
                            ? "text-primary"
                            : "text-muted-foreground"
                    )}
                >
                    <Settings size={18} />
                    <span className="text-[9px] font-medium">Settings</span>
                </button>
            </div>
        </>
    );
}
