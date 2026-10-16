// iPhone Home Screen designs (W17-W31). Full colour in each app's own palette; on Clear and tinted
// Home Screens the system drops the colours and the background, and the Kel portraits and Themis
// stay in colour (img() sets full).
import { PAL, theme, photoTheme, t, m, V, H, Z, sp, gap, div, mark, cv, img, ic, root, face, habit, design } from '../kit.mjs'

const BUBBLE = 'M52 6c25.4 0 46 15.6 46 34.8S77.4 75.6 52 75.6c-4.6 0-9-.5-13.2-1.5L18 82l5.4-15.4C13.6 60.2 6 51 6 40.8 6 21.6 26.6 6 52 6z'

const temple = (s, roof = 'accent') => cv(62 * s, 56 * s, [
  { type: 'path', d: `M${3 * s} ${12.5 * s} ${31 * s} ${2 * s}l${28 * s} ${10.5 * s}z`, color: roof },
  { type: 'rect', x: 2 * s, y: 14 * s, width: 58 * s, height: 3.6 * s },
  { type: 'repeat', count: '{data.total}', value: '{data.carried}', x: 4.5 * s, y: 21 * s, height: 27 * s, fit: 'spread', spacing: 2.4 * s,
    track: 'ink', strokeWidth: 1.2 * s, dash: [2.6 * s, 2 * s] },
  { type: 'rect', x: 0, y: 50.5 * s, width: 62 * s, height: 4 * s },
])

const head = (icon, title, right) => H([ic(icon, 14, { color: 'accent' }), t(title, 13, 600), sp(6), right], { spacing: 5 })

// Office tiles sit on the office's lilac, as on the board.
const [ol, od] = PAL.office.map((s) => s.split(' '))
const lilac = { ...theme('office'), bg: [ol[4]], dark: { ...theme('office').dark, bg: [od[4]] } }

const tile = (card, value, label, icon) => V([
  H([ic(icon, 14, { color: 'accent' }), sp(), mark('{tint}', 12)]),
  sp(),
  t(value, 34, 600, 'rd'),
  m(label, 12, { lines: 1 }),
], { card, bg: 'tile', radius: 14, height: 106, padding: [12], maxW: true })

const fine = (card, icon, title, value) => H([
  mark('{tint}', 11), ic(icon, 12, { color: 'muted' }), t(title, 13, 600), sp(4), m(value, 12, { lines: 1 }),
], { card, spacing: 6, maxW: true })

