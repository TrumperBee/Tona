"use client";

// GCC - development-only design-system showcase.
// Every primitive, variant and state is demonstrated here with sample content.
// Demo data is allowed on this route and nowhere else in the product.
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  Copy,
  Download,
  Flag,
  Info,
  LayoutDashboard,
  Plus,
  Search,
  Settings,
  Trash2,
  Trophy,
  User,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { BrandLockup, BrandMark } from "@/components/brand/logo";
import { PageHeader } from "@/components/shared/page-header";
import {
  Avatar,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  ConfirmDialog,
  Countdown,
  Dialog,
  Drawer,
  DropdownMenu,
  EmptyState,
  FormField,
  IconButton,
  Input,
  Pagination,
  Select,
  Skeleton,
  Spinner,
  StatCard,
  StatusPill,
  Switch,
  Table,
  Tabs,
  Textarea,
  ToastProvider,
  Tooltip,
  buttonStyles,
  useToast,
  type BadgeTone,
  type TableColumn,
  type ToastTone,
} from "@/components/ui";

const sections = [
  { id: "foundations", label: "Foundations" },
  { id: "buttons", label: "Buttons" },
  { id: "forms", label: "Forms" },
  { id: "surfaces", label: "Surfaces" },
  { id: "navigation", label: "Navigation" },
  { id: "overlays", label: "Overlays" },
  { id: "data", label: "Data display" },
  { id: "feedback", label: "Feedback" },
] as const;

const palette = [
  { name: "navy-950", className: "bg-navy-950", note: "Page background" },
  { name: "navy-900", className: "bg-navy-900", note: "Panels" },
  { name: "navy-800", className: "bg-navy-800", note: "Raised surfaces" },
  { name: "electric-500", className: "bg-electric-500", note: "Primary action" },
  { name: "electric-400", className: "bg-electric-400", note: "Focus and links" },
  { name: "gold-400", className: "bg-gold-400", note: "Championship only" },
  { name: "success", className: "bg-success", note: "Confirmed" },
  { name: "warning", className: "bg-warning", note: "Pending" },
  { name: "danger", className: "bg-danger", note: "Rejected or error" },
  { name: "grey-300", className: "bg-grey-300", note: "Body text" },
] as const;

const badgeTones: readonly BadgeTone[] = [
  "neutral",
  "info",
  "success",
  "warning",
  "danger",
  "gold",
];

const toastTones: readonly ToastTone[] = ["info", "success", "warning", "danger"];

interface DemoPlayer {
  readonly player: string;
  readonly country: string;
  readonly played: number;
  readonly points: number;
}

const demoPlayers: readonly DemoPlayer[] = [
  { player: "Demo Striker", country: "Ghana", played: 8, points: 19 },
  { player: "Sample Keeper", country: "Brazil", played: 8, points: 16 },
  { player: "Example Winger", country: "Japan", played: 7, points: 11 },
];

const playerColumns: readonly TableColumn<DemoPlayer>[] = [
  {
    key: "player",
    header: "Player",
    render: (row) => <span className="font-medium text-white">{row.player}</span>,
  },
  { key: "country", header: "Country", render: (row) => row.country },
  {
    key: "played",
    header: "Played",
    align: "center",
    render: (row) => <span className="tabular-nums">{row.played}</span>,
  },
  {
    key: "points",
    header: "Points",
    align: "right",
    render: (row) => (
      <span className="font-semibold tabular-nums text-electric-300">{row.points}</span>
    ),
  },
];

function Section({
  id,
  title,
  description,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="scroll-mt-24 border-t border-white/10 py-12"
    >
      <p className="text-xs font-semibold uppercase tracking-eyebrow text-gold-300">{title}</p>
      <h2
        id={`${id}-heading`}
        className="mt-2 font-display text-3xl font-semibold uppercase tracking-display text-white"
      >
        {title}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-grey-400">{description}</p>
      <div className="mt-8 space-y-6">{children}</div>
    </section>
  );
}

