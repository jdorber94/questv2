import React, { useState, useRef, useEffect } from 'react';
import { useBudget } from '../context/BudgetContext';
import { aggregateFinancialData } from '../lib/dataAggregator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Bot, User, Loader2, AlertCircle } from 'lucide-react';

const resolveAdvisorUrl = () => {
    const fallback = '/api/advisor';
    const rawUrl = (import.meta.env.VITE_ADVISOR_API_URL || '').trim();

    // Ignore placeholder values that break fetch URL parsing
    if (!rawUrl || rawUrl.includes('<your') || rawUrl.includes('your-domain.com')) {
        return fallback;
    }

    const cleaned = rawUrl.replace(/\/$/, '');
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';

    try {
        // Validate the URL without changing relative paths
        new URL(cleaned, origin);
        return cleaned;
    } catch {
        console.warn(`[Advisor] Invalid VITE_ADVISOR_API_URL "${rawUrl}", falling back to ${fallback}`);
        return fallback;
    }
};

const ADVISOR_API_URL = resolveAdvisorUrl();

export function Advisor() {
    const { categories, transactions, settings, user } = useBudget();
    const [messages, setMessages] = useState([
        { role: 'assistant', content: "Hello! I'm your AI financial advisor. I've analyzed your budget and spending habits. How can I help you today?" }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [advisorStatus, setAdvisorStatus] = useState({ ok: true, message: '' });
    const [checkingHealth, setCheckingHealth] = useState(false);
    const scrollAreaRef = useRef(null);
    const advisorHealthUrl = `${ADVISOR_API_URL.replace(/\/$/, '')}/health`;

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollAreaRef.current) {
            const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
    }, [messages]);

    const checkAdvisorHealth = async () => {
        setCheckingHealth(true);
        try {
            const res = await fetch(advisorHealthUrl, { method: 'GET' });
            if (!res.ok) {
                throw new Error(`Health check failed (${res.status})`);
            }
            setAdvisorStatus({ ok: true, message: '' });
        } catch (error) {
            setAdvisorStatus({
                ok: false,
                message: 'Unable to reach the AI advisor server. Start it locally with `npm run dev:advisor` or point VITE_ADVISOR_API_URL at a reachable instance.',
            });
            console.error('[Advisor] Health check failed', error);
        } finally {
            setCheckingHealth(false);
        }
    };

    useEffect(() => {
        checkAdvisorHealth();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMessage = input;
        const previousMessages = [...messages];
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsLoading(true);

        try {
            // Prepare context
            const contextData = aggregateFinancialData(categories, transactions, settings);

            const response = await fetch(ADVISOR_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    history: previousMessages,
                    userMessage,
                    contextData,
                }),
            });

            const contentType = response.headers.get('content-type') || '';
            const rawBody = await response.text();
            let result = null;

            if (rawBody) {
                if (contentType.includes('application/json')) {
                    try {
                        result = JSON.parse(rawBody);
                    } catch {
                        // Fall through to fallback parsing
                    }
                }

                if (!result) {
                    try {
                        result = JSON.parse(rawBody);
                    } catch {
                        result = { error: rawBody };
                    }
                }
            }

            if (!response.ok) {
                const errorMessage = typeof result === 'object'
                    ? result?.error || result?.message
                    : rawBody;
                throw new Error(errorMessage || `AI advisor request failed (${response.status}).`);
            }

            const assistantReply = result?.text?.trim();

            setMessages(prev => [
                ...prev,
                {
                    role: 'assistant',
                    content: assistantReply || "I couldn't generate a response. Please try again.",
                },
            ]);
        } catch (error) {
            console.error("Chat error:", error);
            const errorMsg = error.message?.includes('API') || error.message?.includes('key') || error.message?.includes('401')
                ? "Please check that the advisor server is running and the Groq API key is set on the backend."
                : `Sorry, I encountered an error: ${error.message}`;
            setMessages(prev => [...prev, { role: 'assistant', content: errorMsg }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="h-[calc(100vh-2rem)] flex flex-col gap-4">
            <div>
                <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                    <Bot className="text-primary" />
                    AI Advisor
                </h2>
                <p className="text-muted-foreground mt-1">
                    Ask questions about your spending, budget, and financial health.
                </p>
            </div>

            {!advisorStatus.ok && (
                <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm">
                    <AlertCircle className="text-destructive mt-0.5" size={16} />
                    <div className="space-y-2">
                        <div className="font-medium text-destructive">Advisor server unreachable</div>
                        <div className="text-muted-foreground">{advisorStatus.message}</div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={checkAdvisorHealth}
                                disabled={checkingHealth || isLoading}
                            >
                                {checkingHealth ? 'Checking...' : 'Retry health check'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <Card className="flex-1 flex flex-col overflow-hidden">
                <CardHeader className="border-b py-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Bot size={18} />
                        Financial Advisor
                    </CardTitle>
                </CardHeader>

                <CardContent className="flex-1 p-0 flex flex-col overflow-hidden">
                    <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
                        <div className="space-y-4">
                            {messages.map((msg, index) => (
                                <div
                                    key={index}
                                    className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    {msg.role === 'assistant' && (
                                        <Avatar className="h-8 w-8 border">
                                            <AvatarFallback className="bg-primary/10 text-primary"><Bot size={16} /></AvatarFallback>
                                        </Avatar>
                                    )}

                                    <div
                                        className={`rounded-lg px-4 py-2 max-w-[80%] text-sm ${msg.role === 'user'
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted'
                                            }`}
                                    >
                                        <div className="whitespace-pre-wrap">{msg.content}</div>
                                    </div>

                                    {msg.role === 'user' && (
                                        <Avatar className="h-8 w-8 border">
                                            <AvatarImage src={user?.avatar} />
                                            <AvatarFallback className="bg-secondary text-secondary-foreground">
                                                <User size={16} />
                                            </AvatarFallback>
                                        </Avatar>
                                    )}
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex gap-3 justify-start">
                                    <Avatar className="h-8 w-8 border">
                                        <AvatarFallback className="bg-primary/10 text-primary"><Bot size={16} /></AvatarFallback>
                                    </Avatar>
                                    <div className="bg-muted rounded-lg px-4 py-2 flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                        <span className="text-xs text-muted-foreground">Thinking...</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollArea>

                    <div className="p-4 border-t bg-background">
                        <div className="flex gap-2">
                            <Input
                                placeholder="Ask about your budget..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={isLoading}
                                className="flex-1"
                            />
                            <Button
                                onClick={handleSend}
                                disabled={isLoading || !input.trim()}
                                size="icon"
                            >
                                <Send size={18} />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
