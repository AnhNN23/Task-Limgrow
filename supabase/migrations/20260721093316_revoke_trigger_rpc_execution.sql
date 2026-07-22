-- Remote migration version: 20260721093316.
-- set_updated_at is a trigger-only function and should not be callable as RPC.
revoke execute on function public.set_updated_at() from public, anon, authenticated;
