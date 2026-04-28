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
