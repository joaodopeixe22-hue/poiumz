-- Agendador econômico (aplicado em 21/11/2026, depois de os créditos de Cloud
-- acabarem e o banco ser pausado).
--
-- Antes: radio_tick a cada 10 s, 24 h por dia (~8.640 execuções/dia), o que
-- impedia o banco de descansar à noite.
-- Agora: 1 vez por minuto, das 06:00 às 23:59 de Brasília (UTC 09–02).
--
-- Com alguém ouvindo, o próprio player avisa o fim de cada faixa; o agendador
-- só cobre os momentos sem ouvinte. Fora desse horário a rádio não avança
-- sozinha, e ao reabrir a página o próximo aviso do player a retoma.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'radio-tick';
    PERFORM cron.schedule('radio-tick', '* 0-2,9-23 * * *', 'SELECT public.radio_tick()');
  END IF;
END
$do$;
