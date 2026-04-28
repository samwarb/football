import Foundation

@MainActor
final class FootballStore: ObservableObject {
  @Published private(set) var standings: StandingsResponse?
  @Published private(set) var season: SeasonResponse?
  @Published private(set) var selectedRound = 34
  @Published private(set) var currentRound = 34
  @Published private(set) var fixtureRound: FixtureRoundResponse?
  @Published private(set) var newsResponse: NewsResponse?
  @Published private(set) var isLoadingStandings = false
  @Published private(set) var isLoadingSeason = false
  @Published private(set) var isLoadingFixtures = false
  @Published private(set) var isLoadingNews = false
  @Published var errorMessage: String?
  @Published var fixturesErrorMessage: String?
  @Published var newsErrorMessage: String?

  private let client: FootballDataClient
  let minimumRound = 1
  let maximumRound = 38

  init(client: FootballDataClient = FootballDataClient()) {
    self.client = client
  }

  var teams: [TeamStanding] {
    standings?.teams ?? []
  }

  var seasonFixtures: [Fixture] {
    season?.fixtures ?? []
  }

  var fixtures: [Fixture] {
    fixtureRound?.fixtures ?? []
  }

  var news: [NewsArticle] {
    newsResponse?.articles ?? []
  }

  var newsSources: [String] {
    Array(Set(news.map(\.source))).sorted()
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
    if standings == nil {
      await refreshStandings()
    }

    if season == nil {
      await refreshSeason()
    }

    if fixtureRound == nil {
      await loadCurrentRound()
    }

    if newsResponse == nil {
      await refreshNews()
    }
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

  func refreshSeason() async {
    isLoadingSeason = true

    do {
      season = try await client.season()
      if let round = season?.currentRound {
        currentRound = round
      }
    } catch {
      if errorMessage == nil {
        errorMessage = error.localizedDescription
      }
    }

    isLoadingSeason = false
  }

  func loadCurrentRound() async {
    isLoadingFixtures = true
    fixturesErrorMessage = nil

    do {
      let payload = try await client.currentRound()
      currentRound = payload.round
      selectedRound = payload.round
      fixtureRound = try await client.round(payload.round)
    } catch {
      fixturesErrorMessage = error.localizedDescription
    }

    isLoadingFixtures = false
  }

  func loadRound(_ round: Int) async {
    let safeRound = max(minimumRound, min(maximumRound, round))
    selectedRound = safeRound
    isLoadingFixtures = true
    fixturesErrorMessage = nil

    do {
      fixtureRound = try await client.round(safeRound)
    } catch {
      fixturesErrorMessage = error.localizedDescription
    }

    isLoadingFixtures = false
  }

  func loadPreviousRound() async {
    await loadRound(selectedRound - 1)
  }

  func loadNextRound() async {
    await loadRound(selectedRound + 1)
  }

  func refreshFixtures() async {
    await loadRound(selectedRound)
  }

  func refreshNews() async {
    isLoadingNews = true
    newsErrorMessage = nil

    do {
      newsResponse = try await client.news()
    } catch {
      newsErrorMessage = error.localizedDescription
    }

    isLoadingNews = false
  }

  func lastFiveForm(for slug: String) -> [String] {
    seasonFixtures
      .filter { fixture in
        fixture.played && (fixture.home.slug == slug || fixture.away.slug == slug)
      }
      .sorted { lhs, rhs in
        let lhsKey = "\(lhs.date ?? "")-\(lhs.round ?? 0)"
        let rhsKey = "\(rhs.date ?? "")-\(rhs.round ?? 0)"
        return lhsKey > rhsKey
      }
      .prefix(5)
      .compactMap { $0.outcome(for: slug) }
  }

  func fixtures(for slug: String) -> [Fixture] {
    seasonFixtures
      .filter { $0.home.slug == slug || $0.away.slug == slug }
      .sorted {
        let roundDifference = ($0.round ?? 0) - ($1.round ?? 0)
        if roundDifference != 0 { return roundDifference < 0 }
        return ($0.date ?? "") < ($1.date ?? "")
      }
  }
}
