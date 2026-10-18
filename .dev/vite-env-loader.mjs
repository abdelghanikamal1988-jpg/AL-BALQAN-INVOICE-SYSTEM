/**
 * Node loader that stubs Vite's `import.meta.env` so src modules that
 * touch it (company.js, supabase.js, AuthContext.jsx) can be imported
 * under `node --test`. Vite itself never sees this file.
 *
 * Register it with:
 *   node --import ./.dev/vite-env-register.mjs --test .dev/unit_tests.mjs
 */

const STUB = '({BASE_URL:"/",MODE:"test",DEV:false,PROD:true,VITE_SUPABASE_URL:"",VITE_SUPABASE_ANON_KEY:""})';

export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context);
  if (result && result.source && url.startsWith('file:') && url.includes('/src/')) {
    const src =
      typeof result.source === 'string' ? result.source : Buffer.from(result.source).toString('utf8');
    if (src.includes('import.meta.env')) {
      return { ...result, source: src.replace(/import\.meta\.env/g, STUB) };
    }
  }
  return result;
}
