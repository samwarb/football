import Foundation

struct ResponseMeta: Decodable, Hashable {
  let cache: String?
  let cachedAt: String?
  let warning: String?
}

struct StandingsResponse: Decodable, Hashable {
  let season: String
  let updatedAt: String?
  let teams: [TeamStanding]
  let meta: ResponseMeta?
}

struct CurrentRoundResponse: Decodable, Hashable {
  let season: String
  let round: Int
}

struct SeasonResponse: Decodable, Hashable {
  let season: String
  let currentRound: Int?
  let complete: Bool?
  let scope: String?
  let rounds: [FixtureRound]
  let warnings: [String]?
  let meta: ResponseMeta?

  var fixtures: [Fixture] {
    rounds.flatMap(\.fixtures)
  }
}

struct FixtureRound: Decodable, Hashable, Identifiable {
  let round: Int
  let fixtures: [Fixture]

  var id: Int { round }
}

struct FixtureRoundResponse: Decodable, Hashable {
  let season: String
  let round: Int
  let fixtures: [Fixture]
  let warnings: [String]?
  let meta: ResponseMeta?
}

struct Fixture: Decodable, Hashable, Identifiable {
  let id: String
  let round: Int?
  let date: String?
  let time: String?
  let venue: String?
  let status: String
  let played: Bool
  let live: Bool
  let home: FixtureTeam
  let away: FixtureTeam
  let score: FixtureScore
  let tvChannels: [String]

  enum CodingKeys: String, CodingKey {
    case id
    case round
    case date
    case time
    case venue
    case status
    case played
    case live
    case home
    case away
    case score
    case tvChannels
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    if let stringId = try? container.decode(String.self, forKey: .id) {
      id = stringId
    } else {
      id = String(try container.decode(Int.self, forKey: .id))
    }

    round = try container.decodeIfPresent(Int.self, forKey: .round)
    date = try container.decodeIfPresent(String.self, forKey: .date)
    time = try container.decodeIfPresent(String.self, forKey: .time)
    venue = try container.decodeIfPresent(String.self, forKey: .venue)
    status = try container.decodeIfPresent(String.self, forKey: .status) ?? "Scheduled"
    played = try container.decodeIfPresent(Bool.self, forKey: .played) ?? false
    live = try container.decodeIfPresent(Bool.self, forKey: .live) ?? false
    home = try container.decode(FixtureTeam.self, forKey: .home)
    away = try container.decode(FixtureTeam.self, forKey: .away)
    score = try container.decodeIfPresent(FixtureScore.self, forKey: .score) ?? FixtureScore(home: nil, away: nil)
    tvChannels = try container.decodeIfPresent([String].self, forKey: .tvChannels) ?? []
  }

  var scoreLabel: String {
    if played {
      return "\(score.home ?? 0) - \(score.away ?? 0)"
    }

    guard let time, !time.isEmpty else { return "vs" }
    return String(time.prefix(5))
  }

  var statusLabel: String {
    if live { return "Live" }
    if played { return "FT" }
    if date == Date().formatted(.iso8601.year().month().day()) { return "Today" }
    return "Scheduled"
  }

  func outcome(for slug: String) -> String? {
    guard played else { return nil }

    let isHome = home.slug == slug
    let isAway = away.slug == slug
    guard isHome || isAway else { return nil }

    let ownScore = isHome ? score.home : score.away
    let opponentScore = isHome ? score.away : score.home
    guard let ownScore, let opponentScore else { return nil }

    if ownScore > opponentScore { return "W" }
    if ownScore < opponentScore { return "L" }
    return "D"
  }
}

struct FixtureTeam: Decodable, Hashable {
  let slug: String
  let name: String
  let shortName: String?
  let badge: String?

  var displayName: String {
    shortName?.isEmpty == false ? shortName! : name
  }
}

struct FixtureScore: Decodable, Hashable {
  let home: Int?
  let away: Int?
}

struct NewsResponse: Decodable, Hashable {
  let season: String
  let articles: [NewsArticle]
  let warnings: [String]?
  let meta: ResponseMeta?
}

struct NewsArticle: Decodable, Hashable, Identifiable {
  let id: String
  let source: String
  let headline: String
  let description: String?
  let publishedAt: String?
  let image: String?
  let link: String?
  let tag: String?
  let teams: [String]

  enum CodingKeys: String, CodingKey {
    case id
    case source
    case headline
    case description
    case publishedAt
    case image
    case link
    case tag
    case teams
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    if let stringId = try? container.decode(String.self, forKey: .id) {
      id = stringId
    } else {
      id = String(try container.decode(Int.self, forKey: .id))
    }

    source = try container.decodeIfPresent(String.self, forKey: .source) ?? "News"
    headline = try container.decodeIfPresent(String.self, forKey: .headline) ?? "Untitled story"
    description = try container.decodeIfPresent(String.self, forKey: .description)
    publishedAt = try container.decodeIfPresent(String.self, forKey: .publishedAt)
    image = try container.decodeIfPresent(String.self, forKey: .image)
    link = try container.decodeIfPresent(String.self, forKey: .link)
    tag = try container.decodeIfPresent(String.self, forKey: .tag)
    teams = try container.decodeIfPresent([String].self, forKey: .teams) ?? []
  }
}

struct TeamStanding: Decodable, Hashable, Identifiable {
  let providerId: String
  let slug: String
  let name: String
  let shortName: String
  let abbreviation: String
  let logo: String
  let rank: Int
  let played: Int
  let wins: Int
  let draws: Int
  let losses: Int
  let goalsFor: Int
  let goalsAgainst: Int
  let goalDifference: Int
  let points: Int
  let note: String?

  var id: String { slug }
  var goalDifferenceLabel: String {
    goalDifference > 0 ? "+\(goalDifference)" : "\(goalDifference)"
  }
}

enum TableZone: String {
  case championsLeague = "Champions League"
  case europaLeague = "Europa League"
  case conferenceLeague = "Conference League"
  case relegation = "Relegation"
  case midTable = "Premier League"

  init(rank: Int) {
    if rank <= 4 {
      self = .championsLeague
    } else if rank <= 6 {
      self = .europaLeague
    } else if rank == 7 {
      self = .conferenceLeague
    } else if rank >= 18 {
      self = .relegation
    } else {
      self = .midTable
    }
  }
}
