// Supabase 连接设置。
// 在 Supabase 后台 Project Settings → API 里复制 "Project URL" 和 "anon public" key 填到下面。
// 也可以用环境变量 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY（见 .env.example），环境变量优先。
// 两项都留空时，网站以“本机模式”运行：记录只存在当前浏览器里。
// anon key 本来就是给前端公开使用的，可以提交到 GitHub；不要把 service_role key 填在这里。

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://elgfbiyaagotyblpvmxi.supabase.co';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsZ2ZiaXlhYWdvdHlibHB2bXhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2MjM0OTUsImV4cCI6MjEwNzE5OTQ5NX0.UZmbKW5tyMhqZfMj6pYbiXVhOzepiMZxVH1E2w4jxsM';

// 存照片的 Storage bucket 名称，要和 schema.sql 里的一致
export const PHOTO_BUCKET = 'glass-photos';
