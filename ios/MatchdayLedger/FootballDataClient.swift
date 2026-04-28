import Foundation

enum FootballDataError: LocalizedError {
  case invalidURL(String)
  case invalidResponse
  case httpStatus(Int)

  var errorDescription: String? {
    switch self {
    case .invalidURL(let path):
      "Could not build API URL for \(path)."
    case .invalidResponse:
      "The server returned a response the app could not read."
    case .httpStatus(let status):
      "The server returned HTTP \(status)."
    }
  }
}

struct FootballDataClient {
  var baseURL = AppConfiguration.cloudflareApiBaseURL
  var session = URLSession.shared

  func standings() async throws -> StandingsResponse {
    try await get("standings")
  }

  func currentRound() async throws -> CurrentRoundResponse {
    try await get("current-round")
  }

  func season() async throws -> SeasonResponse {
    try await get("season")
  }

  func round(_ round: Int) async throws -> FixtureRoundResponse {
    try await get("fixtures/round/\(round)")
  }

  func news() async throws -> NewsResponse {
    try await get("news")
  }

  private func get<T: Decodable>(_ path: String) async throws -> T {
    guard let url = URL(string: path, relativeTo: baseURL)?.absoluteURL else {
      throw FootballDataError.invalidURL(path)
    }

    var request = URLRequest(url: url)
    request.setValue("application/json", forHTTPHeaderField: "Accept")

    let (data, response) = try await session.data(for: request)
    guard let httpResponse = response as? HTTPURLResponse else {
      throw FootballDataError.invalidResponse
    }
    guard (200..<300).contains(httpResponse.statusCode) else {
      throw FootballDataError.httpStatus(httpResponse.statusCode)
    }

    let decoder = JSONDecoder()
    return try decoder.decode(T.self, from: data)
  }
}
