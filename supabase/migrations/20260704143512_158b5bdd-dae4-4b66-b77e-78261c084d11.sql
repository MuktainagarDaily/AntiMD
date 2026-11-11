
-- school-images
CREATE POLICY "School images are publicly viewable"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'school-images');

CREATE POLICY "Admins can upload school images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'school-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update school images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'school-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete school images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'school-images' AND public.has_role(auth.uid(), 'admin'));

-- request-images
CREATE POLICY "Request images are publicly viewable"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'request-images');

CREATE POLICY "Authenticated users can upload request images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'request-images');

CREATE POLICY "Admins can update request images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'request-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete request images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'request-images' AND public.has_role(auth.uid(), 'admin'));
