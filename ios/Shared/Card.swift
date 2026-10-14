import SwiftUI
import UIKit

struct CardItem: Codable, Hashable {
    var title: String
    var detail: String?
    var tag: String?
    var tint: String?
    var action: String?
    var on: Bool?
    var symbol: String?
    var confirm: Bool?
}

/// A button on the card. With `url` it only opens something; otherwise the hub runs it.
struct CardAction: Codable, Hashable, Identifiable {
    var id: String
    var label: String
    var symbol: String?
    var style: String?
    var confirm: Bool?
    var on: Bool?
    var url: String?
}

/// The last action's result, shown on the card until `until` (epoch ms).
struct CardFlash: Codable, Hashable {
    var text: String
    var tint: String?
    var until: Double
}

struct ThemeColors: Codable, Hashable {
    var bg: [String]?
    var ink: String?
    var muted: String?
    var accent: String?
    var tile: String?
}

/// Per-app look, resolved by the hub from hub/themes/<app>.json. Every field is optional.
struct CardTheme: Codable, Hashable {
    var bg: [String]?
    var ink: String?
    var muted: String?
    var accent: String?
    var tile: String?
    var font: String?
    var numbers: String?
    var family: String?
    var weight: String?
    var image: String?
    var dark: ThemeColors?
}

/// One node of a layout tree. The hub validates the shape; NodeRenderer draws it.
struct LayoutNode: Codable, Hashable {
    var type: String
    var children: [LayoutNode]?
    var text: String?
    var name: String?
    var src: String?
    var value: String?
    var series: String?
    var date: String?
    var style: String?
    var of: String?
    var limit: Int?
    var action: String?
    var url: String?
    var when: String?
    var label: String?
    var symbol: String?
    var size: Double?
    var weight: String?
    var design: String?
    var family: String?
    var color: String?
    var track: String?
    var line: Double?
    var lines: Int?
    var scale: Double?
    var tracking: Double?
    var upper: Bool?
    var italic: Bool?
    var mono: Bool?
    var privacy: Bool?
    var accent: Bool?
    var spacing: Double?
    var align: String?
    var padding: [Double]?
    var bg: String?
    var radius: Double?
    var stroke: String?
    var strokeWidth: Double?
    var width: Double?
    var height: Double?
    var maxW: Bool?
    var maxH: Bool?
    var frameAlign: String?
    var opacity: Double?
    var fit: String?
    var minLength: Double?
}

/// One widget card, exactly as the hub serves it. Unknown keys are ignored.
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
    var open: String?
    var data: [String: String]?
    var theme: CardTheme?
    var layouts: [String: LayoutNode]?
    var actions: [CardAction]?
    var armed: [String: Double]?
    var flash: CardFlash?
    var updatedAt: String?
    var ageSec: Int?
    var stale: Bool?
    var order: Double?
}

/// A card that fails to decode is skipped, never the whole list: one bad card must not blank
/// every widget on the phone.
struct CardsResponse: Codable {
    var now: String?
    var cards: [Card]

    private struct Lossy: Decodable {
        let card: Card?
        init(from decoder: Decoder) throws { card = try? Card(from: decoder) }
    }

    init(now: String?, cards: [Card]) {
        self.now = now
        self.cards = cards
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        now = try c.decodeIfPresent(String.self, forKey: .now)
        cards = (try c.decodeIfPresent([Lossy].self, forKey: .cards) ?? []).compactMap(\.card)
    }
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
    var openURL: URL? { KeledLinks.open(url, via: open, title: app ?? title) }
    var isStale: Bool { stale ?? false }

    var ageText: String? {
        guard let s = ageSec else { return nil }
        if s < 90 { return "now" }
        if s < 5400 { return "\(s / 60)m" }
        if s < 129_600 { return "\(s / 3600)h" }
        return "\(s / 86400)d"
    }

    /// The hub marks every action that needs a second tap and Face ID; rows and checks obey it too.
    func needsConfirm(_ ref: String, item: CardItem? = nil) -> Bool {
        item?.confirm == true || actions?.first(where: { $0.id == ref })?.confirm == true
    }

    func isArmed(_ ref: String, at now: Date) -> Bool {
        guard let until = armed?[ref] else { return false }
        return until / 1000 > now.timeIntervalSince1970
    }

    func activeFlash(at now: Date) -> CardFlash? {
        guard let f = flash, f.until / 1000 > now.timeIntervalSince1970 else { return nil }
        return f
    }

    /// Moments the card changes without new data: an armed button falling back, a flash ending.
    var transitions: [Date] {
        var out = (armed ?? [:]).values.map { Date(timeIntervalSince1970: $0 / 1000) }
        if let f = flash { out.append(Date(timeIntervalSince1970: f.until / 1000)) }
        return out
    }

