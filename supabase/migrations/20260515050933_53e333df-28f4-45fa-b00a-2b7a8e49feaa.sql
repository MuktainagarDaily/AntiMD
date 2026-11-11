
-- ============ ENUMS ============
create type public.app_role as enum ('admin');
create type public.product_type as enum ('mobile','accessory');
create type public.category_type as enum ('mobile','accessory','service');
create type public.enquiry_source as enum ('contact','service','product','repair');
create type public.enquiry_status as enum ('new','contacted','closed');

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "profiles self read" on public.profiles for select using (auth.uid() = id);
create policy "profiles self update" on public.profiles for update using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name',''));
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ ROLES ============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'admin');
$$;

-- Bootstrap: anyone can claim admin if none exists
create or replace function public.claim_first_admin()
returns boolean language plpgsql security definer set search_path = public as $$
declare _exists boolean;
begin
  if auth.uid() is null then return false; end if;
  select exists(select 1 from public.user_roles where role = 'admin') into _exists;
  if _exists then return false; end if;
  insert into public.user_roles(user_id, role) values (auth.uid(), 'admin');
  return true;
end; $$;

create policy "roles self read" on public.user_roles for select using (auth.uid() = user_id or public.is_admin());
create policy "roles admin manage" on public.user_roles for all using (public.is_admin()) with check (public.is_admin());

-- ============ HELPER: updated_at trigger ============
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- ============ CATEGORIES ============
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  type public.category_type not null,
  name text not null,
  slug text not null unique,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.categories enable row level security;
create policy "categories public read" on public.categories for select using (true);
create policy "categories admin write" on public.categories for all using (public.is_admin()) with check (public.is_admin());

-- ============ BRANDS ============
create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  sort int not null default 0
);
alter table public.brands enable row level security;
create policy "brands public read" on public.brands for select using (true);
create policy "brands admin write" on public.brands for all using (public.is_admin()) with check (public.is_admin());

