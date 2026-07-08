import { Bell, CalendarClock, ChartColumn, CircleAlert, ListTodo, Sparkles, UsersRound } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { PageHeader } from "../../components/common/page-header";
import { QuickActions } from "../../components/common/quick-actions";
import { SectionTitle } from "../../components/common/section-title";
import { StatCard } from "../../components/common/stat-card";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "../../hooks/use-session";
import { listNotifications } from "../../services/notifications-service";

export function DashboardPage() {
  const { userId } = useSession();
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => listNotifications(userId ?? ""),
    enabled: Boolean(userId),
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Dashboard"
        title="Good morning, Manager"
        description="Track today's workload, monitor overdue duties, and move quickly from assignment to completion without losing context."
        actions={
          <>
            <Button variant="secondary">View Reports</Button>
            <Button>Create Duty</Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pending Duties" value="18" detail="5 due today, 3 overdue" accent={<ListTodo className="h-5 w-5" />} />
        <StatCard label="Completed Today" value="42" detail="+12% vs yesterday" accent={<Sparkles className="h-5 w-5" />} />
        <StatCard label="Overdue" value="3" detail="Needs manager review" accent={<CircleAlert className="h-5 w-5" />} />
        <StatCard label="Incidents" value="2" detail="Open this week" accent={<Bell className="h-5 w-5" />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="space-y-6 p-5">
          <SectionTitle title="Today's duties" description="The highest priority work across the active site." />
          <div className="space-y-3">
            {[
              { title: "Lobby deep clean", meta: "High · Due 2:00 PM · Assigned to 2 cleaners" },
              { title: "Kitchen sanitization", meta: "Medium · Due 4:30 PM · 1 cleaner" },
              { title: "Restroom inspection", meta: "Urgent · Due ASAP · 3 cleaners" },
            ].map((item) => (
              <div key={item.title} className="flex flex-col gap-2 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-medium text-slate-950">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{item.meta}</p>
                </div>
                <Button variant="secondary">Open</Button>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-6">
          <QuickActions />
        <Card className="space-y-4 p-5">
          <SectionTitle title="Recent activity" description="Latest changes across the company." />
            <div className="space-y-4 text-sm">
              {[
                { title: "Kevin completed Lobby deep clean", meta: "8 minutes ago" },
                { title: "Maria reported a broken glass incident", meta: "31 minutes ago" },
                { title: "North Tower site updated", meta: "Today at 08:12" },
              ].map((entry) => (
                <div key={entry.title} className="flex items-start gap-3">
                  <div className="mt-1 h-2.5 w-2.5 rounded-full bg-slate-900" />
                  <div>
                    <p className="font-medium text-slate-950">{entry.title}</p>
                    <p className="text-slate-500">{entry.meta}</p>
                  </div>
                </div>
              ))}
            </div>
        </Card>
        <Card className="space-y-4 p-5">
          <SectionTitle title="Notifications" description="Unread alerts and duty updates." />
          <div className="space-y-3">
            {notifications.length === 0 ? (
              <p className="text-sm text-slate-500">No notifications yet.</p>
            ) : (
              notifications.map((notification) => (
                <div key={notification.id} className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-950">{notification.type}</p>
                  <p className="mt-1 text-sm text-slate-500">{new Date(notification.createdAt).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </Card>
        <Card className="space-y-4 p-5">
          <SectionTitle title="Top cleaners" description="Performance by completion and incident-free work." />
          <div className="space-y-4">
              {[
                { name: "Alicia Gomez", score: "98%", meta: "12 completed this week" },
                { name: "Kevin Brown", score: "96%", meta: "9 completed this week" },
                { name: "Mia Patel", score: "94%", meta: "8 completed this week" },
              ].map((person) => (
                <div key={person.name} className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-slate-950">{person.name}</p>
                    <p className="text-sm text-slate-500">{person.meta}</p>
                  </div>
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">{person.score}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-slate-500">Upcoming duties</p>
          <p className="mt-2 text-2xl font-semibold">14</p>
          <p className="mt-2 text-sm text-slate-500">Scheduled over the next 72 hours.</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">Notifications</p>
          <p className="mt-2 text-2xl font-semibold">7</p>
          <p className="mt-2 text-sm text-slate-500">Unread across the current site.</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">Today's coverage</p>
          <p className="mt-2 text-2xl font-semibold">92%</p>
          <p className="mt-2 text-sm text-slate-500">Active duty completion rate.</p>
        </Card>
      </div>
    </div>
  );
}
