import SwiftUI
import UIKit

struct CardItem: Codable, Hashable {
    var title: String
    var detail: String?
    var tag: String?
    var tint: String?
}

/// One widget card, exactly as hub/store.mjs normalizes it. Unknown keys are ignored.
struct Card: Codable, Identifiable, Hashable {
    var id: String
    var title: String
    var kind: String
    var tint: String
    var app: String?
    var symbol: String?
    var value: String?
    var label: String?
    var caption: String?
    var progress: Double?
    var series: [Double]?
    var items: [CardItem]?
    var url: String?
    var updatedAt: String?
    var ageSec: Int?
    var stale: Bool?
    var order: Double?
}

struct CardsResponse: Codable {
    var now: String?
    var cards: [Card]
}

enum KeledPalette {
    // Brand: black and white, wine only as a splash. Status colours mean status, nothing else.
    static let wine = Color(uiColor: UIColor { $0.userInterfaceStyle == .dark
        ? UIColor(red: 0.86, green: 0.36, blue: 0.44, alpha: 1)
        : UIColor(red: 0.608, green: 0.106, blue: 0.188, alpha: 1) })
    static let ok = Color(red: 0.19, green: 0.64, blue: 0.38)
    static let warn = Color(red: 0.90, green: 0.58, blue: 0.10)
    static let bad = Color(red: 0.86, green: 0.22, blue: 0.22)

    static func tint(_ name: String?) -> Color {
        switch name {
        case "ok": return ok
        case "warn": return warn
        case "bad": return bad
        case "neutral": return Color.secondary
        default: return wine
        }
    }
}

extension Card {
    var tintColor: Color { KeledPalette.tint(tint) }
    var symbolName: String { symbol ?? "square.grid.2x2.fill" }
    var openURL: URL? { KeledLinks.open(url) }
    var isStale: Bool { stale ?? false }

    var ageText: String? {
        guard let s = ageSec else { return nil }
        if s < 90 { return "now" }
        if s < 5400 { return "\(s / 60)m" }
        if s < 129_600 { return "\(s / 3600)h" }
        return "\(s / 86400)d"
    }

    static let samples: [Card] = (try? JSONDecoder().decode([Card].self, from: Data(sampleJSON.utf8))) ?? []
}

// Invented data in the shape of the live feeds, so screenshots show real proportions.
private let sampleJSON = """
[
 {"id":"mail","app":"Keled Mail","title":"Mail","symbol":"envelope.fill","kind":"list","tint":"warn",
  "value":"4","label":"need you","caption":"0 threads marked for Claude","ageSec":40,
  "items":[{"title":"WORK","detail":"3 need you","tag":"124","tint":"warn"},
           {"title":"HOME","detail":"1 need you","tag":"18","tint":"warn"},
           {"title":"SHOP","detail":"clear","tag":"2"},
           {"title":"NEWS","detail":"clear","tag":"312"}]},
 {"id":"office","app":"Keled Office","title":"Office","symbol":"building.2.fill","kind":"status","tint":"neutral",
  "value":"Stopped","label":"STOP file","caption":"5 with you · last 51m ago","ageSec":70,
  "items":[{"title":"Mira","detail":"idle"},{"title":"Nora","detail":"idle"},{"title":"Lena","detail":"drafting","tag":"busy","tint":"ok"}]},
 {"id":"olympus","app":"Olympus","title":"Board","symbol":"building.columns.fill","kind":"list","tint":"warn",
  "value":"5/6","label":"carried","caption":"Pick the launch date first.","ageSec":3000,
  "items":[{"title":"Move the site launch to Monday","detail":"20h ago","tag":"keled"},
           {"title":"Approve the March invoice run","detail":"waiting on you","tag":"held","tint":"warn"},
           {"title":"Lena drafts a three-line nudge","detail":"waiting on you","tag":"held","tint":"warn"}]},
 {"id":"office-asks","app":"Keled Office","title":"Asks","symbol":"questionmark.bubble.fill","kind":"metric","tint":"ok",
  "value":"0","label":"for you","caption":"nothing waiting","ageSec":70},
 {"id":"build","app":"Demo","title":"Build","symbol":"hammer.fill","kind":"gauge","tint":"accent",
  "value":"62%","label":"TestFlight","progress":0.62,"caption":"archive running","ageSec":20},
 {"id":"focus","app":"Demo","title":"Focus","symbol":"chart.xyaxis.line","kind":"spark","tint":"accent",
  "value":"3.4h","label":"deep work","series":[1.2,2.0,1.6,2.8,3.1,2.2,3.4],"caption":"best day this week","ageSec":7200,"stale":true}
]
"""
