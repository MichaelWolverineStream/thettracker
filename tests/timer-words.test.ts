import { describe, expect, it } from 'vitest';
import { timerText } from '../src/preview/timerFormat';
import { emojiNumber } from '../src/preview/words/emoji';
import { spanishNumber } from '../src/preview/words/es';
import { frenchNumber } from '../src/preview/words/fr';
import { nativeKoreanCount, sinoKoreanNumber } from '../src/preview/words/ko';
import { latinNumber } from '../src/preview/words/la';
import { quenyaNumber } from '../src/preview/words/qya';
import { russianNumber, russianPluralForm } from '../src/preview/words/ru';
import { swedishNumber } from '../src/preview/words/sv';
import { klingonNumber } from '../src/preview/words/tlh';

const time = (hours: number, minutes: number, seconds: number) => ((hours * 60 + minutes) * 60 + seconds) * 1000;

describe('words timer languages', () => {
  it('defaults to English and leaves non-word styles unchanged', () => {
    expect(timerText('words', time(1, 4, 3))).toBe('One hour, four minutes, and three seconds');
    expect(timerText('words', time(1, 4, 3), 'en')).toBe('One hour, four minutes, and three seconds');
    expect(timerText('roman', time(1, 4, 3), 'la')).toBe('I:IV:III');
    expect(timerText('compact', time(1, 4, 3), 'ko')).toBe('1h 04m 03s');
    expect(timerText('digital', time(1, 4, 3), 'fr')).toBe('01:04:03');
  });
});

describe('French', () => {
  it.each([
    [21, 'vingt et une'], [71, 'soixante et onze'], [80, 'quatre-vingts'], [81, 'quatre-vingt-une'],
  ])('spells %i as %s', (value, expected) => {
    expect(frenchNumber(value)).toBe(expected);
  });

  it.each([
    [time(0, 0, 1), 'Une seconde'],
    [time(1, 4, 3), 'Une heure, quatre minutes et trois secondes'],
  ])('writes %i ms as "%s"', (ms, expected) => {
    expect(timerText('words', ms, 'fr')).toBe(expected);
  });
});

describe('Swedish', () => {
  it.each([
    [1, 'en'], [21, 'tjugoen'], [42, 'fyrtiotvå'],
  ])('spells %i as %s', (value, expected) => {
    expect(swedishNumber(value)).toBe(expected);
  });

  it('writes singular and plural units joined with och', () => {
    expect(timerText('words', time(1, 4, 3), 'sv')).toBe('En timme, fyra minuter och tre sekunder');
  });
});

describe('Spanish', () => {
  it.each([
    [16, 'f', 'dieciséis'], [21, 'm', 'veintiún'], [31, 'f', 'treinta y una'],
  ] as const)('spells %i (%s) as %s', (value, gender, expected) => {
    expect(spanishNumber(value, gender)).toBe(expected);
  });

  it.each([
    [time(1, 4, 3), 'Una hora, cuatro minutos y tres segundos'],
    [time(21, 21, 21), 'Veintiuna horas, veintiún minutos y veintiún segundos'],
  ])('writes %i ms as "%s"', (ms, expected) => {
    expect(timerText('words', ms, 'es')).toBe(expected);
  });
});

describe('Korean', () => {
  it.each([
    [1, '한'], [20, '스무'],
  ])('counts %i hours natively as %s', (value, expected) => {
    expect(nativeKoreanCount(value)).toBe(expected);
  });

  it.each([
    [10, '십'], [59, '오십구'],
  ])('spells %i in Sino-Korean as %s', (value, expected) => {
    expect(sinoKoreanNumber(value)).toBe(expected);
  });

  it.each([
    [time(1, 4, 3), '한 시간 사 분 삼 초'],
    [time(21, 0, 1), '스물한 시간 일 초'],
  ])('writes %i ms as "%s"', (ms, expected) => {
    expect(timerText('words', ms, 'ko')).toBe(expected);
  });
});

describe('Latin', () => {
  it.each([
    [18, 'n', 'duodeviginti'], [19, 'n', 'undeviginti'], [21, 'f', 'viginti una'],
  ] as const)('spells %i (%s) as %s', (value, gender, expected) => {
    expect(latinNumber(value, gender)).toBe(expected);
  });

  it.each([
    [time(0, 0, 1), 'Unum secundum'],
    [time(1, 4, 3), 'Una hora, quattuor minuta et tria secunda'],
  ])('writes %i ms as "%s"', (ms, expected) => {
    expect(timerText('words', ms, 'la')).toBe(expected);
  });
});

describe('Russian', () => {
  it.each([
    [2, 'm', 'два'], [2, 'f', 'две'],
  ] as const)('spells %i (%s) as %s', (value, gender, expected) => {
    expect(russianNumber(value, gender)).toBe(expected);
  });

  it.each([
    [1, 0], [2, 1], [5, 2], [12, 2], [21, 0],
  ])('uses plural form %i -> %i', (value, form) => {
    expect(russianPluralForm(value)).toBe(form);
  });

  it('agrees numbers with masculine hours and feminine minutes and seconds', () => {
    expect(timerText('words', time(21, 21, 21), 'ru')).toBe('Двадцать один час, двадцать одна минута и двадцать одна секунда');
  });
});

describe('Klingon', () => {
  it.each([
    [1, "wa'"], [21, "cha'maH wa'"], [101, "wa'vatlh wa'"],
  ])('spells %i as %s', (value, expected) => {
    expect(klingonNumber(value)).toBe(expected);
  });

  it('writes units in order and ends a list with je', () => {
    expect(timerText('words', time(1, 4, 3), 'tlh')).toBe("wa' rep loS tup wej lup je");
  });
});

describe('Quenya', () => {
  it.each([
    [21, 'min yuquain'], [35, 'lempë nelquain'], [100, '100'],
  ])('spells %i as %s', (value, expected) => {
    expect(quenyaNumber(value)).toBe(expected);
  });

  it.each([
    [time(1, 4, 3), 'Min lúmë, enenquaistar canta ar attië enenquaistar neldë'],
    [time(2, 0, 0), 'Lúmë atta'],
  ])('writes %i ms as "%s"', (ms, expected) => {
    expect(timerText('words', ms, 'qya')).toBe(expected);
  });
});

describe('Emoji', () => {
  const keycap = '\uFE0F\u20E3';

  it('spells each digit as a keycap', () => {
    expect(emojiNumber(10)).toBe(`1${keycap}0${keycap}`);
  });

  it('writes each unit as keycaps followed by its emoji', () => {
    expect(timerText('words', time(1, 4, 3), 'emoji')).toBe(`1${keycap}🕐 4${keycap}⏱\uFE0F 3${keycap}⚡`);
  });
});

describe('Mr. T', () => {
  it.each([
    [time(0, 0, 1), 'One second, fool!'],
    [time(1, 4, 3), 'One hour, four minutes, and three seconds, fool!'],
  ])('writes %i ms as "%s"', (ms, expected) => {
    expect(timerText('words', ms, 'mrt')).toBe(expected);
  });
});
