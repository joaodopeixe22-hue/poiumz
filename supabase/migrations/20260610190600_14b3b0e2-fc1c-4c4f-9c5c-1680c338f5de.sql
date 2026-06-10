CREATE POLICY "institutional: leitura publica"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'institutional');

CREATE POLICY "institutional: admin envia"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'institutional' AND public.is_admin());

CREATE POLICY "institutional: admin atualiza"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'institutional' AND public.is_admin())
  WITH CHECK (bucket_id = 'institutional' AND public.is_admin());

CREATE POLICY "institutional: admin remove"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'institutional' AND public.is_admin());