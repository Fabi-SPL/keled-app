import SwiftUI

// Drawn forms for designs: SVG paths, rings cut into segments, radial rays, gauges, bar charts and
// the status marks. Everything is built as a Path in the design's own box units (the viewBox) and
// scaled to the frame, strokes included, so a 72 pt sketch keeps its proportions at any size.

/// A path drawn in `box` units, fitted into whatever rect SwiftUI offers (aspect fit, centered).
struct BoxShape: Shape {
    let box: CGSize
    let built: Path

    func path(in rect: CGRect) -> Path {
        guard box.width > 0, box.height > 0 else { return built }
        let s = min(rect.width / box.width, rect.height / box.height)
        let tx = rect.minX + (rect.width - box.width * s) / 2
        let ty = rect.minY + (rect.height - box.height * s) / 2
        return built.applying(CGAffineTransform(a: s, b: 0, c: 0, d: s, tx: tx, ty: ty))
    }
}

/// One drawn layer: a filled path (strokes are already outlined), its colour, opacity, knockout.
struct ShapeLayer {
    var path: Path
    var color: Color
    var opacity: Double = 1
    var knock = false
}

enum Geometry {
    /// Clockwise degrees from 12 o'clock, as Minerva drew them.
    static func point(_ c: CGPoint, _ r: Double, _ deg: Double) -> CGPoint {
        let t = (deg - 90) * .pi / 180
        return CGPoint(x: Double(c.x) + r * cos(t), y: Double(c.y) + r * sin(t))
    }

    static func arc(_ c: CGPoint, _ r: Double, _ a0: Double, _ a1: Double) -> Path {
        var p = Path()
        p.addArc(center: c, radius: r, startAngle: .degrees(a0 - 90), endAngle: .degrees(a1 - 90), clockwise: false)
        return p
    }

    static func stroked(_ p: Path, width: Double, dash: [Double]? = nil, round: Bool = true) -> Path {
        p.strokedPath(StrokeStyle(lineWidth: width, lineCap: round ? .round : .butt, lineJoin: round ? .round : .miter,
                                  dash: (dash ?? []).map { CGFloat($0) }))
    }
}

// MARK: SVG path data

enum SVGPath {
    private struct Reader {
        let c: [Character]
        var i = 0

        mutating func skip() {
            while i < c.count, c[i] == " " || c[i] == "," || c[i] == "\n" || c[i] == "\t" || c[i] == "\r" { i += 1 }
        }

        mutating func command() -> Character? {
            skip()
            guard i < c.count, c[i].isLetter, c[i] != "e", c[i] != "E" else { return nil }
            defer { i += 1 }
            return c[i]
        }

        mutating func hasNumber() -> Bool {
            skip()
            guard i < c.count else { return false }
            return c[i].isNumber || c[i] == "-" || c[i] == "+" || c[i] == "."
        }

        mutating func number() -> Double? {
            skip()
            var s = ""
            var dot = false
            var exp = false
            if i < c.count, c[i] == "-" || c[i] == "+" { s.append(c[i]); i += 1 }
            while i < c.count {
                let ch = c[i]
                if ch.isNumber { s.append(ch); i += 1 }
                else if ch == ".", !dot, !exp { dot = true; s.append(ch); i += 1 }
                else if ch == "e" || ch == "E", !exp {
                    exp = true; s.append(ch); i += 1
                    if i < c.count, c[i] == "-" || c[i] == "+" { s.append(c[i]); i += 1 }
                } else { break }
            }
            return Double(s)
        }

        /// Arc flags may be packed without separators ("0 01 1.5"), so read exactly one digit.
        mutating func flag() -> Bool? {
            skip()
            guard i < c.count else { return nil }
            if c[i] == "0" || c[i] == "1" { defer { i += 1 }; return c[i] == "1" }
            return nil
        }
    }

