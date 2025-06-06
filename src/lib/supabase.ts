
import { createClient } from '@supabase/supabase-js';

// IMPORTANT:
// 1. Create a `.env.local` file in the root of your project (next to package.json).
// 2. Add your Supabase URL and Anon Key to this file:
//    NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
//    NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
//
// You can find these in your Supabase project settings: Project Settings > API.
//
// 3. ENABLE REALTIME FOR THE 'rooms' TABLE:
//    In your Supabase project dashboard:
//    - Go to Database -> Replication.
//    - Under "Source", find your schema (usually "public").
//    - Click on the number under "Publication" (e.g., "0 tables") for `supabase_realtime`.
//    - In the modal that appears, find the "rooms" table.
//    - Check the boxes for INSERT, UPDATE, DELETE for the "rooms" table.
//    - Save the changes. This step is CRUCIAL for realtime to work.
//
// 4. CONFIGURE ROW LEVEL SECURITY (RLS):
//    Ensure your Row Level Security (RLS) policies for the "rooms" table allow
//    the appropriate users (e.g., 'anon', 'authenticated') to perform SELECT operations
//    on the data they need to see in real-time. If RLS blocks reads, realtime updates
//    will not be received.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMessage = `
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
CRITICAL SUPABASE CONFIGURATION ERROR IN: src/lib/supabase.ts

Supabase URL or Anon Key is missing from .env.local.
Please ensure you have a '.env.local' file in your project root with:
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

Current values (from environment):
  - NEXT_PUBLIC_SUPABASE_URL: "${supabaseUrl || 'MISSING'}"
  - NEXT_PUBLIC_SUPABASE_ANON_KEY: "${supabaseAnonKey ? '********' : 'MISSING'}"

You can find these credentials in your Supabase project dashboard under Project Settings > API.
The application will NOT work until these are correctly set.
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
`;
  console.error(errorMessage);

  if (typeof window !== 'undefined') {
    const el = document.createElement('pre');
    el.textContent = "Supabase configuration is missing. Please check the console and your .env.local file.";
    el.style.color = 'red';
    el.style.padding = '20px';
    el.style.backgroundColor = 'white';
    el.style.border = '2px solid red';
    el.style.position = 'fixed';
    el.style.top = '10px';
    el.style.left = '10px';
    el.style.zIndex = '9999';
    document.body.prepend(el);
  }
  throw new Error("Supabase URL or Anon Key is not defined. Check .env.local and console for details.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
