import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase env vars. Check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Load signups for a single date key
export async function loadSignups(dateKey) {
  const { data, error } = await supabase
    .from('pizza_signups')
    .select('signups')
    .eq('date_key', dateKey)
    .single()
  if (error && error.code !== 'PGRST116') console.error(error)
  return data?.signups ?? []
}

// Load all signups at once
export async function loadAllSignups(dateKeys) {
  const { data, error } = await supabase
    .from('pizza_signups')
    .select('date_key, signups')
    .in('date_key', dateKeys)
  if (error) { console.error(error); return {} }
  return Object.fromEntries((data || []).map(r => [r.date_key, r.signups]))
}

// Save signups for a single date key (upsert)
export async function saveSignups(dateKey, signups) {
  const { error } = await supabase
    .from('pizza_signups')
    .upsert({ date_key: dateKey, signups }, { onConflict: 'date_key' })
  if (error) console.error(error)
}
