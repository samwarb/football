import SwiftUI

struct LeagueTableView: View {
  @EnvironmentObject private var store: FootballStore

  var body: some View {
    LedgerPage {
      LedgerHeroHeader(
        title: "Matchday Ledger",
        eyebrow: "Premier League 2025/26",
        pills: headerPills
      )

      LedgerSectionTitle(
        kicker: "Standings",
        title: "Premier League Table",
        note: "Updated \(store.updatedLabel)"
      )

      if let errorMessage = store.errorMessage, store.teams.isEmpty {
        LedgerNoticeView(title: "Could not load standings", message: errorMessage)
      } else if store.isLoadingStandings && store.teams.isEmpty {
        LedgerLoadingView(message: "Loading standings")
      } else {
        StandingsTableView()
      }
    }
    .navigationTitle("Standings")
    .navigationBarTitleDisplayMode(.inline)
    .toolbar {
      ToolbarItem(placement: .topBarTrailing) {
        Button {
          Task {
            await store.refreshStandings()
            await store.refreshSeason()
          }
        } label: {
          Image(systemName: "arrow.clockwise")
        }
        .disabled(store.isLoadingStandings || store.isLoadingSeason)
        .accessibilityLabel("Refresh standings")
      }
    }
    .refreshable {
      await store.refreshStandings()
      await store.refreshSeason()
    }
  }

  private var headerPills: [LedgerSourcePill] {
    [
      LedgerSourcePill(store.standings == nil ? "Standings pending" : "Standings synced", status: store.standings == nil ? .pending : .ok),
      LedgerSourcePill(store.seasonFixtures.isEmpty ? "Form cache loading" : "Form cache ready", status: store.seasonFixtures.isEmpty ? .pending : .ok),
      LedgerSourcePill("Cloudflare API", status: .ok)
    ]
  }
}

private struct StandingsTableView: View {
  @EnvironmentObject private var store: FootballStore

  var body: some View {
    LedgerSurface {
      VStack(alignment: .leading, spacing: 12) {
        ScrollView(.horizontal, showsIndicators: true) {
          VStack(spacing: 0) {
            TableHeaderRow()

            ForEach(Array(store.teams.enumerated()), id: \.element.id) { index, team in
              NavigationLink {
                TeamStandingDetailView(team: team)
              } label: {
                TeamTableRow(team: team, form: store.lastFiveForm(for: team.slug))
                  .background(index.isMultiple(of: 2) ? LedgerTheme.paperStrong.opacity(0.68) : Color(hex: 0xfff7e8).opacity(0.58))
              }
              .buttonStyle(.plain)
            }
          }
          .frame(minWidth: 790, alignment: .leading)
        }

        Divider()
          .overlay(LedgerTheme.line)

        LegendRow()
      }
    }
  }
}

private struct TableHeaderRow: View {
  var body: some View {
    HStack(spacing: 0) {
      HeaderCell("#", width: 48)
      HeaderCell("Club", width: 230, alignment: .leading)
      HeaderCell("MP", width: 48)
      HeaderCell("W", width: 42)
      HeaderCell("D", width: 42)
      HeaderCell("L", width: 42)
      HeaderCell("GF", width: 48)
      HeaderCell("GA", width: 48)
      HeaderCell("GD", width: 54)
      HeaderCell("Pts", width: 56)
      HeaderCell("Last 5", width: 132, alignment: .leading)
    }
    .padding(.vertical, 10)
    .background(Color(hex: 0xeee6d3))
  }
}

private struct TeamTableRow: View {
  let team: TeamStanding
  let form: [String]

