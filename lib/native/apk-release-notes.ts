/** Histórico editorial: versão do aplicativo é SEMPRE lida do Android, não destes marcos. */
export const DFL_UPDATE_NOTES: readonly { name: string; title: string; changes: readonly string[] }[] = [
  { name: 'P360 · P3', title: 'Atualizações Android Premium', changes: ['Central de versões nativas e PWA separadas', 'Download privado com progresso, cancelamento, integridade e instalação consentida', 'Histórico de builds e recuperação por GitHub Releases'] },
  { name: 'P360 · P2', title: 'Notificações Premium', changes: ['Horário de silêncio e frequência configuráveis', 'Priorização de avisos essenciais', 'Controles operacionais preservados'] },
  { name: 'P360 · P1', title: 'Experiência e preferências', changes: ['Central de Preferências 360', 'Mais e Loja com navegação organizada', 'Preservação das regras de entrega e do expediente'] },
];
