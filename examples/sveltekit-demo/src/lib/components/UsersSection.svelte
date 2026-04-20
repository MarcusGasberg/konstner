<script lang="ts">
  import Card from "./ui/Card.svelte";
  import Button from "./ui/Button.svelte";
  import Input from "./ui/Input.svelte";
  import { Search, UserPlus, MoreHorizontal, Shield, User } from "lucide-svelte";
  import { cn } from "$lib/utils";

  const users = [
    { name: "Lena Hartman", email: "lena.hartman@email.com", role: "Admin", plan: "Enterprise", joined: "Jan 2024", status: "Active" },
    { name: "Marcus Webb", email: "marcus.webb@email.com", role: "Member", plan: "Starter", joined: "Feb 2024", status: "Active" },
    { name: "Priya Nair", email: "priya.nair@email.com", role: "Admin", plan: "Enterprise", joined: "Mar 2024", status: "Active" },
    { name: "Daniel Song", email: "daniel.song@email.com", role: "Member", plan: "Pro", joined: "Mar 2024", status: "Suspended" },
    { name: "Aisha Kamara", email: "aisha.kamara@email.com", role: "Member", plan: "Starter", joined: "Apr 2024", status: "Active" },
    { name: "Tom Reeves", email: "tom.reeves@email.com", role: "Viewer", plan: "Pro", joined: "May 2024", status: "Active" },
    { name: "Sofia Ruiz", email: "sofia.ruiz@email.com", role: "Admin", plan: "Enterprise", joined: "Jun 2024", status: "Active" },
    { name: "Kenji Tanaka", email: "kenji.tanaka@email.com", role: "Member", plan: "Starter", joined: "Jul 2024", status: "Inactive" },
  ];

  const statusStyle: Record<string, string> = {
    Active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    Suspended: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    Inactive: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };

    let inviteOpen = $state(false);
  let inviteEmail = $state("");
  let inviteRole = $state("Member");
  let toastMessage = $state("");
  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  function submitInvite(e: SubmitEvent) {
    e.preventDefault();
    const sentTo = inviteEmail;
    inviteOpen = false;
    inviteEmail = "";
    inviteRole = "Member";
    toastMessage = `Invite sent to ${sentTo}`;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toastMessage = ""), 3000);
  }

  let query = $state("");
  let roleFilter = $state("All");
  let statusFilter = $state("All");
  const filtered = $derived(
    users.filter(
      (u) =>
        (u.name.toLowerCase().includes(query.toLowerCase()) ||
          u.email.toLowerCase().includes(query.toLowerCase())) &&
        (roleFilter === "All" || u.role === roleFilter) &&
        (statusFilter === "All" || u.status === statusFilter)
    )
  );

    function initials(name: string) {
    return name.split(" ").map((n) => n[0]).join("");
  }

  const avatarPalette = [
    "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
    "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
    "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300",
    "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  ];

  function avatarColor(name: string) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return avatarPalette[hash % avatarPalette.length];
  }
</script>

