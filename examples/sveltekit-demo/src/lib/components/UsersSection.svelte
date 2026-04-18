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

  let query = $state("");
  const filtered = $derived(
    users.filter(
      (u) =>
        u.name.toLowerCase().includes(query.toLowerCase()) ||
        u.email.toLowerCase().includes(query.toLowerCase())
    )
  );

  function initials(name: string) {
    return name.split(" ").map((n) => n[0]).join("");
  }
</script>

<div class="flex flex-col gap-4">
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-base font-semibold text-foreground">Users</h2>
      <p class="text-xs text-muted-foreground mt-0.5">{users.length} total members</p>
    </div>
    <Button size="sm" class="gap-1.5">
      <UserPlus class="w-3.5 h-3.5" />
      Invite User
    </Button>
  </div>

  <Card class="p-5 flex flex-col gap-4">
    <div class="relative max-w-xs">
      <Search
        class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground z-10"
      />
      <Input class="pl-8 text-sm" placeholder="Search users..." bind:value={query} />
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
                    class="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary"
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
