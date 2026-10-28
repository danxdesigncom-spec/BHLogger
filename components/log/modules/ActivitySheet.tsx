"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import type { ModuleFormContext } from "../LogSheet";
import { FaceScale, Group, OptionTiles, RadioChips } from "../controls";
import { ActivityIcon } from "../activity-icons";
import { useHousehold } from "@/lib/context/household-provider";
import { useEntries } from "@/lib/data/hooks";
import { useOptionSet } from "@/lib/data/useOptionSet";
import { useRepo } from "@/lib/data/repo-context";
import { ACTIVITY_DURATIONS, ACTIVITY_LIBRARY, activityLabel, ENJOYMENT_LABELS, type Option } from "@/lib/options";

const VISIBLE = 8;

export function ActivitySheet({ ctx, initial }: { ctx: ModuleFormContext; initial?: Record<string, unknown> }) {
  const { activeProfile } = useHousehold();
  const profileId = activeProfile?.id ?? null;
  const stage = activeProfile?.careStage ?? "child";
  const repo = useRepo();
  const qc = useQueryClient();

  const optionSet = useOptionSet(profileId, "activity", ACTIVITY_LIBRARY[stage]);
  const since = useMemo(() => new Date(Date.now() - 60 * 86_400_000).toISOString(), []);
  const recent = useEntries({ profileId: profileId ?? undefined, types: ["activity"], from: since }, !!profileId);

  const init = (initial ?? {}) as { activity_id?: string; enjoyment?: number | null; duration_min?: number };
  const [activity, setActivity] = useState<string | null>(init.activity_id ?? null);
  const [enjoyment, setEnjoyment] = useState<number | null>(init.enjoyment ?? null);
  const [duration, setDuration] = useState<number | null>(init.duration_min ?? null);
  const [showAll, setShowAll] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  // ACT-01: library plus custom activities, most-used first.
  const options: Option[] = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of recent.data ?? []) {
      const id = (e.data as { activity_id?: string }).activity_id;
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    const all = [...optionSet.options];
    const libraryOrder = new Map(all.map((o, i) => [o.key, i]));
    return all.sort((a, b) => (counts.get(b.key) ?? 0) - (counts.get(a.key) ?? 0) || libraryOrder.get(a.key)! - libraryOrder.get(b.key)!);
  }, [optionSet.options, recent.data]);

  const visible = showAll ? options : options.slice(0, VISIBLE);
  if (activity && !visible.some((o) => o.key === activity)) {
    visible.push(options.find((o) => o.key === activity) ?? { key: activity, label: activityLabel(activity) });
  }

  useEffect(() => {
    if (!activity) return;
    const label = options.find((o) => o.key === activity)?.label ?? "Activity";
    ctx.setData({ activity_id: activity, enjoyment, ...(duration ? { duration_min: duration } : {}) }, label, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity, enjoyment, duration]);

  const addActivity = async () => {
    const label = newName.trim();
    if (!label || !profileId) return;
    const result = await repo.addOption({ profileId, module: "activity", label, icon: null });
    if ("error" in result) {
      setAddError(result.error);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["options"] });
    setAdding(false);
    setNewName("");
    setAddError(null);
    const created = (await repo.listOptions(profileId, "activity")).find((o) => o.label === label);
    if (created) setActivity(created.key);
  };

  return (
    <div className="space-y-4">
      <Group label="What did they do?">
        <OptionTiles
          label="Activity"
          columns={3}
          value={activity}
          onChange={setActivity}
          options={visible.map((o) => ({ value: o.key, label: o.label, icon: <ActivityIcon id={o.key} /> }))}
          extra={
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="min-h-[76px] flex flex-col items-center justify-center gap-1 rounded-[18px] border-[1.5px] border-dashed border-dashed-line bg-card text-foreground"
            >
              <Plus size={22} strokeWidth={2} aria-hidden="true" />
              <span className="text-[0.8125rem] font-extrabold">New activity</span>
            </button>
          }
        />
        {!showAll && options.length > VISIBLE && (
          <button type="button" onClick={() => setShowAll(true)} className="self-start min-h-touch-min text-label font-extrabold text-profile-ink">
            Show all {options.length} activities
          </button>
        )}
        {adding && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void addActivity();
            }}
          >
            <label className="flex-1">
              <span className="sr-only">New activity name</span>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={40}
                placeholder="Activity name"
                className="w-full h-button rounded-full border border-input bg-card px-4 text-[16px] font-bold"
              />
            </label>
            <button type="submit" className="h-button px-5 rounded-full bg-primary text-primary-foreground text-body font-extrabold">Add</button>
          </form>
        )}
        {addError && <p role="alert" className="text-caption font-bold text-destructive">{addError}</p>}
      </Group>

      {activity && (
        <>
          <Group label="How did it go?" hint="Optional">
            <FaceScale label="Enjoyment" labels={ENJOYMENT_LABELS} value={enjoyment} onChange={(v) => setEnjoyment(v === enjoyment ? null : v)} />
          </Group>
          <Group label="How long?">
            <RadioChips
              label="How long"
              value={duration}
              onChange={(d) => setDuration(d === duration ? null : d)}
              options={ACTIVITY_DURATIONS.map((d) => ({ value: d.min, label: d.label }))}
            />
          </Group>
        </>
      )}
    </div>
  );
}
