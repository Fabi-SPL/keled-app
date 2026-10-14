import SwiftUI
import AppIntents
import WidgetKit

// Draws a card's layout tree natively. This is what lets every app's widgets look like that app
// without a new build: the design is data on the hub, this file only knows the primitives.
// Anything it does not recognise renders as nothing, never as a crash.

struct LayoutContext {
    let card: Card
    var item: CardItem?
    var index: Int = 0
    let palette: CardPalette
    let now: Date
}

enum Template {
    private static let pattern = try! NSRegularExpression(pattern: "\\{([A-Za-z0-9_.]+)\\}")

    static func fill(_ raw: String?, _ ctx: LayoutContext) -> String {
        guard let raw else { return "" }
        guard raw.contains("{") else { return raw }
        let ns = raw as NSString
        var out = ""
        var last = 0
        for m in pattern.matches(in: raw, range: NSRange(location: 0, length: ns.length)) {
            out += ns.substring(with: NSRange(location: last, length: m.range.location - last))
            out += lookup(ns.substring(with: m.range(at: 1)), ctx)
            last = m.range.location + m.range.length
        }
        return out + ns.substring(from: last)
    }

    static func lookup(_ key: String, _ ctx: LayoutContext) -> String {
        let parts = key.split(separator: ".").map(String.init)
        let c = ctx.card
        switch parts.first ?? "" {
        case "title": return c.title
        case "value": return c.value ?? ""
        case "label": return c.label ?? ""
        case "caption": return c.caption ?? ""
        case "app": return c.app ?? ""
        case "tint": return c.tint
        case "symbol": return c.symbolName
        case "progress": return c.progress.map { String($0) } ?? ""
        case "percent": return c.progress.map { String(Int(($0 * 100).rounded())) } ?? ""
        case "age": return c.ageText ?? ""
        case "count": return String(c.items?.count ?? 0)
        case "flash": return c.activeFlash(at: ctx.now)?.text ?? ""
        case "data": return parts.count > 1 ? (c.data?[parts[1]] ?? "") : ""
        case "index": return String(ctx.index + 1)
        case "item":
            guard let it = ctx.item, parts.count > 1 else { return "" }
            return field(it, parts[1])
        case "items":
            guard parts.count > 2, let i = Int(parts[1]), let items = c.items, i < items.count else { return "" }
            return field(items[i], parts[2])
        default: return ""
        }
    }

    private static func field(_ it: CardItem, _ key: String) -> String {
        switch key {
        case "title": return it.title
        case "detail": return it.detail ?? ""
        case "tag": return it.tag ?? ""
        case "tint": return it.tint ?? "neutral"
        case "action": return it.action ?? ""
        case "on": return (it.on ?? false) ? "true" : ""
        case "symbol": return it.symbol ?? ""
        default: return ""
        }
    }

    static func truthy(_ s: String) -> Bool {
        let t = s.trimmingCharacters(in: .whitespaces).lowercased()
        return !(t.isEmpty || t == "0" || t == "false" || t == "no")
    }

    static func date(_ raw: String) -> Date? {
        let s = raw.trimmingCharacters(in: .whitespaces)
        if let ms = Double(s) { return Date(timeIntervalSince1970: ms > 1e11 ? ms / 1000 : ms) }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = iso.date(from: s) { return d }
        iso.formatOptions = [.withInternetDateTime]
        if let d = iso.date(from: s) { return d }
        let day = DateFormatter()
        day.locale = Locale(identifier: "en_US_POSIX")
        day.timeZone = .current
        day.dateFormat = "yyyy-MM-dd"
        return day.date(from: s)
    }
}

struct NodeView: View {
    let node: LayoutNode
    let ctx: LayoutContext

    var body: some View { NodeRenderer.view(node, ctx) }
}

enum NodeRenderer {
    static func view(_ n: LayoutNode, _ ctx: LayoutContext) -> AnyView {
        if let when = n.when, !Template.truthy(Template.fill(when, ctx)) { return AnyView(EmptyView()) }
        return styled(content(n, ctx), n, ctx)
    }

    private static func cg(_ v: Double?) -> CGFloat? { v.map { CGFloat($0) } }

    private static func kids(_ n: LayoutNode, _ ctx: LayoutContext) -> some View {
        ForEach(Array((n.children ?? []).enumerated()), id: \.offset) { _, child in
            view(child, ctx)
        }
    }

    private static func hAlign(_ s: String?) -> HorizontalAlignment {
        switch s {
        case "center": return .center
        case "trailing": return .trailing
        default: return .leading
        }
    }

