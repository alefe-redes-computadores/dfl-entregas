/** V111 R32 — detector puro de riscos em amostras de projeções. Jamais publica dados. */
export type ProjectionRisk = 'unexpected_field' | 'invalid_text' | 'sensitive_pattern';
export type ProjectionScan = { clean: boolean; risks: ProjectionRisk[] };
const allowed = new Set(['title', 'subtitle', 'status']);
const maximum: Record<string,number> = {title:120,subtitle:180,status:32};
const highConfidence = [
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /(?:\+?55\s*)?\(?\d{2}\)?[\s.-]*9?\d{4}[\s.-]*\d{4}\b/,
  /\b\d{3}[. ]?\d{3}[. ]?\d{3}[- ]?\d{2}\b/,
  /\b\d{2}[. ]?\d{3}[. ]?\d{3}[/ ]?\d{4}[- ]?\d{2}\b/,
  /\b(?:cpf|cnpj|telefone|whatsapp|celular|endereço|endereco|chave\s+pix)\s*[:=#]/i,
  /R\$\s*[0-9]/i,
];
export function inspectStaffProjection(value: unknown): ProjectionScan {
  const risks = new Set<ProjectionRisk>();
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {clean:false,risks:['invalid_text']};
  }
  const doc = value as Record<string,unknown>;
  if (Object.keys(doc).some(key=>!allowed.has(key))) risks.add('unexpected_field');
  for (const key of allowed) {
    const field=doc[key];
    if (typeof field !== 'string' || field.length>maximum[key] || /[\u0000-\u001f\u007f]/.test(field)) {
      risks.add('invalid_text');
    } else if (highConfidence.some(pattern=>pattern.test(field))) {
      risks.add('sensitive_pattern');
    }
  }
  return {clean:risks.size===0,risks:Array.from(risks)};
}
