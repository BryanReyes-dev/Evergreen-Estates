-- Remove anonymous read access from the private property-images bucket.
DROP POLICY IF EXISTS "Allow public read access to property images"
ON storage.objects;