    static func parse(_ d: String) -> Path {
        var p = Path()
        var r = Reader(c: Array(d))
        var cmd: Character = "M"
        var cur = CGPoint.zero
        var start = CGPoint.zero
        var lastCubic: CGPoint?
        var lastQuad: CGPoint?
        var guardCount = 0

        while guardCount < 10_000 {
            guardCount += 1
            if let next = r.command() { cmd = next } else if !r.hasNumber() { break }
            let rel = cmd.isLowercase
            let base = rel ? cur : .zero
            func pt() -> CGPoint? {
                guard let x = r.number(), let y = r.number() else { return nil }
                return CGPoint(x: Double(base.x) + x, y: Double(base.y) + y)
            }
            switch cmd.uppercased() {
            case "M":
                guard let q = pt() else { return p }
                p.move(to: q); cur = q; start = q
                cmd = rel ? "l" : "L"
                lastCubic = nil; lastQuad = nil
            case "L":
                guard let q = pt() else { return p }
                p.addLine(to: q); cur = q
                lastCubic = nil; lastQuad = nil
            case "H":
                guard let x = r.number() else { return p }
                cur = CGPoint(x: (rel ? Double(cur.x) : 0) + x, y: Double(cur.y)); p.addLine(to: cur)
                lastCubic = nil; lastQuad = nil
            case "V":
                guard let y = r.number() else { return p }
                cur = CGPoint(x: Double(cur.x), y: (rel ? Double(cur.y) : 0) + y); p.addLine(to: cur)
                lastCubic = nil; lastQuad = nil
            case "C":
                guard let c1 = pt(), let c2 = pt(), let q = pt() else { return p }
                p.addCurve(to: q, control1: c1, control2: c2); cur = q
                lastCubic = c2; lastQuad = nil
            case "S":
                guard let c2 = pt(), let q = pt() else { return p }
                let c1 = lastCubic.map { CGPoint(x: 2 * cur.x - $0.x, y: 2 * cur.y - $0.y) } ?? cur
                p.addCurve(to: q, control1: c1, control2: c2); cur = q
                lastCubic = c2; lastQuad = nil
            case "Q":
                guard let c1 = pt(), let q = pt() else { return p }
                p.addQuadCurve(to: q, control: c1); cur = q
                lastQuad = c1; lastCubic = nil
            case "T":
                guard let q = pt() else { return p }
                let c1 = lastQuad.map { CGPoint(x: 2 * cur.x - $0.x, y: 2 * cur.y - $0.y) } ?? cur
                p.addQuadCurve(to: q, control: c1); cur = q
                lastQuad = c1; lastCubic = nil
            case "A":
                guard let rx = r.number(), let ry = r.number(), let rot = r.number(),
                      let large = r.flag(), let sweep = r.flag(), let q = pt() else { return p }
                arc(&p, from: cur, rx: rx, ry: ry, rotation: rot, large: large, sweep: sweep, to: q)
                cur = q
                lastCubic = nil; lastQuad = nil
            case "Z":
                p.closeSubpath(); cur = start
                lastCubic = nil; lastQuad = nil
                if r.hasNumber() { return p }
            default:
                return p
            }
        }
        return p
    }

    /// SVG's endpoint arc, converted to its centre form and walked in small steps.
    private static func arc(_ p: inout Path, from p0: CGPoint, rx rx0: Double, ry ry0: Double, rotation: Double,
                            large: Bool, sweep: Bool, to p1: CGPoint) {
        if p0 == p1 { return }
        var rx = abs(rx0), ry = abs(ry0)
        if rx == 0 || ry == 0 { p.addLine(to: p1); return }
        let phi = rotation * .pi / 180, cp = cos(phi), sp = sin(phi)
        let ax = Double(p0.x), ay = Double(p0.y), bx = Double(p1.x), by = Double(p1.y)
        let dx = (ax - bx) / 2, dy = (ay - by) / 2
        let x1 = cp * dx + sp * dy, y1 = -sp * dx + cp * dy
        let lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry)
        if lambda > 1 { rx *= lambda.squareRoot(); ry *= lambda.squareRoot() }
        let num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1
        let den = rx * rx * y1 * y1 + ry * ry * x1 * x1
        var coef = den == 0 ? 0 : max(0, num / den).squareRoot()
        if large == sweep { coef = -coef }
        let cxp = coef * rx * y1 / ry, cyp = -coef * ry * x1 / rx
        let cx = cp * cxp - sp * cyp + (ax + bx) / 2
        let cy = sp * cxp + cp * cyp + (ay + by) / 2
        func angle(_ ux: Double, _ uy: Double, _ vx: Double, _ vy: Double) -> Double { atan2(ux * vy - uy * vx, ux * vx + uy * vy) }
        let t1 = angle(1, 0, (x1 - cxp) / rx, (y1 - cyp) / ry)
        var dt = angle((x1 - cxp) / rx, (y1 - cyp) / ry, (-x1 - cxp) / rx, (-y1 - cyp) / ry)
        if !sweep && dt > 0 { dt -= 2 * .pi } else if sweep && dt < 0 { dt += 2 * .pi }
        let steps = max(2, Int((abs(dt) / (3 * .pi / 180)).rounded(.up)))
        for k in 1...steps {
            let t = t1 + dt * Double(k) / Double(steps)
            p.addLine(to: CGPoint(x: cx + rx * cos(t) * cp - ry * sin(t) * sp, y: cy + rx * cos(t) * sp + ry * sin(t) * cp))
        }
    }
}

