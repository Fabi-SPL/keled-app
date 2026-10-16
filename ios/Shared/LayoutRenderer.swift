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
    /// Every card the hub sent, so one design can read several (a node's `card` switches).
    var all: [Card] = []

    func with(card: Card, index: Int = 0) -> LayoutContext {
        LayoutContext(card: card, item: nil, index: index, palette: palette, now: now, all: all)
    }

    func with(item: CardItem?, index: Int) -> LayoutContext {
        LayoutContext(card: card, item: item, index: index, palette: palette, now: now, all: all)
    }
}

enum Template {
    private static let pattern = try! NSRegularExpression(pattern: "\\{([A-Za-z0-9_.-]+)\\}")

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
        case "id": return c.id
        case "title": return c.title
        case "value": return c.value ?? ""
        case "label": return c.label ?? ""
        case "caption": return c.caption ?? ""
        case "app": return c.app ?? ""
        case "tint": return c.tint
        case "symbol": return c.symbolName
        case "url": return c.url ?? ""
        case "progress": return c.progress.map { String($0) } ?? ""
        case "percent": return c.progress.map { String(Int(($0 * 100).rounded())) } ?? ""
        case "age": return c.ageText ?? ""
        case "time": return c.updatedAt.flatMap(date).map { clock($0) } ?? ""
        case "stale": return c.isStale ? "true" : ""
        case "count": return String(c.items?.count ?? 0)
        case "warn": return String((c.items ?? []).filter { $0.tint == "warn" }.count)
        case "wants": return String(ctx.all.filter { $0.tint == "warn" }.count)
        case "mode": return ctx.palette.mode
        case "flash": return c.activeFlash(at: ctx.now)?.text ?? ""
        case "data": return parts.count > 1 ? (c.data?[parts[1]] ?? "") : ""
        case "index": return String(ctx.index + 1)
        case "item":
            guard let it = ctx.item, parts.count > 1 else { return "" }
            return field(it, parts[1])
        case "items":
            guard parts.count > 2, let i = Int(parts[1]), let items = c.items, i < items.count else { return "" }
            return field(items[i], parts[2])
        case "cards":
            // {cards.mail.value}: another card the design reads, by id.
            guard parts.count > 2, let other = ctx.all.first(where: { $0.id == parts[1] }) else { return "" }
            return lookup(parts[2...].joined(separator: "."), ctx.with(card: other))
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
        case "value": return it.value ?? ""
        case "image": return it.image ?? ""
        case "url": return it.url ?? ""
        case "initial": return it.title.first.map { String($0).uppercased() } ?? ""
        default: return ""
        }
    }

    static func truthy(_ s: String) -> Bool {
        let t = s.trimmingCharacters(in: .whitespaces).lowercased()
        return !(t.isEmpty || t == "0" || t == "false" || t == "no")
    }

    /// `when` and `test`: a template that is truthy, or "a OP b" with OP one of >= <= == != > <.
    /// Both sides compare as numbers when they read as numbers ("1,642" and "+290" do).
    static func test(_ raw: String, _ ctx: LayoutContext) -> Bool {
        if raw.hasPrefix("!") { return !test(String(raw.dropFirst()), ctx) }
        let filled = fill(raw, ctx)
        for op in [" >= ", " <= ", " == ", " != ", " > ", " < "] {
            guard let r = filled.range(of: op) else { continue }
            let a = filled[..<r.lowerBound].trimmingCharacters(in: .whitespaces)
            let b = filled[r.upperBound...].trimmingCharacters(in: .whitespaces)
            let o = op.trimmingCharacters(in: .whitespaces)
            if let x = numeric(a), let y = numeric(b) {
                switch o {
                case ">=": return x >= y
                case "<=": return x <= y
                case "==": return x == y
                case "!=": return x != y
                case ">": return x > y
                default: return x < y
                }
            }
            switch o {
            case "==": return a == b
            case "!=": return a != b
            default: return false
            }
        }
        return truthy(filled)
    }

    static func numeric(_ s: String) -> Double? {
        Double(s.replacingOccurrences(of: ",", with: "").replacingOccurrences(of: "+", with: ""))
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

    /// English words, 24-hour clock, the phone's own time zone: "Sat 18:30", "Mon 11 Jan".
    static func format(_ d: Date, _ pattern: String) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_GB")
        f.timeZone = .current
        f.dateFormat = pattern
        return f.string(from: d)
    }

    static func clock(_ d: Date) -> String { format(d, "HH:mm") }
}

