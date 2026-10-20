import { approvalOutcome, checkApprovers, checkMarker, checkVote } from './approval-rules.js';

describe('approval-rules', () => {
  it('aprova só com todos; qualquer reprovação reprova', () => {
    expect(approvalOutcome(['a', 'b'], [])).toBe('OPEN');
    expect(approvalOutcome(['a', 'b'], [{ userId: 'a', decision: 'APPROVE' }])).toBe('OPEN');
    expect(
      approvalOutcome(['a', 'b'], [
        { userId: 'a', decision: 'APPROVE' },
        { userId: 'b', decision: 'APPROVE' },
      ]),
    ).toBe('APPROVED');
    expect(approvalOutcome(['a', 'b'], [{ userId: 'b', decision: 'REJECT' }])).toBe('REJECTED');
  });

  it('aprovadores são envolvidos, sem repetir e sem o solicitante', () => {
    expect(checkApprovers(['a', 'b', 'a'], 'r', ['a', 'b', 'r'])).toEqual(['a', 'b']);
    expect(() => checkApprovers([], 'r', ['a'])).toThrow('pelo menos um');
    expect(() => checkApprovers(['r'], 'r', ['r'])).toThrow('não pode aprová-la');
    expect(() => checkApprovers(['x'], 'r', ['a'])).toThrow('envolvidos');
  });

  it('confere o voto', () => {
    const request = { situation: 'OPEN' as const, approverIds: ['a', 'b'], requesterId: 'r', votes: [{ userId: 'a', decision: 'APPROVE' as const }] };
    expect(() => checkVote(request, 'b', 'APPROVE', null)).not.toThrow();
    expect(() => checkVote(request, 'a', 'APPROVE', null)).toThrow('já votou');
    expect(() => checkVote(request, 'r', 'APPROVE', null)).toThrow('não é aprovador');
    expect(() => checkVote(request, 'b', 'REJECT', '  ')).toThrow('motivo');
    expect(() => checkVote({ ...request, situation: 'CANCELED' }, 'b', 'APPROVE', null)).toThrow('encerrada');
  });

  it('confere o marcador', () => {
    expect(() => checkMarker(50, 50, 'Trocar a cor')).not.toThrow();
    expect(() => checkMarker(101, 50, 'x')).toThrow('fora');
    expect(() => checkMarker(10, 10, ' ')).toThrow('comentário');
  });
});
