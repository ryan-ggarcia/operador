import { makePermissions } from '../../auth/public/testing.js';
import {
  canEditMedia,
  canViewMedia,
  nextMediaSituation,
  nextPieceLetter,
  type MediaAccessView,
} from './media-access.js';

const media = (overrides: Partial<MediaAccessView> = {}): MediaAccessView => ({
  situation: 'OPEN',
  responsibleId: 'resp',
  requesterId: 'req',
  memberIds: [],
  sentToFinanceAt: null,
  projectHidden: false,
  involvedInProject: false,
  ...overrides,
});

describe('acesso à mídia', () => {
  it('nível 1 só as suas; 3 lê todas e edita as suas; Total edita todas', () => {
    expect(canViewMedia('outro', makePermissions({ medias: 1 }), media())).toBe(false);
    expect(canViewMedia('outro', makePermissions({ medias: 3 }), media())).toBe(true);
    expect(canEditMedia('outro', makePermissions({ medias: 3 }), media())).toBe(false);
    expect(canEditMedia('resp', makePermissions({ medias: 3 }), media())).toBe(true);
    expect(canEditMedia('outro', makePermissions({ medias: 6 }), media())).toBe(true);
    expect(canEditMedia('resp', makePermissions({ medias: 2 }), media())).toBe(false);
  });

  it('mídia de projeto oculto: envolvidos na mídia ou no projeto, e o administrador', () => {
    const hidden = media({ projectHidden: true, memberIds: ['membro'] });
    expect(canViewMedia('outro', makePermissions({ medias: 6 }), hidden)).toBe(false);
    expect(canViewMedia('outro', makePermissions({ medias: 6 }), media({ projectHidden: true, involvedInProject: true }))).toBe(true);
    expect(canViewMedia('membro', makePermissions({ medias: 2 }), hidden)).toBe(true);
    expect(canViewMedia('outro', makePermissions({ medias: 7 }), hidden)).toBe(true);
    expect(canEditMedia('outro', makePermissions({ medias: 6 }), hidden)).toBe(false);
  });

  it('enviada ao financeiro ou fechada fica travada', () => {
    const full = makePermissions({ medias: 7 });
    expect(canEditMedia('resp', full, media({ sentToFinanceAt: new Date() }))).toBe(false);
    expect(canEditMedia('resp', full, media({ situation: 'DONE' }))).toBe(false);
  });

  it('transições', () => {
    expect(nextMediaSituation('OPEN', 'complete')).toBe('DONE');
    expect(nextMediaSituation('DONE', 'cancel')).toBeNull();
    expect(nextMediaSituation('CANCELED', 'reopen')).toBe('OPEN');
  });

  it('letras das peças', () => {
    expect(nextPieceLetter([])).toBe('A');
    expect(nextPieceLetter(['A', 'B', 'D'])).toBe('C');
    expect(nextPieceLetter(Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)))).toBe('AA');
  });
});