    private static func vAlign(_ s: String?) -> VerticalAlignment {
        switch s {
        case "top": return .top
        case "bottom": return .bottom
        case "baseline", "firstBaseline": return .firstTextBaseline
        default: return .center
        }
    }

    static func alignment(_ s: String?) -> Alignment {
        switch s {
        case "topLeading": return .topLeading
        case "top": return .top
        case "topTrailing": return .topTrailing
        case "leading": return .leading
        case "trailing": return .trailing
        case "bottomLeading": return .bottomLeading
        case "bottom": return .bottom
        case "bottomTrailing": return .bottomTrailing
        default: return .center
        }
    }

    private static func font(_ n: LayoutNode, _ ctx: LayoutContext, size: Double = 13, weight: Font.Weight = .regular) -> Font {
        let s = CGFloat(n.size ?? size)
        let w = CardPalette.weight(n.weight) ?? weight
        if let family = n.family, !family.isEmpty { return .custom(family, size: s).weight(w) }
        if n.design == "numbers" { return .system(size: s, weight: w, design: ctx.palette.numbers) }
        if let d = CardPalette.design(n.design) { return .system(size: s, weight: w, design: d) }
        return ctx.palette.text(s, w)
    }

    private static func color(_ raw: String?, _ ctx: LayoutContext) -> Color? {
        ctx.palette.color(Template.fill(raw, ctx), card: ctx.card)
    }

    private static func number(_ raw: String?, _ ctx: LayoutContext) -> Double? {
        Double(Template.fill(raw, ctx).trimmingCharacters(in: .whitespaces))
    }

    private static func content(_ n: LayoutNode, _ ctx: LayoutContext) -> AnyView {
        switch n.type {
        case "vstack":
            return AnyView(VStack(alignment: hAlign(n.align), spacing: cg(n.spacing)) { kids(n, ctx) })
        case "hstack":
            return AnyView(HStack(alignment: vAlign(n.align), spacing: cg(n.spacing)) { kids(n, ctx) })
        case "zstack":
            return AnyView(ZStack(alignment: alignment(n.align)) { kids(n, ctx) })
        case "text":
            return AnyView(textView(n, ctx))
        case "symbol":
            return AnyView(
                Image(systemName: Template.fill(n.name ?? "{symbol}", ctx))
                    .font(font(n, ctx, size: 14, weight: .semibold))
                    .foregroundStyle(color(n.color, ctx) ?? ctx.palette.tint(ctx.card.tint))
            )
        case "image":
            let name = Template.fill(n.src, ctx)
            guard let img = AssetStore.image(name) else { return AnyView(EmptyView()) }
            let image = Image(uiImage: img).resizable()
            return AnyView(n.fit == "fill" ? AnyView(image.scaledToFill()) : AnyView(image.scaledToFit()))
        case "spacer":
            return AnyView(Spacer(minLength: cg(n.minLength) ?? 0))
        case "divider":
            return AnyView(Rectangle().fill(color(n.color, ctx) ?? ctx.palette.muted.opacity(0.3)).frame(height: cg(n.line) ?? 1))
        case "rect":
            return AnyView(RoundedRectangle(cornerRadius: cg(n.radius) ?? 0, style: .continuous).fill(color(n.color, ctx) ?? ctx.palette.tile))
        case "circle":
            return AnyView(Circle().fill(color(n.color, ctx) ?? ctx.palette.accent))
        case "ring":
            let tint = color(n.color, ctx) ?? ctx.palette.tint(ctx.card.tint)
            return AnyView(
                ZStack {
                    Circle().stroke(color(n.track, ctx) ?? tint.opacity(0.18), lineWidth: cg(n.line) ?? 6)
                    Circle()
                        .trim(from: 0, to: max(0.001, min(1, number(n.value ?? "{progress}", ctx) ?? 0)))
                        .stroke(tint, style: StrokeStyle(lineWidth: cg(n.line) ?? 6, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    kids(n, ctx)
                }
            )
        case "bar":
            let tint = color(n.color, ctx) ?? ctx.palette.tint(ctx.card.tint)
            let fraction = max(0, min(1, number(n.value ?? "{progress}", ctx) ?? 0))
            return AnyView(
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(color(n.track, ctx) ?? tint.opacity(0.18))
                        Capsule().fill(tint).frame(width: max(geo.size.height, geo.size.width * CGFloat(fraction)))
                    }
                }
                .frame(height: cg(n.height) ?? 6)
            )
        case "spark":
            let values: [Double]
            if let key = n.series, key.hasPrefix("data.") {
                values = Template.fill("{\(key)}", ctx).split(separator: ",").compactMap { Double($0.trimmingCharacters(in: .whitespaces)) }
            } else {
                values = ctx.card.series ?? []
            }
            guard values.count > 1 else { return AnyView(EmptyView()) }
            return AnyView(Sparkline(values: values, color: color(n.color, ctx) ?? ctx.palette.tint(ctx.card.tint), line: cg(n.line) ?? 2))
        case "date":
            return AnyView(dateView(n, ctx))
        case "button":
            return AnyView(buttonView(n, ctx))
        case "check":
            return AnyView(checkView(n, ctx))
        case "link":
            let target = KeledLinks.open(Template.fill(n.url, ctx), via: ctx.card.open, title: ctx.card.app ?? ctx.card.title)
            guard let target else { return AnyView(VStack(alignment: hAlign(n.align), spacing: cg(n.spacing)) { kids(n, ctx) }) }
            return AnyView(Link(destination: target) { VStack(alignment: hAlign(n.align), spacing: cg(n.spacing)) { kids(n, ctx) } })
        case "each":
            return AnyView(eachView(n, ctx))
        default:
            return AnyView(EmptyView())
        }
    }

