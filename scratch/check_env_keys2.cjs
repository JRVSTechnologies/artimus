require('dotenv').config({ path: '../.env' });
console.log(Object.keys(process.env).filter(k => k.includes('SUPABASE') || k.includes('POSTGRES') || k.includes('DATABASE') || k.includes('URL')));
