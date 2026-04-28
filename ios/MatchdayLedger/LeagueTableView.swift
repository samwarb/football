import SwiftUI

struct LeagueTableView: View {
  @EnvironmentObject private var store: FootballStore

  var body: some View {
    List {
      if let errorMessage = store.errorMessage, store.teams.isEmpty {
        ContentUnavailableView(
          "Could not load the table",
          systemImage: "wifi.exclamationmark",
          description: Text(errorMessage)
        )
      } else {
        tableSummary
        ForEach(store.teams) { team in
          NavigationLink {
            TeamStandingDetailView(team: team)
          } label: {
            TeamStandingRow(team: team)
          }
        }
      }
    }
    .listStyle(.insetGrouped)
    .navigationTitle("League Table")
    .toolbar {
      ToolbarItem(placement: .topBarTrailing) {
        Button {
          Task { await store.refreshStandings() }
        } label: {
          Image(systemName: "arrow.clockwise")
        }
        .disabled(store.isLoadingStandings)
        .accessibilityLabel("Refresh table")
      }
    }
    .overlay {
      if store.isLoadingStandings && store.teams.isEmpty {
        ProgressView("Loading table")
      }
    }
    .refreshable {
      await store.refreshStandings()
    }
  }

  private var tableSummary: some View {
    Section {
      HStack {
        VStack(alignment: .leading, spacing: 4) {
          Text(store.updatedLabel)
            .font(.subheadline)
            .foregroundStyle(.secondary)
          if let cache = store.standings?.meta?.cache {
            Text("Cloudflare API: \(cache)")
              .font(.caption)
              .foregroundStyle(.secondary)
          }
        }
        Spacer()
        if store.isLoadingStandings {
          ProgressView()
        }
      }
    }
  }
}

private struct TeamStandingRow: View {
  let team: TeamStanding

  var body: some View {
    HStack(spacing: 12) {
      Text("\(team.rank)")
        .font(.headline.monospacedDigit())
        .foregroundStyle(.secondary)
        .frame(width: 30, alignment: .leading)

      TeamLogoView(urlString: team.logo, abbreviation: team.abbreviation)

      VStack(alignment: .leading, spacing: 4) {
        Text(team.name)
          .font(.headline)
        Text("\(team.played) played  \(team.wins)-\(team.draws)-\(team.losses)")
          .font(.caption)
          .foregroundStyle(.secondary)
      }

      Spacer()

      VStack(alignment: .trailing, spacing: 4) {
        Text("\(team.points)")
          .font(.title3.bold().monospacedDigit())
        Text(team.goalDifferenceLabel)
          .font(.caption.monospacedDigit())
          .foregroundStyle(team.goalDifference >= 0 ? .green : .red)
      }
    }
    .padding(.vertical, 4)
  }
}

private struct TeamStandingDetailView: View {
  let team: TeamStanding

  var body: some View {
    List {
      Section {
        HStack(spacing: 16) {
          TeamLogoView(urlString: team.logo, abbreviation: team.abbreviation, size: 56)
          VStack(alignment: .leading, spacing: 4) {
            Text(team.name)
              .font(.title2.bold())
            Text(TableZone(rank: team.rank).rawValue)
              .font(.subheadline)
              .foregroundStyle(.secondary)
          }
        }
        .padding(.vertical, 6)
      }

      Section("Standing") {
        StatRow(label: "Position", value: "\(team.rank)")
        StatRow(label: "Points", value: "\(team.points)")
        StatRow(label: "Played", value: "\(team.played)")
        StatRow(label: "Record", value: "\(team.wins)-\(team.draws)-\(team.losses)")
      }

      Section("Goals") {
        StatRow(label: "Goals For", value: "\(team.goalsFor)")
        StatRow(label: "Goals Against", value: "\(team.goalsAgainst)")
        StatRow(label: "Goal Difference", value: team.goalDifferenceLabel)
      }

      if let note = team.note, !note.isEmpty {
        Section("Status") {
          Text(note)
        }
      }
    }
    .navigationTitle(team.shortName)
    .navigationBarTitleDisplayMode(.inline)
  }
}

private struct TeamLogoView: View {
  let urlString: String
  let abbreviation: String
  var size: CGFloat = 36

  var body: some View {
    AsyncImage(url: URL(string: urlString)) { phase in
      switch phase {
      case .success(let image):
        image
          .resizable()
          .scaledToFit()
      default:
        ZStack {
          Circle().fill(.thinMaterial)
          Text(abbreviation)
            .font(.caption2.bold())
            .foregroundStyle(.secondary)
        }
      }
    }
    .frame(width: size, height: size)
    .clipShape(Circle())
  }
}

private struct StatRow: View {
  let label: String
  let value: String

  var body: some View {
    HStack {
      Text(label)
      Spacer()
      Text(value)
        .fontWeight(.semibold)
        .monospacedDigit()
    }
  }
}