    private static func textView(_ n: LayoutNode, _ ctx: LayoutContext) -> some View {
        var text = Text(Template.fill(n.text, ctx))
        if n.italic == true { text = text.italic() }
        if n.mono == true { text = text.monospacedDigit() }
        return text
            .font(font(n, ctx))
            .tracking(cg(n.tracking) ?? 0)
            .textCase(n.upper == true ? .uppercase : nil)
            .foregroundStyle(color(n.color, ctx) ?? ctx.palette.ink)
            .lineLimit(n.lines ?? 1)
            .minimumScaleFactor(cg(n.scale) ?? 0.6)
            .multilineTextAlignment(n.align == "center" ? .center : n.align == "trailing" ? .trailing : .leading)
            .privacySensitive(n.privacy == true)
    }

    /// Dates count on the device: "days" is whole days left, the others are Apple's live styles
    /// that tick without a reload.
    @ViewBuilder
    private static func dateView(_ n: LayoutNode, _ ctx: LayoutContext) -> some View {
        let tint = color(n.color, ctx) ?? ctx.palette.ink
        if let date = Template.date(Template.fill(n.date, ctx)) {
            Group {
                switch n.style {
                case "timer": Text(date, style: .timer)
                case "relative": Text(date, style: .relative)
                case "time": Text(date, style: .time)
                case "date": Text(date, style: .date)
                default:
                    let start = Calendar.current.startOfDay(for: ctx.now)
                    let target = Calendar.current.startOfDay(for: date)
                    Text("\(Calendar.current.dateComponents([.day], from: start, to: target).day ?? 0)")
                }
            }
            .font(font(n, ctx, size: 13))
            .monospacedDigit()
            .foregroundStyle(tint)
            .lineLimit(1)
            .minimumScaleFactor(cg(n.scale) ?? 0.5)
        }
    }

    private static func intentButton<Label: View>(_ ctx: LayoutContext, ref: String, on: Bool, guarded: Bool, @ViewBuilder label: () -> Label) -> AnyView {
        if guarded {
            return AnyView(Button(intent: GuardedHubActionIntent(card: ctx.card.id, action: ref, on: on), label: label).buttonStyle(.plain))
        }
        return AnyView(Button(intent: HubActionIntent(card: ctx.card.id, action: ref, on: on), label: label).buttonStyle(.plain))
    }

    private static func buttonView(_ n: LayoutNode, _ ctx: LayoutContext) -> AnyView {
        let ref = Template.fill(n.action, ctx)
        let action = ctx.card.actions?.first(where: { $0.id == ref })
        let armed = ctx.card.isArmed(ref, at: ctx.now)
        let label: AnyView
        if armed {
            label = AnyView(
                Text("Tap again")
                    .font(font(n, ctx, size: 12, weight: .semibold))
                    .foregroundStyle(KeledPalette.warn)
                    .padding(.horizontal, 10).padding(.vertical, 6)
            )
        } else if let children = n.children, !children.isEmpty {
            label = AnyView(VStack(alignment: hAlign(n.align), spacing: cg(n.spacing)) { kids(n, ctx) })
        } else {
            let tint = color(n.color, ctx) ?? ctx.palette.accent
            label = AnyView(
                HStack(spacing: 5) {
                    if let sym = n.symbol ?? action?.symbol { Image(systemName: Template.fill(sym, ctx)) }
                    Text(Template.fill(n.label ?? action?.label ?? ref, ctx)).lineLimit(1)
                }
                .font(font(n, ctx, size: 12, weight: .semibold))
                .foregroundStyle(n.style == "filled" ? Color.white : tint)
                .padding(.horizontal, 10).padding(.vertical, 6)
                .background(Capsule().fill(n.style == "filled" ? tint : tint.opacity(0.14)))
            )
        }
        if let url = action?.url, let target = KeledLinks.open(url, via: ctx.card.open, title: ctx.card.app ?? ctx.card.title) {
            return AnyView(Link(destination: target) { label })
        }
        return intentButton(ctx, ref: ref, on: !(action?.on ?? ctx.item?.on ?? false), guarded: ctx.card.needsConfirm(ref, item: ctx.item)) { label }
    }

