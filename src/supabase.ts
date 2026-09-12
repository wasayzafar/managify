import { createClient } from '@supabase/supabase-js'
import { auth } from './firebase'

const supabaseUrl = 'https://eooulfvbllitlhjzilit.supabase.co'
const supabaseKey = 'sb_publishable_cUcSuXC2J7EHU3EyULkSwQ__BApX1s5'

// Every request carries the signed-in Firebase user's ID token as its bearer
// token (Supabase "Third-Party Auth"), so RLS policies can trust
// auth.jwt()->>'sub' as a server-verified Firebase UID instead of a
// client-supplied, spoofable user_id column. When there's no signed-in user
// (or the token fetch fails), returning null falls back to the anon
// publishable key, which is what public tables like `announcements` still
// rely on.
export const supabase = createClient(supabaseUrl, supabaseKey, {
  accessToken: async () => {
    try {
      return (await auth.currentUser?.getIdToken()) ?? null
    } catch {
      return null
    }
  },
})