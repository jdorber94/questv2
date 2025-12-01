import React, { useState } from 'react';
import { useBudget } from '../context/BudgetContext';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Trash2, Moon, Sun, Globe, LogOut, Sparkles } from 'lucide-react';
import { initializeSmartCategorization, isLLMInitialized } from '../lib/smartCategorization';

export function Settings() {
    const { settings, updateSettings, clearData } = useBudget();
    const [llmLoading, setLlmLoading] = useState(false);
    const [llmProgress, setLlmProgress] = useState('');

    // Detect if user is on mobile
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.reload();
    };

    const handleSmartCategorizationToggle = async (checked) => {
        if (checked && !isLLMInitialized()) {
            setLlmLoading(true);
            try {
                await initializeSmartCategorization((progress) => {
                    setLlmProgress(`${progress.text || 'Loading...'} ${Math.round(progress.progress * 100)}%`);
                });
                updateSettings({ smartCategorization: true });
            } catch (error) {
                console.error('Failed to initialize smart categorization:', error);
                alert('Failed to enable smart categorization. Please try again.');
            } finally {
                setLlmLoading(false);
                setLlmProgress('');
            }
        } else {
            updateSettings({ smartCategorization: checked });
        }
    };

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
                <p className="text-muted-foreground mt-1">Manage your application preferences.</p>
            </div>

            <div className="grid gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Appearance</CardTitle>
                        <CardDescription>Customize how the application looks.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-secondary rounded-full">
                                    {settings.theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
                                </div>
                                <div className="space-y-0.5">
                                    <Label className="text-base">Dark Mode</Label>
                                    <p className="text-sm text-muted-foreground">Switch between light and dark themes.</p>
                                </div>
                            </div>
                            <Switch
                                checked={settings.theme === 'dark'}
                                onCheckedChange={(checked) => updateSettings({ theme: checked ? 'dark' : 'light' })}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Preferences</CardTitle>
                        <CardDescription>Manage your regional settings.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-secondary rounded-full">
                                    <Globe size={20} />
                                </div>
                                <div className="space-y-0.5">
                                    <Label className="text-base">Currency</Label>
                                    <p className="text-sm text-muted-foreground">Select your preferred currency for display.</p>
                                </div>
                            </div>
                            <div className="w-[180px]">
                                <Select
                                    value={settings.currency}
                                    onValueChange={(value) => updateSettings({ currency: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select currency" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="USD">USD ($)</SelectItem>
                                        <SelectItem value="EUR">EUR (€)</SelectItem>
                                        <SelectItem value="GBP">GBP (£)</SelectItem>
                                        <SelectItem value="JPY">JPY (¥)</SelectItem>
                                        <SelectItem value="CAD">CAD ($)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>AI Features</CardTitle>
                        <CardDescription>Enable intelligent categorization powered by local AI.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-secondary rounded-full">
                                    <Sparkles size={20} />
                                </div>
                                <div className="space-y-0.5">
                                    <Label className="text-base">Smart Categorization</Label>
                                    {isMobile ? (
                                        <p className="text-sm text-muted-foreground">
                                            AI categorization is only available on desktop devices due to the large model size (1.5GB).
                                            Use keyword-based categorization on mobile.
                                        </p>
                                    ) : (
                                        <>
                                            <p className="text-sm text-muted-foreground">
                                                Use AI to intelligently categorize transactions. Runs locally in your browser (~1.5GB download).
                                            </p>
                                            {llmLoading && <p className="text-xs text-muted-foreground mt-1">{llmProgress}</p>}
                                        </>
                                    )}
                                </div>
                            </div>
                            <Switch
                                checked={settings.smartCategorization || false}
                                onCheckedChange={handleSmartCategorizationToggle}
                                disabled={llmLoading || isMobile}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-destructive/50">
                    <CardHeader>
                        <CardTitle className="text-destructive">Danger Zone</CardTitle>
                        <CardDescription>Irreversible actions.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base">Clear All Data</Label>
                                <p className="text-sm text-muted-foreground">Delete all categories, transactions, and settings.</p>
                            </div>
                            <Button variant="destructive" onClick={clearData} className="gap-2">
                                <Trash2 size={16} />
                                Clear Data
                            </Button>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base">Sign Out</Label>
                                <p className="text-sm text-muted-foreground">Log out of your account.</p>
                            </div>
                            <Button variant="outline" onClick={handleLogout} className="gap-2">
                                <LogOut size={16} />
                                Sign Out
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
