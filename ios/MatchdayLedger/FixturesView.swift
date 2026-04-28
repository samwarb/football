import SwiftUI

struct FixturesView: View {
  @EnvironmentObject private var store: FootballStore

  var body: some View {
    LedgerPage {
      LedgerHeroHeader(
        title: "Fixtures & Results",
        eyebrow: "Premier League 2025/26",
        pills: headerPills
      )

      VStack(alignment: .leading, spacing: 12) {
        LedgerSectionTitle(
          kicker: "Matchweek",
          title: "Fixtures & Results",
          note: LedgerDate.rangeLabel(round: store.selectedRound, fixtures: store.fixtures)
        )

        RoundControls()
      }

      if let message = store.fixturesErrorMessage, store.fixtures.isEmpty {
        LedgerNoticeView(title: "Could not load this matchweek", message: message)
      } else if store.isLoadingFixtures && store.fixtures.isEmpty {
        LedgerLoadingView(message: "Loading fixtures")
      } else if store.fixtures.isEmpty {
        LedgerNoticeView(title: "No fixtures found", message: "Round \(store.selectedRound) has not returned any matches yet.", systemImage: "calendar.badge.exclamationmark")
      } else {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 286), spacing: 12)], spacing: 12) {
          ForEach(store.fixtures) { fixture in
            FixtureCard(fixture: fixture)
          }
        }
      }
    }
    .navigationTitle("Fixtures")
    .navigationBarTitleDisplayMode(.inline)
    .toolbar {
      ToolbarItem(placement: .topBarTrailing) {
        Button {
          Task { await store.refreshFixtures() }
        } label: {
          Image(systemName: "arrow.clockwise")
        }
        .disabled(store.isLoadingFixtures)
        .accessibilityLabel("Refresh fixtures")
      }
    }
    .refreshable {
      await store.refreshFixtures()
    }
  }

  private var headerPills: [LedgerSourcePill] {
    let hasTv = store.fixtures.contains { !$0.tvChannels.isEmpty }

    return [
      LedgerSourcePill("Round \(store.selectedRound)", status: .ok),
      LedgerSourcePill(store.fixtures.isEmpty ? "Loading matches" : "\(store.fixtures.count) matches", status: store.fixtures.isEmpty ? .pending : .ok),
      LedgerSourcePill(hasTv ? "TV coverage" : "Kick-off times", status: .ok)
    ]
  }
}

private struct RoundControls: View {
  @EnvironmentObject private var store: FootballStore

  var body: some View {
    HStack(spacing: 10) {
      Button {
        Task { await store.loadPreviousRound() }
      } label: {
        Image(systemName: "chevron.left")
          .font(.headline.weight(.heavy))
      }
      .buttonStyle(RoundButtonStyle())
      .disabled(store.selectedRound <= store.minimumRound || store.isLoadingFixtures)
      .accessibilityLabel("Previous round")

      Text("Round \(store.selectedRound)")
        .font(.subheadline.weight(.heavy))
        .foregroundStyle(LedgerTheme.muted)
        .frame(minWidth: 128)

      Button {
        Task { await store.loadNextRound() }
      } label: {
        Image(systemName: "chevron.right")
          .font(.headline.weight(.heavy))
      }
      .buttonStyle(RoundButtonStyle())
      .disabled(store.selectedRound >= store.maximumRound || store.isLoadingFixtures)
      .accessibilityLabel("Next round")

      if store.isLoadingFixtures {
        ProgressView()
          .tint(LedgerTheme.green)
          .padding(.leading, 4)
      }
    }
  }
}

private struct RoundButtonStyle: ButtonStyle {
  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .foregroundStyle(LedgerTheme.ink)
      .frame(width: 42, height: 42)
      .background(LedgerTheme.paperStrong, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
      .overlay {
        RoundedRectangle(cornerRadius: 8, style: .continuous)
          .stroke(LedgerTheme.lineStrong, lineWidth: 1)
      }
      .opacity(configuration.isPressed ? 0.7 : 1)
  }
}

private struct FixtureCard: View {
  let fixture: Fixture

  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      HStack(alignment: .firstTextBaseline, spacing: 8) {
        Text(LedgerDate.shortDate(fixture.date))
          .font(.caption.weight(.semibold))
          .foregroundStyle(LedgerTheme.muted)

        if let venue = fixture.venue, !venue.isEmpty {
          Text(venue)
            .font(.caption)
            .foregroundStyle(LedgerTheme.muted)
            .lineLimit(1)
        }

        Spacer(minLength: 0)

        Text(fixture.statusLabel)
          .font(.caption.weight(.heavy))
          .foregroundStyle(fixture.live ? LedgerTheme.red : LedgerTheme.green)
      }

      HStack(spacing: 10) {
        FixtureTeamView(team: fixture.home)

        Text(fixture.scoreLabel)
          .font(.title3.weight(.black).monospacedDigit())
          .foregroundStyle(LedgerTheme.ink)
          .frame(minWidth: 68)
          .padding(.vertical, 9)
          .padding(.horizontal, 10)
          .background(Color(hex: 0xefe5ce), in: RoundedRectangle(cornerRadius: 8, style: .continuous))

        FixtureTeamView(team: fixture.away)
      }

      if !fixture.tvChannels.isEmpty {
        FlowingChannels(channels: fixture.tvChannels)
      }
    }
    .padding(15)
    .background(LedgerTheme.paperStrong.opacity(0.86), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
    .overlay {
      RoundedRectangle(cornerRadius: 8, style: .continuous)
        .stroke(fixture.live ? LedgerTheme.red : LedgerTheme.lineStrong, lineWidth: 1)
    }
    .shadow(color: Color(hex: 0x2d2615).opacity(0.12), radius: 20, x: 0, y: 12)
  }
}

private struct FixtureTeamView: View {
  let team: FixtureTeam

  var body: some View {
    VStack(spacing: 8) {
      TeamBadgeView(urlString: team.badge, fallback: String(team.displayName.prefix(3)).uppercased(), size: 34)

      Text(team.displayName)
        .font(.subheadline.weight(.heavy))
        .foregroundStyle(LedgerTheme.ink)
        .lineLimit(2)
        .multilineTextAlignment(.center)
        .minimumScaleFactor(0.78)
    }
    .frame(maxWidth: .infinity)
  }
}

private struct FlowingChannels: View {
  let channels: [String]

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      ForEach(channels, id: \.self) { channel in
        Text(channel)
          .font(.caption2.weight(.heavy))
          .foregroundStyle(LedgerTheme.greenDark)
          .padding(.horizontal, 8)
          .padding(.vertical, 4)
          .background(LedgerTheme.green.opacity(0.1), in: RoundedRectangle(cornerRadius: 7, style: .continuous))
          .overlay {
            RoundedRectangle(cornerRadius: 7, style: .continuous)
              .stroke(LedgerTheme.green.opacity(0.24), lineWidth: 1)
          }
      }
    }
  }
}
