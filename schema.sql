-- 鸟撞玻璃点位记录：在 Supabase 后台 SQL Editor 里整段粘贴并运行一次

-- 1. 记录表：每行一个同质玻璃风险单元，列与《批量记录》表对应
create table if not exists public.records (
  id           uuid primary key default gen_random_uuid(),
  point_id     text not null,               -- 点位ID
  building     text not null,               -- 建筑
  facade       text default '',             -- 立面/特征
  orientation  text default '',             -- 朝向
  observed_at  text default '',             -- 日期时间（现场时间，YYYY-MM-DDTHH:mm）
  weather      text default '',
  light        text default '',
  observer     text default '',
  obs_type     text default '',
  a smallint check (a between 0 and 3),     -- A 玻璃量
  b smallint check (b between 0 and 3),     -- B 错觉
  c smallint check (c between 0 and 3),     -- C 几何/曲面
  d smallint check (d between 0 and 3),     -- D 鸟类暴露
  k smallint check (k between 0 and 1),     -- 完整有效防护
  n smallint check (n between 0 and 3),     -- 夜间N，空 = 未观察
  m smallint check (m between 0 and 2),     -- 碰撞证据
  f smallint check (f between 0 and 2),     -- 飞穿红旗
  risk_index   smallint,                    -- 快速筛查指数（网页计算后写入）
  risk_level   text,                        -- 风险等级
  advice       text,                        -- 建议/复核
  confidence   text default '中',
  photo_no     text default '',
  notes        text default '',
  photos       jsonb not null default '[]', -- [{path, kind}]，path 指向 Storage 里的照片
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 2. 访问权限：任何拿到网址的人都可以读写（适合小组内部使用）
alter table public.records enable row level security;
drop policy if exists "records read"   on public.records;
drop policy if exists "records write"  on public.records;
drop policy if exists "records update" on public.records;
drop policy if exists "records delete" on public.records;
create policy "records read"   on public.records for select using (true);
create policy "records write"  on public.records for insert with check (true);
create policy "records update" on public.records for update using (true) with check (true);
create policy "records delete" on public.records for delete using (true);

-- 3. 实时同步：队友保存后其他人的页面自动刷新
do $$ begin
  alter publication supabase_realtime add table public.records;
exception when duplicate_object then null; end $$;

-- 4. 照片存储桶（公开读取，导出的 CSV 里的照片链接可直接打开）
insert into storage.buckets (id, name, public)
values ('glass-photos', 'glass-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "glass photos read"   on storage.objects;
drop policy if exists "glass photos upload" on storage.objects;
drop policy if exists "glass photos delete" on storage.objects;
create policy "glass photos read"   on storage.objects for select using (bucket_id = 'glass-photos');
create policy "glass photos upload" on storage.objects for insert with check (bucket_id = 'glass-photos');
create policy "glass photos delete" on storage.objects for delete using (bucket_id = 'glass-photos');