  var body: some View {
    HStack(spacing: 0) {
      RankCell(rank: team.rank)
        .frame(width: 48)

      HStack(spacing: 10) {
        TeamBadgeView(urlString: team.logo, fallback: team.abbreviation, size: 30)
        Text(team.name)
          .font(.subheadline.weight(.heavy))
          .foregroundStyle(LedgerTheme.ink)
          .lineLimit(1)
          .minimumScaleFactor(0.75)
        Spacer(minLength: 0)
      }
      .frame(width: 230, alignment: .leading)

      BodyCell("\(team.played)", width: 48)
      BodyCell("\(team.wins)", width: 42)
      BodyCell("\(team.draws)", width: 42)
      BodyCell("\(team.losses)", width: 42)
      BodyCell("\(team.goalsFor)", width: 48)
      BodyCell("\(team.goalsAgainst)", width: 48)
      BodyCell(team.goalDifferenceLabel, width: 54, color: team.goalDifference >= 0 ? LedgerTheme.green : LedgerTheme.red)
      BodyCell("\(team.points)", width: 56, weight: .heavy)

      HStack(spacing: 4) {
        if form.isEmpty {
          Text("Pending")
            .font(.caption.weight(.semibold))
            .foregroundStyle(LedgerTheme.muted)
        } else {
          ForEach(Array(form.enumerated()), id: \.offset) { _, outcome in
            FormPillView(outcome: outcome)
          }
        }
      }
      .frame(width: 132, alignment: .leading)
    }
    .padding(.vertical, 10)
    .contentShape(Rectangle())
  }
}

private struct HeaderCell: View {
  let text: String
  let width: CGFloat
  var alignment: Alignment = .center

  init(_ text: String, width: CGFloat, alignment: Alignment = .center) {
    self.text = text
    self.width = width
    self.alignment = alignment
  }

  var body: some View {
    Text(text.uppercased())
      .font(.caption2.weight(.heavy))
      .foregroundStyle(LedgerTheme.muted)
      .frame(width: width, alignment: alignment)
  }
}

private struct BodyCell: View {
  let text: String
  let width: CGFloat
  var color: Color = LedgerTheme.ink
  var weight: Font.Weight = .semibold

  init(_ text: String, width: CGFloat, color: Color = LedgerTheme.ink, weight: Font.Weight = .semibold) {
    self.text = text
    self.width = width
    self.color = color
    self.weight = weight
  }

  var body: some View {
    Text(text)
      .font(.subheadline.weight(weight).monospacedDigit())
      .foregroundStyle(color)
      .frame(width: width)
  }
}

private struct RankCell: View {
  let rank: Int

  var body: some View {
    Text("\(rank)")
      .font(.subheadline.weight(.black).monospacedDigit())
      .foregroundStyle(.white)
      .frame(width: 30, height: 30)
      .background(LedgerTheme.rankColor(for: rank), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
  }
}

private struct LegendRow: View {
  private let items: [(String, Color)] = [
    ("Champions League", LedgerTheme.blue),
    ("Europa League", LedgerTheme.gold),
    ("Conference League", LedgerTheme.green),
    ("Relegation", LedgerTheme.red)
  ]

  var body: some View {
    FlowingLegend(items: items)
  }
}

private struct FlowingLegend: View {
  let items: [(String, Color)]

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      ForEach(items, id: \.0) { item in
        HStack(spacing: 6) {
          Circle()
            .fill(item.1)
            .frame(width: 10, height: 10)
          Text(item.0)
            .font(.caption)
            .foregroundStyle(LedgerTheme.muted)
        }
      }
    }
  }
}

private struct TeamStandingDetailView: View {
  @EnvironmentObject private var store: FootballStore
  let team: TeamStanding

