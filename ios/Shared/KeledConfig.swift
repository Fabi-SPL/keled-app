import Foundation

enum KeledConfig {
    // CI swaps both placeholders in from repo secrets. The public repo never holds them.
    static let hubURL = "BUILD_HUB_URL"
    static let hubToken = "BUILD_HUB_TOKEN"

    static var isConfigured: Bool { !hubURL.hasPrefix("BUILD_") && !hubToken.hasPrefix("BUILD_") }

    /// Simulator screenshot runs cannot reach the tailnet, so they render the sample cards.
    static var demo: Bool { !isConfigured || UserDefaults.standard.bool(forKey: "KeledDemo") }
}

enum KeledLinks {
    static let home = URL(string: "keled://home")!

    /// A widget tap always lands in the app first. keled://open carries the web URL, how to open it
    /// (via=app hosts it full screen inside Keled, via=safari hands it to Safari) and a title.
    /// iOS gives no way to open an installed home-screen web app from a link, so Keled hosts it.
    static func open(_ raw: String?, via: String? = nil, title: String? = nil) -> URL? {
        guard let raw, let target = URL(string: raw) else { return nil }
        if target.scheme == "keled" { return target }
        var c = URLComponents()
        c.scheme = "keled"
        c.host = "open"
        var q = [URLQueryItem(name: "url", value: target.absoluteString)]
        if let via, !via.isEmpty { q.append(URLQueryItem(name: "via", value: via)) }
        if let title, !title.isEmpty { q.append(URLQueryItem(name: "t", value: title)) }
        c.queryItems = q
        return c.url
    }

    private static func query(_ url: URL, _ name: String) -> String? {
        URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == name })?.value
    }

    static func target(of url: URL) -> URL? {
        guard url.scheme == "keled", url.host == "open", let raw = query(url, "url") else { return nil }
        return URL(string: raw)
    }

    static func wantsSafari(_ url: URL) -> Bool { query(url, "via") == "safari" }

    static func title(of url: URL) -> String? { query(url, "t") }
}
