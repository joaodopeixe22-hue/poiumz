# Correções de continuidade
- [x] Restaurar avanço automático autorizado da rádio, sem alterar esquema ou permissões.
- [x] Corrigir fontes públicas, preparação e eventos do player compartilhado.
- [x] Validar testes, reprodução real e atualização de segurança.

Limite preservado: a rádio depende de uma página de operação aberta por administrador ou operador aprovado; execução autônoma sem navegador exigiria uma etapa separada no servidor.
# Rádio autônoma (Fase 1)
- [x] Avanço validado pelo servidor (radio_tick) chamado por ouvintes e por pg_cron a cada 10 s.
- [x] Trava do admin não interrompe o avanço automático.
- [x] Ouvintes passam a ler a vinheta que está no ar.

Limite removido: a rádio não depende mais de uma página de operação aberta.

# Som de loja
- [x] Volume nivelado por faixa (LUFS, alvo −14), medido no upload e pelo botão "Nivelar volume" da biblioteca.
- [x] Limitador e perfis de ambiente por aparelho (Padrão, Caixa pequena, Loja cheia, Loja vazia).
- [x] Corte de silêncio no início e no fim das faixas.

Pendente: analisar a biblioteca existente (admin, em Músicas → Nivelar volume) e pré-carregar a próxima faixa para reduzir o intervalo entre músicas.

# Som remoto
- [x] Volume da rádio ajustado pelo operador (Programação e controles da página inicial), aplicado em todos os aparelhos.
- [x] Perfil de ambiente da rádio escolhido pelo operador; cada aparelho pode fixar um perfil próprio.
- [x] Consulta de reserva a cada 20 s para o aparelho voltar a obedecer se o tempo real cair.

# Relógio do servidor
- [x] Hora do servidor medida pelo cabeçalho Date do próprio site e usada em toda conta de tempo da rádio.
- [x] Login renovado pela hora do servidor, também com a aba em segundo plano, com conferência periódica no servidor.
- [x] Músicas, playlists, institucional e configurações se recarregam quando o login é renovado.
- [x] Anterior, arrastar a barra e pular para uma música gravam a hora do servidor.

# Custo
- [x] Agendador da rádio reduzido: 1x/min das 06:00 às 23:59 de Brasília (antes a cada 10 s, 24 h). Motivo: os créditos de Cloud acabaram em 21/11 e o banco foi pausado.
