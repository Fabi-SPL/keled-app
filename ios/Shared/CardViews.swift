import SwiftUI
import AppIntents
import WidgetKit

// One renderer for every card in every widget size. The app's gallery draws the same views,
// so a simulator screenshot of the app shows exactly what the widget will show.
// A card with a layout for this size draws that layout (LayoutRenderer.swift); without one it gets
// the built-in look below, dressed in its app's theme if the hub has one.
// Anchor for the built-in look: Apple's own Batteries / Reminders widgets.

struct CardView: View {
    let card: Card
    let family: WidgetFamily
    var live: Bool = true
    var now: Date = Date()

    static func key(_ family: WidgetFamily) -> String {
        switch family {
        case .systemSmall: return "small"
        case .systemMedium: return "medium"
        case .systemLarge: return "large"
        case .systemExtraLarge: return "xl"
        case .accessoryCircular: return "circular"
        case .accessoryRectangular: return "rectangular"
        case .accessoryInline: return "inline"
        default: return "medium"
        }
    }

    private var layout: LayoutNode? {
        let key = CardView.key(family)
        return card.layouts?[key] ?? (key == "xl" ? card.layouts?["large"] : nil)
    }

    var body: some View {
        Themed(card: card) { palette in
            if let layout {
                NodeRenderer.view(layout, LayoutContext(card: card, palette: palette, now: now))
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            } else {
                builtIn
            }
        }
    }

    @ViewBuilder private var builtIn: some View {
        switch family {
        case .accessoryCircular: CircularCard(card: card)
        case .accessoryRectangular: RectangularCard(card: card)
        case .accessoryInline: InlineCard(card: card)
        case .systemSmall: SmallCard(card: card, live: live, now: now)
        case .systemMedium: MediumCard(card: card, live: live, now: now)
        case .systemExtraLarge: LargeCard(card: card, live: live, now: now, rows: 8)
        default: LargeCard(card: card, live: live, now: now, rows: 6)
        }
    }
}

struct CardHeader: View {
    let card: Card
    let live: Bool
    @Environment(\.cardPalette) private var palette

    var body: some View {
        HStack(spacing: 5) {
            Image(systemName: card.symbolName)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(palette.tint(card.tint))
                .widgetAccentable()
            Text(card.title)
                .font(palette.text(13, .semibold))
                .foregroundStyle(palette.ink)
                .lineLimit(1)
            Spacer(minLength: 4)
            FreshnessMark(card: card, live: live)
        }
    }
}

/// Offline beats stale: no connection means every number is the cached one.
struct FreshnessMark: View {
    let card: Card
    let live: Bool
    @Environment(\.cardPalette) private var palette

    var body: some View {
        if !live {
            Image(systemName: "wifi.slash")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(palette.muted)
        } else if card.isStale, let age = card.ageText {
            Text(age)
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(palette.muted)
        }
    }
}

/// The caption line, or the last action's result while it is fresh.
struct CaptionLine: View {
    let card: Card
    let now: Date
    var size: CGFloat = 11
    var lines = 2
    @Environment(\.cardPalette) private var palette

    var body: some View {
        if let flash = card.activeFlash(at: now) {
            Text(flash.text)
                .font(palette.text(size, .semibold))
                .foregroundStyle(palette.tint(flash.tint ?? "ok"))
                .lineLimit(lines)
        } else if let line = card.caption ?? card.items?.first?.title {
            Text(line)
                .font(palette.text(size))
                .foregroundStyle(palette.muted)
                .lineLimit(lines)
                .privacySensitive()
        }
    }
}

struct Ring: View {
    let progress: Double
    let color: Color
    var line: CGFloat = 7

