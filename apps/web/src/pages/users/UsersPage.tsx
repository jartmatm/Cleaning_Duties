import { MailPlus, UserRoundPlus } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { PageHeader } from "../../components/common/page-header";
import { SectionTitle } from "../../components/common/section-title";

export function UsersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Users"
        title="People and access"
        description="Invite managers and cleaners, review invitation status, and keep every person scoped to the sites they belong to."
        actions={
          <>
            <Button variant="secondary">
              <MailPlus className="h-4 w-4" />
              Invite Cleaner
            </Button>
            <Button>
              <UserRoundPlus className="h-4 w-4" />
              Invite Manager
            </Button>
          </>
        }
      />

      <Card className="space-y-4 p-5">
        <SectionTitle title="Team members" description="Role and invitation state across the company." />
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { name: "Alicia Gomez", role: "Manager", status: "Active" },
            { name: "Kevin Brown", role: "Cleaner", status: "Pending invitation" },
            { name: "Mia Patel", role: "Cleaner", status: "Active" },
            { name: "Daniel Brooks", role: "Manager", status: "Active" },
          ].map((user) => (
            <div key={user.name} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-slate-950">{user.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{user.role}</p>
                </div>
                <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                  {user.status}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
