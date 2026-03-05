-- Required for Realtime UPDATE events to include full row in payload.new
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
