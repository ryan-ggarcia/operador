/**
 * Aprovação de peças (docs/operand/jobs.md, 2.4). O Operand não mostra se
 * basta um voto ou se exige todos; aqui: qualquer reprovação reprova na
 * hora, e a peça só é aprovada quando todos os aprovadores aprovam.
 */

export type ApprovalSituation = 'OPEN' | 'APPROVED' | 'REJECTED' | 'CANCELED';
export type ApprovalDecision = 'APPROVE' | 'REJECT';

export class ApprovalRuleError extends Error {}

export interface ApprovalVoteView {
  userId: string;
  decision: ApprovalDecision;
}

/** Situação depois dos votos (OPEN enquanto falta alguém). */
export function approvalOutcome(approverIds: string[], votes: ApprovalVoteView[]): ApprovalSituation {
  if (votes.some((vote) => vote.decision === 'REJECT')) return 'REJECTED';
  const approved = new Set(votes.filter((vote) => vote.decision === 'APPROVE').map((vote) => vote.userId));
  return approverIds.every((id) => approved.has(id)) ? 'APPROVED' : 'OPEN';
}

/** Aprovadores: envolvidos no documento, sem repetir e sem quem pediu. */
export function checkApprovers(approverIds: string[], requesterId: string, involvedUserIds: string[]): string[] {
  const unique = [...new Set(approverIds)];
  if (unique.length === 0) throw new ApprovalRuleError('Escolha pelo menos um aprovador.');
  if (unique.includes(requesterId)) throw new ApprovalRuleError('Quem pede a aprovação não pode aprová-la.');
  if (unique.some((id) => !involvedUserIds.includes(id))) {
    throw new ApprovalRuleError('Só os envolvidos no documento podem aprovar.');
  }
  return unique;
}

/** Confere se o usuário pode votar agora; reprovar exige motivo. */
export function checkVote(
  request: { situation: ApprovalSituation; approverIds: string[]; requesterId: string; votes: ApprovalVoteView[] },
  userId: string,
  decision: ApprovalDecision,
  reason: string | null,
): void {
  if (request.situation !== 'OPEN') throw new ApprovalRuleError('Esta aprovação já foi encerrada.');
  if (!request.approverIds.includes(userId)) throw new ApprovalRuleError('Você não é aprovador desta peça.');
  if (request.votes.some((vote) => vote.userId === userId)) throw new ApprovalRuleError('Você já votou nesta aprovação.');
  if (decision === 'REJECT' && !reason?.trim()) throw new ApprovalRuleError('Informe o motivo da reprovação.');
}

/** Marcador sobre a imagem: posição em % (0 a 100) e texto. */
export function checkMarker(x: number, y: number, text: string): void {
  if (!(x >= 0 && x <= 100 && y >= 0 && y <= 100)) throw new ApprovalRuleError('Posição do marcador fora da imagem.');
  if (!text.trim()) throw new ApprovalRuleError('Escreva o comentário do marcador.');
}