  var body: some View {
    LedgerPage {
      LedgerSurface {
        HStack(spacing: 14) {
          TeamBadgeView(urlString: team.logo, fallback: team.abbreviation, size: 58)

          VStack(alignment: .leading, spacing: 5) {
            Text("Club dossier".uppercased())
              .font(.caption.weight(.heavy))
              .foregroundStyle(LedgerTheme.green)
            Text(team.name)
              .font(.title2.weight(.heavy))
              .foregroundStyle(LedgerTheme.ink)
            Text(TableZone(rank: team.rank).rawValue)
              .font(.footnote.weight(.semibold))
              .foregroundStyle(LedgerTheme.muted)
          }

          Spacer(minLength: 0)
        }
      }

      LazyVGrid(columns: [GridItem(.adaptive(minimum: 96), spacing: 10)], spacing: 10) {
        DetailMetric(title: "Position", value: "\(team.rank)")
        DetailMetric(title: "Points", value: "\(team.points)")
        DetailMetric(title: "Played", value: "\(team.played)")
        DetailMetric(title: "Wins", value: "\(team.wins)")
        DetailMetric(title: "GD", value: team.goalDifferenceLabel)
      }

      LedgerSurface {
        VStack(alignment: .leading, spacing: 14) {
          Text("Recent form")
            .font(.headline)
            .foregroundStyle(LedgerTheme.ink)

          HStack(spacing: 5) {
            let form = store.lastFiveForm(for: team.slug)
            if form.isEmpty {
              Text("Pending")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(LedgerTheme.muted)
            } else {
              ForEach(Array(form.enumerated()), id: \.offset) { _, outcome in
                FormPillView(outcome: outcome)
              }
            }
          }
        }
      }

      LedgerSurface {
        VStack(alignment: .leading, spacing: 12) {
          Text("Goals")
            .font(.headline)
            .foregroundStyle(LedgerTheme.ink)

          DetailStatRow(label: "Goals For", value: "\(team.goalsFor)")
          DetailStatRow(label: "Goals Against", value: "\(team.goalsAgainst)")
          DetailStatRow(label: "Goal Difference", value: team.goalDifferenceLabel, color: team.goalDifference >= 0 ? LedgerTheme.green : LedgerTheme.red)
          DetailStatRow(label: "Record", value: "\(team.wins)-\(team.draws)-\(team.losses)")
        }
      }

      LedgerSurface {
        VStack(alignment: .leading, spacing: 12) {
          Text("Cached fixtures")
            .font(.headline)
            .foregroundStyle(LedgerTheme.ink)

          let fixtures = Array(store.fixtures(for: team.slug).suffix(8).reversed())
          if fixtures.isEmpty {
            Text("No fixtures available yet.")
              .font(.footnote)
              .foregroundStyle(LedgerTheme.muted)
          } else {
            ForEach(fixtures) { fixture in
              TeamFixtureRow(fixture: fixture, team: team)
              if fixture.id != fixtures.last?.id {
                Divider()
                  .overlay(LedgerTheme.line)
              }
            }
          }
        }
      }
    }
    .navigationTitle(team.shortName)
    .navigationBarTitleDisplayMode(.inline)
  }
}

private struct DetailMetric: View {
  let title: String
  let value: String

  var body: some View {
    LedgerSurface {
      VStack(alignment: .leading, spacing: 8) {
        Text(title.uppercased())
          .font(.caption2.weight(.heavy))
          .foregroundStyle(LedgerTheme.muted)
        Text(value)
          .font(.title3.weight(.heavy).monospacedDigit())
          .foregroundStyle(LedgerTheme.ink)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }
}

private struct DetailStatRow: View {
  let label: String
  let value: String
  var color: Color = LedgerTheme.ink

  var body: some View {
    HStack {
      Text(label)
        .foregroundStyle(LedgerTheme.muted)
      Spacer()
      Text(value)
        .fontWeight(.heavy)
        .monospacedDigit()
        .foregroundStyle(color)
    }
    .font(.subheadline)
  }
}

private struct TeamFixtureRow: View {
  let fixture: Fixture
  let team: TeamStanding

  var body: some View {
    HStack(spacing: 10) {
      if let outcome = fixture.outcome(for: team.slug) {
        FormPillView(outcome: outcome)
      } else {
        Text("R\(fixture.round ?? 0)")
          .font(.caption2.weight(.heavy))
          .foregroundStyle(LedgerTheme.muted)
          .frame(width: 24, height: 24)
          .background(Color(hex: 0xe8dfc9), in: RoundedRectangle(cornerRadius: 7, style: .continuous))
      }

      VStack(alignment: .leading, spacing: 3) {
        Text("\(homeAwayLabel) \(opponent.displayName)")
          .font(.subheadline.weight(.heavy))
          .foregroundStyle(LedgerTheme.ink)
          .lineLimit(1)
        Text("\(LedgerDate.shortDate(fixture.date)) · \(fixture.venue ?? "Venue TBC")")
          .font(.caption)
          .foregroundStyle(LedgerTheme.muted)
          .lineLimit(1)
      }

      Spacer()

      Text(fixture.scoreLabel)
        .font(.subheadline.weight(.heavy).monospacedDigit())
        .foregroundStyle(LedgerTheme.ink)
    }
  }

  private var isHome: Bool {
    fixture.home.slug == team.slug
  }

  private var opponent: FixtureTeam {
    isHome ? fixture.away : fixture.home
  }

  private var homeAwayLabel: String {
    isHome ? "vs" : "@"
  }
}
