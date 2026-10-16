// StandBy (W32-W37, iPhone on its side while charging) and iPad designs (W41-W53).
// StandBy draws these without a background on black, and red at night, so they lean on type.
import { theme, photoTheme, t, m, V, H, Z, sp, gap, div, mark, cv, img, ic, root, face, habit, idle, design } from '../kit.mjs'

const TAG = 'M3 12.2V4.5A1.5 1.5 0 0 1 4.5 3h7.7l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-7.1 7.1a1.5 1.5 0 0 1-2.1 0z'
const HOLE = 'M9.2 7.8a1.4 1.4 0 1 1-2.8 0a1.4 1.4 0 1 1 2.8 0z'

const stand = (children, o = {}) => V(children, { align: 'center', spacing: 2, padding: [10], maxW: true, maxH: true, frameAlign: 'center', ...o })
const head = (icon, title, right) => H([ic(icon, 14, { color: 'accent' }), t(title, 13, 600), sp(6), right].filter(Boolean), { spacing: 5 })

const tile = (card, value, label, icon) => V([
  H([ic(icon, 14, { color: 'accent' }), sp(), mark('{tint}', 12)]),
  sp(),
  t(value, 32, 600, 'rd'),
  m(label, 12, { lines: 1 }),
], { card, bg: 'tile', radius: 14, height: 112, padding: [12], maxW: true })

const fine = (card, icon, title, value) => H([
  mark('{tint}', 11), ic(icon, 12, { color: 'muted' }), t(title, 13, 600), sp(6), m(value, 12, { lines: 1 }),
], { card, spacing: 6, maxW: true })