    var body: some View {
        ZStack {
            Circle().stroke(color.opacity(0.18), lineWidth: line)
            Circle()
                .trim(from: 0, to: max(0.001, min(1, progress)))
                .stroke(color, style: StrokeStyle(lineWidth: line, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
    }
}

struct Sparkline: View {
    let values: [Double]
    let color: Color
    var line: CGFloat = 2

    var body: some View {
        GeometryReader { geo in
            let lo = values.min() ?? 0
            let span = max((values.max() ?? 1) - lo, 0.0001)
            Path { p in
                for (i, v) in values.enumerated() {
                    let x = values.count > 1 ? geo.size.width * CGFloat(i) / CGFloat(values.count - 1) : 0
                    let y = geo.size.height * (1 - CGFloat((v - lo) / span))
                    if i == 0 { p.move(to: CGPoint(x: x, y: y)) } else { p.addLine(to: CGPoint(x: x, y: y)) }
                }
            }
            .stroke(color, style: StrokeStyle(lineWidth: line, lineCap: .round, lineJoin: .round))
        }
    }
}

/// The card's headline: a ring for gauges, a dot and a word for status, otherwise the big number.
struct MainFigure: View {
    let card: Card
    var size: CGFloat = 40
    @Environment(\.cardPalette) private var palette

    var body: some View {
        let tint = palette.tint(card.tint)
        if card.kind == "gauge", let p = card.progress {
            HStack(spacing: 10) {
                ZStack {
                    Ring(progress: p, color: tint, line: size * 0.17)
                    Text("\(Int((p * 100).rounded()))")
                        .font(palette.number(size * 0.38))
                        .monospacedDigit()
                        .foregroundStyle(palette.ink)
                }
                .frame(width: size * 1.5, height: size * 1.5)
                if let label = card.label {
                    Text(label).font(palette.text(12, .medium)).foregroundStyle(palette.muted).lineLimit(2)
                }
            }
        } else if card.kind == "status" {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 7) {
                    Circle().fill(tint).frame(width: size * 0.22, height: size * 0.22)
                    Text(card.value ?? "–")
                        .font(palette.number(size * 0.66))
                        .foregroundStyle(palette.ink)
                        .minimumScaleFactor(0.5)
                        .lineLimit(1)
                }
                if let label = card.label {
                    Text(label).font(palette.text(12, .medium)).foregroundStyle(palette.muted).lineLimit(1)
                }
            }
        } else {
            VStack(alignment: .leading, spacing: 0) {
                Text(card.value ?? "–")
                    .font(palette.number(size))
                    .monospacedDigit()
                    .minimumScaleFactor(0.5)
                    .lineLimit(1)
                    .foregroundStyle(card.isStale ? palette.muted : palette.ink)
                if let label = card.label {
                    Text(label).font(palette.text(12, .medium)).foregroundStyle(palette.muted).lineLimit(1)
                }
            }
        }
    }
}

/// A list row. An item with `on` gets a tick box; an item with only an action gets a button at the end.
struct ItemRow: View {
    let card: Card
    let item: CardItem
    var compact = false
    @Environment(\.cardPalette) private var palette

    var body: some View {
        HStack(spacing: 8) {
            if let ref = item.action, let on = item.on {
                HubButton(card: card.id, action: ref, on: !on, guarded: card.needsConfirm(ref, item: item)) {
                    Image(systemName: on ? "checkmark.circle.fill" : "circle")
                        .font(.system(size: compact ? 15 : 17, weight: .medium))
                        .foregroundStyle(on ? palette.tint(item.tint ?? card.tint) : palette.muted)
                }
                .buttonStyle(.plain)
            } else {
                Circle()
                    .fill(item.tint == nil ? palette.muted.opacity(0.6) : palette.tint(item.tint))
                    .frame(width: 6, height: 6)
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(item.title)
                    .font(palette.text(compact ? 12 : 13, .medium))
                    .foregroundStyle(item.on == true ? palette.muted : palette.ink)
                    .strikethrough(item.on == true, color: palette.muted)
                    .lineLimit(1)
                if !compact, let detail = item.detail {
                    Text(detail).font(palette.text(11)).foregroundStyle(palette.muted).lineLimit(1)
                }
            }
            .privacySensitive()
            Spacer(minLength: 4)
            if let tag = item.tag {
                Text(tag)
                    .font(palette.number(11, .semibold))
                    .monospacedDigit()
                    .foregroundStyle(palette.muted)
                    .lineLimit(1)
            }
            if let ref = item.action, item.on == nil {
                HubButton(card: card.id, action: ref, on: true, guarded: card.needsConfirm(ref, item: item)) {
                    Image(systemName: item.symbol ?? "checkmark")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(palette.tint(item.tint ?? card.tint))
                        .frame(width: 24, height: 24)
                        .background(Circle().fill(palette.tint(item.tint ?? card.tint).opacity(0.14)))
                }
                .buttonStyle(.plain)
            }
        }
    }
}

/// The card's own buttons. Confirm-actions go through the guarded intent and need a second tap.
struct ActionRow: View {
    let card: Card
    let now: Date
    var limit = 2

    // Full labels when they fit; otherwise buttons with a symbol shrink to the symbol, except one
    // waiting for its second tap, which always says so.
    var body: some View {
        let shown = Array((card.actions ?? []).prefix(limit))
        let squeezable = Set(shown.filter { $0.symbol != nil && !card.isArmed($0.id, at: now) }.map { $0.id })
        ViewThatFits(in: .horizontal) {
            row(shown, iconOnly: [])
            row(shown, iconOnly: squeezable)
        }
    }

