-- Allow TI department to manage help_images (insert/update/delete)
-- and add storage bucket for help page images.

-- 1. help_images RLS: allow TI in addition to admin/ADMINISTRAÇÃO
DROP POLICY IF EXISTS "Only admins can insert help images" ON public.help_images;
CREATE POLICY "Admins and TI can insert help images"
  ON public.help_images FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (
        LOWER(TRIM(profiles.role)) = 'admin'
        OR UPPER(TRIM(profiles.department)) = 'ADMINISTRAÇÃO'
        OR UPPER(TRIM(profiles.department)) = 'TI'
      )
    )
  );

DROP POLICY IF EXISTS "Only admins can update help images" ON public.help_images;
CREATE POLICY "Admins and TI can update help images"
  ON public.help_images FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (
        LOWER(TRIM(profiles.role)) = 'admin'
        OR UPPER(TRIM(profiles.department)) = 'ADMINISTRAÇÃO'
        OR UPPER(TRIM(profiles.department)) = 'TI'
      )
    )
  );

DROP POLICY IF EXISTS "Only admins can delete help images" ON public.help_images;
CREATE POLICY "Admins and TI can delete help images"
  ON public.help_images FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (
        LOWER(TRIM(profiles.role)) = 'admin'
        OR UPPER(TRIM(profiles.department)) = 'ADMINISTRAÇÃO'
        OR UPPER(TRIM(profiles.department)) = 'TI'
      )
    )
  );

-- 2. Storage bucket for help page images (public so image_url can be used directly)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('help-images', 'help-images', true, 10485760)
ON CONFLICT (id) DO UPDATE SET file_size_limit = 10485760;

-- Only TI and admins can upload to help-images
CREATE POLICY "TI and admins can upload help images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'help-images'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (
        LOWER(TRIM(profiles.role)) = 'admin'
        OR UPPER(TRIM(profiles.department)) = 'ADMINISTRAÇÃO'
        OR UPPER(TRIM(profiles.department)) = 'TI'
      )
    )
  );

-- Public read so image URLs work for everyone
CREATE POLICY "Anyone can read help images bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'help-images');

-- TI and admins can update/delete objects in help-images
CREATE POLICY "TI and admins can update help images storage"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'help-images'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (
        LOWER(TRIM(profiles.role)) = 'admin'
        OR UPPER(TRIM(profiles.department)) = 'ADMINISTRAÇÃO'
        OR UPPER(TRIM(profiles.department)) = 'TI'
      )
    )
  );

CREATE POLICY "TI and admins can delete help images storage"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'help-images'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (
        LOWER(TRIM(profiles.role)) = 'admin'
        OR UPPER(TRIM(profiles.department)) = 'ADMINISTRAÇÃO'
        OR UPPER(TRIM(profiles.department)) = 'TI'
      )
    )
  );
