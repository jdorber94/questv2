import React, { useState } from 'react';
import { useBudget } from '../context/BudgetContext';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, FileText, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { categorizeWithLLM, isLLMInitialized } from '../lib/smartCategorization';

// Set up the worker to use local file
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

export function CSVImport() {
    const { addTransaction, categories, addCategory, settings } = useBudget();
    const [file, setFile] = useState(null);
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState(null);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile && (selectedFile.type === 'text/csv' || selectedFile.type === 'application/pdf')) {
            setFile(selectedFile);
            setResult(null);
        } else {
            setResult({ success: false, message: 'Please select a valid CSV or PDF file' });
        }
    };

    const parseCSV = (text) => {
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

        const transactions = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index];
            });
            transactions.push(row);
        }
        return transactions;
    };

    const parsePDF = async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();

            const items = textContent.items.sort((a, b) => {
                const yDiff = b.transform[5] - a.transform[5];
                if (Math.abs(yDiff) > 5) return yDiff;
                return a.transform[4] - b.transform[4];
            });

            let lastY = -1;
            let pageText = '';

            for (const item of items) {
                const y = item.transform[5];
                if (lastY !== -1 && Math.abs(y - lastY) > 8) {
                    pageText += '\n';
                } else if (lastY !== -1) {
                    pageText += ' ';
                }
                pageText += item.str;
                lastY = y;
            }

            fullText += pageText + '\n';
        }

        // Filter to only extract lines from UMSATZÜBERSICHT section
        const lines = fullText.split('\n').map(line => line.trim());
        let inTransactionSection = false;
        const transactionLines = [];

        for (const line of lines) {
            // Start extracting after UMSATZÜBERSICHT header
            if (line.includes('UMSATZÜBERSICHT') || line.includes('DATUM') && line.includes('TYP') && line.includes('BESCHREIBUNG')) {
                inTransactionSection = true;
                continue;
            }

            // Stop at section boundaries
            if (inTransactionSection && (
                line.includes('BARMITTELÜBERSICHT') ||
                line.includes('TRANSAKTIONSÜBERSICHT') ||
                line.includes('GELDMARKTFONDS') ||
                line.includes('Trade Republic Bank GmbH www.traderepublic.com') ||
                line.includes('Erstellt am')
            )) {
                inTransactionSection = false;
                continue;
            }

            // Collect transaction lines
            if (inTransactionSection && line) {
                transactionLines.push(line);
            }
        }

        // Rebuild fullText with only transaction lines
        fullText = transactionLines.join('\n');

        const monthMap = {
            'jan': '01', 'januar': '01', 'january': '01',
            'feb': '02', 'februar': '02', 'february': '02',
            'mär': '03', 'märz': '03', 'maerz': '03', 'mar': '03', 'march': '03',
            'apr': '04', 'april': '04',
            'mai': '05', 'may': '05',
            'jun': '06', 'juni': '06', 'june': '06',
            'jul': '07', 'juli': '07', 'july': '07',
            'aug': '08', 'august': '08',
            'sep': '09', 'sept': '09', 'september': '09',
            'okt': '10', 'oktober': '10', 'oct': '10', 'october': '10',
            'nov': '11', 'november': '11',
            'dez': '12', 'dezember': '12', 'dec': '12', 'december': '12'
        };

        const monthAlternatives = Object.keys(monthMap)
            .sort((a, b) => b.length - a.length)
            .map(token => token.replace('.', '\\.'));
        // Match dates in format: "01 Okt. 2025" or "01 Okt." with year at end of line
        const monthRegex = new RegExp(`(\\d{1,2})\\s+(${monthAlternatives.join('|')})\\.?(?:\\s+(\\d{4}))?`, 'i');
        const typeTokens = [
            'Kartentransaktion', 'Kartenzahlung', 'Card transaction', 'Card payment',
            'Handel', 'Trade', 'Überweisung', 'Transfer', 'Zinszahlung', 'Interest',
            'Erträge', 'Income', 'Prämie', 'Bonus', 'Belohnung', 'Reward',
            'Gebühren', 'Fee', 'Lastschrift', 'Direct debit', 'Einzahlung', 'Deposit',
            'Auszahlung', 'Withdrawal', 'Zahlungseingang', 'Zahlungsausgang'
        ];
        const typeRegex = new RegExp(`(${typeTokens.join('|')})`, 'i');
        const amountDetector = /-?\d{1,3}(?:[.,\s]\d{3})*[.,]\d{2}/;
        const amountExtractor = /(-?\d{1,3}(?:[.,\s]\d{3})*[.,]\d{2})(?:\s*(?:€|EUR))?/gi;
        const lines = transactionLines; // Use filtered lines
        const transactions = [];

        const normalizeToken = (token) => token
            .toLowerCase()
            .replace('.', '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            if (!line) continue;

            const dateMatch = line.match(monthRegex);
            if (!dateMatch) continue;

            const day = dateMatch[1].padStart(2, '0');
            const rawMonth = normalizeToken(dateMatch[2]);
            const month = monthMap[rawMonth];
            if (!month) continue;

            // Year might be in the date match or at the end of the line (e.g. "2025")
            let year = dateMatch[3];
            if (!year) {
                const yearAtEnd = line.match(/\b(20\d{2})\s*$/);
                if (yearAtEnd) {
                    year = yearAtEnd[1];
                }
            }
            if (!year) continue; // Skip if we couldn't find a year

            const isoDate = `${year}-${month}-${day}`;

            let combinedLine = line;
            let lookahead = i;
            while (!amountDetector.test(combinedLine) && lookahead + 1 < lines.length) {
                const nextLine = lines[lookahead + 1];
                if (!nextLine) break;
                combinedLine += ` ${nextLine}`;
                lookahead++;
            }
            i = lookahead;

            const normalizedLine = combinedLine.replace(/\s+/g, ' ');
            const typeMatch = normalizedLine.match(typeRegex);
            const transactionType = typeMatch ? typeMatch[1] : 'Transaction';

            const afterType = typeMatch
                ? normalizedLine.slice(normalizedLine.indexOf(transactionType) + transactionType.length)
                : normalizedLine;
            const firstAmountMatch = afterType.match(amountDetector);

            let description = firstAmountMatch
                ? afterType.slice(0, afterType.indexOf(firstAmountMatch[0]))
                : afterType;
            description = description.replace(/ZAHLUNGSEINGANG|ZAHLUNGSAUSGANG/gi, '').replace(/\s+/g, ' ').trim();
            if (!description) {
                description = transactionType;
            }

            const lowerLine = normalizedLine.toLowerCase();
            const incomeSignals = ['zins', 'interest', 'ertrag', 'income', 'prämie', 'bonus', 'belohnung', 'reward', 'einzahlung', 'incoming', 'zahlungseingang', 'gutschrift'];
            const isIncome = incomeSignals.some(token =>
                transactionType.toLowerCase().includes(token) || lowerLine.includes(token)
            );

            // Extract all amounts from the line
            const amountMatches = [...normalizedLine.matchAll(amountExtractor)];

            let amountString = null;
            // In Trade Republic format: line contains transaction amount(s) followed by running balance (SALDO)
            // Format 1: DATE TYPE DESCRIPTION AMOUNT SALDO (one amount column for both income/expense)
            // Format 2: DATE TYPE DESCRIPTION ZAHLUNGSEINGANG ZAHLUNGSAUSGANG SALDO (two amount columns)
            if (amountMatches.length >= 2) {
                // Multiple amounts: last one is always SALDO (balance), we want the transaction amount
                // If 2 amounts: [transaction, balance]
                // If 3 amounts: [income amount, expense amount, balance] - one will be empty/zero
                if (amountMatches.length === 2) {
                    // Simple case: [transaction amount, balance]
                    amountString = amountMatches[0][1];
                } else if (amountMatches.length >= 3) {
                    // Complex case: [income, expense, balance] or more
                    // Take the second-to-last non-zero amount (skip the balance)
                    const transactionAmounts = amountMatches.slice(0, -1); // Remove last (balance)
                    amountString = transactionAmounts[transactionAmounts.length - 1][1];
                }
            } else if (amountMatches.length === 1) {
                amountString = amountMatches[0][1];
            }

            if (!amountString) continue;

            let normalizedAmount = amountString
                .replace(/\s/g, '')
                .replace(/€/gi, '')
                .replace(/EUR/gi, '')
                .replace(/\./g, '')
                .replace(',', '.')
                .replace(/[^\d.-]/g, '');
            if (normalizedAmount.endsWith('-')) {
                normalizedAmount = `-${normalizedAmount.slice(0, -1)}`;
            }
            const amount = parseFloat(normalizedAmount);

            if (Number.isFinite(amount) && Math.abs(amount) > 0) {
                // For expenses (non-income), store as negative
                const finalAmount = isIncome ? amount : -Math.abs(amount);
                transactions.push({
                    Date: isoDate,
                    Description: description,
                    Amount: finalAmount.toString()
                });
            }
        }

        if (!transactions.length) {
            throw new Error('No transactions detected in this PDF. Please upload an official Trade Republic statement (monthly or quarterly).');
        }

        return transactions;
    };

    const inferDirection = (description = '', amountValue = 0) => {
        const desc = description.toLowerCase();
        const creditKeywords = [
            'verkauf', 'sale', 'gutschrift', 'zahlungseingang', 'einzahlung',
            'deposit', 'refund', 'erstattung', 'rückzahlung', 'incoming', 'bonus',
            'interest', 'zins', 'dividend'
        ];
        const debitKeywords = [
            'kauf', 'purchase', 'lastschrift', 'abbuchung', 'zahlungsausgang',
            'withdrawal', 'auszahlung', 'gebühr', 'fee', 'kartenzahlung', 'card payment'
        ];

        const hasCredit = creditKeywords.some(k => desc.includes(k));
        const hasDebit = debitKeywords.some(k => desc.includes(k));

        if (hasCredit && !hasDebit) return 'credit';
        if (hasDebit && !hasCredit) return 'debit';

        if (amountValue < 0) return 'credit';
        if (amountValue > 0) return 'debit';

        return null;
    };

    const mapToCategory = (description, forceIncome = false) => {
        const desc = description.toLowerCase();
        if (forceIncome) {
            const incomeCategory = categories.find(c => c.name.toLowerCase().includes('income'));
            if (incomeCategory) return incomeCategory.id;
        }
        // Map keywords to default category names
        const categoryKeywords = {
            'Income': [
                'salary', 'gehalt', 'lohn', 'payroll', 'wage',
                'dividend', 'interest', 'zinsen', 'zinszahlung',
                'erträge', 'prämie', 'belohnung', 'bonus',
                'refund', 'erstattung', 'rückerstattung',
                'einzahlung', 'deposit'
            ],
            'Housing': [
                'rent', 'miete', 'landlord', 'vermieter',
                'utilities', 'stadtwerke', 'water', 'wasser',
                'electricity', 'strom', 'gas', 'heating', 'heizung',
                'internet', 'vodafone', 'telekom', 'o2', '1&1'
            ],
            'Transportation': [
                'uber', 'lyft', 'taxi', 'bolt',
                'bvg', 'mvg', 'hvv', 'vbb', 'öpnv', 'nahverkehr',
                'deutsche bahn', 'db ', 'train', 'zug',
                'benzin', 'diesel', 'shell', 'aral', 'total',
                'parking', 'parkhaus', 'parkplatz'
            ],
            'Food & Dining': [
                'wolt', 'lieferando', 'uber eats', 'deliveroo',
                'mcdonalds', 'burger king', 'kfc', 'subway',
                'restaurant', 'cafe', 'coffee', 'starbucks', 'costa',
                'pizza', 'sushi', 'kebab', 'döner',
                'rewe', 'edeka', 'aldi', 'lidl', 'netto', 'penny',
                'kaufland', 'real', 'tegut', 'famila',
                'dm-drogerie', 'rossmann', 'müller',
                'bakery', 'bäckerei', 'metzgerei', 'butcher'
            ],
            'Shopping': [
                'amazon', 'ebay', 'zalando', 'about you',
                'h&m', 'zara', 'uniqlo', 'primark', 'tkmaxx',
                'media markt', 'saturn', 'conrad',
                'ikea', 'obi', 'bauhaus', 'hornbach',
                'clothing', 'kleidung', 'fashion'
            ],
            'Entertainment': [
                'netflix', 'prime video', 'disney+', 'hbo', 'sky',
                'spotify', 'apple music', 'youtube premium', 'deezer',
                'apple.com', 'google play', 'app store',
                'playtomic', 'padel', 'tennis', 'gym', 'fitness',
                'cinema', 'kino', 'theater', 'concert', 'konzert',
                'museum', 'club', 'bar', 'nightlife',
                'steam', 'playstation', 'xbox', 'nintendo',
                'claude.ai', 'openai', 'chatgpt', 'anthropic'
            ],
            'Healthcare': [
                'apotheke', 'pharmacy', 'doctor', 'arzt', 'dentist', 'zahnarzt',
                'hospital', 'krankenhaus', 'clinic', 'klinik',
                'insurance', 'versicherung', 'krankenkasse',
                'yoga'
            ],
            'Investments': [
                'trade republic', 'trading', 'handel', 'verkauf', 'kauf',
                'savings plan', 'sparplan', 'ishares', 'etf', 'stock', 'aktie',
                'vanguard', 'msci', 'sp500', 's&p 500',
                'crypto', 'bitcoin', 'binance', 'coinbase', 'kartentransaktion'
            ],
            'Fees': [
                'fee', 'charge', 'gebühr', 'gebühren',
                'service charge', 'atm', 'geldautomat',
                'commission', 'provision'
            ],
            'Transfers': [
                'überweisung', 'transfer', 'paypal', 'venmo',
                'sepa', 'wire transfer', 'geldüberweisung'
            ]
        };

        // Find matching category by keywords
        for (const [categoryName, keywords] of Object.entries(categoryKeywords)) {
            if (keywords.some(keyword => desc.includes(keyword))) {
                const category = categories.find(c =>
                    c.name.toLowerCase() === categoryName.toLowerCase() ||
                    c.name.toLowerCase().includes(categoryName.toLowerCase()) ||
                    categoryName.toLowerCase().includes(c.name.toLowerCase().split(' ')[0])
                );
                if (category) return category.id;
            }
        }

        // Default to "Other" category
        const otherCategory = categories.find(c => c.name.toLowerCase() === 'other');
        return otherCategory?.id || categories[0]?.id;
    };

    const handleImport = async () => {
        if (!file) return;

        setImporting(true);
        setResult(null);

        try {
            let csvData;

            if (file.type === 'application/pdf') {
                csvData = await parsePDF(file);
            } else {
                const text = await file.text();
                csvData = parseCSV(text);
            }

            if (!csvData || csvData.length === 0) {
                throw new Error('No transactions were detected in this file. Double-check the statement format and try again.');
            }

            let imported = 0;
            let skipped = 0;

            for (const row of csvData) {
                const date = row['Date'] || row['Datum'] || row['date'];
            const description = row['Description'] || row['Beschreibung'] || row['description'];
            const amount = row['Amount'] || row['Betrag'] || row['amount'];

            if (date && amount) {
                const parsedAmount = parseFloat(amount.toString().replace(/[^0-9.-]/g, ''));

                if (Number.isFinite(parsedAmount) && parsedAmount !== 0) {
                    const direction = inferDirection(description || '', parsedAmount) || 'debit';
                    const normalizedAmount = Math.abs(parsedAmount);
                    let categoryId;

                    // Use AI if enabled and initialized
                    if (settings.smartCategorization && isLLMInitialized()) {
                        try {
                                categoryId = await categorizeWithLLM(description || '', categories);
                            } catch (error) {
                                console.error('LLM categorization failed, falling back to keyword matching:', error);
                            }
                        }

                        // Fallback to keyword matching if AI didn't return a result
                        if (!categoryId) {
                            categoryId = mapToCategory(description || '', direction === 'credit');
                        }

                        await addTransaction({
                            date: date,
                            amount: normalizedAmount,
                            categoryId: categoryId,
                            note: `Imported${direction === 'credit' ? ' (income)' : ''}: ${description || 'Trade Republic transaction'}`
                        });
                        imported++;
                    } else {
                        skipped++;
                    }
                } else {
                    skipped++;
                }
            }

            setResult({
                success: true,
                message: `Successfully imported ${imported} transaction(s). ${skipped > 0 ? `Skipped ${skipped} invalid entries.` : ''}`
            });
            setFile(null);
        } catch (error) {
            setResult({
                success: false,
                message: `Error importing file: ${error.message}`
            });
        } finally {
            setImporting(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Upload size={20} />
                    Import from CSV or PDF
                </CardTitle>
                <CardDescription>
                    Upload a CSV or PDF file from Trade Republic to import transactions automatically.
                    {settings.smartCategorization && isLLMInitialized() && (
                        <span className="flex items-center gap-1 mt-1 text-primary">
                            <Sparkles size={14} /> Smart categorization enabled
                        </span>
                    )}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="csv-file">Select File</Label>
                    <div className="flex gap-2">
                        <Input
                            id="csv-file"
                            type="file"
                            accept=".csv,.pdf"
                            onChange={handleFileChange}
                            disabled={importing}
                        />
                        <Button
                            onClick={handleImport}
                            disabled={!file || importing}
                            className="gap-2 whitespace-nowrap"
                        >
                            {importing ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                                    Importing...
                                </>
                            ) : (
                                <>
                                    <Upload size={16} />
                                    Import
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                {file && !result && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileText size={16} />
                        <span>{file.name}</span>
                    </div>
                )}

                {result && (
                    <div
                        className={`flex items-start gap-2 p-3 rounded-md ${result.success
                            ? 'bg-primary/10 text-primary'
                            : 'bg-destructive/10 text-destructive'
                            }`}
                    >
                        {result.success ? (
                            <CheckCircle2 size={20} className="mt-0.5 flex-shrink-0" />
                        ) : (
                            <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />
                        )}
                        <p className="text-sm">{result.message}</p>
                    </div>
                )}

                <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                    <p className="font-medium">Supported formats:</p>
                    <p>• <strong>PDF</strong>: Trade Republic account statements (monthly, 3-month, 6-month)</p>
                    <p>• <strong>CSV</strong>: Headers: Date, Description, Amount (or German equivalents)</p>
                    <p>• Transactions will be auto-categorized based on description keywords</p>
                </div>
            </CardContent>
        </Card>
    );
}