<div class="flex flex-col gap-4">
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-base font-semibold text-foreground">Users</h2>
      <p class="text-xs text-muted-foreground mt-0.5">{users.length} total members</p>
    </div>
    <Button size="sm" class="gap-1.5" onclick={() => (inviteOpen = true)}>
      <UserPlus class="w-3.5 h-3.5" />
      Invite User
    </Button>
  </div>

  <Card class="p-5 flex flex-col gap-4">
    <div class="flex flex-wrap items-center gap-2">
      <div class="relative max-w-xs flex-1 min-w-[180px]">
        <Search
          class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground z-10"
        />
        <Input class="pl-8 text-sm" placeholder="Search users..." bind:value={query} />
      </div>
      <select
        bind:value={roleFilter}
        aria-label="Filter by role"
        class="h-9 rounded-md border border-border bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <option value="All">All roles</option>
        <option value="Admin">Admin</option>
        <option value="Member">Member</option>
        <option value="Viewer">Viewer</option>
      </select>
      <select
        bind:value={statusFilter}
        aria-label="Filter by status"
        class="h-9 rounded-md border border-border bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <option value="All">All statuses</option>
        <option value="Active">Active</option>
        <option value="Suspended">Suspended</option>
        <option value="Inactive">Inactive</option>
      </select>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-border">
            <th class="text-left pb-2.5 text-xs font-medium text-muted-foreground">Name</th>
            <th
              class="text-left pb-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell"
              >Role</th
            >
            <th
              class="text-left pb-2.5 text-xs font-medium text-muted-foreground hidden lg:table-cell"
              >Plan</th
            >
            <th
              class="text-left pb-2.5 text-xs font-medium text-muted-foreground hidden lg:table-cell"
              >Joined</th
            >
            <th class="text-left pb-2.5 text-xs font-medium text-muted-foreground">Status</th>
            <th class="pb-2.5"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          {#each filtered as user (user.email)}
            <tr class="hover:bg-muted/40 transition-colors">
              <td class="py-3">
                <div class="flex items-center gap-2.5">
                  <div
                    class={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold",
                      avatarColor(user.name)
                    )}
                  >
                    {initials(user.name)}
                  </div>
                  <div>
                    <p class="font-medium text-foreground text-xs">{user.name}</p>
                    <p class="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
              </td>
              <td class="py-3 hidden md:table-cell">
                <span class="flex items-center gap-1 text-xs text-muted-foreground">
                  {#if user.role === "Admin"}
                    <Shield class="w-3 h-3" />
                  {:else}
                    <User class="w-3 h-3" />
                  {/if}
                  {user.role}
                </span>
              </td>
              <td class="py-3 text-xs text-muted-foreground hidden lg:table-cell">
                {user.plan}
              </td>
              <td class="py-3 text-xs text-muted-foreground hidden lg:table-cell">
                {user.joined}
              </td>
              <td class="py-3">
                <span
                  class={cn(
                    "text-xs font-medium px-2 py-0.5 rounded-full",
                    statusStyle[user.status]
                  )}
                >
                  {user.status}
                </span>
              </td>
              <td class="py-3">
                <Button variant="ghost" size="icon" class="w-7 h-7" aria-label="User actions">
                  <MoreHorizontal class="w-3.5 h-3.5" />
                </Button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
      {#if filtered.length === 0}
        <p class="text-center text-sm text-muted-foreground py-8">
          No users match your search.
        </p>
      {/if}
    </div>
  </Card>
</div>

{#if inviteOpen}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    role="presentation"
    onclick={() => (inviteOpen = false)}
  >
    <div
      class="w-full max-w-sm rounded-lg border border-border bg-background p-6 shadow-lg"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-title"
      onclick={(e) => e.stopPropagation()}
    >
      <h3 id="invite-title" class="text-base font-semibold text-foreground">Invite User</h3>
      <p class="text-xs text-muted-foreground mt-1">Send an invitation via email.</p>
      <form class="flex flex-col gap-3 mt-4" onsubmit={submitInvite}>
        <div class="flex flex-col gap-1.5">
          <label for="invite-email" class="text-xs font-medium text-foreground">Email</label>
          <Input id="invite-email" type="email" required placeholder="name@company.com" bind:value={inviteEmail} />
        </div>
        <div class="flex flex-col gap-1.5">
          <label for="invite-role" class="text-xs font-medium text-foreground">Role</label>
          <select
            id="invite-role"
            bind:value={inviteRole}
            class="h-9 rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option>Admin</option>
            <option>Member</option>
            <option>Viewer</option>
          </select>
        </div>
        <div class="flex justify-end gap-2 mt-2">
          <Button type="button" variant="outline" size="sm" onclick={() => (inviteOpen = false)}>Cancel</Button>
          <Button type="submit" size="sm">Send Invite</Button>
        </div>
      </form>
    </div>
  </div>
{/if}

{#if toastMessage}
  <div
    class="fixed bottom-4 right-4 z-50 rounded-md border border-border bg-background px-4 py-2.5 text-sm text-foreground shadow-lg"
    role="status"
    aria-live="polite"
  >
    {toastMessage}
  </div>
{/if}
