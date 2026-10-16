import SwiftUI
import WidgetKit

/// CI only (-KeledScreen designs): draws every gallery design at its real point size in each mode
/// it meets (Light, Dark, Clear for home designs; the lock screen for accessories) with the
/// preview cards, and writes one PNG per design and mode to Documents/designs.
struct DesignShotsView: View {
    @State private var written = 0

    var body: some View {
        Text("\(written) design shots")
            .font(.system(size: 22, weight: .semibold))
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .onAppear {
                written = DesignShots.renderAll()
                let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
                try? Data().write(to: dir.appendingPathComponent("keled-screen-designs.ok"))
            }
    }
}

@MainActor
enum DesignShots {
    static let now = ISO8601DateFormatter().date(from: "2026-10-16T17:41:00Z") ?? Date()

    static func size(_ d: Design) -> CGSize {
        let pad = d.device == "pad"
        switch d.family {
        case "small": return pad ? CGSize(width: 155, height: 155) : CGSize(width: 170, height: 170)
        case "medium": return pad ? CGSize(width: 342, height: 155) : CGSize(width: 364, height: 170)
        case "large": return pad ? CGSize(width: 342, height: 342) : CGSize(width: 364, height: 382)
        case "xl": return CGSize(width: 715, height: 342)
        case "circular": return CGSize(width: 76, height: 76)
        case "rectangular": return CGSize(width: 172, height: 76)
        default: return CGSize(width: 260, height: 26)
        }
    }

    static func modes(_ d: Design) -> [String] { d.isAccessory ? ["lock"] : ["light", "dark", "clear"] }

    static func renderAll() -> Int {
        let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("designs", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        var count = 0
        for d in HubClient.designs() {
            for mode in modes(d) {
                let renderer = ImageRenderer(content: shot(d, mode: mode))
                renderer.scale = 3
                guard let png = renderer.uiImage?.pngData() else { continue }
                try? png.write(to: dir.appendingPathComponent("\(d.id)-\(mode).png"))
                count += 1
            }
        }
        return count
    }

    static func shot(_ d: Design, mode: String) -> some View {
        let s = size(d)
        let cards = Card.previews
        let forced: String? = mode == "clear" ? "accented" : mode == "lock" ? "vibrant" : nil
        let corner: CGFloat = d.isAccessory ? 0 : (d.family == "small" ? 22 : 24)
        let backdrop: Color = mode == "lock" ? .black : mode == "clear" ? Color(red: 0.35, green: 0.37, blue: 0.42) : Color(red: 0.86, green: 0.87, blue: 0.9)
        return ZStack {
            if mode == "light" || mode == "dark" {
                Themed(theme: d.theme ?? d.pick(cards).first?.theme) { palette in CardBackground(palette: palette) }
            } else if mode == "clear" {
                Color.white.opacity(0.16)
            }
            DesignView(design: d, cards: cards, live: true, now: now)
        }
        .frame(width: s.width, height: s.height)
        .clipShape(RoundedRectangle(cornerRadius: corner, style: .continuous))
        .padding(14)
        .background(backdrop)
        .foregroundStyle(mode == "lock" ? Color.white : Color.primary)
        .environment(\.colorScheme, mode == "light" ? .light : .dark)
        .environment(\.keledForcedMode, forced)
    }
}
