import SwiftUI
import UIKit
import WidgetKit

// Gallery designs (hub/designs): a layout that reads one or more cards, drawn by the same
// LayoutRenderer as a card's own layouts. The app ships a copy of every design so the gallery
// works before the hub has answered; the hub's newer copy replaces it when its version changes.

enum DesignCatalog {
    static func all() -> [Design] { HubClient.designs() }

    static func inGroup(_ group: String) -> [Design] {
        all().filter { $0.group == group }.sorted { ($0.n ?? 999) < ($1.n ?? 999) }
    }

    /// What the widget's edit menu lists: "W17 Big six · Small".
    static func label(_ d: Design) -> String { "\(d.label) · \(d.familyLabel)" }

    static func labels(group: String) -> [String] { inGroup(group).map(label) }

    /// The chosen style when it fits this widget size, else the group's first design for the size,
    /// preferring ones made for this device.
    static func resolve(group: String, style: String?, family: WidgetFamily) -> Design? {
        let key = CardView.key(family)
        let list = inGroup(group).filter { $0.family == key }
        if let style, let d = list.first(where: { label($0) == style || $0.id == style }) { return d }
        let device = UIDevice.current.userInterfaceIdiom == .pad ? "pad" : "phone"
        return list.first { ($0.device ?? "any") == "any" || $0.device == device } ?? list.first
    }
}

struct DesignView: View {
    let design: Design
    let cards: [Card]
    var live: Bool = true
    var now: Date = Date()

    var body: some View {
        let picked = design.pick(cards)
        if let primary = picked.first {
            Themed(theme: design.theme ?? primary.theme) { palette in
                let ctx = LayoutContext(card: primary, palette: palette, now: now, all: cards)
                ZStack(alignment: .topTrailing) {
                    NodeRenderer.view(design.family == "inline" ? DesignView.inline(design.layout, ctx) : design.layout, ctx)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    if !live && !design.isAccessory {
                        Image(systemName: "wifi.slash")
                            .font(.system(size: 9, weight: .semibold))
                            .foregroundStyle(palette.muted)
                            .padding(7)
                    }
                }
            }
        } else {
            Themed(theme: design.theme) { palette in
                VStack(spacing: 4) {
                    Image(systemName: "hourglass").font(.system(size: design.isAccessory ? 14 : 18, weight: .medium))
                    if !design.isAccessory {
                        Text(verbatim: design.name).font(.system(size: 12, weight: .semibold)).multilineTextAlignment(.center)
                        Text("Waiting for the hub").font(.system(size: 11)).foregroundStyle(palette.muted)
                    }
                }
                .foregroundStyle(palette.ink)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
    }

    /// An inline widget shows one line of text: the first child of a stack that passes its `when`.
    static func inline(_ n: LayoutNode, _ ctx: LayoutContext) -> LayoutNode {
        guard ["zstack", "hstack", "vstack"].contains(n.type), let kids = n.children else { return n }
        for k in kids where k.when.map({ Template.test($0, ctx) }) ?? true { return inline(k, ctx) }
        return n
    }
}

extension Card {
    /// Invented cards in the live feeds' shape (hub/designs/preview-cards.mjs), for the gallery
    /// preview and the CI shots. Never real data.
    static let previews: [Card] = {
        guard let url = Bundle.main.url(forResource: "preview-cards", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let cards = try? JSONDecoder().decode([Card].self, from: data) else { return samples }
        return cards
    }()
}
