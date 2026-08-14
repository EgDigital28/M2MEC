-- Add investor tier to profiles.

ALTER TYPE public.user_tier ADD VALUE IF NOT EXISTS 'investor';
