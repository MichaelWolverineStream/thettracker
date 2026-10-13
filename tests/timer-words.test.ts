import { describe, expect, it } from 'vitest';
import { TIMER_LANGUAGES } from '../src/preview/appearance';
import { formatWords, splitDuration, timerText } from '../src/preview/timerFormat';
import { WORDS } from '../src/preview/words';
import { spanishNumber } from '../src/preview/words/es';
import { frenchNumber } from '../src/preview/words/fr';
import { nativeKoreanCount, sinoKoreanNumber } from '../src/preview/words/ko';
import { latinNumber } from '../src/preview/words/la';
import { swedishNumber } from '../src/preview/words/sv';

const time = (hours: number, minutes: number, seconds: number) => ((hours * 60 + minutes) * 60 + seconds) * 1000;

describe('words timer languages', () => {
  it('has a formatter and a not-started phrase for every language', () => {
    expect(TIMER_LANGUAGES.map(({ value }) => value)).toEqual(['en', 'fr', 'sv', 'es', 'ko', 'la']);
    expect(TIMER_LANGUAGES.map(({ value }) => WORDS[value].notStarted)).toEqual([
      'There is still time', 'Il est encore temps', 'Det finns fortfarande tid', 'Todavía hay tiempo', '아직 시간이 있어요', 'Adhuc tempus est',
    ]);
    for (const { value } of TIMER_LANGUAGES) expect(timerText('words', 0, value)).toBe(WORDS[value].notStarted);
  });

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
    [1, 'une'], [16, 'seize'], [17, 'dix-sept'], [21, 'vingt et une'], [22, 'vingt-deux'], [41, 'quarante et une'], [59, 'cinquante-neuf'],
    [61, 'soixante et une'], [70, 'soixante-dix'], [71, 'soixante et onze'], [72, 'soixante-douze'], [79, 'soixante-dix-neuf'],
    [80, 'quatre-vingts'], [81, 'quatre-vingt-une'], [90, 'quatre-vingt-dix'], [91, 'quatre-vingt-onze'], [99, 'quatre-vingt-dix-neuf'],
    [100, 'cent'], [101, 'cent une'], [200, 'deux cents'], [201, 'deux cent une'], [280, 'deux cent quatre-vingts'], [999, 'neuf cent quatre-vingt-dix-neuf'], [1000, '1000'],
  ])('spells %i as %s', (value, expected) => {
    expect(frenchNumber(value)).toBe(expected);
  });

  it.each([
    [time(0, 0, 1), 'Une seconde'],
    [time(0, 0, 3), 'Trois secondes'],
    [time(0, 4, 3), 'Quatre minutes et trois secondes'],
    [time(1, 4, 3), 'Une heure, quatre minutes et trois secondes'],
    [time(21, 21, 21), 'Vingt et une heures, vingt et une minutes et vingt et une secondes'],
    [time(23, 59, 59), 'Vingt-trois heures, cinquante-neuf minutes et cinquante-neuf secondes'],
    [time(1000, 0, 1), '1000 heures et une seconde'],
  ])('writes %i ms as "%s"', (ms, expected) => {
    expect(formatWords(splitDuration(ms), 'fr')).toBe(expected);
    expect(timerText('words', ms, 'fr')).toBe(expected);
  });
});

describe('Swedish', () => {
  it.each([
    [1, 'en'], [11, 'elva'], [18, 'arton'], [20, 'tjugo'], [21, 'tjugoen'], [42, 'fyrtiotvå'], [59, 'femtionio'], [99, 'nittionio'],
    [100, 'hundra'], [121, 'hundratjugoen'], [200, 'tvåhundra'], [999, 'niohundranittionio'], [1000, '1000'],
  ])('spells %i as %s', (value, expected) => {
    expect(swedishNumber(value)).toBe(expected);
  });

  it.each([
    [time(0, 0, 1), 'En sekund'],
    [time(0, 0, 3), 'Tre sekunder'],
    [time(0, 1, 0), 'En minut'],
    [time(0, 4, 3), 'Fyra minuter och tre sekunder'],
    [time(1, 4, 3), 'En timme, fyra minuter och tre sekunder'],
    [time(2, 30, 0), 'Två timmar och trettio minuter'],
    [time(8, 0, 0), 'Åtta timmar'],
    [time(1000, 0, 1), '1000 timmar och en sekund'],
  ])('writes %i ms as "%s"', (ms, expected) => {
    expect(timerText('words', ms, 'sv')).toBe(expected);
  });
});