struct NodeView: View {
    let node: LayoutNode
    let ctx: LayoutContext

    var body: some View { NodeRenderer.view(node, ctx) }
}

enum NodeRenderer {
    static func view(_ n: LayoutNode, _ ctx: LayoutContext) -> AnyView {
        var ctx = ctx
        if let id = n.card {
            let key = Template.fill(id, ctx)
            guard let other = ctx.all.first(where: { $0.id == key }) else { return AnyView(EmptyView()) }
            ctx = ctx.with(card: other, index: ctx.index)
        }
        if let when = n.when, !Template.test(when, ctx) { return AnyView(EmptyView()) }
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
        Template.numeric(Template.fill(raw, ctx).trimmingCharacters(in: .whitespaces))
    }

    /// The numbers a chart draws: the card's series, a comma list in data, or each item's value.
    private static func series(_ n: LayoutNode, _ ctx: LayoutContext) -> [Double] {
        var values: [Double]
        if let key = n.series, key.hasPrefix("data.") {
            values = Template.fill("{\(key)}", ctx).split(separator: ",").compactMap { Double($0.trimmingCharacters(in: .whitespaces)) }
        } else if n.series == "items" {
            values = (ctx.card.items ?? []).compactMap { Template.numeric($0.value ?? "") }
        } else {
            values = ctx.card.series ?? []
        }
        if let limit = n.limit, limit > 0, values.count > limit { values = Array(values.suffix(limit)) }
        return values
    }

    private static func boxSize(_ n: LayoutNode, fallback: CGSize) -> CGSize {
        if let b = n.box, b.count >= 2 { return CGSize(width: b[0], height: b[1]) }
        return CGSize(width: n.width ?? Double(fallback.width), height: n.height ?? Double(fallback.height))
    }