export default [
  // ---------- StandBy ----------
  design(32, 'Rate, not a counter', 'neural', 'small', 'phone', ['neural'], stand([
    m('nodes last hour', 12),
    t('+{data.hour}', 50, 600, 'rd', { tracking: -1 }),
    gap(6),
    { type: 'bars', box: [136, 26], width: 136, height: 26, spacing: 2.4, cap: 364, limit: 12, color: 'accent' },
    gap(6),
    m('{value} at {time}', 11),
  ]), { theme: theme('lucid'), note: 'How fast the network grows, for the nightstand.' }),

  design(33, 'Kickoff', 'calendar', 'small', 'phone', ['vesta'], stand([
    ic('ball', 18, { color: 'accent' }),
    t('{data.next}', 13, 600, 'sys', { lines: 2, align: 'center' }),
    gap(4),
    { type: 'date', style: 'timer', date: '{data.nextAt}', size: 34, weight: 'semibold', design: 'mono', align: 'center' },
    { type: 'date', style: 'dayTime', date: '{data.nextAt}', size: 12, weight: 'medium', color: 'muted' },
  ]), { theme: theme('vesta'), note: 'A live countdown to the next calendar thing.' }),

  design(34, 'Habit rings', 'today', 'small', 'phone', ['lucid'], stand([
    t('{data.done}/{data.total}', 26, 600, 'rd'),
    m('habits today', 12),
    gap(12),
    { type: 'each', style: 'row', spacing: 10, limit: 3, children: [{ type: 'check', style: 'ring', size: 40, line: 4, scale: 0.42, action: '{item.action}', symbol: '{item.symbol}', color: 'accent' }] },
  ]), { theme: theme('lucid'), note: 'Three rings that close as you tick each habit. Tap to tick.' }),

  design(35, 'Her message', 'cura', 'small', 'phone', ['cura'], stand([
    H([ic('bub', 14, { color: 'accent' }), m('{value} ago', 12)], { spacing: 5 }),
    gap(6),
    t('{caption}', 15, 500, 'sys', { lines: 4, align: 'center', privacy: true }),
  ]), { theme: theme('cura'), note: 'What Cura last wrote. Hidden while locked.' }),

  design(36, 'Eighty-seven', 'taxes', 'small', 'phone', ['taxes-ustva'], stand([
    { type: 'date', date: '{data.dueAt}', size: 76, weight: 'regular', design: 'serif', color: 'accent' },
    m('days to the UStVA', 12),
    { type: 'date', style: 'dayMonth', date: '{data.dueAt}', label: 'due ', size: 12, weight: 'semibold' },
  ], { spacing: 0 }), { theme: theme('taxes'), note: 'Days left until the UStVA is due, big.' }),

  design(37, 'Ada at work', 'office', 'small', 'phone', ['office'], stand([
    { type: 'each', test: '{item.on}', limit: 1, children: [V([
      face(52),
      t('{item.title}', 15, 600),
      m('{item.detail}', 12, { lines: 2, align: 'center' }),
    ], { align: 'center', spacing: 3 })] },
    V([idle(30), t('Nobody working', 14, 600), m('last {data.last}', 12)], { align: 'center', spacing: 4, when: '{data.busy} == 0' }),
    gap(4),
    m('{data.hold} you hold', 11),
  ]), { theme: theme('office'), note: 'Whichever Kel is working right now, by face.' }),

  // ---------- iPad lock screen (small widgets in the side column) ----------
  design(41, 'Thread cards', 'hq', 'small', 'pad', ['hq'], root([
    H([ic('stack', 14), t('HQ', 13, 600), sp(), t('{value}', 15, 600, 'rd')], { spacing: 5 }),
    gap(8),
    { type: 'each', limit: 3, spacing: 5, children: [t('{item.title}', 12, 600, 'sys', { lines: 1, padding: [6, 8, 6, 8], bg: 'fill', radius: 9, maxW: true, frameAlign: 'leading' })] },
  ], { padding: [12] }), { theme: theme('hq'), note: 'Unread HQ sessions as cards, for the iPad lock screen.' }),

  design(42, 'Twenty-four hours', 'neural', 'small', 'pad', ['neural'], root([
    head('nodes', 'Neural'),
    gap(6),
    t('+{data.today}', 26, 600, 'rd'),
    m('today · {time}', 11),
    sp(),
    { type: 'bars', box: [132, 50], width: 132, height: 50, spacing: 1.6, cap: 364, color: 'ink' },
  ], { padding: [12] }), { theme: theme('lucid'), note: 'The last 24 hours of growth, hour by hour.' }),

  design(43, 'Big habit glyphs', 'today', 'small', 'pad', ['lucid'], root([
    H([t('Today', 14, 600), sp(), t('{data.done}/{data.total}', 14, 600, 'rd')]),
    sp(),
    { type: 'each', style: 'row', spacing: 8, limit: 3, children: [habit(38, { color: 'ink' })] },
    gap(6),
  ], { padding: [12] }), { theme: theme('lucid'), note: 'Three habit buttons, big enough to hit on the lock screen.' }),

  // ---------- iPad home ----------
  design(44, 'Nothing marked', 'mail', 'small', 'pad', ['mail-claude'], root([
    cv(64, 64, [{ type: 'path', d: TAG, stroke: 'muted', line: 1.3, dash: [2.2, 1.8] }, { type: 'path', d: HOLE, color: 'muted' }], { box: [24, 24] }),
    sp(),
    t('{value}', 34, 600, 'rd'),
    m('marked for Claude', 12),
    m('{caption}', 11, { lines: 1 }),
  ]), { theme: theme('mail'), note: 'Mails you marked for Claude; an empty tag when there are none.' }),

  design(45, 'An empty day', 'calendar', 'small', 'pad', ['vesta'], root([
    { type: 'date', style: 'weekdayLong', date: 'now', size: 13, weight: 'semibold', color: 'accent' },
    { type: 'date', style: 'day', date: 'now', size: 54, weight: 'regular' },
    H([idle(9), m('{caption}', 12, { lines: 1 })], { spacing: 6 }),
    sp(),
    div(),
    gap(6),
    H([ic('ball', 11), { type: 'date', style: 'dayTime', date: '{data.nextAt}', size: 12, weight: 'semibold' }], { spacing: 4 }),
    m('{data.next}', 11, { lines: 1 }),
  ]), { theme: theme('vesta'), note: 'Today as a date, and what comes next.' }),

  design(46, 'Three cards', 'hq', 'medium', 'pad', ['hq'], root([
    H([ic('stack', 14, { color: 'accent' }), t('HQ', 13, 600), sp(), m('{value} unread', 12)], { spacing: 5 }),
    gap(10),
    { type: 'each', columns: 3, limit: 3, spacing: 8, children: [V([
      mark('{item.tint}', 10),
      gap(6),
      t('{item.title}', 13, 600, 'sys', { lines: 3 }),
      sp(),
      m('{item.detail}', 11),
    ], { bg: 'tile', radius: 12, padding: [10], maxW: true, maxH: true, frameAlign: 'topLeading' })] },
  ]), { theme: theme('hq'), note: 'Three HQ sessions side by side.' }),

  design(47, 'Checklist', 'network', 'medium', 'pad', ['argus'], root([
    H([ic('net', 14), t('Network', 13, 600), sp(), t('{label}', 12, 500, 'mo')], { spacing: 5 }),
    gap(10),
    { type: 'each', limit: 4, spacing: 7, children: [H([
      mark('{item.tint}', 12),
      t('{item.title}', 12, 500, 'sys', { lines: 1 }),
      sp(6),
      t('{item.tag}', 10, 500, 'mo', { color: 'muted', padding: [2, 6, 2, 6], stroke: 'line', radius: 4 }),
    ], { spacing: 7 })] },
  ]), { theme: theme('argus'), note: 'Every Argus check with its mark.' }),

  design(48, 'Desk floor', 'office', 'large', 'pad', ['office'], root([
    H([ic('bldg', 15, { color: 'accent' }), t('Office', 15, 600), sp(), m('{data.busy} busy', 12)], { spacing: 5 }),
    gap(10),
    { type: 'each', columns: 3, limit: 6, spacing: 10, rowSpacing: 12, children: [V([
      Z([
        { type: 'rect', color: 'tile', width: 84, height: 26, radius: 6, y: 24, when: '{item.on}' },
        { type: 'rect', stroke: 'line', dash: [3, 3], width: 84, height: 26, radius: 6, y: 24, when: '!{item.on}' },
        face(36, { y: -6 }),
      ], { width: 88, height: 82 }),
      t('{item.title}', 12, 600),
    ], { align: 'center', spacing: 2, maxW: true })] },
    sp(),
    V([m('Now', 11), t('{data.who}: {data.task}', 13, 600, 'sys', { lines: 2 })], { bg: 'fill', radius: 10, padding: [10], maxW: true, when: '{data.busy} > 0' }),
    gap(8),
    m('{data.hold} you hold · {data.assigned} assigned · last {data.last}', 11, { lines: 1 }),
  ]), { theme: theme('office'), note: 'The office floor: a desk per Kel, lit where someone works.' }),

  design(49, 'Growth field', 'neural', 'large', 'pad', ['neural'], root([
    H([ic('nodes', 14, { color: 'accent' }), t('Neural network', 13, 600), sp(), m('{time}', 12)], { spacing: 5 }),
    gap(8),
    t('{value}', 40, 600, 'mo'),
    m('+{data.today} today · +{data.hour} last hour', 12),
    sp(),
    { type: 'bars', box: [324, 112], width: 310, height: 108, spacing: 3, cap: 364, color: 'accent', maxW: true },
    gap(4),
    H([m('24h ago', 10), sp(), m('now', 10)]),
    gap(10),
    H([
      V([m('Memories', 11), t('{items.0.detail}', 15, 600, 'mo')]),
      sp(),
      V([m('Branches', 11), t('{items.1.detail}', 15, 600, 'mo')], { align: 'trailing' }),
    ]),
  ]), { theme: theme('lucid'), note: 'The whole day of growth as a field of bars.' }),

  design(50, 'Sorted by weight', 'overview', 'xl', 'pad', ['*'], root([
    H([t('Sorted by weight', 17, 700), sp(), m('{wants} apps want you · {time}', 12)]),
    gap(12),
    H([
      V([
        H([tile('mail', '{value}', 'mails need you', 'env'), tile('office-asks', '{value}', 'asks for you', 'qbub'), tile('hq', '{value}', 'unread in HQ', 'stack')], { spacing: 8 }),
        gap(8),
        H([tile('olympus', '{data.wait}', 'wait on you', 'cols'), tile('argus', '{data.open}', 'to check', 'net'), tile('cura', '{value}', 'since Cura wrote', 'bub')], { spacing: 8 }),
      ], { width: 430 }),
      V([
        t('Fine', 15, 600),
        gap(6),
        fine('lucid', 'sun.max', 'Today', '{value} habits'),
        fine('neural', 'nodes', 'Neural', '+{data.today} today'),
        fine('vesta', 'cal', 'Calendar', '{caption}'),
        fine('taxes-ustva', 'doc', 'UStVA', '{label}'),
        fine('tv-alerts', 'tv', 'Alerts', '{caption}'),
        fine('mail-claude', 'tag', 'For Claude', '{caption}'),
        fine('office', 'bldg', 'Office', '{value}'),
      ], { spacing: 9, maxW: true, frameAlign: 'topLeading' }),
    ], { spacing: 18, align: 'top' }),
  ]), { theme: theme('keled'), note: 'What wants you as tiles, everything fine as a list.' }),

  design(51, 'The Kels', 'office', 'xl', 'pad', ['office'], root([
    H([ic('bldg', 15, { color: 'accent' }), t('Office', 15, 600), sp(), m('{data.busy} busy · {data.hold} you hold · last {data.last}', 12)], { spacing: 5 }),
    sp(),
    { type: 'each', style: 'row', spacing: 14, limit: 6, children: [V([
      face(80),
      t('{item.title}', 15, 600),
      H([mark('ok', 10, { when: '{item.on}' }), { ...idle(9), when: '!{item.on}' }, m('{item.detail}', 11, { lines: 1 })], { spacing: 4 }),
    ], { align: 'center', spacing: 4, width: 96 })] },
    sp(),
    H([ic('bldg', 13), t('{data.who}, now: {data.task}', 13, 600, 'sys', { lines: 1 })], { spacing: 6, bg: 'fill', radius: 10, padding: [10, 12, 10, 12], maxW: true, frameAlign: 'leading', when: '{data.busy} > 0' }),
  ]), { theme: theme('office'), note: 'All six Kels, big; a green ring on whoever is working.' }),

  design(52, 'The board, with Themis', 'board', 'xl', 'pad', ['olympus'], root([H([
    Z([
      { type: 'rect', color: 'accent', radius: 16, maxW: true, maxH: true },
      img('themis.png', 196, 290, { fit: 'fit', y: 10 }),
    ], { width: 212, maxH: true, radius: 16 }),
    V([
      t('{data.carried}/{data.total}', 56, 500, 'se'),
      m('carried · board {age} ago', 13),
      gap(10),
      t('{caption}', 19, 400, 'se', { lines: 3 }),
      gap(10),
      H([mark('warn', 10), t('{data.wait} wait on you', 14, 600)], { spacing: 5 }),
      gap(4),
      { type: 'each', test: '{item.tint} == warn', limit: 4, spacing: 0, children: [V([div(), t('{item.title}', 14, 500, 'sys', { lines: 1, padding: [7, 0, 7, 0] })])] },
    ], { maxW: true, maxH: true, frameAlign: 'topLeading' }),
  ], { spacing: 20, align: 'top', maxH: true })]), { theme: theme('olympus'), note: 'Themis beside the board: the count, the next letter, what waits on you.' }),

  design(53, 'Window on the night', 'overview', 'xl', 'pad', ['lucid', 'neural', 'vesta'], root([H([
    V([
      { type: 'date', style: 'weekdayLong', date: 'now', size: 17, weight: 'semibold' },
      { type: 'date', style: 'day', date: 'now', size: 72, weight: 'light' },
      sp(),
      t('{data.done}/{data.total}', 40, 600, 'rd'),
      m('habits today', 12),
      gap(10),
      { type: 'each', style: 'row', spacing: 10, limit: 3, children: [habit(44)] },
    ], { maxH: true, frameAlign: 'topLeading' }),
    sp(),
    V([
      t('+{cards.neural.data.today}', 34, 600, 'rd'),
      m('nodes today · {cards.neural.time}', 12),
      gap(8),
      { type: 'bars', card: 'neural', box: [260, 60], width: 260, height: 60, spacing: 2, cap: 364, color: 'ink' },
      sp(),
      H([ic('ball', 13), { type: 'date', style: 'dayTime', date: '{data.nextAt}', size: 13, weight: 'semibold', card: 'vesta' }], { spacing: 5 }),
      t('{cards.vesta.data.next}', 15, 600, 'sys', { lines: 1 }),
    ], { width: 270, maxH: true, frameAlign: 'topLeading' }),
  ], { maxH: true })]), { theme: photoTheme('wall-nyc.jpg'), note: 'Today, the network and the next match over one of your photos.' }),
]
