-- ============================================================
-- IELTS Mock — Auth & Profiles Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT,
  role        TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('superadmin', 'admin', 'student')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. RLS policies for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read profiles (needed for UI display)
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Superadmins can update any profile (role management)
CREATE POLICY "Superadmins can update any profile"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

-- Only superadmins can delete profiles
CREATE POLICY "Only superadmins can delete profiles"
  ON public.profiles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

-- ============================================================
-- 4. Add user_id column to attempts (nullable for backward compat)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attempts' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.attempts ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- RLS for attempts: users can only see their own attempts (admins see all)
CREATE POLICY "Users can view own attempts"
  ON public.attempts FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

-- Users can insert their own attempts
CREATE POLICY "Users can insert own attempts"
  ON public.attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 5. Promote the first user as superadmin
--    Run this AFTER you create your first account:
--    UPDATE public.profiles SET role = 'superadmin' WHERE email = 'your@email.com';
-- ============================================================