    private func row(_ actions: [CardAction], iconOnly: Set<String>) -> some View {
        HStack(spacing: 6) {
            ForEach(actions) { action in
                ActionButton(card: card, action: action, now: now, iconOnly: iconOnly.contains(action.id))
            }
        }
    }
}

struct ActionButton: View {
    let card: Card
    let action: CardAction
    let now: Date
    var iconOnly = false
    @Environment(\.cardPalette) private var palette

    private var label: some View {
        let armed = card.isArmed(action.id, at: now)
        let tint = armed ? KeledPalette.warn : action.style == "destructive" ? KeledPalette.bad : palette.accent
        let filled = action.style == "filled" && !armed
        return HStack(spacing: 4) {
            if let sym = armed ? "hand.tap.fill" : action.symbol { Image(systemName: sym) }
            if !iconOnly || armed { Text(armed ? "Tap again" : action.label).lineLimit(1) }
        }
        .font(palette.text(12, .semibold))
        .foregroundStyle(filled ? Color.white : tint)
        .padding(.horizontal, iconOnly && !armed ? 8 : 10)
        .padding(.vertical, 6)
        .background(Capsule().fill(filled ? tint : tint.opacity(0.14)))
        .accessibilityLabel(action.label)
    }

    var body: some View {
        if let url = action.url, let target = KeledLinks.open(url, via: card.open, title: card.app ?? card.title) {
            Link(destination: target) { label }
        } else if action.confirm == true {
            Button(intent: GuardedHubActionIntent(card: card.id, action: action.id, on: !(action.on ?? false))) { label }
                .buttonStyle(.plain)
        } else {
            Button(intent: HubActionIntent(card: card.id, action: action.id, on: !(action.on ?? false))) { label }
                .buttonStyle(.plain)
        }
    }
}

struct SmallCard: View {
    let card: Card
    let live: Bool
    let now: Date
    @Environment(\.cardPalette) private var palette

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            CardHeader(card: card, live: live)
            Spacer(minLength: 0)
            MainFigure(card: card, size: 40)
            if let action = card.actions?.first {
                ActionButton(card: card, action: action, now: now)
            } else if let series = card.series, series.count > 1 {
                Sparkline(values: series, color: palette.tint(card.tint)).frame(height: 18)
            } else {
                CaptionLine(card: card, now: now)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

struct MediumCard: View {
    let card: Card
    let live: Bool
    let now: Date
    @Environment(\.cardPalette) private var palette

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            VStack(alignment: .leading, spacing: 6) {
                CardHeader(card: card, live: live)
                Spacer(minLength: 0)
                MainFigure(card: card, size: 38)
                if card.actions?.isEmpty == false {
                    ActionRow(card: card, now: now, limit: 2)
                } else {
                    CaptionLine(card: card, now: now)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

            if let items = card.items, !items.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(Array(items.prefix(4).enumerated()), id: \.offset) { _, item in
                        ItemRow(card: card, item: item, compact: true)
                    }
                    Spacer(minLength: 0)
                }
                .padding(.top, 2)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            } else if let series = card.series, series.count > 1 {
                Sparkline(values: series, color: palette.tint(card.tint))
                    .padding(.vertical, 22)
                    .frame(maxWidth: .infinity)
            }
        }
    }
}

struct LargeCard: View {
    let card: Card
    let live: Bool
    let now: Date
    let rows: Int
    @Environment(\.cardPalette) private var palette

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            CardHeader(card: card, live: live)
            HStack(alignment: .bottom) {
                MainFigure(card: card, size: 46)
                Spacer(minLength: 8)
                if let series = card.series, series.count > 1 {
                    Sparkline(values: series, color: palette.tint(card.tint)).frame(width: 120, height: 38)
                }
            }
            CaptionLine(card: card, now: now, size: 13)
            if let items = card.items, !items.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(Array(items.prefix(rows).enumerated()), id: \.offset) { _, item in
                        ItemRow(card: card, item: item)
                    }
                }
                .padding(.top, 6)
            }
            Spacer(minLength: 0)
            if card.actions?.isEmpty == false {
                ActionRow(card: card, now: now, limit: 3)
            } else if let app = card.app {
                Text(app.uppercased())
                    .font(.system(size: 9, weight: .semibold))
                    .tracking(0.8)
                    .foregroundStyle(palette.muted.opacity(0.7))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

// MARK: Lock screen

struct CircularCard: View {
    let card: Card

    var body: some View {
        if let p = card.progress {
            Gauge(value: max(0, min(1, p))) {
                Image(systemName: card.symbolName)
            } currentValueLabel: {
                Text("\(Int((p * 100).rounded()))")
            }
            .gaugeStyle(.accessoryCircular)
        } else {
            ZStack {
                AccessoryWidgetBackground()
                VStack(spacing: 1) {
                    Image(systemName: card.symbolName)
                        .font(.system(size: 12, weight: .semibold))
                        .widgetAccentable()
                    Text(card.value ?? "–")
                        .font(.system(size: 17, weight: .semibold, design: .rounded))
                        .minimumScaleFactor(0.5)
                        .lineLimit(1)
                }
                .padding(6)
            }
        }
    }
}

struct RectangularCard: View {
    let card: Card

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 4) {
                Image(systemName: card.symbolName).widgetAccentable()
                Text(card.title).fontWeight(.semibold)
            }
            .font(.system(size: 13))
            .lineLimit(1)
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(card.value ?? "–")
                    .font(.system(size: 22, weight: .semibold, design: .rounded))
                    .minimumScaleFactor(0.6)
                    .lineLimit(1)
                if let label = card.label {
                    Text(label).font(.system(size: 12)).lineLimit(1)
                }
            }
            if let line = card.caption ?? card.items?.first?.title {
                Text(line).font(.system(size: 11)).foregroundStyle(.secondary).lineLimit(1)
                    .privacySensitive()
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct InlineCard: View {
    let card: Card

    private var text: String {
        [card.title, card.value, card.label].compactMap { $0 }.joined(separator: " ")
    }

    var body: some View {
        Label(text, systemImage: card.symbolName)
    }
}

struct EmptyCardView: View {
    let family: WidgetFamily

    var body: some View {
        switch family {
        case .accessoryInline:
            Label("Keled", systemImage: "square.grid.2x2")
        case .accessoryCircular, .accessoryRectangular:
            ZStack {
                AccessoryWidgetBackground()
                Image(systemName: "square.grid.2x2")
            }
        default:
            VStack(alignment: .leading, spacing: 6) {
                KeledK7Shape().fill(Color.primary).frame(width: 12, height: 16)
                Spacer(minLength: 0)
                Text("No card yet").font(.system(size: 15, weight: .semibold))
                Text("Hold the widget, Edit Widget, pick a card.")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }
}

// MARK: Board: several cards in one widget, for the iPad and the big phone sizes

struct BoardView: View {
    let cards: [Card]
    let family: WidgetFamily
    let live: Bool
    var title = "Keled"

    private var columns: Int { family == .systemExtraLarge ? 4 : 2 }
    private var limit: Int {
        switch family {
        case .systemExtraLarge: return 8
        case .systemLarge: return 6
        default: return 2
        }
    }

    var body: some View {
        let shown = Array(cards.prefix(limit))
        let rowCount = max(1, (shown.count + columns - 1) / columns)
        VStack(alignment: .leading, spacing: 8) {
            if family != .systemMedium {
                HStack(spacing: 6) {
                    KeledK7Shape().fill(Color.primary).frame(width: 10, height: 13)
                    Text(title).font(.system(size: 13, weight: .semibold))
                    Spacer()
                    if !live {
                        Image(systemName: "wifi.slash").font(.system(size: 10, weight: .semibold)).foregroundStyle(.secondary)
                    }
                }
            }
            VStack(spacing: 8) {
                ForEach(0..<rowCount, id: \.self) { r in
                    HStack(spacing: 8) {
                        ForEach(0..<columns, id: \.self) { c in
                            let i = r * columns + c
                            if i < shown.count {
                                BoardTile(card: shown[i])
                            } else {
                                Color.clear.frame(maxWidth: .infinity, maxHeight: .infinity)
                            }
                        }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

/// A board tile wears its app's theme, so an iPad board reads as a mosaic of the apps themselves.
struct BoardTile: View {
    let card: Card

    var body: some View {
        Themed(card: card) { palette in
            Link(destination: card.openURL ?? KeledLinks.home) {
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 4) {
                        Image(systemName: card.symbolName)
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(palette.tint(card.tint))
                            .widgetAccentable()
                        Text(card.title).font(palette.text(11, .semibold)).foregroundStyle(palette.ink).lineLimit(1)
                        Spacer(minLength: 0)
                    }
                    Spacer(minLength: 0)
                    Text(card.value ?? "–")
                        .font(palette.number(24))
                        .monospacedDigit()
                        .minimumScaleFactor(0.5)
                        .lineLimit(1)
                        .foregroundStyle(card.isStale ? palette.muted : palette.ink)
                    if let label = card.label {
                        Text(label).font(palette.text(10)).foregroundStyle(palette.muted).lineLimit(1)
                    }
                }
                .padding(10)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .background {
                    if palette.background.isEmpty {
                        RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color(uiColor: .secondarySystemBackground))
                    } else {
                        CardBackground(palette: palette).clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                }
            }
            .buttonStyle(.plain)
        }
    }
}
