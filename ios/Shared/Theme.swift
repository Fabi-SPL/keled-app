import SwiftUI
import UIKit
import WidgetKit

/// The resolved look of one card: theme colours for the current appearance, fonts, background.
/// No theme means the system look, so an unthemed card renders exactly as before.
struct CardPalette {
    var ink: Color = .primary
    var muted: Color = .secondary
    var accent: Color = KeledPalette.wine
    var tile: Color = Color(uiColor: .secondarySystemBackground)
    var background: [Color] = []
    var font: Font.Design = .default
    var numbers: Font.Design = .rounded
    var family: String?
    var weight: Font.Weight = .semibold
    var image: String?
    var themed = false

    static let system = CardPalette()

    static func make(_ theme: CardTheme?, dark: Bool, mode: WidgetRenderingMode = .fullColor) -> CardPalette {
        var p = CardPalette()
        guard let theme else { return p }
        p.font = design(theme.font) ?? .default
        p.numbers = design(theme.numbers) ?? .rounded
        p.family = theme.family
        p.weight = weight(theme.weight) ?? .semibold
        // Tinted and clear home screens recolour everything themselves; a brand palette there
        // only fights the system, so keep the fonts and drop the colours.
        guard mode == .fullColor else { return p }
        p.themed = true
        let d = dark ? theme.dark : nil
        if let c = hex(d?.ink ?? theme.ink) { p.ink = c }
        if let c = hex(d?.muted ?? theme.muted) { p.muted = c } else if theme.ink != nil { p.muted = p.ink.opacity(0.62) }
        if let c = hex(d?.accent ?? theme.accent) { p.accent = c }
        if let c = hex(d?.tile ?? theme.tile) { p.tile = c } else if theme.ink != nil { p.tile = p.ink.opacity(0.08) }
        p.background = (d?.bg ?? theme.bg ?? []).compactMap(hex)
        p.image = theme.image
        return p
    }

    func tint(_ name: String?) -> Color {
        switch name {
        case nil, "accent": return accent
        case "neutral": return muted
        default: return KeledPalette.tint(name)
        }
    }

    func text(_ size: CGFloat, _ weight: Font.Weight = .regular, design: Font.Design? = nil) -> Font {
        if let family, !family.isEmpty, design == nil { return .custom(family, size: size).weight(weight) }
        return .system(size: size, weight: weight, design: design ?? font)
    }

    func number(_ size: CGFloat, _ weight: Font.Weight? = nil) -> Font {
        .system(size: size, weight: weight ?? self.weight, design: numbers)
    }

    /// Colour specs from layouts: a token, a hex, either with "@0.4" for opacity.
    func color(_ raw: String?, card: Card) -> Color? {
        guard var spec = raw?.trimmingCharacters(in: .whitespaces), !spec.isEmpty else { return nil }
        var alpha = 1.0
        if let at = spec.lastIndex(of: "@"), let a = Double(spec[spec.index(after: at)...]) {
            alpha = a
            spec = String(spec[..<at])
        }
        let base: Color?
        switch spec {
        case "ink": base = ink
        case "muted": base = muted
        case "accent": base = accent
        case "tile": base = tile
        case "bg": base = background.first ?? Color(uiColor: .systemBackground)
        case "tint": base = tint(card.tint)
        case "ok", "warn", "bad": base = KeledPalette.tint(spec)
        case "neutral": base = muted
        case "white": base = .white
        case "black": base = .black
        case "clear": base = .clear
        default: base = CardPalette.hex(spec)
        }
        return base?.opacity(alpha)
    }

    static func hex(_ raw: String?) -> Color? {
        guard var s = raw?.trimmingCharacters(in: .whitespaces), s.hasPrefix("#") else { return nil }
        s.removeFirst()
        guard s.count == 6 || s.count == 8, let v = UInt64(s, radix: 16) else { return nil }
        let hasAlpha = s.count == 8
        let r = Double((v >> (hasAlpha ? 24 : 16)) & 0xFF) / 255
        let g = Double((v >> (hasAlpha ? 16 : 8)) & 0xFF) / 255
        let b = Double((v >> (hasAlpha ? 8 : 0)) & 0xFF) / 255
        let a = hasAlpha ? Double(v & 0xFF) / 255 : 1
        return Color(.sRGB, red: r, green: g, blue: b, opacity: a)
    }

    static func design(_ raw: String?) -> Font.Design? {
        switch raw {
        case "rounded": return .rounded
        case "serif": return .serif
        case "mono": return .monospaced
        case "system": return .default
        default: return nil
        }
    }

    static func weight(_ raw: String?) -> Font.Weight? {
        switch raw {
        case "ultralight": return .ultraLight
        case "thin": return .thin
        case "light": return .light
        case "regular": return .regular
        case "medium": return .medium
        case "semibold": return .semibold
        case "bold": return .bold
        case "heavy": return .heavy
        case "black": return .black
        default: return nil
        }
    }
}

private struct CardPaletteKey: EnvironmentKey {
    static let defaultValue = CardPalette.system
}

extension EnvironmentValues {
    var cardPalette: CardPalette {
        get { self[CardPaletteKey.self] }
        set { self[CardPaletteKey.self] = newValue }
    }
}

/// The card's own background: gradient or flat colour, optional image, system background otherwise.
struct CardBackground: View {
    let palette: CardPalette

    var body: some View {
        ZStack {
            if palette.background.count > 1 {
                LinearGradient(colors: palette.background, startPoint: .top, endPoint: .bottom)
            } else if let c = palette.background.first {
                c
            } else {
                Color(uiColor: .systemBackground)
            }
            if let name = palette.image, let img = AssetStore.image(name) {
                Image(uiImage: img).resizable().scaledToFill()
            }
        }
    }
}

/// Resolves the palette from the environment's appearance and wraps a card in it.
struct Themed<Content: View>: View {
    let card: Card?
    @ViewBuilder var content: (CardPalette) -> Content
    @Environment(\.colorScheme) private var scheme
    @Environment(\.widgetRenderingMode) private var mode

    var body: some View {
        let palette = CardPalette.make(card?.theme, dark: scheme == .dark, mode: mode)
        content(palette).environment(\.cardPalette, palette)
    }
}
