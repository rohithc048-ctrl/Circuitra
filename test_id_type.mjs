// Test script to check column types and attempt an upsert
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hjmyihvxtbuijktskbzz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqbXlpaHZ4dGJ1aWprdHNrYnp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyODAzNTgsImV4cCI6MjEwNjg1NjM1OH0.ETYbJKIC7UgUkBgBDqV3NSt4QoFU2ByFq5R2eus97-M';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testProjectInsert() {
  console.log('Testing project lookup with string ID vs UUID...');
  
  // 1. Try selecting with 'proj-123'
  const { data: res1, error: err1 } = await supabase
    .from('projects')
    .select('id')
    .eq('id', 'proj-12345');
  console.log('Result for eq(id, "proj-12345"):', { error: err1?.message || null, details: err1?.details, code: err1?.code });

  // 2. Try selecting with valid UUID
  const { data: res2, error: err2 } = await supabase
    .from('projects')
    .select('id')
    .eq('id', '00000000-0000-0000-0000-000000000000');
  console.log('Result for eq(id, valid UUID):', { error: err2?.message || null, details: err2?.details, code: err2?.code });
}

testProjectInsert();
