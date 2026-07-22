-- Run this in the Supabase SQL Editor to migrate the user_role enum
-- It renames the existing enum values without dropping columns or data

-- 1. Rename 'admin' to 'super-admin'
ALTER TYPE user_role RENAME VALUE 'admin' TO 'super-admin';

-- 2. Rename 'lead' to 'admin'
ALTER TYPE user_role RENAME VALUE 'lead' TO 'admin';

-- NOTE: If you get an error saying you cannot rename enum values in a transaction,
-- make sure to execute these statements outside of a transaction block or 
-- individually if the editor wraps them in a transaction by default.
