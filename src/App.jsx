import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Overview } from './components/Overview';
import { Transactions } from './components/Transactions';
import { Budget } from './components/Budget';
import { Balance } from './components/Balance';
import { Advisor } from './components/Advisor';
import { FinancialModeling } from './components/FinancialModeling';
import { Settings } from './components/Settings';
import { Profile } from './components/Profile';
import { Login } from './components/Login';
import { BudgetProvider } from './context/BudgetContext';
import { supabase } from './lib/supabase';

function App() {
    const [activeTab, setActiveTab] = useState('overview');
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
        });

        // Listen for auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    const renderContent = () => {
        switch (activeTab) {
            case 'overview':
                return <Overview />;
            case 'transactions':
                return <Transactions />;
            case 'budget':
                return <Budget />;
            case 'balance':
                return <Balance />;
            case 'modeling':
                return <FinancialModeling />;
            case 'advisor':
                return <Advisor />;
            case 'settings':
                return <Settings />;
            case 'profile':
                return <Profile />;
            default:
                return <Overview />;
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading...</p>
                </div>
            </div>
        );
    }

    if (!session) {
        return <Login />;
    }

    return (
        <BudgetProvider>
            <Layout activeTab={activeTab} onTabChange={setActiveTab}>
                {renderContent()}
            </Layout>
        </BudgetProvider>
    );
}

export default App;