    private static func content(_ n: LayoutNode, _ ctx: LayoutContext) -> AnyView {
        switch n.type {
        case "vstack":
            return AnyView(VStack(alignment: hAlign(n.align), spacing: cg(n.spacing)) { kids(n, ctx) })
        case "hstack":
            return AnyView(HStack(alignment: vAlign(n.align), spacing: cg(n.spacing)) { kids(n, ctx) })
        case "zstack":
            let z = ZStack(alignment: alignment(n.align)) { kids(n, ctx) }
            let knocks = (n.children ?? []).contains { $0.knock == true }
            return knocks ? AnyView(z.compositingGroup()) : AnyView(z)
        case "grid":
            return AnyView(gridView(n.children ?? [], columns: Int(n.columns ?? 2), n: n) { child in view(child, ctx) })
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
            var image = Image(uiImage: img).resizable()
            if n.full == true, #available(iOS 18.0, *) { image = image.widgetAccentedRenderingMode(.fullColor) }
            return AnyView(n.fit == "fill" ? AnyView(image.scaledToFill()) : AnyView(image.scaledToFit()))
        case "spacer":
            return AnyView(Spacer(minLength: cg(n.minLength) ?? 0))
        case "divider":
            return AnyView(Rectangle().fill(color(n.color, ctx) ?? ctx.palette.ink.opacity(0.14)).frame(height: cg(n.line) ?? 1))
        case "rect":
            let shape = RoundedRectangle(cornerRadius: cg(n.radius) ?? 0, style: .continuous)
            if let line = color(n.stroke, ctx) {
                return AnyView(ZStack {
                    if let fill = color(n.color, ctx) { shape.fill(fill) }
                    shape.strokeBorder(line, style: StrokeStyle(lineWidth: cg(n.strokeWidth ?? n.line) ?? 1.5, dash: (n.dash ?? []).map { CGFloat($0) }))
                })
            }
            return AnyView(shape.fill(color(n.color, ctx) ?? ctx.palette.tile))
        case "circle":
            if let line = color(n.stroke, ctx) {
                return AnyView(ZStack {
                    if let fill = color(n.color, ctx) { Circle().fill(fill) }
                    Circle().strokeBorder(line, style: StrokeStyle(lineWidth: cg(n.strokeWidth ?? n.line) ?? 1.5, dash: (n.dash ?? []).map { CGFloat($0) }))
                })
            }
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
            let values = series(n, ctx)
            guard values.count > 1 else { return AnyView(EmptyView()) }
            return AnyView(Sparkline(values: values, color: color(n.color, ctx) ?? ctx.palette.tint(ctx.card.tint), line: cg(n.line) ?? 2))
        case "bars":
            let box = boxSize(n, fallback: CGSize(width: 120, height: 30))
            let layers = Bars.layers(series(n, ctx), box: box, gap: n.spacing ?? 1.6, cap: n.cap,
                                     color: color(n.color, ctx) ?? ctx.palette.accent, dim: 0.42)
            return AnyView(LayeredShapes(box: box, layers: layers))
        case "mark":
            let tint = Template.fill(n.value ?? "{item.tint}", ctx)
            let side = cg(n.size) ?? 14
            return AnyView(StatusMark(tint: tint, palette: ctx.palette).frame(width: side, height: side))
        case "canvas":
            let box = boxSize(n, fallback: CGSize(width: 72, height: 72))
            return AnyView(LayeredShapes(box: box, layers: canvasLayers(n, ctx, box: box)))
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

    // MARK: Canvas

    /// Shapes in the canvas's box: path, rect, circle, a ring cut into segments, radial rays, a gauge.
    private static func canvasLayers(_ n: LayoutNode, _ ctx: LayoutContext, box: CGSize) -> [ShapeLayer] {
        var out: [ShapeLayer] = []
        for child in n.children ?? [] {
            var c = ctx
            if let id = child.card {
                guard let other = ctx.all.first(where: { $0.id == Template.fill(id, ctx) }) else { continue }
                c = ctx.with(card: other)
            }
            if let when = child.when, !Template.test(when, c) { continue }
            out += shapeLayers(child, c, box: box)
        }
        return out
    }

    private static func paint(_ p: Path, _ n: LayoutNode, _ ctx: LayoutContext, defaultFill: Bool = true) -> [ShapeLayer] {
        var out: [ShapeLayer] = []
        let op = n.opacity ?? 1
        let knock = n.knock == true
        if let fill = color(n.color, ctx) {
            out.append(ShapeLayer(path: p, color: fill, opacity: op, knock: knock))
        } else if n.stroke == nil, defaultFill {
            out.append(ShapeLayer(path: p, color: ctx.palette.ink, opacity: op, knock: knock))
        }
        if let line = color(n.stroke, ctx) {
            let width = n.line ?? n.strokeWidth ?? 1.5
            out.append(ShapeLayer(path: Geometry.stroked(p, width: width, dash: n.dash, round: n.style != "butt"), color: line, opacity: op, knock: knock))
        }
        return out
    }

    private static func shapeLayers(_ n: LayoutNode, _ ctx: LayoutContext, box: CGSize) -> [ShapeLayer] {
        let center = CGPoint(x: n.x ?? Double(box.width) / 2, y: n.y ?? Double(box.height) / 2)
        let ink = color(n.color ?? n.stroke, ctx) ?? ctx.palette.ink
        switch n.type {
        case "path":
            return paint(SVGPath.parse(Template.fill(n.d, ctx)), n, ctx)
        case "rect":
            let rect = CGRect(x: n.x ?? 0, y: n.y ?? 0, width: n.width ?? 10, height: n.height ?? 10)
            let rad = n.radius ?? 0
            return paint(Path(roundedRect: rect, cornerSize: CGSize(width: rad, height: rad), style: .continuous), n, ctx)
        case "circle":
            let r = n.r ?? 10
            return paint(Path(ellipseIn: CGRect(x: Double(center.x) - r, y: Double(center.y) - r, width: 2 * r, height: 2 * r)), n, ctx)
        case "arcs":
            // A ring cut into one segment per thing: heavy and solid where it wants you, thin and faint where not.
            let total = max(1, Int(number(n.count, ctx) ?? n.total ?? 6))
            let per = 360.0 / Double(total)
            let gap = n.spacing ?? 14
            let start = n.from ?? gap / 2
            let r = n.r ?? Double(min(box.width, box.height)) / 2 - 5
            let items = ctx.card.items ?? []
            let count = number(n.value, ctx) ?? 0
            var out: [ShapeLayer] = []
            for i in 0..<total {
                let on: Bool
                if let test = n.test {
                    on = i < items.count && Template.test(test, ctx.with(item: items[i], index: i))
                } else {
                    on = Double(i) < count
                }
                let a0 = Double(i) * per + start
                let p = Geometry.arc(center, r, a0, a0 + per - gap)
                let width = on ? (n.line ?? 5.5) : (n.strokeWidth ?? 2)
                out.append(ShapeLayer(path: Geometry.stroked(p, width: width), color: ink, opacity: on ? 1 : 0.45))
            }
            return out
        case "rays":
            // One ray per hour around the dial, longer for a busier hour; the newest one at full strength.
            let values = series(n, ctx)
            guard !values.isEmpty else { return [] }
            let sorted = values.sorted(by: >)
            let auto = sorted.count > 1 && sorted[0] > 2 * sorted[1] ? sorted[1] : sorted[0]
            let top = max(1, n.cap ?? auto)
            let inner = n.r ?? 19
            let base = n.from ?? inner + 2
            let extra = n.size ?? 13.5
            let step = 360.0 / Double(values.count)
            return values.enumerated().map { i, v in
                let a = Double(i + 1) * step
                var p = Path()
                p.move(to: Geometry.point(center, inner, a))
                p.addLine(to: Geometry.point(center, base + min(1, v / top) * extra, a))
                return ShapeLayer(path: Geometry.stroked(p, width: n.line ?? 3.6), color: ink, opacity: i == values.count - 1 ? 1 : 0.5)
            }
        case "gauge":
            // Track from `from` to `to` degrees; the filled part is the value (0...1) or the time
            // gone between `start` and `date`, so a deadline gauge fills by itself.
            let a0 = n.from ?? 225, a1 = n.to ?? 495
            let r = n.r ?? Double(min(box.width, box.height)) / 2 - 7
            var fraction = number(n.value, ctx) ?? 0
            if n.value == nil, let s = Template.date(Template.fill(n.start, ctx)), let e = Template.date(Template.fill(n.date, ctx)), e > s {
                fraction = ctx.now.timeIntervalSince(s) / e.timeIntervalSince(s)
            }
            fraction = max(0, min(1, fraction))
            let width = n.line ?? 4.5
            var out = [ShapeLayer(path: Geometry.stroked(Geometry.arc(center, r, a0, a1), width: width), color: ink, opacity: 0.28)]
            if fraction > 0 {
                out.append(ShapeLayer(path: Geometry.stroked(Geometry.arc(center, r, a0, a0 + (a1 - a0) * fraction), width: width), color: ink))
            }
            return out
        case "repeat":
            // A row or grid of equal cells: the first `value` filled, the rest drawn as an outline.
            let count = max(0, min(60, Int(number(n.count, ctx) ?? n.total ?? 0)))
            let filled = Int(number(n.value, ctx) ?? 0)
            let cols = max(1, Int(n.columns ?? Double(max(1, count))))
            let gap = n.spacing ?? 4, rowGap = n.rowSpacing ?? gap
            let x0 = n.x ?? 0, y0 = n.y ?? 0
            var w = n.width ?? 10
            if n.fit == "spread" { w = (Double(box.width) - 2 * x0 - gap * Double(cols - 1)) / Double(cols) }
            let h = n.height ?? w
            let rad = n.radius ?? 0
            let line = n.strokeWidth ?? 1.4
            let fill = color(n.color, ctx) ?? ctx.palette.ink
            let empty = color(n.track, ctx) ?? ctx.palette.muted
            var out: [ShapeLayer] = []
            for i in 0..<count {
                let col = i % cols, row = i / cols
                let rect = CGRect(x: x0 + Double(col) * (w + gap), y: y0 + Double(row) * (h + rowGap), width: w, height: h)
                if i < filled {
                    out.append(ShapeLayer(path: Path(roundedRect: rect, cornerSize: CGSize(width: rad, height: rad), style: .continuous), color: fill, opacity: n.opacity ?? 1))
                } else {
                    let inset = rect.insetBy(dx: line / 2, dy: line / 2)
                    let p = Path(roundedRect: inset, cornerSize: CGSize(width: max(0, rad - line / 2), height: max(0, rad - line / 2)), style: .continuous)
                    out.append(ShapeLayer(path: Geometry.stroked(p, width: line, dash: n.dash, round: false), color: empty, opacity: n.opacity ?? 1))
                }
            }
            return out
        case "mark":
            let side = n.size ?? 14
            let layer = StatusMark.layer(Template.fill(n.value ?? "{item.tint}", ctx), ctx.palette)
            let s = side / 16
            let t = CGAffineTransform(a: s, b: 0, c: 0, d: s, tx: (n.x ?? 0), ty: (n.y ?? 0))
            return [ShapeLayer(path: layer.path.applying(t), color: layer.color, opacity: n.opacity ?? 1)]
        default:
            return []
        }
    }

    // MARK: Text and dates

    /// "{@envelope} 6" draws the SF Symbol inline, so the one-line lock widget keeps its glyphs.
    private static func richText(_ raw: String) -> Text {
        guard raw.contains("{@") else { return Text(verbatim: raw) }
        var out = Text(verbatim: "")
        var rest = Substring(raw)
        while let open = rest.range(of: "{@") {
            out = out + Text(verbatim: String(rest[..<open.lowerBound]))
            guard let close = rest[open.upperBound...].firstIndex(of: "}") else {
                return out + Text(verbatim: String(rest[open.lowerBound...]))
            }
            out = out + Text(Image(systemName: String(rest[open.upperBound..<close])))
            rest = rest[rest.index(after: close)...]
        }
        return out + Text(verbatim: String(rest))
    }

    private static func textView(_ n: LayoutNode, _ ctx: LayoutContext) -> some View {
        var text = richText(Template.fill(n.text, ctx))
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

    private static let datePatterns = [
        "weekday": "EEE", "weekdayLong": "EEEE", "day": "d", "month": "MMM", "hm": "HH:mm",
        "dayTime": "EEE HH:mm", "dayMonth": "EEE d MMM", "monthLong": "MMMM", "dayDot": "EEE · MMM",
    ]

    /// Dates count on the device: "days" is whole days left, timer/relative are Apple's live
    /// styles that tick without a reload, the rest print the date in words ("Sat 18:30").
    /// `label` goes before the date and `text` after it, on the same line.
    private static func dateText(_ n: LayoutNode, _ date: Date, _ ctx: LayoutContext) -> Text {
        switch n.style ?? "" {
        case "timer": return Text(date, style: .timer)
        case "relative": return Text(date, style: .relative)
        case "time": return Text(date, style: .time)
        case "date": return Text(date, style: .date)
        default:
            if let s = n.style, let pattern = datePatterns[s] { return Text(verbatim: Template.format(date, pattern)) }
            let start = Calendar.current.startOfDay(for: ctx.now)
            let target = Calendar.current.startOfDay(for: date)
            return Text(verbatim: "\(Calendar.current.dateComponents([.day], from: start, to: target).day ?? 0)")
        }
    }

    private static func dateView(_ n: LayoutNode, _ ctx: LayoutContext) -> AnyView {
        let tint = color(n.color, ctx) ?? ctx.palette.ink
        let raw = Template.fill(n.date, ctx)
        guard let date = raw == "now" ? ctx.now : Template.date(raw) else { return AnyView(EmptyView()) }
        var text = dateText(n, date, ctx)
        if let pre = n.label, !pre.isEmpty { text = richText(Template.fill(pre, ctx)) + text }
        if let post = n.text, !post.isEmpty { text = text + richText(Template.fill(post, ctx)) }
        return AnyView(
            text
                .font(font(n, ctx, size: 13))
                .monospacedDigit()
                .foregroundStyle(tint)
                .lineLimit(1)
                .minimumScaleFactor(cg(n.scale) ?? 0.5)
                .multilineTextAlignment(n.align == "center" ? .center : n.align == "trailing" ? .trailing : .leading)
        )
    }

    // MARK: Buttons

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
                    .foregroundStyle(ctx.palette.warn)
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

    /// A tick. "glyph": the habit's symbol in a ring, filled with the symbol cut out once done.
    /// "ring": a progress ring that closes once done. Without an action it only shows the state.
    private static func checkView(_ n: LayoutNode, _ ctx: LayoutContext) -> AnyView {
        let ref = Template.fill(n.action ?? "{item.action}", ctx)
        let cardAction = ctx.card.actions?.first(where: { $0.id == ref })
        let on = ctx.item?.on ?? cardAction?.on ?? false
        let tint = color(n.color, ctx) ?? ctx.palette.accent
        let side = CGFloat(n.size ?? 18)
        let glyph = Template.fill(n.symbol ?? "{item.symbol}", ctx)
        let ink = CGFloat(n.scale ?? 0.45)
        let label: AnyView
        switch n.style {
        case "glyph":
            label = AnyView(
                ZStack {
                    if on {
                        Circle().fill(tint)
                        Image(systemName: glyph).font(.system(size: side * CGFloat(n.scale ?? 0.46), weight: .semibold)).blendMode(.destinationOut)
                    } else {
                        Circle().strokeBorder(tint, lineWidth: cg(n.line) ?? 1.7)
                        Image(systemName: glyph).font(.system(size: side * CGFloat(n.scale ?? 0.46), weight: .semibold)).foregroundStyle(tint)
                    }
                }
                .compositingGroup()
                .frame(width: side, height: side)
            )
        case "ring":
            label = AnyView(
                ZStack {
                    Circle().strokeBorder(tint.opacity(on ? 1 : 0.25), lineWidth: cg(n.line) ?? 4)
                    Image(systemName: glyph).font(.system(size: side * ink, weight: .semibold)).foregroundStyle(tint)
                }
                .frame(width: side, height: side)
            )
        default:
            label = AnyView(
                Image(systemName: on ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: side, weight: .medium))
                    .foregroundStyle(on ? tint : ctx.palette.muted)
            )
        }
        guard !ref.isEmpty else { return label }
        return intentButton(ctx, ref: ref, on: !on, guarded: ctx.card.needsConfirm(ref, item: ctx.item)) { label }
    }

    // MARK: Repeats

    /// Equal-width cells, `columns` to a row; the last row is padded so every cell keeps its width.
    private static func gridView<Cell: View>(_ cells: [LayoutNode], columns: Int, n: LayoutNode, cell: @escaping (LayoutNode) -> Cell) -> some View {
        let cols = max(1, columns)
        let rows = stride(from: 0, to: cells.count, by: cols).map { Array(cells[$0..<min($0 + cols, cells.count)]) }
        return VStack(spacing: cg(n.rowSpacing ?? n.spacing) ?? 8) {
            ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                HStack(alignment: .top, spacing: cg(n.spacing) ?? 8) {
                    ForEach(Array(row.enumerated()), id: \.offset) { _, c in
                        cell(c).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    }
                    ForEach(0..<(cols - row.count), id: \.self) { _ in Color.clear.frame(maxWidth: .infinity) }
                }
            }
        }
    }

    /// Repeats its children once per item, or once per card with `of: "cards"`; `test` filters,
    /// `limit` caps, `columns` lays them out as a grid, style "row" side by side.
    private static func eachView(_ n: LayoutNode, _ ctx: LayoutContext) -> some View {
        var contexts: [LayoutContext]
        if n.of == "cards" {
            contexts = ctx.all.map { ctx.with(card: $0) }
        } else {
            contexts = (ctx.card.items ?? []).enumerated().map { ctx.with(item: $1, index: $0) }
        }
        if let test = n.test { contexts = contexts.filter { Template.test(test, $0) } }
        contexts = Array(contexts.prefix(n.limit ?? 8))
        if n.of == "cards" { contexts = contexts.enumerated().map { i, c in c.with(card: c.card, index: i) } }
        let children = n.children ?? []
        let one: (LayoutContext) -> AnyView = { inner in
            if children.count == 1 { return view(children[0], inner) }
            return AnyView(HStack(spacing: 8) {
                ForEach(Array(children.enumerated()), id: \.offset) { _, child in view(child, inner) }
            })
        }
        return Group {
            if let columns = n.columns {
                let cols = max(1, Int(columns))
                let rows = stride(from: 0, to: contexts.count, by: cols).map { Array(contexts[$0..<min($0 + cols, contexts.count)]) }
                VStack(spacing: cg(n.rowSpacing ?? n.spacing) ?? 8) {
                    ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                        HStack(alignment: .top, spacing: cg(n.spacing) ?? 8) {
                            ForEach(Array(row.enumerated()), id: \.offset) { _, c in
                                one(c).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                            }
                            ForEach(0..<(cols - row.count), id: \.self) { _ in Color.clear.frame(maxWidth: .infinity) }
                        }
                    }
                }
            } else if n.style == "row" {
                HStack(alignment: vAlign(n.align), spacing: cg(n.spacing) ?? 8) {
                    ForEach(Array(contexts.enumerated()), id: \.offset) { _, c in one(c) }
                }
            } else {
                VStack(alignment: hAlign(n.align), spacing: cg(n.spacing) ?? 8) {
                    ForEach(Array(contexts.enumerated()), id: \.offset) { _, c in one(c) }
                }
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
        let drawsOwnShape = n.type == "rect" || n.type == "circle"
        if !drawsOwnShape, let bg = color(n.bg, ctx) {
            out = AnyView(out.background(RoundedRectangle(cornerRadius: cg(n.radius) ?? 0, style: .continuous).fill(bg)))
        }
        if !drawsOwnShape, let stroke = color(n.stroke, ctx) {
            out = AnyView(out.overlay(RoundedRectangle(cornerRadius: cg(n.radius) ?? 0, style: .continuous)
                .strokeBorder(stroke, style: StrokeStyle(lineWidth: cg(n.strokeWidth) ?? 1, dash: (n.dash ?? []).map { CGFloat($0) }))))
        }
        if let r = n.radius, n.bg == nil, n.stroke == nil {
            out = AnyView(out.clipShape(RoundedRectangle(cornerRadius: CGFloat(r), style: .continuous)))
        }
        if let o = n.opacity { out = AnyView(out.opacity(o)) }
        if n.x != nil || n.y != nil { out = AnyView(out.offset(x: cg(n.x) ?? 0, y: cg(n.y) ?? 0)) }
        if n.knock == true { out = AnyView(out.blendMode(.destinationOut)) }
        if n.accent == true { out = AnyView(out.widgetAccentable()) }
        return out
    }
}
