"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { useTranslations } from "next-intl";
import { Group, Segmented } from "@/components/log/controls";
import { useTheme, type ThemePreference } from "@/lib/theme-context";

export default function ThemePage() {
  const { theme, setTheme } = useTheme();
  const t = useTranslations("settings");
  return (
    <>
      <PageHeader title={t("theme.title")} backHref="/more" backLabel={t("backToMore")} showDot={false} />
      <div className="px-5 pt-3 pb-8 space-y-5">
        <Group label={t("theme.appearance")} hint={t("theme.hint")}>
          <Segmented<ThemePreference>
            label={t("theme.appearance")}
            value={theme === "night" ? "dark" : theme}
            onChange={setTheme}
            options={[{ value: "light", label: t("theme.light") }, { value: "dark", label: t("theme.dark") }, { value: "system", label: t("theme.system") }]}
          />
        </Group>
        <p className="text-caption text-muted-foreground">{t("theme.note")}</p>
      </div>
    </>
  );
}
