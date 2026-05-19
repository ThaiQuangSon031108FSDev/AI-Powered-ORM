import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
// We use the service role key for backend API routes to bypass RLS easily for this MVP
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''; 

export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;
