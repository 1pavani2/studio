
import { createClient } from '@supabase/supabase-js';

// IMPORTANT:
// 1. Create a `.env.local` file in the root of your project (next to package.json).
// 2. Add your Supabase URL and Anon Key to this file:
//    NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
//    NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
//
// You can find these in your Supabase project settings: Project Settings > API.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMessage = `
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
CRITICAL SUPABASE CONFIGURATION ERROR IN: src/lib/supabase.ts

Supabase URL or Anon Key is missing. 
Please ensure you have a '.env.local' file in your project root with:
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

Current values:
  - NEXT_PUBLIC_SUPABASE_URL: "${supabaseUrl}"
  - NEXT_PUBLIC_SUPABASE_ANON_KEY: "${supabaseAnonKey ? '********' : 'MISSING'}"

You can find these credentials in your Supabase project dashboard under Project Settings > API.
The application will NOT work until these are correctly set.
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
`;
  console.error(errorMessage);
  if (typeof window !== 'undefined') {
    // Display a more user-friendly error in the browser if possible
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
  // This error will stop the app from trying to initialize Supabase with incorrect details.
  throw new Error("Supabase URL or Anon Key is not defined. Check .env.local and console for details.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
