import { Filter, Plus, Search } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { PageHeader } from "../../components/common/page-header";
import { SectionTitle } from "../../components/common/section-title";

export function DutiesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cleaning Duties"
        title="Duty board"
        description="Review the current duty load, filter by priority or status, and open any duty to manage assignments and evidence."
        actions={
          <>
            <Button variant="secondary">
              <Filter className="h-4 w-4" />
              Filters
            </Button>
            <Button>
              <Plus className="h-4 w-4" />
              Create Duty
            </Button>
          </>
        }
      />

      <Card className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
        <div className="flex-1">
          <label className="sr-only" htmlFor="duty-search">
            Search duties
          </label>
          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
            <Search className="h-4 w-4 text-slate-400" />
            <input id="duty-search" className="w-full bg-transparent text-sm outline-none" placeholder="Search title, cleaner, site..." />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary">Priority</Button>
          <Button variant="secondary">Status</Button>
          <Button variant="secondary">Cleaner</Button>
          <Button variant="secondary">Due date</Button>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {[
          { title: "Lobby deep clean", meta: "High priority · Due today · North Tower", status: "In Progress" },
          { title: "Kitchen sanitization", meta: "Medium priority · Due tomorrow · Harbour Plaza", status: "Pending" },
          { title: "Restroom inspection", meta: "Urgent priority · Overdue · Sunset Offices", status: "Overdue" },
          { title: "Glass door polish", meta: "Low priority · Scheduled · North Tower", status: "Draft" },
        ].map((duty) => (
          <Card key={duty.title} className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-slate-950">{duty.title}</p>
                <p className="mt-1 text-sm text-slate-500">{duty.meta}</p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{duty.status}</div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary">Open</Button>
              <Button variant="ghost">Assign</Button>
            </div>
          </Card>
        ))}
      </div>

      <Card className="space-y-4 p-5">
        <SectionTitle title="Status distribution" description="The current mix of work across the active site." />
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          {[
            ["Draft", "4"],
            ["Pending", "9"],
            ["In Progress", "11"],
            ["Completed", "23"],
            ["Incomplete", "2"],
            ["Overdue", "3"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
