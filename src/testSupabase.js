// testSupabase.js
import { createClient } from "@supabase/supabase-js";
;

// Replace these with your own Supabase project URL and anon key
const SUPABASE_URL = "https://oqfuhgbfmthadczhvmkc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9xZnVoZ2JmbXRoYWRjemh2bWtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxMTkzMTEsImV4cCI6MjA3MTY5NTMxMX0.cxVvLcUxGsnaUmkUCXHfZbvtUycgtq-xiWzNjLJFmwY";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testConnection() {
  try {
    const { data, error } = await supabase
      .from("students")
      .select("*")
      .limit(1);

    if (error) {
      console.error("Supabase connection error:", error.message);
    } else {
      console.log("Supabase connection successful!");
      console.log("Sample data from students table:", data);
    }
  } catch (err) {
    console.error("Unexpected error:", err);
  }
}

testConnection();
