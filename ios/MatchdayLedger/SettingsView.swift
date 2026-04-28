import SwiftUI

struct SettingsView: View {
  @EnvironmentObject private var store: FootballStore

  var body: some View {
    LedgerPage {
      LedgerHeroHeader(
        title: "Settings",
        eyebrow: "Matchday Ledger",
        pills: [
          LedgerSourcePill("Data sources", status: .ok),
          LedgerSourcePill("App details", status: .ok)
        ]
      )

      LedgerSectionTitle(
        kicker: "Behind the scenes",
        title: "Data & Sources",
        note: "The football-facing pages stay clean; source and refresh details live here."
      )

      SettingsGroup(title: "Season") {
        SettingsRow(label: "Competition", value: "Premier League")
        SettingsRow(label: "Season", value: "2025/26")
        SettingsRow(label: "Current round", value: "Round \(store.currentRound)")
      }

      SettingsGroup(title: "Data Sources") {
        SettingsRow(label: "Table and fixtures", value: "Matchday Ledger service")
        SettingsRow(label: "News providers", value: newsSourcesLabel)
        SettingsRow(label: "Hosting", value: "Cloudflare Workers")
      }

      SettingsGroup(title: "Refresh Status") {
        SettingsRow(label: "League table", value: store.standings == nil ? "Loading" : "Ready")
        SettingsRow(label: "Recent form", value: store.seasonFixtures.isEmpty ? "Loading" : "Ready")
        SettingsRow(label: "Fixtures", value: store.fixtures.isEmpty ? "Loading" : "Ready")
        SettingsRow(label: "News", value: store.news.isEmpty ? "Loading" : "Ready")
        SettingsRow(label: "Last table update", value: store.updatedLabel)
      }

      Button {
        Task {
          await store.refreshStandings()
          await store.refreshSeason()
          await store.refreshFixtures()
          await store.refreshNews()
        }
      } label: {
        Label("Refresh All Data", systemImage: "arrow.clockwise")
          .font(.headline)
          .frame(maxWidth: .infinity)
      }
      .buttonStyle(SettingsActionButtonStyle())
      .disabled(isRefreshing)
    }
    .navigationTitle("Settings")
    .navigationBarTitleDisplayMode(.inline)
  }

  private var newsSourcesLabel: String {
    let sources = store.newsSources
    return sources.isEmpty ? "ESPN, Sky Sports" : sources.joined(separator: ", ")
  }

  private var isRefreshing: Bool {
    store.isLoadingStandings || store.isLoadingSeason || store.isLoadingFixtures || store.isLoadingNews
  }
}

private struct SettingsGroup<Content: View>: View {
  let title: String
  private let content: Content

  init(title: String, @ViewBuilder content: () -> Content) {
    self.title = title
    self.content = content()
  }

  var body: some View {
    LedgerSurface {
      VStack(alignment: .leading, spacing: 12) {
        Text(title)
          .font(.headline)
          .foregroundStyle(LedgerTheme.ink)

        VStack(spacing: 0) {
          content
        }
      }
    }
  }
}

private struct SettingsRow: View {
  let label: String
  let value: String

  var body: some View {
    HStack(alignment: .firstTextBaseline, spacing: 14) {
      Text(label)
        .font(.subheadline)
        .foregroundStyle(LedgerTheme.muted)

      Spacer(minLength: 16)

      Text(value)
        .font(.subheadline.weight(.semibold))
        .foregroundStyle(LedgerTheme.ink)
        .multilineTextAlignment(.trailing)
    }
    .padding(.vertical, 10)
    .overlay(alignment: .bottom) {
      Rectangle()
        .fill(LedgerTheme.line)
        .frame(height: 1)
        .opacity(0.7)
    }
  }
}

private struct SettingsActionButtonStyle: ButtonStyle {
  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .foregroundStyle(LedgerTheme.paperStrong)
      .padding(.vertical, 14)
      .padding(.horizontal, 16)
      .background(LedgerTheme.green, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
      .opacity(configuration.isPressed ? 0.75 : 1)
  }
}
