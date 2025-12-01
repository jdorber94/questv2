import React from 'react';
import { Sidebar } from './Sidebar';

export function Layout({ children, activeTab, onTabChange }) {
    return (
        <div className="min-h-screen bg-background">
            <Sidebar activeTab={activeTab} onTabChange={onTabChange} />
            <main className="lg:ml-64 pt-14 pb-20 lg:pt-8 lg:pb-8 p-4 sm:p-6 lg:px-8">
                {children}
            </main>
        </div>
    );
}
