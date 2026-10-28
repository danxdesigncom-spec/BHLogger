"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { Group, Segmented } from "@/components/log/controls";
import { useTheme, type ThemePreference } from "@/lib/theme-context";

export default function ThemePage() {
  const { theme, setTheme } = useTheme();
  return (
    <>
      <PageHeader title="Theme" backHref="/more" backLabel="Back to More" showDot={false} />
      <div className="px-5 pt-3 pb-8 space-y-5">
        <Group label="Appearance" hint="Saved on this device">
          <Segmented<ThemePreference>
            label="Appearance"
            value={theme === "night" ? "dark" : theme}
            onChange={setTheme}
            options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }, { value: "system", label: "Automatic" }]}
          />
        </Group>
        <p className="text-caption text-muted-foreground">Automatic follows your phone&rsquo;s light or dark setting.</p>
      </div>
    </>
  );
}
