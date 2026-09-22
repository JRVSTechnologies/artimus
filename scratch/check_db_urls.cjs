require('dotenv').config({ path: '../.env' });
console.log("Supabase URL:", process.env.VITE_SUPABASE_URL);
console.log("Postgres URL:", process.env.POSTGRES_URL);