-- ============ PRODUCTS ============
create table public.products (
  id uuid primary key default gen_random_uuid(),
  type public.product_type not null,
  brand_id uuid references public.brands(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  price numeric(10,2),
  mrp numeric(10,2),
  storage_gb int,
  ram_gb int,
  specs jsonb not null default '{}'::jsonb,
  images text[] not null default '{}',
  badges text[] not null default '{}',
  in_stock boolean not null default true,
  featured boolean not null default false,
  published boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();
alter table public.products enable row level security;
create policy "products public read published" on public.products for select using (published = true or public.is_admin());
create policy "products admin write" on public.products for all using (public.is_admin()) with check (public.is_admin());

-- ============ SERVICES ============
create table public.services (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text,
  icon text,
  image_url text,
  cta_label text default 'Enquire Now',
  sort int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger services_touch before update on public.services for each row execute function public.touch_updated_at();
alter table public.services enable row level security;
create policy "services public read published" on public.services for select using (published = true or public.is_admin());
create policy "services admin write" on public.services for all using (public.is_admin()) with check (public.is_admin());

-- ============ OFFERS ============
create table public.offers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  description text,
  image_url text,
  video_url text,
  badge text,
  starts_at timestamptz,
  ends_at timestamptz,
  link text,
  cta_label text default 'Avail Now',
  published boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger offers_touch before update on public.offers for each row execute function public.touch_updated_at();
alter table public.offers enable row level security;
create policy "offers public read published" on public.offers for select using (published = true or public.is_admin());
create policy "offers admin write" on public.offers for all using (public.is_admin()) with check (public.is_admin());

-- ============ FESTIVAL THEMES ============
create table public.festival_themes (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  accent_color text not null,
  bg_gradient text,
  banner_text text,
  banner_image_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger themes_touch before update on public.festival_themes for each row execute function public.touch_updated_at();
alter table public.festival_themes enable row level security;
create policy "themes public read" on public.festival_themes for select using (true);
create policy "themes admin write" on public.festival_themes for all using (public.is_admin()) with check (public.is_admin());

-- ============ BANNERS ============
create table public.banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  image_url text,
  link text,
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.banners enable row level security;
create policy "banners public read" on public.banners for select using (active = true or public.is_admin());
create policy "banners admin write" on public.banners for all using (public.is_admin()) with check (public.is_admin());

-- ============ PROMO VIDEOS ============
create table public.promo_videos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  video_url text not null,
  poster_url text,
  placement text default 'home',
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.promo_videos enable row level security;
create policy "videos public read" on public.promo_videos for select using (active = true or public.is_admin());
create policy "videos admin write" on public.promo_videos for all using (public.is_admin()) with check (public.is_admin());

-- ============ GALLERY ============
create table public.gallery_images (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  caption text,
  category text,
  sort int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.gallery_images enable row level security;
create policy "gallery public read" on public.gallery_images for select using (published = true or public.is_admin());
create policy "gallery admin write" on public.gallery_images for all using (public.is_admin()) with check (public.is_admin());

-- ============ TESTIMONIALS ============
create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rating int not null default 5 check (rating between 1 and 5),
  message text not null,
  avatar_url text,
  location text,
  published boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.testimonials enable row level security;
create policy "testimonials public read" on public.testimonials for select using (published = true or public.is_admin());
create policy "testimonials admin write" on public.testimonials for all using (public.is_admin()) with check (public.is_admin());

-- ============ ENQUIRIES ============
create table public.enquiries (
  id uuid primary key default gen_random_uuid(),
  source public.enquiry_source not null default 'contact',
  name text not null,
  phone text not null,
  email text,
  message text,
  product_id uuid references public.products(id) on delete set null,
  service_slug text,
  status public.enquiry_status not null default 'new',
  created_at timestamptz not null default now()
);
alter table public.enquiries enable row level security;
create policy "enquiries public insert" on public.enquiries for insert with check (true);
create policy "enquiries admin read" on public.enquiries for select using (public.is_admin());
create policy "enquiries admin update" on public.enquiries for update using (public.is_admin());
create policy "enquiries admin delete" on public.enquiries for delete using (public.is_admin());

-- ============ SOCIAL LINKS ============
create table public.social_links (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  url text not null,
  sort int not null default 0,
  active boolean not null default true
);
alter table public.social_links enable row level security;
create policy "social public read" on public.social_links for select using (active = true or public.is_admin());
create policy "social admin write" on public.social_links for all using (public.is_admin()) with check (public.is_admin());

-- ============ SITE SETTINGS (singleton) ============
create table public.site_settings (
  id int primary key default 1,
  business_name text not null default 'New Harsh Mobile',
  tagline text default 'Your Trusted Mobile Store in Chhatrapati Sambhajinagar',
  phone text default '+91 90000 00000',
  whatsapp text default '+91 90000 00000',
  email text default 'contact@newharshmobile.in',
  address text default 'Trimurti Chowk, Jawahar Colony, Chhatrapati Sambhajinagar (Aurangabad), Maharashtra 431001',
  map_embed text default 'https://www.google.com/maps?q=Aurangabad+Maharashtra&output=embed',
  hours jsonb not null default '{"mon":"10:00-21:00","tue":"10:00-21:00","wed":"10:00-21:00","thu":"10:00-21:00","fri":"10:00-21:00","sat":"10:00-21:00","sun":"11:00-20:00"}'::jsonb,
  logo_url text,
  favicon_url text,
  seo_title text default 'New Harsh Mobile — Mobiles, Accessories & Repair in Chhatrapati Sambhajinagar',
  seo_description text default 'Trusted local mobile store in Chhatrapati Sambhajinagar (Aurangabad). Latest smartphones, accessories, recharges & expert repair services.',
  og_image_url text,
  active_theme_key text,
  announcement text,
  announcement_active boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);
create trigger settings_touch before update on public.site_settings for each row execute function public.touch_updated_at();
alter table public.site_settings enable row level security;
create policy "settings public read" on public.site_settings for select using (true);
create policy "settings admin write" on public.site_settings for all using (public.is_admin()) with check (public.is_admin());

insert into public.site_settings (id) values (1);

-- ============ SEED FESTIVAL THEMES ============
insert into public.festival_themes (key, name, accent_color, bg_gradient, banner_text, sort) values
  ('default','Default','#f59e0b','linear-gradient(135deg,#0c2340,#1a4a6e)','Welcome to New Harsh Mobile',0),
  ('diwali','Diwali','#f59e0b','linear-gradient(135deg,#7c2d12,#f59e0b)','Diwali Dhamaka — Festive Offers on Mobiles & Accessories',1),
  ('holi','Holi','#ec4899','linear-gradient(135deg,#7c3aed,#ec4899)','Holi Hai! Colorful Deals on Smartphones',2),
  ('gudi-padwa','Gudi Padwa','#16a34a','linear-gradient(135deg,#15803d,#facc15)','Gudi Padwa Special — New Beginnings, New Mobiles',3),
  ('ganesh-chaturthi','Ganesh Chaturthi','#dc2626','linear-gradient(135deg,#b91c1c,#fbbf24)','Ganpati Bappa Morya — Festive Mobile Offers',4),
  ('dussehra','Dussehra','#ea580c','linear-gradient(135deg,#c2410c,#fbbf24)','Dussehra Deals — Conquer Great Savings',5),
  ('raksha-bandhan','Raksha Bandhan','#e11d48','linear-gradient(135deg,#be123c,#fda4af)','Rakhi Special Gifts for Brothers & Sisters',6),
  ('independence-day','Independence Day','#16a34a','linear-gradient(135deg,#ea580c,#16a34a)','Azaadi Sale — Tricolor Offers Across the Store',7),
  ('republic-day','Republic Day','#1d4ed8','linear-gradient(135deg,#1d4ed8,#f59e0b)','Republic Day Sale — Salute to Savings',8),
  ('new-year','New Year','#9333ea','linear-gradient(135deg,#1e3a8a,#9333ea)','New Year, New Mobile — Special Launch Offers',9);

-- ============ SEED CATEGORIES ============
insert into public.categories(type, name, slug, sort) values
  ('mobile','Smartphones','smartphones',1),
  ('mobile','Feature Phones','feature-phones',2),
  ('mobile','Tablets','tablets',3),
  ('accessory','Chargers','chargers',1),
  ('accessory','Cables','cables',2),
  ('accessory','Earphones','earphones',3),
  ('accessory','Cases & Covers','cases-covers',4),
  ('accessory','Screen Guards','screen-guards',5),
  ('accessory','Power Banks','power-banks',6),
  ('accessory','Smartwatches','smartwatches',7),
  ('accessory','Speakers','speakers',8),
  ('accessory','Memory Cards','memory-cards',9),
  ('service','Repair','repair',1),
  ('service','Recharge','recharge',2);

-- ============ SEED BRANDS ============
insert into public.brands(name, slug, sort) values
  ('Samsung','samsung',1),('Vivo','vivo',2),('Oppo','oppo',3),
  ('Realme','realme',4),('Xiaomi','xiaomi',5),('Apple','apple',6),
  ('Motorola','motorola',7),('OnePlus','oneplus',8),('Nothing','nothing',9);

-- ============ SEED SERVICES ============
insert into public.services(title, slug, description, icon, sort) values
  ('Mobile Repairing','mobile-repairing','Expert repair for all major brands. Quick turnaround with genuine parts.','wrench',1),
  ('Screen Replacement','screen-replacement','Cracked display? We replace it with quality OEM-grade screens.','smartphone',2),
  ('Battery Replacement','battery-replacement','Original-spec batteries to bring your phone back to all-day life.','battery',3),
  ('Software & Flashing','software-flashing','OS install, bootloop fix, factory reset and software updates.','cpu',4),
  ('Data Transfer','data-transfer','Move contacts, photos and apps from your old phone to a new one.','arrow-right-left',5),
  ('Recharge & SIM','recharge-sim','Prepaid recharges, plan activation, SIM swap and assistance.','signal',6);

-- ============ SEED TESTIMONIALS ============
insert into public.testimonials(name, rating, message, location, sort) values
  ('Rohit Patil',5,'Got my phone screen replaced in 2 hours. Genuine work and fair price. Highly recommended!','Aurangabad',1),
  ('Priya Deshmukh',5,'Best mobile shop in town. They guided me through every option and got me the best deal.','CIDCO',2),
  ('Akash Sharma',5,'Bought my Samsung from here last Diwali — great festival offers and helpful staff.','Garkheda',3),
  ('Sneha Kulkarni',5,'Quick repair, neat work. The team is polite and trustworthy.','Jawahar Colony',4);

-- ============ SEED SOCIAL LINKS ============
insert into public.social_links(platform, url, sort) values
  ('whatsapp','https://wa.me/919000000000',1),
  ('instagram','https://instagram.com/newharshmobile',2),
  ('facebook','https://facebook.com/newharshmobile',3),
  ('youtube','https://youtube.com/@newharshmobile',4),
  ('google','https://g.page/newharshmobile',5);

-- ============ STORAGE BUCKETS ============
insert into storage.buckets (id, name, public) values
  ('product-images','product-images',true),
  ('offer-banners','offer-banners',true),
  ('gallery-images','gallery-images',true),
  ('videos','videos',true),
  ('branding','branding',true),
  ('theme-assets','theme-assets',true)
on conflict (id) do nothing;

create policy "public read all buckets" on storage.objects for select using (
  bucket_id in ('product-images','offer-banners','gallery-images','videos','branding','theme-assets')
);
create policy "admin upload" on storage.objects for insert with check (
  bucket_id in ('product-images','offer-banners','gallery-images','videos','branding','theme-assets') and public.is_admin()
);
create policy "admin update" on storage.objects for update using (
  bucket_id in ('product-images','offer-banners','gallery-images','videos','branding','theme-assets') and public.is_admin()
);
create policy "admin delete" on storage.objects for delete using (
  bucket_id in ('product-images','offer-banners','gallery-images','videos','branding','theme-assets') and public.is_admin()
);
