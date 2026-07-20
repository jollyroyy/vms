-- Migration 003: store visitor photos as base64 data URLs in DB column
-- Avoids need for Supabase Storage bucket (temporary until cloud storage is set up)
alter table public.visits add column if not exists photo_data text;
