<script lang="ts">
  import { CheckCircle2, CircleAlert, CircleDashed, CircleX, HelpCircle, ShieldAlert } from "@lucide/svelte";

  type Status = string;
  type Tone = "healthy" | "warning" | "danger" | "info" | "active" | "neutral";

  /** Status is never conveyed by colour alone: icon + text always accompany the tone. */
  let { status, label = status }: { status: Status; label?: string } = $props();

  const statusLabel: Record<string, string> = {
    healthy: "Gesund",
    degraded: "Eingeschränkt",
    blocked: "Blockiert",
    unknown: "Unbekannt",
    fresh: "Frisch",
    stale: "Veraltet",
    suspect: "Verdächtig",
    restored: "Wiederhergestellt",
    valid: "Gültig",
    conservative: "Konservativ",
    unsafe: "Unsicher",
    unavailable: "Nicht verfügbar",
    invalid: "Ungültig",
    good: "Gut",
    conflict: "Konflikt",
    none: "Kein Fallback",
    reject: "Ablehnen",
    hold_last: "Letzten Wert halten",
    safe_default: "Sicherer Standardwert",
    disabled: "Deaktiviert",
    not_configured: "Nicht eingerichtet",
    error: "Fehler",
    info: "Hinweis",
    alive: "Lebendig",
    overdue: "Überfällig",
    not_applicable: "Nicht relevant",
  };
  const toneMap: Record<string, Tone> = {
    healthy: "healthy", good: "healthy", fresh: "healthy", valid: "healthy", alive: "healthy",
    degraded: "warning", suspect: "warning", stale: "warning", conservative: "warning", overdue: "warning",
    blocked: "danger", unsafe: "danger", conflict: "danger", invalid: "danger", error: "danger",
    unavailable: "info", not_configured: "info", info: "info", unknown: "neutral", restored: "neutral", none: "neutral", disabled: "neutral", not_applicable: "neutral",
    reject: "danger", hold_last: "warning", safe_default: "warning",
  };
  const iconMap = { healthy: CheckCircle2, warning: CircleAlert, danger: CircleX, info: ShieldAlert, active: CheckCircle2, neutral: HelpCircle };
  let tone = $derived(toneMap[String(status)] ?? "neutral");
  let Icon = $derived(String(status) === "disabled" || String(status) === "not_configured" ? CircleDashed : iconMap[tone]);
  let text = $derived(label === status ? (statusLabel[String(status)] ?? String(status)) : label);
</script>

<span class={`status-badge ${tone}`} data-status={status}>
  <Icon size={14} strokeWidth={2.2} aria-hidden="true" />
  <span>{text}</span>
</span>
