# Monthly Budgets Migration

## Overview
This migration adds support for monthly budgets, allowing users to set custom budgets for specific months while maintaining default category budgets.

## Database Changes
The migration creates a new `monthly_budgets` table with:
- User and category references
- Month-specific budget values
- Row-level security policies
- Optimized indexes

## Running the Migration

### Option 1: Supabase Dashboard (Recommended)
1. Log into your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase-migration.sql`
4. Paste into the SQL editor
5. Click **Run**

### Option 2: Supabase CLI
```bash
# If you have Supabase CLI installed
supabase db reset
# Or apply migration manually
psql -h your-project.supabase.co -U postgres -d postgres -f supabase-migration.sql
```

## Features Added
- **Monthly Budget Management**: Set different budgets for each month
- **Default Budgets**: Fallback to category defaults when no monthly budget exists
- **Budget Copying**: Copy budgets from previous month or defaults
- **Month Navigation**: Navigate through months to plan future budgets
- **Visual Indicators**: See which budgets are custom vs. default

## Usage
1. Navigate to **Monthly Budgets** in the sidebar
2. Select a month using the navigation controls
3. Click on any budget amount to customize it for that month
4. Use "Copy from Default Budgets" to apply category defaults
5. Use "Copy from Previous Month" to duplicate last month's budgets

## Notes
- Monthly budgets are optional - categories use their default budget if no monthly override exists
- The current month is clearly indicated with a badge
- All budgets are per-category and per-month
- Changes are automatically saved to the database