export default [
  design(17, 'Big six', 'mail', 'small', 'any', ['mail'], root([
    H([
      t('{value}', 78, 600, 'rd', { tracking: -2 }),
      V([ic('env', 17, { color: 'accent' }), m('need\nyou', 13, { lines: 2 })], { spacing: 4, padding: [0, 0, 12, 0] }),
    ], { spacing: 8, align: 'bottom' }),
    sp(),
    { type: 'each', style: 'row', spacing: 7, align: 'bottom', limit: 6, children: [Z([
      { type: 'rect', color: 'warn', height: 40, radius: 4, maxW: true, when: '{item.tint} == warn' },
      { type: 'rect', color: 'muted@0.35', height: 9, radius: 3, maxW: true, when: '{item.tint} != warn' },
    ])] },
  ]), { theme: theme('mail'), note: 'How many mails need you, one bar per account.' }),

  design(18, 'Today, with its time', 'neural', 'small', 'any', ['neural'], root([
    head('nodes', 'Neural', m('{time}', 12)),
    gap(10),
    t('+{data.today}', 31, 600, 'rd'),
    m('nodes today · +{data.hour}/h', 12),
    sp(),
    { type: 'bars', box: [126, 32], width: 126, height: 32, spacing: 1.6, cap: 364, color: 'accent' },
  ]), { theme: theme('lucid'), note: 'Growth today, with the hour it was counted.' }),

  design(19, 'Three taps', 'today', 'small', 'any', ['lucid'], root([
    H([t('Today', 15, 600), sp(), t('{data.done}/{data.total}', 15, 600, 'rd', { color: 'accent' })]),
    sp(),
    { type: 'each', limit: 3, spacing: 9, children: [H([habit(30), t('{item.tag}', 15, 600, 'rd')], { spacing: 10 })] },
  ]), { theme: theme('lucid'), note: 'Your three habits; tap a circle to tick it.' }),

  design(20, 'Tear-off day', 'taxes', 'small', 'any', ['taxes-ustva'], V([
    { type: 'rect', color: 'accent', height: 8, maxW: true },
    V([
      { type: 'date', style: 'dayDot', date: '{data.dueAt}', size: 13, weight: 'semibold', color: 'accent' },
      { type: 'date', style: 'day', date: '{data.dueAt}', size: 60, weight: 'regular', design: 'serif' },
      t('UStVA {data.quarter}', 14, 600),
      sp(),
      H([ic('clock', 12, { color: 'accent' }), { type: 'date', date: '{data.dueAt}', text: ' days to go', size: 12, weight: 'semibold', color: 'accent' }], { spacing: 4 }),
    ], { padding: [10, 16, 14, 16], maxW: true, maxH: true, frameAlign: 'topLeading' }),
  ], { maxW: true, maxH: true, frameAlign: 'top' }), { theme: theme('taxes'), note: 'The UStVA due date as a calendar page.' }),

  design(21, 'Open bubble', 'asks', 'small', 'any', ['office-asks'], root([
    Z([
      cv(104, 84, [{ type: 'path', d: BUBBLE, stroke: 'ink', line: 3 }]),
      t('{value}', 40, 600, 'rd', { y: -3 }),
    ], { maxW: true }),
    sp(),
    t('asks for you', 14, 600),
    m('{caption}', 11, { lines: 1, opacity: 0.8 }),
  ], { padding: [14, 16, 14, 16] }), { theme: lilac, note: 'Questions and decisions the office is holding for you.' }),

  design(22, 'All quiet', 'tv', 'small', 'any', ['tv-alerts'], root([
    H([
      cv(74, 56, [
        { type: 'rect', x: 2, y: 2, width: 70, height: 44, radius: 9, stroke: 'ink', line: 2.6 },
        { type: 'path', d: 'M14 25h11l4-8 6 16 5-10 3 2h17', stroke: 'muted', line: 2.2 },
        { type: 'path', d: 'M29 53h16M37 46v7', stroke: 'ink', line: 2.6 },
      ]),
      sp(),
      mark('ok', 18, { when: '{value} == 0' }),
      mark('warn', 18, { when: '{value} != 0' }),
    ], { align: 'top' }),
    sp(),
    H([t('{value}', 34, 600, 'rd'), m('{label}', 13)], { spacing: 5, align: 'firstBaseline' }),
    m('{caption}', 12, { lines: 1 }),
  ]), { theme: theme('tv'), note: 'TV alerts; a tick when nothing is wrong.' }),

  design(23, 'Window, photo crop', 'mail', 'small', 'any', ['mail'], root([
    H([ic('env', 13), t('Mail', 13, 600)], { spacing: 5 }),
    sp(),
    t('{value}', 52, 600, 'rd', { tracking: -1 }),
    m('need you', 12),
    gap(8),
    { type: 'each', style: 'row', spacing: 5, align: 'bottom', limit: 6, children: [Z([
      { type: 'rect', color: 'ink', height: 26, radius: 3, maxW: true, when: '{item.tint} == warn' },
      { type: 'rect', color: 'ink@0.45', height: 7, radius: 2.5, maxW: true, when: '{item.tint} != warn' },
    ])] },
  ]), { theme: photoTheme('wall-nyc.jpg'), note: 'Mail over one of your own photos. White type, so it suits dark photos.' }),

  design(24, 'Unread threads', 'hq', 'medium', 'any', ['hq'], root([H([
    V([
      ic('stack', 20, { color: 'accent' }),
      t('{value}', 44, 600, 'rd'),
      m('unread', 12),
      sp(),
      m('{caption}', 11, { lines: 2 }),
    ], { width: 88, maxH: true, frameAlign: 'topLeading' }),
    V([
      { type: 'each', limit: 3, spacing: 0, children: [V([
        H([t('{item.title}', 13, 600, 'sys', { lines: 1 }), sp(6), m('{item.detail}', 12)], { padding: [8, 0, 8, 0] }),
        div(),
      ])] },
    ], { maxW: true, maxH: true, frameAlign: 'topLeading' }),
  ], { spacing: 14, align: 'top', maxH: true })]), { theme: theme('hq'), note: 'HQ sessions waiting on you, newest first.' }),

  design(25, 'The temple', 'board', 'medium', 'any', ['olympus'], root([H([
    temple(2),
    V([
      H([t('{data.carried}', 44, 500, 'se'), m('of {data.total}\ncarried', 12, { lines: 2 })], { spacing: 6, align: 'bottom' }),
      gap(6),
      H([mark('warn', 10), t('{data.wait} wait on you', 13, 600)], { spacing: 5 }),
      sp(),
      m('Board · {age} ago', 11),
    ], { maxW: true, maxH: true, frameAlign: 'topLeading' }),
  ], { spacing: 16, maxH: true })]), { theme: theme('olympus'), note: 'One pillar per motion: solid carried, dashed waiting on you.' }),

  design(26, 'Tailnet floor', 'network', 'medium', 'any', ['argus'], root([H([
    V([
      cv(84, 84, [{ type: 'repeat', count: '{data.devices}', value: '{data.online}', columns: 3, width: 24, height: 24, spacing: 6, radius: 6,
        color: 'ink', track: 'muted', strokeWidth: 1.4, dash: [3, 2.4] }]),
      gap(8),
      t('{data.online}/{data.devices} online', 11, 500, 'mo', { color: 'muted' }),
    ], { width: 96 }),
    V([
      H([ic('net', 14), t('Network', 13, 600)], { spacing: 5 }),
      t('{label}', 19, 500, 'mo'),
      gap(8),
      { type: 'each', limit: 3, spacing: 6, children: [H([mark('{item.tint}', 11), t('{item.title}', 12, 500, 'sys', { lines: 1 })], { spacing: 6 })] },
    ], { maxW: true, maxH: true, frameAlign: 'topLeading' }),
  ], { spacing: 14, align: 'top', maxH: true })]), { theme: theme('argus'), note: 'One square per tailnet device, and the checks worth a look.' }),

  design(27, 'Faces', 'office', 'medium', 'any', ['office'], root([
    head('bldg', 'Office', m('{data.busy} busy · {data.hold} you hold', 12)),
    sp(),
    { type: 'each', style: 'row', spacing: 4, limit: 6, children: [V([face(36), t('{item.title}', 11, 600)], { align: 'center', spacing: 3 })] },
    sp(),
    m('{data.who}: {data.task}', 12, { lines: 1, when: '{data.busy} > 0' }),
    m('Nobody working · last {data.last}', 12, { lines: 1, when: '{data.busy} == 0' }),
  ]), { theme: theme('office'), note: 'The Kels by face; a green ring on whoever is working.' }),

  design(28, 'Runway', 'calendar', 'medium', 'any', ['vesta', 'taxes-ustva'], root([
    head('cal', 'Coming up', m('{caption}', 12)),
    sp(),
    Z([
      { type: 'rect', color: 'line', height: 2, maxW: true },
      H([
        { type: 'circle', color: 'ink', width: 12, height: 12 },
        sp(),
        { type: 'circle', color: 'accent', width: 12, height: 12 },
        sp(),
        cv(14, 14, [{ type: 'path', d: 'M7 0 14 7 7 14 0 7z', color: 'warn' }]),
      ]),
    ]),
    gap(8),
    H([
      V([t('Today', 12, 600), m('{data.today} planned', 11)]),
      sp(6),
      V([
        { type: 'date', style: 'dayTime', date: '{data.nextAt}', size: 12, weight: 'semibold' },
        m('{data.next}', 11, { lines: 1 }),
      ], { align: 'center' }),
      sp(6),
      V([
        { type: 'date', style: 'dayMonth', date: '{data.dueAt}', size: 12, weight: 'semibold', card: 'taxes-ustva' },
        m('UStVA', 11),
      ], { align: 'trailing' }),
    ], { align: 'top' }),
  ]), { theme: theme('vesta'), note: 'Today, the next calendar thing and the tax deadline on one line.' }),

  design(29, 'What wants you', 'overview', 'large', 'any', ['*'], root([
    H([t('Wants you', 17, 700), sp(), m('{time}', 12)]),
    gap(10),
    H([tile('mail', '{value}', 'mails need you', 'env'), tile('office-asks', '{value}', 'asks for you', 'qbub')], { spacing: 8 }),
    gap(8),
    H([tile('hq', '{value}', 'unread in HQ', 'stack'), tile('olympus', '{data.wait}', 'wait on you', 'cols')], { spacing: 8 }),
    sp(),
    H([fine('lucid', 'sun.max', 'Today', '{value}'), fine('argus', 'net', 'Network', '{label}')], { spacing: 10 }),
    gap(8),
    H([fine('tv-alerts', 'tv', 'Alerts', '{caption}'), fine('vesta', 'cal', 'Calendar', '{caption}')], { spacing: 10 }),
  ]), { theme: theme('keled'), note: 'The four that want you as tiles, the rest as one line each.' }),

  design(30, 'Pigeonholes', 'mail', 'large', 'any', ['mail', 'mail-claude'], root([
    H([ic('env', 15, { color: 'accent' }), t('Mail', 15, 600), sp(), t('{value} need you', 13, 600, 'sys', { color: 'accent' })], { spacing: 5 }),
    gap(12),
    { type: 'each', columns: 2, limit: 6, spacing: 8, children: [H([
      { type: 'rect', color: 'warn', width: 3, height: 58, radius: 1.5, when: '{item.tint} == warn' },
      V([
        t('{item.title}', 11, 600, 'mo', { color: 'muted', lines: 1 }),
        t('{item.tag}', 18, 600, 'mo'),
        m('{item.detail}', 11, { lines: 1 }),
      ], { spacing: 1, maxW: true, frameAlign: 'leading' }),
    ], { spacing: 8, padding: [8, 10, 8, 8], bg: 'tile', radius: 10, maxW: true })] },
    sp(),
    H([ic('tag', 12, { color: 'muted' }), m('{cards.mail-claude.value} marked for Claude', 12)], { spacing: 5 }),
  ]), { theme: theme('mail'), note: 'Every mail account as a pigeonhole, plus what is marked for Claude.' }),

  design(31, 'Themis on the table', 'board', 'large', 'any', ['olympus'], root([
    H([
      Z([{ type: 'rect', color: 'accent', width: 72, height: 72, radius: 14 }, img('themis.png', 64, 66, { fit: 'fit', y: 3 })], { width: 72, height: 72, radius: 14 }),
      V([t('{data.carried}/{data.total}', 34, 500, 'se'), m('carried · board {age} ago', 12)], { spacing: 1 }),
    ], { spacing: 12 }),
    gap(12),
    t('{caption}', 17, 400, 'se', { lines: 3 }),
    gap(10),
    H([mark('warn', 10), t('{data.wait} wait on you', 13, 600)], { spacing: 5 }),
    gap(4),
    { type: 'each', test: '{item.tint} == warn', limit: 3, spacing: 0, children: [V([
      div(),
      t('{item.title}', 13, 500, 'sys', { lines: 1, padding: [8, 0, 8, 0] }),
    ])] },
  ]), { theme: theme('olympus'), note: 'Themis, the board count, the next letter and what waits on you.' }),
]