// MARK: Views

/// Draws layers in one box. Knocked-out layers punch through everything drawn before them.
struct LayeredShapes: View {
    let box: CGSize
    let layers: [ShapeLayer]

    var body: some View {
        ZStack {
            ForEach(Array(layers.enumerated()), id: \.offset) { _, layer in
                BoxShape(box: box, built: layer.path)
                    .fill(layer.color)
                    .opacity(layer.opacity)
                    .blendMode(layer.knock ? .destinationOut : .normal)
            }
        }
        .compositingGroup()
    }
}

/// Status by shape, so it survives Clear and the lock screen: wants you = solid disc,
/// fine = a thin check, neutral = a dashed ring, bad = a solid triangle.
struct StatusMark: View {
    let tint: String
    let palette: CardPalette

    var body: some View {
        LayeredShapes(box: CGSize(width: 16, height: 16), layers: [StatusMark.layer(tint, palette)])
    }

    static func layer(_ tint: String, _ palette: CardPalette) -> ShapeLayer {
        switch tint {
        case "warn":
            return ShapeLayer(path: Path(ellipseIn: CGRect(x: 1.8, y: 1.8, width: 12.4, height: 12.4)), color: palette.status("warn"))
        case "bad":
            var p = Path()
            p.move(to: CGPoint(x: 8, y: 1.6)); p.addLine(to: CGPoint(x: 15, y: 14)); p.addLine(to: CGPoint(x: 1, y: 14)); p.closeSubpath()
            return ShapeLayer(path: p, color: palette.status("bad"))
        case "ok":
            var p = Path()
            p.move(to: CGPoint(x: 2.6, y: 8.6)); p.addLine(to: CGPoint(x: 6.2, y: 12)); p.addLine(to: CGPoint(x: 13.4, y: 4.4))
            return ShapeLayer(path: Geometry.stroked(p, width: 2.4), color: palette.status("ok"))
        default:
            let ring = Path(ellipseIn: CGRect(x: 2.4, y: 2.4, width: 11.2, height: 11.2))
            return ShapeLayer(path: Geometry.stroked(ring, width: 1.6, dash: [2.4, 2.2], round: false), color: palette.muted)
        }
    }
}

/// Hourly bars, newest on the right at full strength. One value far above the rest (the hour the
/// network was rebuilt) gets a broken bar instead of flattening the other twenty-three.
enum Bars {
    static func layers(_ values: [Double], box: CGSize, gap: Double, cap: Double?, color: Color, dim: Double) -> [ShapeLayer] {
        guard !values.isEmpty else { return [] }
        let n = Double(values.count)
        let W = Double(box.width), H = Double(box.height)
        let bw = max(0.5, (W - gap * (n - 1)) / n)
        let sorted = values.sorted(by: >)
        let auto = sorted.count > 1 && sorted[0] > 2 * sorted[1] ? sorted[1] : sorted[0]
        let top = max(1, cap ?? auto)
        var out: [ShapeLayer] = []
        for (i, v) in values.enumerated() {
            let x = Double(i) * (bw + gap)
            let op = i == values.count - 1 ? 1 : dim
            var p = Path()
            if v > top {
                p.addRoundedRect(in: CGRect(x: x, y: 0, width: bw, height: H * 0.26), cornerSize: CGSize(width: 1, height: 1))
                p.addRoundedRect(in: CGRect(x: x, y: H * 0.36, width: bw, height: H * 0.64), cornerSize: CGSize(width: 1, height: 1))
            } else {
                let h = max(2, v / top * H)
                let rad = min(bw / 2, 1.5)
                p.addRoundedRect(in: CGRect(x: x, y: H - h, width: bw, height: h), cornerSize: CGSize(width: rad, height: rad))
            }
            out.append(ShapeLayer(path: p, color: color, opacity: op))
        }
        return out
    }
}
