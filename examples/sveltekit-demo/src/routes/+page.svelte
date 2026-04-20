<script lang="ts">
  import SidebarNav from "$lib/components/SidebarNav.svelte";
  import TopBar from "$lib/components/TopBar.svelte";
  import StatCards from "$lib/components/StatCards.svelte";
  import RevenueChart from "$lib/components/RevenueChart.svelte";
  import TrafficChart from "$lib/components/TrafficChart.svelte";
  import RecentOrders from "$lib/components/RecentOrders.svelte";
  import ActivityFeed from "$lib/components/ActivityFeed.svelte";
  import UsersSection from "$lib/components/UsersSection.svelte";
  import AnalyticsSection from "$lib/components/AnalyticsSection.svelte";
  import OrdersSection from "$lib/components/OrdersSection.svelte";
  import ReportsSection from "$lib/components/ReportsSection.svelte";
  import SettingsSection from "$lib/components/SettingsSection.svelte";

  const sectionTitles: Record<string, string> = {
    dashboard: "Dashboard",
    analytics: "Analytics",
    users: "Users",
    orders: "Orders",
    reports: "Reports",
    settings: "Settings",
  };

  let activeSection = $state("dashboard");
</script>

<div class="flex h-screen overflow-hidden bg-background">
  <SidebarNav {activeSection} onSectionChange={(id) => (activeSection = id)} />

  <div class="flex flex-col flex-1 overflow-hidden">
    <TopBar title={sectionTitles[activeSection]} />

    <main class="flex-1 overflow-y-auto p-6">
      {#if activeSection === "dashboard"}
        <div class="flex flex-col gap-6 max-w-7xl mx-auto" style="display: flex">
          <StatCards />
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div class="lg:col-span-2">
              <RevenueChart />
            </div>
            <TrafficChart />
          </div>
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div class="lg:col-span-2">
              <RecentOrders />
            </div>
            <ActivityFeed />
          </div>
        </div>
      {:else if activeSection === "analytics"}
        <div class="max-w-7xl mx-auto">
          <AnalyticsSection />
        </div>
      {:else if activeSection === "users"}
        <div class="max-w-7xl mx-auto">
          <UsersSection />
        </div>
      {:else if activeSection === "orders"}
        <div class="max-w-7xl mx-auto">
          <OrdersSection />
        </div>
      {:else if activeSection === "reports"}
        <div class="max-w-7xl mx-auto">
          <ReportsSection />
        </div>
      {:else if activeSection === "settings"}
        <div class="max-w-7xl mx-auto">
          <SettingsSection />
        </div>
      {/if}
    </main>
  </div>
</div>
