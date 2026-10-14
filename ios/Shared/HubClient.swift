import Foundation

enum HubError: Error {
    case notConfigured
    case status(Int)
}

/// Reads the card hub over the tailnet. Each process (app, widget) keeps its own last good copy,
/// so a widget with the PC off shows the last numbers with an offline mark instead of nothing.
enum HubClient {
    private static var cacheURL: URL {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("keled-cards.json")
    }

    static func fetch() async throws -> [Card] {
        guard KeledConfig.isConfigured, let url = URL(string: KeledConfig.hubURL + "/v1/cards") else {
            throw HubError.notConfigured
        }
        var req = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 8)
        req.setValue("Bearer \(KeledConfig.hubToken)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await URLSession.shared.data(for: req)
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
    static func cardsOrCache() async -> (cards: [Card], live: Bool) {
        if KeledConfig.demo { return (Card.samples, true) }
        do {
            return (try await fetch(), true)
        } catch {
            return (cached(), false)
        }
    }
}
