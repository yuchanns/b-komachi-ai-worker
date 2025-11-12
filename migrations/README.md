# Database Migrations

This directory contains database migration scripts for B-Komachi AI Worker.

## Overview

Migrations are used to update existing databases with new schema changes without losing data. Each migration file is safe to run multiple times using `IF NOT EXISTS` clauses.

## How to Apply Migrations

### For Existing Users

If you're upgrading from a previous version, apply migrations in order:

```bash
# Run migration to add user_interactions and user_preferences tables
wrangler d1 execute b-komachi-vocabulary --remote --file=migrations/001_add_user_interactions_and_preferences.sql
```

### For Fresh Installations

New installations should use the main schema file instead:

```bash
wrangler d1 execute b-komachi-vocabulary --remote --file=schema.sql
```

## Migration History

### 001_add_user_interactions_and_preferences.sql (2024-11-12)

**Added:**

- `user_interactions` table - Tracks daily first interactions for showing usage tips
- `user_preferences` table - Stores per-user AI backend preferences

**Features enabled:**

- Daily tips on first interaction
- Per-user AI model selection via `/model` command

## Notes

- All migrations use `IF NOT EXISTS` and are safe to run multiple times
- Migrations are idempotent and won't cause errors on re-execution
- Always backup your database before applying migrations to production
