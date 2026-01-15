import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://eooulfvbllitlhjzilit.supabase.co'
const supabaseKey = 'sb_publishable_cUcSuXC2J7EHU3EyULkSwQ__BApX1s5'

export const supabase = createClient(supabaseUrl, supabaseKey)

// Auth helpers
export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export const signIn = async (email: string, password: string) => {
  return await supabase.auth.signInWithPassword({ email, password })
}

export const signUp = async (email: string, password: string) => {
  return await supabase.auth.signUp({ email, password })
}

export const signOut = async () => {
  return await supabase.auth.signOut()
}