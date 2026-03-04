-- Run this in Supabase SQL Editor if you get "Could not find the table 'public.loans' in the schema cache"
-- This tells the REST API to reload the database schema.

NOTIFY pgrst, 'reload schema';
