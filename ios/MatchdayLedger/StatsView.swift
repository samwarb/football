import SwiftUI

struct StatsView: View {
  @EnvironmentObject private var store: FootballStore

  var body: some View {
    LedgerPage {
      LedgerHeroHeader(
        title: "Team Stats",
        eyebrow: "Premier League 2025/26",
        pills: headerPills
      )

      LedgerSectionTitle(
        kicker: "Numbers",
        title: "Team Stats",
        note: "Native panels built from the live standings feed"
      )

      if let errorMessage = store.errorMessage, store.teams.isEmpty {
        LedgerNoticeView(title: "Could not load stats", message: errorMessage)
      } else if store.isLoadingStandings && store.teams.isEmpty {
        LedgerLoadingView(message: "Loading stats")
      } else {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 300), spacing: 12)], spacing: 12) {
          StatPanel(
            title: "Most goals",
            teams: sortedTeams(\.goalsFor, ascending: false),
            value: \.goalsFor
          )

          StatPanel(
            title: "Fewest conceded",
            teams: sortedTeams(\.goalsAgainst, ascending: true),
            value: \.goalsAgainst
          )

          StatPanel(
            title: "Best goal difference",
            teams: sortedTeams(\.goalDifference, ascending: false),
            value: \.goalDifference
          )

          StatPanel(
            title: "Most wins",
            teams: sortedTeams(\.wins, ascending: false),
            value: \.wins
          )
        }

        GoalsComparisonPanel(teams: sortedTeams(\.goalsFor, ascending: false))
      }
    }
    .navigationTitle("Stats")
    .navigationBarTitleDisplayMode(.inline)
    .toolbar {
      ToolbarItem(placement: .topBarTrailing) {
        Button {
          Task { await store.refreshStandings() }
        } label: {
          Image(systemName: "arrow.clockwise")
        }
        .disabled(store.isLoadingStandings)
        .accessibilityLabel("Refresh stats")
      }
    }
    .refreshable {
      await store.refreshStandings()
    }
  }

  private var headerPills: [LedgerSourcePill] {
    [
      LedgerSourcePill(store.standings == nil ? "Standings pending" : "Standings synced", status: store.standings == nil ? .pending : .ok),
      LedgerSourcePill("\(store.teams.count) clubs", status: store.teams.isEmpty ? .pending : .ok),
      LedgerSourcePill("Goals · form · record", status: .ok)
    ]
  }

  private func sortedTeams(_ keyPath: KeyPath<TeamStanding, Int>, ascending: Bool) -> [TeamStanding] {
    store.teams.sorted {
      ascending ? $0[keyPath: keyPath] < $1[keyPath: keyPath] : $0[keyPath: keyPath] > $1[keyPath: keyPath]
    }
  }
}

private struct StatPanel: View {
  let title: String
  let teams: [TeamStanding]
  let value: KeyPath<TeamStanding, Int>

  var body: some View {
    LedgerSurface {
      VStack(alignment: .leading, spacing: 14) {
        Text(title)
          .font(.headline)
          .foregroundStyle(LedgerTheme.ink)

        VStack(spacing: 9) {
          ForEach(Array(teams.prefix(10))) { team in
            StatBarRow(team: team, value: team[keyPath: value], maxValue: maxValue)
          }
        }
      }
    }
  }

  private var maxValue: Int {
    max(teams.prefix(10).map { abs($0[keyPath: value]) }.max() ?? 1, 1)
  }
}

private struct StatBarRow: View {
  let team: TeamStanding
  let value: Int
  let maxValue: Int

  var body: some View {
    HStack(spacing: 10) {
      Text(team.shortName)
        .font(.caption.weight(.semibold))
        .foregroundStyle(LedgerTheme.muted)
        .lineLimit(1)
        .frame(width: 92, alignment: .leading)

      GeometryReader { proxy in
        ZStack(alignment: .leading) {
          Capsule()
            .fill(Color(hex: 0xe3dac5))

          Capsule()
            .fill(value >= 0 ? LedgerTheme.green : LedgerTheme.red)
            .frame(width: max(4, proxy.size.width * CGFloat(abs(value)) / CGFloat(maxValue)))
        }
      }
      .frame(height: 8)

      Text("\(value)")
        .font(.caption.weight(.heavy).monospacedDigit())
        .foregroundStyle(LedgerTheme.ink)
        .frame(width: 36, alignment: .trailing)
    }
    .frame(minHeight: 31)
  }
}

private struct GoalsComparisonPanel: View {
  let teams: [TeamStanding]

  var body: some View {
    LedgerSurface {
      VStack(alignment: .leading, spacing: 14) {
        Text("Goals for and against")
          .font(.headline)
          .foregroundStyle(LedgerTheme.ink)

        VStack(spacing: 12) {
          ForEach(Array(teams.prefix(12))) { team in
            GoalComparisonRow(team: team, maxValue: maxValue)
          }
        }
      }
    }
  }

  private var maxValue: Int {
    max(teams.prefix(12).flatMap { [$0.goalsFor, $0.goalsAgainst] }.max() ?? 1, 1)
  }
}

private struct GoalComparisonRow: View {
  let team: TeamStanding
  let maxValue: Int

  var body: some View {
    HStack(spacing: 10) {
      TeamBadgeView(urlString: team.logo, fallback: team.abbreviation, size: 30)

      VStack(alignment: .leading, spacing: 7) {
        HStack {
          Text(team.abbreviation)
            .font(.caption.weight(.heavy))
            .foregroundStyle(LedgerTheme.ink)
          Spacer()
          Text("GF \(team.goalsFor) · GA \(team.goalsAgainst)")
            .font(.caption2.weight(.semibold).monospacedDigit())
            .foregroundStyle(LedgerTheme.muted)
        }

        HStack(spacing: 4) {
          bar(value: team.goalsFor, color: LedgerTheme.green)
          bar(value: team.goalsAgainst, color: LedgerTheme.red)
        }
      }
    }
  }

  private func bar(value: Int, color: Color) -> some View {
    GeometryReader { proxy in
      ZStack(alignment: .leading) {
        Capsule()
          .fill(Color(hex: 0xe3dac5))
        Capsule()
          .fill(color)
          .frame(width: max(4, proxy.size.width * CGFloat(value) / CGFloat(maxValue)))
      }
    }
    .frame(height: 8)
  }
}