describe('Spanish', () => {
  it.each([
    [1, 'f', 'una'], [1, 'm', 'un'], [16, 'f', 'dieciséis'], [21, 'f', 'veintiuna'], [21, 'm', 'veintiún'], [22, 'm', 'veintidós'],
    [23, 'm', 'veintitrés'], [26, 'm', 'veintiséis'], [30, 'm', 'treinta'], [31, 'f', 'treinta y una'], [31, 'm', 'treinta y un'],
    [59, 'm', 'cincuenta y nueve'], [100, 'f', 'cien'], [101, 'f', 'ciento una'], [101, 'm', 'ciento un'], [121, 'f', 'ciento veintiuna'],
    [200, 'f', 'doscientas'], [200, 'm', 'doscientos'], [500, 'f', 'quinientas'], [701, 'm', 'setecientos un'],
    [999, 'f', 'novecientas noventa y nueve'], [1000, 'f', '1000'],
  ] as const)('spells %i (%s) as %s', (value, gender, expected) => {
    expect(spanishNumber(value, gender)).toBe(expected);
  });

  it.each([
    [time(0, 0, 1), 'Un segundo'],
    [time(0, 0, 3), 'Tres segundos'],
    [time(1, 0, 0), 'Una hora'],
    [time(0, 4, 3), 'Cuatro minutos y tres segundos'],
    [time(1, 4, 3), 'Una hora, cuatro minutos y tres segundos'],
    [time(21, 21, 21), 'Veintiuna horas, veintiún minutos y veintiún segundos'],
    [time(1000, 0, 1), '1000 horas y un segundo'],
  ])('writes %i ms as "%s"', (ms, expected) => {
    expect(timerText('words', ms, 'es')).toBe(expected);
  });
});

describe('Korean', () => {
  it.each([
    [1, '한'], [2, '두'], [3, '세'], [4, '네'], [5, '다섯'], [10, '열'], [11, '열한'], [20, '스무'], [21, '스물한'], [30, '서른'], [99, '아흔아홉'],
  ])('counts %i hours natively as %s', (value, expected) => {
    expect(nativeKoreanCount(value)).toBe(expected);
  });

  it.each([
    [1, '일'], [10, '십'], [11, '십일'], [20, '이십'], [59, '오십구'], [100, '백'], [101, '백일'], [110, '백십'], [200, '이백'], [999, '구백구십구'], [1000, '1000'],
  ])('spells %i in Sino-Korean as %s', (value, expected) => {
    expect(sinoKoreanNumber(value)).toBe(expected);
  });

  it.each([
    [time(0, 0, 1), '일 초'],
    [time(0, 4, 3), '사 분 삼 초'],
    [time(1, 4, 3), '한 시간 사 분 삼 초'],
    [time(20, 0, 0), '스무 시간'],
    [time(21, 0, 1), '스물한 시간 일 초'],
    [time(23, 59, 59), '스물세 시간 오십구 분 오십구 초'],
    [time(100, 0, 0), '백 시간'],
    [time(1000, 0, 0), '1000 시간'],
  ])('writes %i ms as "%s"', (ms, expected) => {
    expect(timerText('words', ms, 'ko')).toBe(expected);
  });
});

describe('Latin', () => {
  it.each([
    [1, 'f', 'una'], [1, 'n', 'unum'], [2, 'f', 'duae'], [2, 'n', 'duo'], [3, 'f', 'tres'], [3, 'n', 'tria'], [4, 'n', 'quattuor'],
    [17, 'n', 'septendecim'], [18, 'n', 'duodeviginti'], [19, 'n', 'undeviginti'], [20, 'n', 'viginti'], [21, 'f', 'viginti una'],
    [21, 'n', 'viginti unum'], [28, 'n', 'duodetriginta'], [29, 'n', 'undetriginta'], [58, 'n', 'duodesexaginta'], [59, 'n', 'undesexaginta'],
    [88, 'f', 'duodenonaginta'], [89, 'f', 'undenonaginta'], [98, 'f', 'nonaginta octo'], [100, 'f', 'centum'], [102, 'f', 'centum duae'],
    [200, 'f', 'ducentae'], [200, 'n', 'ducenta'], [999, 'f', 'nongentae nonaginta novem'], [1000, 'f', '1000'],
  ] as const)('spells %i (%s) as %s', (value, gender, expected) => {
    expect(latinNumber(value, gender)).toBe(expected);
  });

  it.each([
    [time(0, 0, 1), 'Unum secundum'],
    [time(0, 0, 3), 'Tria secunda'],
    [time(1, 0, 0), 'Una hora'],
    [time(2, 0, 0), 'Duae horae'],
    [time(0, 4, 3), 'Quattuor minuta et tria secunda'],
    [time(1, 4, 3), 'Una hora, quattuor minuta et tria secunda'],
    [time(23, 59, 59), 'Viginti tres horae, undesexaginta minuta et undesexaginta secunda'],
    [time(1000, 0, 1), '1000 horae et unum secundum'],
  ])('writes %i ms as "%s"', (ms, expected) => {
    expect(timerText('words', ms, 'la')).toBe(expected);
  });
});
