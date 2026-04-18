<script lang="ts">
  import Card from "./ui/Card.svelte";
  import Button from "./ui/Button.svelte";
  import Input from "./ui/Input.svelte";
  import Label from "./ui/Label.svelte";
  import Switch from "./ui/Switch.svelte";
  import Separator from "./ui/Separator.svelte";
  import { Save, Trash2, AlertCircle } from "lucide-svelte";

  let form = $state({
    name: "Alex Mercer",
    email: "alex.mercer@company.com",
    company: "Nucleus Corp",
    timezone: "UTC-5 (Eastern)",
  });

  let notifications = $state({
    email: true,
    push: false,
    weekly: true,
    billing: true,
    security: true,
  });

  const notifLabels: Record<keyof typeof notifications, { title: string; desc: string }> = {
    email: { title: "Email notifications", desc: "Receive updates via email" },
    push: { title: "Push notifications", desc: "In-app and browser push alerts" },
    weekly: { title: "Weekly digest", desc: "Summary of activity every Monday" },
    billing: { title: "Billing alerts", desc: "Invoice and payment notifications" },
    security: { title: "Security alerts", desc: "Login and permission change alerts" },
  };

  let saved = $state(false);

  function handleSave() {
    saved = true;
    setTimeout(() => (saved = false), 2000);
  }
</script>

<div class="flex flex-col gap-6 max-w-2xl">
  <div>
    <h2 class="text-base font-semibold text-foreground">Settings</h2>
    <p class="text-xs text-muted-foreground mt-0.5">Manage your account preferences</p>
  </div>

  <Card class="p-5 flex flex-col gap-5">
    <h3 class="text-sm font-semibold text-foreground">Profile</h3>
    <div class="flex items-center gap-4">
      <div
        class="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary"
      >
        AM
      </div>
      <div>
        <Button variant="outline" size="sm" class="text-xs">Change avatar</Button>
        <p class="text-xs text-muted-foreground mt-1.5">JPG, PNG or GIF — max 2MB</p>
      </div>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div class="flex flex-col gap-1.5">
        <Label class="text-xs">Full name</Label>
        <Input bind:value={form.name} class="text-sm" />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label class="text-xs">Email address</Label>
        <Input bind:value={form.email} class="text-sm" />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label class="text-xs">Company</Label>
        <Input bind:value={form.company} class="text-sm" />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label class="text-xs">Timezone</Label>
        <Input bind:value={form.timezone} class="text-sm" />
      </div>
    </div>
    <div class="flex justify-end">
      <Button size="sm" class="gap-1.5" onclick={handleSave}>
        <Save class="w-3.5 h-3.5" />
        {saved ? "Saved!" : "Save changes"}
      </Button>
    </div>
  </Card>

  <Card class="p-5 flex flex-col gap-4">
    <h3 class="text-sm font-semibold text-foreground">Notifications</h3>
    <div class="space-y-4">
      {#each Object.keys(notifLabels) as key (key)}
        {@const k = key as keyof typeof notifications}
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-foreground">{notifLabels[k].title}</p>
            <p class="text-xs text-muted-foreground mt-0.5">{notifLabels[k].desc}</p>
          </div>
          <Switch bind:checked={notifications[k]} />
        </div>
      {/each}
    </div>
  </Card>

  <Card class="p-5 flex flex-col gap-4 border-destructive/30">
    <div class="flex items-center gap-2">
      <AlertCircle class="w-4 h-4 text-destructive" />
      <h3 class="text-sm font-semibold text-foreground">Danger Zone</h3>
    </div>
    <Separator />
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm font-medium text-foreground">Delete account</p>
        <p class="text-xs text-muted-foreground mt-0.5">
          Permanently remove your account and all associated data. This cannot be undone.
        </p>
      </div>
      <Button variant="destructive" size="sm" class="gap-1.5 shrink-0 ml-4">
        <Trash2 class="w-3.5 h-3.5" />
        Delete
      </Button>
    </div>
  </Card>
</div>
