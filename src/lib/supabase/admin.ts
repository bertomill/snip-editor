import { createClient } from '@supabase/supabase-js'

// Admin client using service role key - bypasses RLS
// Only use this in secure server-side contexts after verifying admin access
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase admin credentials')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// Admin email whitelist
export const ADMIN_EMAILS = ['bertmill19@gmail.com', 'hello@bertomill.ca']

export function isAdminEmail(email: string | undefined | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase())
}
