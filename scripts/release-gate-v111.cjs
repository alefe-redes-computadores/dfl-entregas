#!/usr/bin/env node
/**
 * DFL Entregas V111 — diagnóstico local não destrutivo.
 * NÃO faz commit, push, deploy, migração, reenvio ou conexão externa.
 * Não executa comandos de leitura do Firestore para evitar explosão de reads.
 */
'use strict';
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const project = path.resolve(__dirname, '..');
process.chdir(project);
const errors = [], warnings = [], info = [];
function git(...args) {
  try { return execFileSync('git', args, { encoding:'utf8', timeout:10000, maxBuffer:2*1024*1024 }).trim(); }
  catch { return null; }
}
function required(file) {
  if (!fs.existsSync(file)) errors.push(`Arquivo obrigatório ausente: ${file}`);
}
for (const file of [
  'scripts/pre-apk.cjs',
  'scripts/verify-v111-r18-integration-closeout.cjs',
  'scripts/verify-v111-r18-release-candidate.cjs',
  'scripts/verify-v111-r19-conciliation.cjs',
  'app/rotas/details/page.tsx',
  'lib/integration/drain-outcome.ts',
  'lib/integration/server/reverseRelay.ts',
  'lib/delivery-finance.ts',
  'lib/route-cash-flow.ts',
  'lib/stock-panel-preferences.ts',
  'components/home/RouteAccordion.tsx',
  'app/api/integration/outbox/drain/route.ts',
]) required(file);
const tests = fs.existsSync('scripts/pre-apk.cjs') ? fs.readFileSync('scripts/pre-apk.cjs','utf8') : '';
for (const name of ['verify-v111-r19-conciliation.cjs','verify-v111-r18-release-candidate.cjs','verify-v111-r18-integration-closeout.cjs','verify-v111-r18-release-gate.cjs','verify-v111-r17-finance-route-safety.cjs','verify-v111-r16-premium-closeout.cjs']) {
  if (!tests.includes(name)) errors.push(`Suíte crítica não está registrada: ${name}`);
}
const diffCheck = git('diff','--check');
if (diffCheck === null) errors.push('Git diff --check não pôde ser executado');
const current = git('rev-parse','--short','HEAD');
info.push('Base Git local: '+(current || 'não disponível'));
const tracked = git('ls-files')?.split('\n') || [];
const sensitiveTracked = tracked.filter(f => /(^|\/)(?:\.env(?:\.|$)|[^/]+\.(?:pem|p12|jks|keystore|key)$)/i.test(f));
if (sensitiveTracked.length) errors.push(`Arquivos de possível segredo rastreados pelo Git: ${sensitiveTracked.length} (nomes omitidos)`);
const status = git('status','--porcelain=v1');
info.push(`Entradas com mudanças locais: ${status ? status.split('\n').filter(Boolean).length : 0}`);
if (!status) warnings.push('Nenhuma modificação pendente detectada. Confirme se a V111 foi publicada ou preservada em commit.');
const ruleFiles = ['firestore.rules','firebase/firestore.rules','firestore.rules.json'].filter(f => fs.existsSync(f));
if (!ruleFiles.length) warnings.push('Regras de segurança do Firestore não versionadas aqui: conferir no Console Firebase antes de publicar.');
console.log('====================================================');
console.log('DFL ENTREGAS — V111 | RELEASE GATE LOCAL');
console.log('====================================================');
console.log('Nenhuma publicação, acesso externo ou modificação de dados.');
for (const line of info) console.log('INFO: '+line);
for (const line of warnings) console.log('PENDENTE: '+line);
for (const line of errors) console.log('BLOQUEIO LOCAL: '+line);
console.log('');
console.log('HOMOLOGAÇÕES MANUAIS OBRIGATÓRIAS (NÃO EXECUTADAS):');
console.log('1. Firebase Rules: sem regras publicamente abertas, permissões reais e Auth corretos.');
console.log('2. Site -> Entregas -> Site: pedido, saída, posição, entrega, cancelamento.');
console.log('3. Supabase/Evolution V2: pedido novo controlado, status sent verificável; NÃO reabrir dead_letters antigos.');
console.log('4. Caixa: pago, Pix pendente, dinheiro, troco, acerto e devolução/rollback.');
console.log('5. Estoque: cartela, kg/L fracionados, contagem, fornecedor, compras e histórico.');
console.log('6. Firestore: leituras/limites durante loja aberta e em segundo plano.');
console.log('7. APK GitHub Actions: build, assinatura, instalação e teste real no Android.');
console.log('8. Conferência de alterações locais, commit selecionado e autorização explícita para push/deploy.');
console.log('');
console.log(errors.length ? 'GATE LOCAL: BLOQUEADO — CORRIGIR ITENS ACIMA.' : 'GATE LOCAL: SEM ERROS ESTRUTURAIS. PUBLICAÇÃO PENDENTE DAS HOMOLOGAÇÕES.');
process.exitCode = errors.length ? 1 : 0;
