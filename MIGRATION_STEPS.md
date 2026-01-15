# Firebase to Supabase Migration Steps

## Prerequisites
1. **Setup Supabase Project**
   - Create account at supabase.com
   - Create new project
   - Get Project URL and Service Role Key (not anon key)

2. **Setup Firebase Admin**
   - Go to Firebase Console → Project Settings → Service Accounts
   - Generate new private key
   - Save as `firebase-service-account.json`

## Migration Steps

### 1. Install Migration Dependencies
```bash
cd managify
npm install firebase-admin @supabase/supabase-js
```

### 2. Setup Database Schema
- Go to Supabase Dashboard → SQL Editor
- Run the SQL from `supabase_schema.sql`

### 3. Configure Migration Script
Edit `migrate_firebase_to_supabase.js`:
- Replace `YOUR_SUPABASE_URL` with your project URL
- Replace `YOUR_SUPABASE_SERVICE_ROLE_KEY` with service role key
- Replace `DEFAULT_USER_ID` with actual user ID from Firebase Auth

### 4. Run Migration
```bash
node migrate_firebase_to_supabase.js
```

### 5. Verify Data
Check Supabase Dashboard → Table Editor to verify data migration

### 6. Update Application
- Update `src/supabase.ts` with your credentials
- Install Supabase in main app: `npm install @supabase/supabase-js`
- Remove Firebase: `npm uninstall firebase`

## Important Notes
- **Backup your Firebase data first**
- **Test migration with small dataset**
- **User IDs**: Make sure to map Firebase user IDs correctly
- **Foreign Keys**: Items must be migrated before purchases/sales
- **RLS Policies**: Ensure user_id matches authenticated user

## Troubleshooting
- If foreign key errors: Check item_id references exist
- If RLS errors: Verify user_id is correct
- If duplicate errors: Clear Supabase tables and re-run