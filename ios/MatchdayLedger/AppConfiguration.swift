import Foundation

enum AppConfiguration {
  static let appName = "Matchday Ledger"
  static let defaultRemoteURL = URL(string: "https://samwarb.github.io/football/")!

  static func launchURL() -> URL {
    let arguments = ProcessInfo.processInfo.arguments

    if let index = arguments.firstIndex(of: "--url"),
       arguments.indices.contains(index + 1),
       let url = URL(string: arguments[index + 1]) {
      return url
    }

    if let localBundleIndex = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "dist") {
      return localBundleIndex
    }

    return defaultRemoteURL
  }
}
