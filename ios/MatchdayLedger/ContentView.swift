import SwiftUI

struct ContentView: View {
  @StateObject private var store = FootballStore()

  var body: some View {
    TabView {
      NavigationStack {
        LeagueTableView()
      }
      .tabItem {
        Label("Standings", systemImage: "list.number")
      }

      NavigationStack {
        FixturesView()
      }
      .tabItem {
        Label("Fixtures", systemImage: "calendar")
      }

      NavigationStack {
        StatsView()
      }
      .tabItem {
        Label("Stats", systemImage: "chart.bar.xaxis")
      }

      NavigationStack {
        NewsView()
      }
      .tabItem {
        Label("News", systemImage: "newspaper")
      }
    }
    .environmentObject(store)
    .task {
      await store.loadInitialData()
    }
    .tint(LedgerTheme.green)
  }
}
