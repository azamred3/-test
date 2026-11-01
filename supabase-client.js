// سحب مكتبة Supabase من الإنترنت
// (ملاحظة: لازم نضيف سطر السحب هذا في صفحات HTML لاحقاً)
const SUPABASE_URL = 'https://wxlzgjlsyltjbqaryliz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_o9GysQqd6PzMCtzJOx3EUQ_KUgR4Qlc';

// إنشاء الاتصال وجعله متاحاً لكل الصفحات
window.db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log("✅ تم توصيل السلك بقاعدة البيانات بنجاح!");