import Foundation

@MainActor
final class FootballStore: ObservableObject {
  @Published private(set) var standings: StandingsResponse?
  @Published private(set) var isLoadingStandings = false
  @Published var errorMessage: String?

  private let client: FootballDataClient

  init(client: FootballDataClient = FootballDataClient()) {
    self.client = client
  }

  var teams: [TeamStanding] {
    standings?.teams ?? []
  }

  var updatedLabel: String {
    guard let updatedAt = standings?.updatedAt else { return "Live table" }
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

    let fallbackFormatter = ISO8601DateFormatter()
    let date = formatter.date(from: updatedAt) ?? fallbackFormatter.date(from: updatedAt)
    guard let date else { return "Live table" }

    return date.formatted(date: .abbreviated, time: .shortened)
  }

  func loadInitialData() async {
    guard teams.isEmpty else { return }
    await refreshStandings()
  }

  func refreshStandings() async {
    isLoadingStandings = true
    errorMessage = nil

    do {
      standings = try await client.standings()
    } catch {
      errorMessage = error.localizedDescription
    }

    isLoadingStandings = false
  }
}