    /// Every image the card needs, so the widget can fetch them before it draws.
    var assetNames: Set<String> {
        var names = Set<String>()
        if let image = theme?.image { names.insert(image) }
        func walk(_ n: LayoutNode) {
            if n.type == "image", let src = n.src, !src.contains("{") { names.insert(src) }
            n.children?.forEach(walk)
        }
        layouts?.values.forEach(walk)
        return names
    }

    static let samples: [Card] = (try? JSONDecoder().decode([Card].self, from: Data(sampleJSON.utf8))) ?? []
}

// Invented data in the shape of the live feeds, so screenshots show real proportions.
// The last three exercise a theme, a free layout and actions; CI screenshots them on every build.
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
  "value":"3.4h","label":"deep work","series":[1.2,2.0,1.6,2.8,3.1,2.2,3.4],"caption":"best day this week","ageSec":7200,"stale":true},
 {"id":"habits","app":"Demo Themed","title":"Habits","symbol":"checkmark.seal.fill","kind":"list","tint":"accent",
  "value":"1/3","label":"done today","ageSec":30,
  "theme":{"bg":["#0E3B2E","#0A2A21"],"ink":"#F2EFE6","muted":"#9FB8AC","accent":"#E8C547","tile":"#164A3A",
           "font":"serif","numbers":"serif","weight":"bold"},
  "items":[{"title":"Cardio","action":"habit:cardio","on":true},
           {"title":"Cook a real meal","action":"habit:cook","on":false},
           {"title":"Went outside","action":"habit:outside","on":false}],
  "actions":[{"id":"log","label":"Log mood","symbol":"face.smiling","style":"filled"},
             {"id":"reset","label":"Reset","symbol":"arrow.counterclockwise","confirm":true}],
  "armed":{"reset":4102444800000}},
 {"id":"taxes","title":"UStVA","symbol":"doc.text.fill","kind":"metric","tint":"accent","ageSec":10,
  "data":{"quarter":"Q4 2026","due":"Mon 11.01.","dueAt":"2027-01-11"},
  "theme":{"bg":["#F4F1EA"],"ink":"#1C1B19","muted":"#7A766D","accent":"#B4462F","font":"serif","numbers":"serif"},
  "layouts":{"small":{"type":"vstack","align":"leading","spacing":2,"maxW":true,"maxH":true,"frameAlign":"topLeading","children":[
     {"type":"text","text":"UMSATZSTEUER","size":10,"weight":"semibold","color":"muted","tracking":1.2},
     {"type":"spacer"},
     {"type":"date","date":"{data.dueAt}","style":"days","size":56,"weight":"bold","design":"numbers","color":"accent"},
     {"type":"text","text":"days to {data.quarter}","size":13,"color":"ink"},
     {"type":"bar","value":"0.18","color":"accent","track":"accent@0.15","height":5,"padding":[6,0,0,0]},
     {"type":"text","text":"due {data.due}","size":11,"color":"muted","padding":[4,0,0,0]}]},
   "medium":{"type":"hstack","spacing":16,"children":[
     {"type":"vstack","align":"leading","spacing":2,"maxH":true,"frameAlign":"topLeading","children":[
       {"type":"text","text":"UMSATZSTEUER","size":10,"weight":"semibold","color":"muted","tracking":1.2},
       {"type":"spacer"},
       {"type":"date","date":"{data.dueAt}","style":"days","size":60,"weight":"bold","design":"numbers","color":"accent"},
       {"type":"text","text":"days left","size":13,"color":"ink"}]},
     {"type":"vstack","align":"leading","spacing":8,"maxW":true,"maxH":true,"frameAlign":"topLeading","children":[
       {"type":"text","text":"{data.quarter}","size":22,"weight":"bold","design":"serif","color":"ink"},
       {"type":"text","text":"Voranmeldung via ELSTER","size":12,"color":"muted","lines":2},
       {"type":"spacer"},
       {"type":"hstack","spacing":6,"padding":[7,10],"bg":"accent@0.12","radius":10,"children":[
         {"type":"symbol","name":"calendar","size":12,"color":"accent"},
         {"type":"text","text":"due {data.due}","size":12,"weight":"semibold","color":"accent"}]}]}]}},
  "flash":{"text":"Filed. Nice.","tint":"ok","until":4102444800000}},
 {"id":"alarm","app":"Lucid TV","title":"Alerts","symbol":"exclamationmark.triangle.fill","kind":"list","tint":"warn",
  "value":"2","label":"alerts","caption":"Washer finished","ageSec":60,
  "items":[{"title":"Washer finished","detail":"4m ago","tint":"warn","action":"ack:a1","symbol":"checkmark"},
           {"title":"Spotify needs a new login","detail":"1h ago","tint":"warn","action":"ack:a2","symbol":"checkmark"}]}
]
"""
