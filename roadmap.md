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
