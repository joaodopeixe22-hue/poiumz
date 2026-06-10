
-- Storage policies bucket 'songs'
create policy "storage songs: leitura publica"
  on storage.objects for select
  using (bucket_id = 'songs');

create policy "storage songs: upload autorizado"
  on storage.objects for insert
  with check (bucket_id = 'songs' and public.can_user_upload());

create policy "storage songs: admin atualiza"
  on storage.objects for update
  using (bucket_id = 'songs' and public.is_admin())
  with check (bucket_id = 'songs' and public.is_admin());

create policy "storage songs: admin remove"
  on storage.objects for delete
  using (bucket_id = 'songs' and public.is_admin());

-- Restringir execução das funções de segurança
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_approved_member() from public, anon;
revoke execute on function public.can_user_upload() from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_approved_member() to authenticated;
grant execute on function public.can_user_upload() to authenticated;
