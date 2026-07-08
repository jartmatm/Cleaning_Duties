import { Button } from "../ui/button";
import { Card } from "../ui/card";

export function QuickActions() {
  return (
    <Card className="space-y-4 p-5">
      <div>
        <p className="text-sm font-medium text-slate-950">Quick actions</p>
        <p className="mt-1 text-sm text-slate-500">Start the most common manager workflows.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button>Create Site</Button>
        <Button variant="secondary">Create Duty</Button>
        <Button variant="ghost">Invite User</Button>
      </div>
    </Card>
  );
}
