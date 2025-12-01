-- Monthly Budgets Table
-- This allows users to set custom budgets for specific months
-- If no monthly budget exists, the default category budget is used

CREATE TABLE IF NOT EXISTS monthly_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    month DATE NOT NULL, -- Store as first day of month (e.g., 2025-01-01)
    budget NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, category_id, month)
);

-- Enable RLS
ALTER TABLE monthly_budgets ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own monthly budgets"
    ON monthly_budgets FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own monthly budgets"
    ON monthly_budgets FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own monthly budgets"
    ON monthly_budgets FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own monthly budgets"
    ON monthly_budgets FOR DELETE
    USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_monthly_budgets_user_month
    ON monthly_budgets(user_id, month);

CREATE INDEX IF NOT EXISTS idx_monthly_budgets_category
    ON monthly_budgets(category_id);
