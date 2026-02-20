-- =============================================
-- LumoPack E-Commerce Schema
-- Run in Supabase SQL Editor
-- =============================================

-- 1. Profiles (extends Supabase Auth users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  company TEXT,
  role TEXT DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: insert profiles for users who registered before trigger existed
INSERT INTO public.profiles (id, full_name)
SELECT id, raw_user_meta_data->>'full_name'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- 2. Orders
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  session_id TEXT,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','deposit_paid','production','qc','shipped','completed','cancelled')),
  collected_data JSONB NOT NULL,
  pricing JSONB NOT NULL,
  grand_total NUMERIC(12,2) NOT NULL,
  deposit_amount NUMERIC(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Payments
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  type TEXT DEFAULT 'deposit' CHECK (type IN ('deposit','remaining','refund')),
  slip_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Auto-update updated_at on orders
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- Row Level Security (RLS)
-- =============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Orders
CREATE POLICY "Users can view own orders"
  ON public.orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create orders"
  ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all orders"
  ON public.orders FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Admins can update orders"
  ON public.orders FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Payments
CREATE POLICY "Users can view own payments"
  ON public.payments FOR SELECT USING (
    order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid())
  );
CREATE POLICY "Users can create payments"
  ON public.payments FOR INSERT WITH CHECK (
    order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid())
  );
CREATE POLICY "Admins can view all payments"
  ON public.payments FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Admins can update payments"
  ON public.payments FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- =============================================
-- Storage: Create bucket via Dashboard
-- Bucket name: "payment-slips", Public: false
-- =============================================