function Demo({
  label,
  children,
  className,
}: {
  readonly label: string;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div className={className}>
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-eyebrow text-grey-500">
        {label}
      </p>
      {children}
    </div>
  );
}

function ShowcaseInner() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [page, setPage] = useState(3);
  const [notifications, setNotifications] = useState(true);
  const [tab, setTab] = useState("upcoming");

  return (
    <div className="min-h-dvh bg-navy-950">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-navy-950/90 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Link
            href="/"
            aria-label="Global Champions Circuit home"
            className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
          >
            <BrandLockup compact />
          </Link>
          <div className="flex items-center gap-3">
            <Badge tone="warning">Development only</Badge>
            <Link href="/" className={buttonStyles({ variant: "secondary", size: "sm" })}>
              Back to site
            </Link>
          </div>
        </div>
        <nav
          aria-label="Design system sections"
          className="no-scrollbar container overflow-x-auto pb-3"
        >
          <ul className="flex gap-1">
            {sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="inline-flex whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium text-grey-400 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="container py-12">
        <PageHeader
          eyebrow="Internal reference"
          title="GCC design system"
          description="Every primitive, variant and state used by the product. This route returns 404 in production, is excluded from robots.txt and the sitemap, and is the only place where demo content is permitted."
        />

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-eyebrow text-grey-500">Brand</p>
            <div className="mt-3 flex items-center gap-4">
              <BrandMark className="h-10 w-10" />
              <BrandMark tone="dark" className="h-10 w-10 rounded bg-white p-1" />
            </div>
            <p className="mt-3 text-xs text-grey-500">
              Circuit Orbit G: orbit ring, pitch crossbar, gold champion node.
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-eyebrow text-grey-500">
              Display type
            </p>
            <p className="mt-2 font-display text-3xl font-semibold uppercase tracking-display text-white">
              Barlow Condensed
            </p>
            <p className="mt-1 text-xs text-grey-500">Headings, scores, tournament names.</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-eyebrow text-grey-500">
              Body type
            </p>
            <p className="mt-2 text-base text-grey-100">Inter keeps tables and long copy clear.</p>
            <p className="mt-1 text-xs text-grey-500">Minimum 14px for body, 12px metadata.</p>
          </Card>
        </div>

        <Section
          id="foundations"
          title="Foundations"
          description="Navy carries structure, electric blue marks interaction, gold is reserved for championship outcomes, and semantic colours keep their meaning. Never rely on colour alone."
        >
          <Demo label="Palette">
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {palette.map((swatch) => (
                <li key={swatch.name} className="rounded-lg border border-white/10 p-2">
                  <span
                    className={`block h-12 rounded-md border border-white/10 ${swatch.className}`}
                  />
                  <span className="mt-2 block font-mono text-[11px] text-grey-200">
                    {swatch.name}
                  </span>
                  <span className="block text-[10px] leading-4 text-grey-500">{swatch.note}</span>
                </li>
              ))}
            </ul>
          </Demo>
          <div className="grid gap-4 lg:grid-cols-2">
            <Demo label="Type scale">
              <div className="space-y-2 rounded-lg border border-white/10 p-5">
                <p className="font-display text-5xl font-semibold uppercase tracking-display text-white">
                  Matchday
                </p>
                <p className="font-display text-3xl font-semibold uppercase tracking-display text-white">
                  League phase
                </p>
                <p className="text-base text-grey-200">
                  Body copy sits at 16px with a 7px line height.
                </p>
                <p className="text-sm text-grey-400">Secondary copy sits at 14px.</p>
                <p className="text-xs uppercase tracking-eyebrow text-grey-500">
                  Metadata eyebrow at 12px
                </p>
              </div>
            </Demo>
            <Demo label="Focus and motion">
              <div className="space-y-3 rounded-lg border border-white/10 p-5 text-sm text-grey-400">
                <p>
                  Every control uses a 2px electric focus ring with a navy offset. Tab through this
                  page to inspect it.
                </p>
                <p>
                  Animations are short (150-260ms) and meaningful. A global
                  <code className="mx-1 rounded bg-white/[0.06] px-1 py-0.5 text-xs">
                    prefers-reduced-motion
                  </code>
                  rule removes them for users who ask.
                </p>
                <Button size="sm">Focusable control</Button>
              </div>
            </Demo>
          </div>
        </Section>

        <Section
          id="buttons"
          title="Buttons and actions"
          description="One primary action per view. Variants are semantic, sizes preserve a 36px minimum target, and loading buttons announce their busy state."
        >
          <Demo label="Variants">
            <div className="flex flex-wrap items-center gap-3">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
              <Button variant="gold">Gold</Button>
              <Link href="/design-system" className={buttonStyles({ size: "md" })}>
                Link styled as button
              </Link>
            </div>
          </Demo>

          <Demo label="Sizes">
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
            </div>
          </Demo>

          <Demo label="States">
            <div className="flex flex-wrap items-center gap-3">
              <Button loading loadingLabel="Saving">
                Save
              </Button>
              <Button disabled>Disabled</Button>
              <Button leftIcon={<Plus aria-hidden="true" className="h-4 w-4" />}>
                With left icon
              </Button>
              <Button rightIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>
                With right icon
              </Button>
              <Button
                variant="secondary"
                leftIcon={<Download aria-hidden="true" className="h-4 w-4" />}
              >
                Export
              </Button>
            </div>
          </Demo>

          <Demo label="Icon buttons">
            <div className="flex flex-wrap items-center gap-3">
              <IconButton label="Search">
                <Search aria-hidden="true" className="h-4 w-4" />
              </IconButton>
              <IconButton label="Notifications" variant="outline">
                <Bell aria-hidden="true" className="h-4 w-4" />
              </IconButton>
              <IconButton label="Add player" variant="solid">
                <Plus aria-hidden="true" className="h-4 w-4" />
              </IconButton>
              <IconButton label="Delete record" variant="danger">
                <Trash2 aria-hidden="true" className="h-4 w-4" />
              </IconButton>
              <IconButton label="Disabled action" disabled>
                <Settings aria-hidden="true" className="h-4 w-4" />
              </IconButton>
            </div>
          </Demo>

          <Demo label="Sizes">
            <div className="flex flex-wrap items-center gap-3">
              <IconButton label="Small" size="sm">
                <Check aria-hidden="true" className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton label="Medium" size="md">
                <Check aria-hidden="true" className="h-4 w-4" />
              </IconButton>
              <IconButton label="Large" size="lg">
                <Check aria-hidden="true" className="h-5 w-5" />
              </IconButton>
            </div>
          </Demo>
        </Section>

        <Section
          id="forms"
          title="Form controls"
          description="Labels are always present. Hints and errors are wired through aria-describedby, invalid fields set aria-invalid, and the control keeps a 44px touch target."
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <Demo label="Input, hint and required">
              <FormField
                htmlFor="ds-gamer-tag"
                label="Gamer tag"
                hint="Shown to opponents on public fixtures."
                required
              >
                <Input placeholder="e.g. CircuitStriker" />
              </FormField>
            </Demo>

            <Demo label="Error state">
              <FormField
                htmlFor="ds-email"
                label="Email address"
                error="Enter a valid email address."
              >
                <Input type="email" placeholder="name@example.com" />
              </FormField>
            </Demo>

            <Demo label="Select">
              <FormField htmlFor="ds-country" label="Country" optional>
                <Select defaultValue="">
                  <option value="" disabled>
                    Select a country
                  </option>
                  <option value="gh">Ghana</option>
                  <option value="br">Brazil</option>
                  <option value="jp">Japan</option>
                </Select>
              </FormField>
            </Demo>

            <Demo label="Disabled input">
              <FormField htmlFor="ds-locked" label="Account ID" hint="Assigned by the server.">
                <Input value="usr_demo_2048" disabled readOnly />
              </FormField>
            </Demo>

            <Demo label="Textarea" className="lg:col-span-2">
              <FormField
                htmlFor="ds-rules"
                label="Competition rules"
                hint="Supports plain text. Published with the tournament."
              >
                <Textarea placeholder="Describe the rules players must accept." />
              </FormField>
            </Demo>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <Demo label="Checkbox">
              <div className="space-y-4 rounded-lg border border-white/10 p-4">
                <Checkbox
                  label="Accept the competition rules"
                  description="Unchecked by default."
                />
                <Checkbox defaultChecked label="Remember this device" />
                <Checkbox disabled label="Disabled option" />
                <Checkbox invalid label="Invalid option" description="Shown with an error state." />
              </div>
            </Demo>

            <Demo label="Switch">
              <div className="space-y-4 rounded-lg border border-white/10 p-4">
                <Switch
                  checked={notifications}
                  onCheckedChange={setNotifications}
                  label="Notifications"
                  description={notifications ? "Enabled for real platform events." : "Disabled."}
                />
                <Switch disabled label="Disabled switch" />
              </div>
            </Demo>
          </div>
        </Section>

        <Section
          id="surfaces"
          title="Surfaces and status"
          description="Cards are content containers, not decoration. Status always pairs colour with a text label."
        >
          <Demo label="Card variants">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(["default", "elevated", "outline", "gold"] as const).map((variant) => (
                <Card key={variant} variant={variant}>
                  <CardHeader>
                    <CardTitle className="text-lg">{variant}</CardTitle>
                    <CardDescription>Card variant</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-grey-400">
                      A container for related competition content.
                    </p>
                  </CardContent>
                  <CardFooter>
                    <span className="text-xs text-grey-500">Footer slot</span>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </Demo>

          <Demo label="Badges">
            <div className="flex flex-wrap items-center gap-2">
              {badgeTones.map((tone) => (
                <Badge key={tone} tone={tone}>
                  {tone}
                </Badge>
              ))}
            </div>
          </Demo>

          <Demo label="Status pills">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone="success" pulse>
                League phase live
              </StatusPill>
              <StatusPill tone="gold">Knockout stage</StatusPill>
              <StatusPill tone="warning">Registration closed</StatusPill>
              <StatusPill tone="danger">Suspended</StatusPill>
              <StatusPill tone="neutral">Archived</StatusPill>
            </div>
          </Demo>
        </Section>

        <Section
          id="navigation"
          title="Navigation"
          description="Tabs use roving focus with arrow, Home and End keys. Pagination exposes the current page, and breadcrumbs mark the final item with aria-current."
        >
          <Demo label="Tabs">
            <Tabs
              ariaLabel="Tournament sections"
              value={tab}
              onValueChange={setTab}
              items={[
                {
                  id: "upcoming",
                  label: "Upcoming",
                  content: (
                    <p className="text-sm text-grey-400">
                      Panel for upcoming fixtures. Arrow keys move between tabs.
                    </p>
                  ),
                },
                {
                  id: "results",
                  label: "Results",
                  content: (
                    <p className="text-sm text-grey-400">
                      Panel for verified results. The selected tab is the only one in the tab order.
                    </p>
                  ),
                },
                {
                  id: "standings",
                  label: "Standings",
                  content: (
                    <p className="text-sm text-grey-400">
                      Panel for the league table, generated from confirmed matches.
                    </p>
                  ),
                },
                {
                  id: "locked",
                  label: "Locked",
                  disabled: true,
                  content: null,
                },
              ]}
            />
          </Demo>

          <div className="grid gap-6 lg:grid-cols-2">
            <Demo label="Dropdown menu">
              <DropdownMenu
                label="Player actions"
                trigger={
                  <span className={buttonStyles({ variant: "secondary", size: "sm" })}>
                    Open menu
                    <ChevronDown aria-hidden="true" className="h-4 w-4" />
                  </span>
                }
                items={[
                  {
                    label: "View profile",
                    icon: <User className="h-4 w-4" />,
                    onSelect: () => toast({ title: "View profile", description: "Demo action." }),
                  },
                  {
                    label: "Copy player link",
                    icon: <Copy className="h-4 w-4" />,
                    onSelect: () => toast({ title: "Link copied", description: "Demo action." }),
                  },
                  {
                    label: "Remove from tournament",
                    icon: <Trash2 className="h-4 w-4" />,
                    danger: true,
                    separatorBefore: true,
                    onSelect: () => setConfirmOpen(true),
                  },
                ]}
              />
            </Demo>

            <Demo label="Breadcrumbs">
              <Breadcrumbs
                items={[
                  { label: "Home", href: "/" },
                  { label: "Tournaments", href: "/tournaments" },
                  { label: "Demo Cup" },
                ]}
              />
            </Demo>
          </div>

          <Demo label="Pagination">
            <Pagination page={page} pageCount={12} onPageChange={setPage} />
          </Demo>
        </Section>

        <Section
          id="overlays"
          title="Overlays"
          description="Dialog, drawer and confirm dialog trap Tab focus, close on Escape, lock background scrolling and restore focus to the trigger."
        >
          <Demo label="Triggers">
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => setDialogOpen(true)}>Open dialog</Button>
              <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
                Open drawer
              </Button>
              <Button variant="danger" onClick={() => setConfirmOpen(true)}>
                Destructive action
              </Button>
              <Tooltip content="The tooltip appears on hover and keyboard focus.">
                <Button variant="ghost" leftIcon={<Info aria-hidden="true" className="h-4 w-4" />}>
                  Tooltip trigger
                </Button>
              </Tooltip>
            </div>
          </Demo>

          <Demo label="Toasts">
            <div className="flex flex-wrap items-center gap-3">
              {toastTones.map((tone) => (
                <Button
                  key={tone}
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    toast({
                      tone,
                      title: `${tone[0]?.toUpperCase()}${tone.slice(1)} notification`,
                      description: "Toasts are informational and announced politely.",
                    })
                  }
                >
                  {tone}
                </Button>
              ))}
            </div>
          </Demo>

          <Dialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            title="Publish fixtures"
            description="Publishing makes every matchday visible to participants."
            footer={
              <>
                <Button variant="secondary" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    setDialogOpen(false);
                    toast({
                      tone: "success",
                      title: "Demo only",
                      description: "No fixtures were published.",
                    });
                  }}
                >
                  Publish
                </Button>
              </>
            }
          >
            <p className="text-sm leading-6 text-grey-300">
              This dialog demonstrates the focus trap and the modal announcement. It does not
              publish anything.
            </p>
          </Dialog>

          <Drawer
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
            side="right"
            title="Workspace navigation"
            description="A drawer preserves context on small screens."
            footer={
              <Button variant="secondary" className="w-full" onClick={() => setDrawerOpen(false)}>
                Close drawer
              </Button>
            }
          >
            <nav aria-label="Demo workspace">
              <ul className="space-y-1">
                {[
                  { label: "Overview", icon: LayoutDashboard },
                  { label: "Players", icon: Users },
                  { label: "Fixtures", icon: CalendarDays },
                  { label: "Result reports", icon: Flag },
                  { label: "Settings", icon: Settings },
                ].map((item) => {
                  const Icon = item.icon;

                  return (
                    <li key={item.label}>
                      <button
                        type="button"
                        onClick={() => setDrawerOpen(false)}
                        className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-grey-300 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
                      >
                        <Icon aria-hidden="true" className="h-4 w-4" />
                        {item.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </Drawer>

          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="Remove this player?"
            description="The entry will be removed from the field. Competition records already created are not erased."
            confirmLabel="Remove player"
            onConfirm={() => {
              setConfirmOpen(false);
              toast({ tone: "warning", title: "Demo only", description: "No player was removed." });
            }}
          />
        </Section>

        <Section
          id="data"
          title="Data display"
          description="Tables keep real headers and switch to cards below the md breakpoint. Empty states explain what will appear and never display sample counts."
        >
          <Demo label="Table (desktop table, mobile cards)">
            <Table
              caption="Demo standings"
              columns={playerColumns}
              rows={demoPlayers}
              getRowKey={(row) => row.player}
            />
          </Demo>

          <Demo label="Table empty state">
            <Table
              columns={playerColumns}
              rows={[]}
              getRowKey={(row) => row.player}
              emptyState={
                <div className="rounded-lg border border-dashed border-white/15 p-8 text-center text-sm text-grey-400">
                  No verified results yet.
                </div>
              }
            />
          </Demo>

          <div className="grid gap-6 lg:grid-cols-2">
            <Demo label="Stat cards">
              <div className="grid gap-4 sm:grid-cols-2">
                <StatCard
                  label="Registered"
                  value="36"
                  hint="Confirmed participants."
                  icon={Users}
                />
                <StatCard
                  label="Matches played"
                  value="72"
                  hint="Verified results only."
                  icon={Trophy}
                />
              </div>
            </Demo>

            <Demo label="Avatar sizes">
              <div className="flex flex-wrap items-end gap-4 rounded-lg border border-white/10 p-4">
                <Avatar name="Demo Striker" size="xs" />
                <Avatar name="Demo Striker" size="sm" />
                <Avatar name="Demo Striker" size="md" />
                <Avatar name="Demo Striker" size="lg" />
                <Avatar name="Demo Striker" size="xl" />
                <Avatar name="?" size="md" />
              </div>
            </Demo>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Demo label="Countdown">
              <div className="rounded-lg border border-white/10 p-4">
                <Countdown target={new Date("2026-12-31T18:00:00Z")} label="Demo kick-off" />
              </div>
            </Demo>

            <Demo label="Breadcrumbs">
              <div className="rounded-lg border border-white/10 p-4">
                <Breadcrumbs
                  items={[
                    { label: "Home", href: "/" },
                    { label: "Archives", href: "/archives" },
                    { label: "2026 season" },
                  ]}
                />
              </div>
            </Demo>
          </div>

          <Demo label="Empty state">
            <EmptyState
              icon={Search}
              eyebrow="Demo state"
              title="No records match this filter"
              description="An empty state explains what will appear and offers a real next step. Sample rows are never used to fill the gap."
              action={
                <Button size="sm" onClick={() => toast({ title: "Demo action" })}>
                  Clear filters
                </Button>
              }
              secondaryAction={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => toast({ title: "Demo action" })}
                >
                  Reset view
                </Button>
              }
            />
          </Demo>
        </Section>

        <Section
          id="feedback"
          title="Feedback"
          description="Spinners and skeletons are placeholders for real loading states. Both are hidden from assistive technology unless a live label is supplied."
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <Demo label="Spinners">
              <div className="flex flex-wrap items-center gap-5 rounded-lg border border-white/10 p-5">
                <Spinner size="sm" />
                <Spinner size="md" />
                <Spinner size="lg" />
                <Spinner label="Loading standings" />
              </div>
            </Demo>

            <Demo label="Skeletons">
              <div className="space-y-3 rounded-lg border border-white/10 p-5">
                <Skeleton variant="circle" />
                <Skeleton />
                <Skeleton className="w-2/3" />
                <Skeleton variant="block" />
              </div>
            </Demo>
          </div>

          <Card variant="outline" className="p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle
                aria-hidden="true"
                className="mt-0.5 h-5 w-5 shrink-0 text-warning-soft"
              />
              <p className="text-sm leading-6 text-grey-400">
                This route is development-only. Demo players, fixtures and counts exist here and
                must never be copied into a product page. The production site reads real data or
                shows an honest empty state.
              </p>
            </div>
          </Card>
        </Section>
      </main>
    </div>
  );
}

export function DesignSystemShowcase() {
  return (
    <ToastProvider>
      <ShowcaseInner />
    </ToastProvider>
  );
}
