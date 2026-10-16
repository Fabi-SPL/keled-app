// Lock screen designs, iPhone (W01-W16) and iPad (W38-W40). The system draws these monochrome
// ("vibrant") over a blur of the wallpaper, so status is shape, never colour, and faces are initials.
import { t, m, V, H, Z, sp, mark, cv, ic, glyph, lockRoot, disc, design } from '../kit.mjs'

const BUBBLE = 'M36 9c15 0 27 9.9 27 22.2S51 53.4 36 53.4c-2.9 0-5.7-.4-8.3-1.1L14.5 59l3.2-10.3C12.3 44.6 9 38.3 9 31.2 9 18.9 21 9 36 9z'

// Six pillars on a 62 x 56 temple, one per motion on the board: solid when carried, dashed when held.
const temple = (w, h, s) => cv(w, h, [
  { type: 'path', d: `M${3 * s} ${12.5 * s} ${31 * s} ${2 * s}l${28 * s} ${10.5 * s}z` },
  { type: 'rect', x: 2 * s, y: 14 * s, width: 58 * s, height: 3.6 * s },
  { type: 'repeat', count: '{data.total}', value: '{data.carried}', x: 4.5 * s, y: 21 * s, height: 27 * s, fit: 'spread', spacing: 2.4 * s,
    track: 'ink', strokeWidth: 1.4 * s, dash: [2.6 * s, 2 * s] },
  { type: 'rect', x: 0, y: 50.5 * s, width: 62 * s, height: 4 * s },
])

