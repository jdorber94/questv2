import React, { useState, useEffect } from 'react';
import { useBudget } from '../context/BudgetContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserCircle, Save } from 'lucide-react';

export function Profile() {
    const { user, updateUser } = useBudget();
    const [formData, setFormData] = useState(user);
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        setFormData(user);
    }, [user]);

    const handleChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
        setIsDirty(true);
    };

    const handleSave = (e) => {
        e.preventDefault();
        updateUser(formData);
        setIsDirty(false);
    };

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Profile</h2>
                <p className="text-muted-foreground mt-1">Manage your personal information.</p>
            </div>

            <div className="grid gap-6 max-w-2xl">
                <Card>
                    <CardHeader>
                        <CardTitle>Personal Details</CardTitle>
                        <CardDescription>Update your profile information.</CardDescription>
                    </CardHeader>
                    <form onSubmit={handleSave}>
                        <CardContent className="space-y-6">
                            <div className="flex flex-col items-center sm:flex-row gap-6">
                                <Avatar className="h-24 w-24">
                                    <AvatarImage src={formData.avatar} />
                                    <AvatarFallback className="text-2xl bg-secondary">
                                        {formData.name.charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="space-y-2 flex-1 w-full">
                                    <Label htmlFor="avatar">Avatar URL</Label>
                                    <Input
                                        id="avatar"
                                        value={formData.avatar}
                                        onChange={handleChange}
                                        placeholder="https://example.com/avatar.jpg"
                                    />
                                    <p className="text-xs text-muted-foreground">Enter a URL for your profile picture.</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="name">Display Name</Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="Your Name"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email">Email Address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="you@example.com"
                                />
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-end border-t pt-6">
                            <Button type="submit" disabled={!isDirty} className="gap-2">
                                <Save size={16} />
                                Save Changes
                            </Button>
                        </CardFooter>
                    </form>
                </Card>
            </div>
        </div>
    );
}
