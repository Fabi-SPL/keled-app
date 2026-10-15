import Foundation
import UIKit
import ImageIO

enum HubError: Error {
    case notConfigured
    case status(Int)
}

extension Notification.Name {
    static let keledCardsChanged = Notification.Name("KeledCardsChanged")
}

/// Reads the card hub over the tailnet. Each process (app, widget) keeps its own last good copy,
/// so a widget with the PC off shows the last numbers with an offline mark instead of nothing.
enum HubClient {
    private static var cacheURL: URL {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("keled-cards.json")
    }

    /// Who is asking, so the hub can measure how often iOS really reloads each widget.
    static var defaultSource: String {
        (Bundle.main.bundleIdentifier ?? "").hasSuffix(".widgets") ? "widget" : "app"
    }

    private static func request(_ path: String, timeout: TimeInterval = 8, source: String? = nil) throws -> URLRequest {
        guard KeledConfig.isConfigured, let url = URL(string: KeledConfig.hubURL + path) else {
            throw HubError.notConfigured
        }
        var req = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: timeout)
        req.setValue("Bearer \(KeledConfig.hubToken)", forHTTPHeaderField: "Authorization")
        req.setValue(source ?? defaultSource, forHTTPHeaderField: "X-Keled-Source")
        return req
    }

    static func fetch(source: String? = nil) async throws -> [Card] {
        let (data, response) = try await URLSession.shared.data(for: try request("/v1/cards", source: source))
        let code = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard code == 200 else { throw HubError.status(code) }
        let decoded = try JSONDecoder().decode(CardsResponse.self, from: data)
        try? data.write(to: cacheURL, options: .atomic)
        return decoded.cards
    }

    static func cached() -> [Card] {
        guard let data = try? Data(contentsOf: cacheURL),
              let decoded = try? JSONDecoder().decode(CardsResponse.self, from: data) else { return [] }
        return decoded.cards
    }

    /// Fresh cards when the hub answers, the cached ones (live = false) when it does not.
    static func cardsOrCache(source: String? = nil) async -> (cards: [Card], live: Bool) {
        if KeledConfig.demo { return (Card.samples, true) }
        do {
            let cards = try await fetch(source: source)
            await AssetStore.prefetch(cards.reduce(into: Set<String>()) { $0.formUnion($1.assetNames) })
            return (cards, true)
        } catch {
            return (cached(), false)
        }
    }

    /// Fires one card action. The hub decides what it means; the phone only names it.
    static func act(card: String, action: String, on: Bool) async throws {
        if KeledConfig.demo { return }
        var req = try request("/v1/actions", timeout: 20)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: ["card": card, "action": action, "on": on])
        let (_, response) = try await URLSession.shared.data(for: req)
        let code = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(code) else { throw HubError.status(code) }
    }

    static func asset(_ name: String) async throws -> Data {
        let (data, response) = try await URLSession.shared.data(for: try request("/v1/assets/\(name)"))
        let code = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard code == 200 else { throw HubError.status(code) }
        return data
    }
}

/// Images from hub/assets, cached on disk. Widgets cannot load images while drawing, so the
/// timeline provider fetches them first and the views read the cache synchronously.
enum AssetStore {
    private static let maxAge: TimeInterval = 6 * 3600

    private static var dir: URL {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("keled-assets", isDirectory: true)
    }

    private static func file(_ name: String) -> URL? {
        guard name.range(of: "^[a-z0-9][a-z0-9-]{0,47}\\.(png|jpg|jpeg)$", options: .regularExpression) != nil else { return nil }
        return dir.appendingPathComponent(name)
    }

    /// Decoded at most 1400 px on the long side: the widget extension dies near 30 MB, and a
    /// 1 MB PNG can decode to far more than that at full size.
    static func image(_ name: String) -> UIImage? {
        guard let url = file(name),
              let source = CGImageSourceCreateWithURL(url as CFURL, [kCGImageSourceShouldCache: false] as CFDictionary)
        else { return nil }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceThumbnailMaxPixelSize: 1400,
        ]
        guard let cg = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else { return nil }
        return UIImage(cgImage: cg)
    }

    static func prefetch(_ names: Set<String>) async {
        guard !names.isEmpty else { return }
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        await withTaskGroup(of: Void.self) { group in
            for name in names {
                guard let url = file(name) else { continue }
                let modified = (try? url.resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate
                if let modified, Date().timeIntervalSince(modified) < maxAge { continue }
                group.addTask {
                    if let data = try? await HubClient.asset(name) { try? data.write(to: url, options: .atomic) }
                }
            }
        }
    }
}