export default [
  design(1, 'Account bracelet', 'mail', 'circular', 'any', ['mail'], lockRoot(Z([
    cv(72, 72, [{ type: 'arcs', count: '{count}', from: 7, spacing: 14, r: 31, test: '{item.tint} == warn', line: 5.5, strokeWidth: 2 }]),
    V([ic('env', 12), t('{value}', 28, 600, 'rd')], { align: 'center', spacing: 0 }),
  ])), { note: 'One arc per mail account; thick where an account needs you.' }),

  design(2, 'Growth clock', 'neural', 'circular', 'any', ['neural'], lockRoot(Z([
    cv(72, 72, [{ type: 'rays', limit: 12, r: 19, from: 21, size: 13.5, line: 3.6, cap: 364 }]),
    V([t('+{data.hour}', 14, 600, 'rd'), m('/h', 10)], { align: 'center' }),
  ])), { note: 'Twelve rays for the last twelve hours of network growth.' }),

  design(3, 'Deadline gauge', 'taxes', 'circular', 'any', ['taxes-ustva'], lockRoot(Z([
    cv(72, 72, [{ type: 'gauge', from: 225, to: 495, r: 29, line: 4.5, start: '{data.from}', date: '{data.dueAt}' }]),
    V([{ type: 'date', date: '{data.dueAt}', size: 23, weight: 'semibold', design: 'rounded' }, m('days', 10)], { align: 'center', y: -2 }),
    t('{value}', 11, 600, 'sys', { maxH: true, frameAlign: 'bottom', padding: [0, 0, 3, 0] }),
  ])), { note: 'Fills as the UStVA deadline comes closer.' }),

  design(4, 'Solid bubble', 'asks', 'circular', 'any', ['office-asks'], lockRoot(Z([
    cv(72, 72, [{ type: 'path', d: BUBBLE }]),
    t('{value}', 30, 600, 'rd', { knock: true, y: -5 }),
  ])), { note: 'Asks waiting for you, punched through a speech bubble.' }),

  design(5, 'Thread stack', 'hq', 'circular', 'any', ['hq'], lockRoot(Z([
    cv(72, 72, [
      { type: 'rect', x: 25, y: 14, width: 22, height: 4.5, radius: 2.2, opacity: 0.45 },
      { type: 'rect', x: 20, y: 21, width: 32, height: 5, radius: 2.5, opacity: 0.7 },
      { type: 'rect', x: 15, y: 29, width: 42, height: 28, radius: 8 },
    ]),
    t('{value}', 22, 600, 'rd', { knock: true, y: 7 }),
  ])), { note: 'Unread HQ sessions on a stack of threads.' }),

  design(6, 'Habit trio', 'today', 'circular', 'any', ['lucid'], lockRoot(Z([
    { type: 'each', test: '{index} == 1', limit: 1, y: -18, children: [{ type: 'check', style: 'glyph', size: 26.6, scale: 0.6, line: 1.7, action: '{item.action}', symbol: '{item.symbol}', color: 'ink' }] },
    { type: 'each', test: '{index} == 2', limit: 1, x: -14.5, y: 10, children: [{ type: 'check', style: 'glyph', size: 26.6, scale: 0.6, line: 1.7, action: '{item.action}', symbol: '{item.symbol}', color: 'ink' }] },
    { type: 'each', test: '{index} == 3', limit: 1, x: 14.5, y: 10, children: [{ type: 'check', style: 'glyph', size: 26.6, scale: 0.6, line: 1.7, action: '{item.action}', symbol: '{item.symbol}', color: 'ink' }] },
  ])), { note: 'Your three habits; tap one to tick it.' }),

  design(7, 'Odometer, dated', 'neural', 'rectangular', 'any', ['neural'], lockRoot(V([
    H([ic('nodes', 13), t('Neural network', 13, 600)], { spacing: 5 }),
    t('{value}', 25, 600, 'mo'),
    H([ic('clock', 11, { color: 'muted' }), m('at {time} · +{data.hour}/h', 12)], { spacing: 4 }),
  ], { spacing: 1 }), { frameAlign: 'leading' }), { note: 'Total nodes, with the time it was counted.' }),

  design(8, 'She wrote', 'cura', 'rectangular', 'any', ['cura'], lockRoot(H([
    V([ic('bub', 15), t('{value}', 24, 600, 'rd'), m('{label}', 11)], { width: 44 }),
    t('{caption}', 12, 500, 'sys', { lines: 3, privacy: true, maxW: true, frameAlign: 'leading' }),
  ], { spacing: 8, align: 'top' }), { frameAlign: 'leading' }), { note: 'How long since Cura wrote, and her first line. Hidden while locked.' }),

  design(9, 'Who is in', 'office', 'rectangular', 'any', ['office'], lockRoot(V([
    t('{data.busy} busy · {data.hold} you hold', 13, 600),
    { type: 'each', style: 'row', spacing: 4, limit: 6, children: [disc(21)] },
    m('{data.who}: {data.task}', 11, { when: '{data.busy} > 0' }),
    m('{caption}', 11, { when: '{data.busy} == 0' }),
  ], { spacing: 4 }), { frameAlign: 'leading' }), { note: 'One ring per Kel, filled while she works.' }),

  design(10, 'Four lights', 'network', 'rectangular', 'any', ['argus'], lockRoot(V([
    H([t('Network', 13, 600), sp(), t('{label}', 12, 500, 'mo')]),
    { type: 'each', columns: 4, limit: 4, spacing: 4, children: [V([mark('{item.tint}', 18), t('{item.tag}', 11, 500, 'mo')], { align: 'center', spacing: 4, maxW: true })] },
  ], { spacing: 8 })), { note: 'Argus checks as marks: dot wants you, tick is fine.' }),

  design(11, 'Kickoff timer', 'calendar', 'rectangular', 'any', ['vesta'], lockRoot(V([
    H([ic('ball', 13), t('{data.next}', 13, 600)], { spacing: 5 }),
    { type: 'date', style: 'timer', date: '{data.nextAt}', size: 25, weight: 'semibold', design: 'mono' },
    { type: 'date', style: 'dayTime', date: '{data.nextAt}', text: ' · {caption}', size: 12, weight: 'medium', color: 'muted' },
  ], { spacing: 1 }), { frameAlign: 'leading' }), { note: 'Counts down to the next thing on the calendar, live.' }),

  design(12, 'Six pillars', 'board', 'rectangular', 'any', ['olympus'], lockRoot(H([
    temple(62, 56, 1),
    V([t('{data.carried}/{data.total}', 28, 500, 'se'), m('carried · {data.wait} wait', 11)], { spacing: 1 }),
  ], { spacing: 10 }), { frameAlign: 'leading' }), { note: 'One pillar per motion: solid carried, dashed waiting on you.' }),

  design(13, 'Account ledger', 'mail', 'rectangular', 'any', ['mail'], lockRoot(H([
    V([t('{value}', 34, 600, 'rd'), H([ic('env', 11), m('need you', 11)], { spacing: 3 })]),
    V([
      { type: 'each', test: '{item.tint} == warn', limit: 2, spacing: 2, children: [H([mark('warn', 7), t('{item.title}', 12, 500, 'mo'), sp(4), t('{item.value}', 12, 500, 'mo')], { spacing: 4 })] },
      H([mark('ok', 13), m('{data.clear} clear', 12)], { spacing: 4 }),
    ], { spacing: 2, maxW: true }),
  ], { spacing: 10 }), { frameAlign: 'leading' }), { note: 'Which accounts need you, and how many are clear.' }),

  design(14, 'Next match', 'calendar', 'inline', 'any', ['vesta'],
    { type: 'date', style: 'dayTime', date: '{data.nextAt}', label: '{@soccerball} ', text: ' · {data.next}' },
    { note: 'The next calendar thing, one line above the clock.' }),

  design(15, 'Four that want you', 'overview', 'inline', 'any', ['mail', 'office-asks', 'hq', 'olympus'],
    t(`${glyph('env')} {cards.mail.value}  ${glyph('qbub')} {cards.office-asks.value}  ${glyph('stack')} {cards.hq.value}  ${glyph('cols')} {cards.olympus.data.wait}`, 13),
    { note: 'Mail, asks, HQ and the board in one line.' }),

  design(16, 'Tax countdown', 'taxes', 'inline', 'any', ['taxes-ustva'],
    { type: 'date', date: '{data.dueAt}', label: `${glyph('doc')} UStVA in `, text: ' days' },
    { note: 'Days until the UStVA is due.' }),

  // ---------- iPad lock screen ----------
  design(38, 'Tailnet ring', 'network', 'circular', 'pad', ['argus'], lockRoot(Z([
    cv(72, 72, [{ type: 'arcs', count: '{data.devices}', value: '{data.online}', from: 5, spacing: 10, r: 30, line: 5, strokeWidth: 2 }]),
    V([ic('net', 12), t('{data.online}/{data.devices}', 16, 500, 'mo')], { align: 'center', spacing: 1 }),
  ])), { note: 'One arc per tailnet device, thick when online.' }),

  design(39, 'Next letter', 'board', 'rectangular', 'pad', ['olympus'], lockRoot(V([
    H([ic('cols', 13), t('{data.carried}/{data.total}', 15, 500, 'se'), m('carried · {data.wait} wait', 11)], { spacing: 5 }),
    t('{data.next}', 12, 500, 'sys', { lines: 2, privacy: true }),
  ], { spacing: 3 }), { frameAlign: 'leading' }), { note: 'The first held motion. Hidden while locked.' }),

  design(40, 'Who is working', 'office', 'inline', 'pad', ['office'], Z([
    t(`${glyph('bldg')} {data.who} working · {data.hold} you hold`, 13, 500, 'sys', { when: '{data.busy} > 0' }),
    t(`${glyph('bldg')} nobody working · {data.hold} you hold`, 13, 500, 'sys', { when: '{data.busy} == 0' }),
  ]), { note: 'Who is working right now.' }),
]
