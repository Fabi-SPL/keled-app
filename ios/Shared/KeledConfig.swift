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

    /// A widget tap always lands in the app first; keled://open hands the web URL on to Safari.
    static func open(_ raw: String?) -> URL? {
        guard let raw, let target = URL(string: raw) else { return nil }
        if target.scheme == "keled" { return target }
        var c = URLComponents()
        c.scheme = "keled"
        c.host = "open"
        c.queryItems = [URLQueryItem(name: "url", value: target.absoluteString)]
        return c.url
    }

    static func target(of url: URL) -> URL? {
        guard url.scheme == "keled", url.host == "open",
              let raw = URLComponents(url: url, resolvingAgainstBaseURL: false)?
                .queryItems?.first(where: { $0.name == "url" })?.value
        else { return nil }
        return URL(string: raw)
    }
}
