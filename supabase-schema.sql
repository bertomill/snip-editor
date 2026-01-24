-- Supabase Schema for Snip Video Editor
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Projects table
create table public.projects (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Clips table
create table public.clips (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  file_name text not null,
  storage_path text not null,
  duration numeric not null,
  order_index integer not null,
  transcript text,
  segments jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Renders table
create table public.renders (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  status text check (status in ('pending', 'processing', 'completed', 'failed')) default 'pending',
  progress integer default 0,
  output_path text,
  error text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  completed_at timestamp with time zone
);

-- Row Level Security (RLS)
alter table public.projects enable row level security;
alter table public.clips enable row level security;
alter table public.renders enable row level security;

-- Projects policies
create policy "Users can view their own projects"
  on public.projects for select
  using (auth.uid() = user_id);

create policy "Users can create their own projects"
  on public.projects for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own projects"
  on public.projects for update
  using (auth.uid() = user_id);

create policy "Users can delete their own projects"
  on public.projects for delete
  using (auth.uid() = user_id);

-- Clips policies
create policy "Users can view their own clips"
  on public.clips for select
  using (auth.uid() = user_id);

create policy "Users can create their own clips"
  on public.clips for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own clips"
  on public.clips for update
  using (auth.uid() = user_id);

create policy "Users can delete their own clips"
  on public.clips for delete
  using (auth.uid() = user_id);

-- Renders policies
create policy "Users can view their own renders"
  on public.renders for select
  using (auth.uid() = user_id);

create policy "Users can create their own renders"
  on public.renders for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own renders"
  on public.renders for update
  using (auth.uid() = user_id);

-- Storage bucket for video files
insert into storage.buckets (id, name, public)
values ('videos', 'videos', false);

-- Storage policies
create policy "Users can upload their own videos"
  on storage.objects for insert
  with check (
    bucket_id = 'videos' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can view their own videos"
  on storage.objects for select
  using (
    bucket_id = 'videos' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete their own videos"
  on storage.objects for delete
  using (
    bucket_id = 'videos' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Indexes for performance
create index clips_project_id_idx on public.clips(project_id);
create index clips_user_id_idx on public.clips(user_id);
create index renders_project_id_idx on public.renders(project_id);
create index renders_user_id_idx on public.renders(user_id);