    private static func checkView(_ n: LayoutNode, _ ctx: LayoutContext) -> AnyView {
        let ref = Template.fill(n.action ?? "{item.action}", ctx)
        guard !ref.isEmpty else { return AnyView(EmptyView()) }
        let cardAction = ctx.card.actions?.first(where: { $0.id == ref })
        let on = ctx.item?.on ?? cardAction?.on ?? false
        let tint = color(n.color, ctx) ?? ctx.palette.accent
        return intentButton(ctx, ref: ref, on: !on, guarded: ctx.card.needsConfirm(ref, item: ctx.item)) {
            Image(systemName: on ? "checkmark.circle.fill" : "circle")
                .font(.system(size: CGFloat(n.size ?? 18), weight: .medium))
                .foregroundStyle(on ? tint : ctx.palette.muted)
        }
    }

    private static func eachView(_ n: LayoutNode, _ ctx: LayoutContext) -> some View {
        let items = Array((ctx.card.items ?? []).prefix(n.limit ?? 8))
        let rows = ForEach(Array(items.enumerated()), id: \.offset) { i, item in
            let inner = LayoutContext(card: ctx.card, item: item, index: i, palette: ctx.palette, now: ctx.now)
            let children = n.children ?? []
            if children.count == 1 {
                view(children[0], inner)
            } else {
                HStack(spacing: 8) {
                    ForEach(Array(children.enumerated()), id: \.offset) { _, child in view(child, inner) }
                }
            }
        }
        return Group {
            if n.style == "row" {
                HStack(alignment: .top, spacing: cg(n.spacing) ?? 8) { rows }
            } else {
                VStack(alignment: hAlign(n.align), spacing: cg(n.spacing) ?? 8) { rows }
            }
        }
    }

    private static func styled(_ v: AnyView, _ n: LayoutNode, _ ctx: LayoutContext) -> AnyView {
        var out = v
        if let p = n.padding, !p.isEmpty {
            let e: EdgeInsets
            switch p.count {
            case 1: e = EdgeInsets(top: p[0], leading: p[0], bottom: p[0], trailing: p[0])
            case 2: e = EdgeInsets(top: p[0], leading: p[1], bottom: p[0], trailing: p[1])
            default: e = EdgeInsets(top: p[0], leading: p[1], bottom: p[2], trailing: p[3])
            }
            out = AnyView(out.padding(e))
        }
        if n.width != nil || n.height != nil {
            out = AnyView(out.frame(width: cg(n.width), height: n.type == "bar" ? nil : cg(n.height)))
        }
        if n.maxW == true || n.maxH == true {
            out = AnyView(out.frame(maxWidth: n.maxW == true ? .infinity : nil, maxHeight: n.maxH == true ? .infinity : nil,
                                    alignment: alignment(n.frameAlign)))
        }
        if let bg = color(n.bg, ctx) {
            out = AnyView(out.background(RoundedRectangle(cornerRadius: cg(n.radius) ?? 0, style: .continuous).fill(bg)))
        }
        if let stroke = color(n.stroke, ctx) {
            out = AnyView(out.overlay(RoundedRectangle(cornerRadius: cg(n.radius) ?? 0, style: .continuous)
                .stroke(stroke, lineWidth: cg(n.strokeWidth) ?? 1)))
        }
        if let r = n.radius, n.bg == nil, n.stroke == nil {
            out = AnyView(out.clipShape(RoundedRectangle(cornerRadius: CGFloat(r), style: .continuous)))
        }
        if let o = n.opacity { out = AnyView(out.opacity(o)) }
        if n.accent == true { out = AnyView(out.widgetAccentable()) }
        return out
    }
}
