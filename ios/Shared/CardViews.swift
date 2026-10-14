import SwiftUI
import WidgetKit

// One renderer for every card in every widget size. The app's gallery draws the same views,
// so a simulator screenshot of the app shows exactly what the widget will show.
// Anchor: Apple's own Batteries / Reminders widgets. Flat, system type, colour only for status.

struct CardView: View {
    let card: Card
    let family: WidgetFamily
    var live: Bool = true

    var body: some View {
        switch family {
        case .accessoryCircular: CircularCard(card: card)
        case .accessoryRectangular: RectangularCard(card: card)
        case .accessoryInline: InlineCard(card: card)
        case .systemSmall: SmallCard(card: card, live: live)
        case .systemMedium: MediumCard(card: card, live: live)
        case .systemExtraLarge: LargeCard(card: card, live: live, rows: 8)
        default: LargeCard(card: card, live: live, rows: 6)
        }
    }
}

struct CardHeader: View {
    let card: Card
    let live: Bool

    var body: some View {
        HStack(spacing: 5) {
            Image(systemName: card.symbolName)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(card.tintColor)
                .widgetAccentable()
            Text(card.title)
                .font(.system(size: 13, weight: .semibold))
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

    var body: some View {
        if !live {
            Image(systemName: "wifi.slash")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(.secondary)
        } else if card.isStale, let age = card.ageText {
            Text(age)
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(.secondary)
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
            .stroke(color, style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
        }
    }
}

/// The card's headline: a ring for gauges, a dot and a word for status, otherwise the big number.
struct MainFigure: View {
    let card: Card
    var size: CGFloat = 40

    var body: some View {
        if card.kind == "gauge", let p = card.progress {
            HStack(spacing: 10) {
                ZStack {
                    Ring(progress: p, color: card.tintColor, line: size * 0.17)
                    Text("\(Int((p * 100).rounded()))")
                        .font(.system(size: size * 0.38, weight: .semibold, design: .rounded))
                        .monospacedDigit()
                }
                .frame(width: size * 1.5, height: size * 1.5)
                if let label = card.label {
                    Text(label).font(.system(size: 12, weight: .medium)).foregroundStyle(.secondary).lineLimit(2)
                }
            }
        } else if card.kind == "status" {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 7) {
                    Circle().fill(card.tintColor).frame(width: size * 0.22, height: size * 0.22)
                    Text(card.value ?? "–")
                        .font(.system(size: size * 0.66, weight: .semibold, design: .rounded))
                        .minimumScaleFactor(0.5)
                        .lineLimit(1)
                }
                if let label = card.label {
                    Text(label).font(.system(size: 12, weight: .medium)).foregroundStyle(.secondary).lineLimit(1)
                }
            }
        } else {
            VStack(alignment: .leading, spacing: 0) {
                Text(card.value ?? "–")
                    .font(.system(size: size, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    .minimumScaleFactor(0.5)
                    .lineLimit(1)
                    .foregroundStyle(card.isStale ? Color.secondary : Color.primary)
                if let label = card.label {
                    Text(label).font(.system(size: 12, weight: .medium)).foregroundStyle(.secondary).lineLimit(1)
                }
            }
        }
    }
}

struct ItemRow: View {
    let item: CardItem
    var compact = false

    var body: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(KeledPalette.tint(item.tint ?? "neutral").opacity(item.tint == nil ? 0.45 : 1))
                .frame(width: 6, height: 6)
            VStack(alignment: .leading, spacing: 1) {
                Text(item.title)
                    .font(.system(size: compact ? 12 : 13, weight: .medium))
                    .lineLimit(1)
                if !compact, let detail = item.detail {
                    Text(detail).font(.system(size: 11)).foregroundStyle(.secondary).lineLimit(1)
                }
            }
            .privacySensitive()
            Spacer(minLength: 4)
            if let tag = item.tag {
                Text(tag)
                    .font(.system(size: 11, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
    }
}

struct SmallCard: View {
    let card: Card
    let live: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            CardHeader(card: card, live: live)
            Spacer(minLength: 0)
            MainFigure(card: card, size: 40)
            if let series = card.series, series.count > 1 {
                Sparkline(values: series, color: card.tintColor).frame(height: 18)
            } else if let line = card.caption ?? card.items?.first?.title {
                Text(line).font(.system(size: 11)).foregroundStyle(.secondary).lineLimit(2)
                    .privacySensitive()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

struct MediumCard: View {
    let card: Card
    let live: Bool

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            VStack(alignment: .leading, spacing: 6) {
                CardHeader(card: card, live: live)
                Spacer(minLength: 0)
                MainFigure(card: card, size: 38)
                if let caption = card.caption {
                    Text(caption).font(.system(size: 11)).foregroundStyle(.secondary).lineLimit(2)
                        .privacySensitive()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

            if let items = card.items, !items.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(Array(items.prefix(4).enumerated()), id: \.offset) { _, item in
                        ItemRow(item: item, compact: true)
                    }
                    Spacer(minLength: 0)
                }
                .padding(.top, 2)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            } else if let series = card.series, series.count > 1 {
                Sparkline(values: series, color: card.tintColor)
                    .padding(.vertical, 22)
                    .frame(maxWidth: .infinity)
            }
        }
    }
}

struct LargeCard: View {
    let card: Card
    let live: Bool
    let rows: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            CardHeader(card: card, live: live)
            HStack(alignment: .bottom) {
                MainFigure(card: card, size: 46)
                Spacer(minLength: 8)
                if let series = card.series, series.count > 1 {
                    Sparkline(values: series, color: card.tintColor).frame(width: 120, height: 38)
                }
            }
            if let caption = card.caption {
                Text(caption).font(.system(size: 13)).foregroundStyle(.secondary).lineLimit(2)
                    .privacySensitive()
            }
            if let items = card.items, !items.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(Array(items.prefix(rows).enumerated()), id: \.offset) { _, item in
                        ItemRow(item: item)
                    }
                }
                .padding(.top, 6)
            }
            Spacer(minLength: 0)
            if let app = card.app {
                Text(app.uppercased())
                    .font(.system(size: 9, weight: .semibold))
                    .tracking(0.8)
                    .foregroundStyle(.tertiary)
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

struct BoardTile: View {
    let card: Card

    var body: some View {
        Link(destination: card.openURL ?? KeledLinks.home) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Image(systemName: card.symbolName)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(card.tintColor)
                        .widgetAccentable()
                    Text(card.title).font(.system(size: 11, weight: .semibold)).lineLimit(1)
                    Spacer(minLength: 0)
                }
                Spacer(minLength: 0)
                Text(card.value ?? "–")
                    .font(.system(size: 24, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    .minimumScaleFactor(0.5)
                    .lineLimit(1)
                    .foregroundStyle(card.isStale ? Color.secondary : Color.primary)
                if let label = card.label {
                    Text(label).font(.system(size: 10)).foregroundStyle(.secondary).lineLimit(1)
                }
            }
            .padding(10)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color(uiColor: .secondarySystemBackground)))
        }
        .buttonStyle(.plain)
    }
}
