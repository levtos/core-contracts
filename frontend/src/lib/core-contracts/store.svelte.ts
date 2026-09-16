import { CoreContractsClient, reconcileById, reconcileContracts } from "./client";
import { previewData } from "./fixtures";
import { RegistryEditor, type Profile } from './registry.svelte';
import { UxPreferences, formatRelativeDate } from './preferences.svelte';
import { formatDateTime } from './format';
import type { GraphMode } from './graph-focus';
import { DEFAULT_FILTER, buildContractRows, buildDeviceRows, buildFusionRows, buildSourceRows, type ListFilter, type RowContext } from './listing';
import type { ConnectionState, DataState } from "../ui/state";
import type {
  Contract,
  DiagnosticProjection,
  GraphSnapshot,
  HassLike,
  HealthItem,
} from "./types";

export type AppView = "overview" | "contracts" | "contract" | "sources" | "devices" | "graph" | "problems" | "changes" | "settings" | "trace";
export type { ConnectionState, DataState } from "../ui/state";

const REGISTRY_POLL_EVERY = 6; // read-only refresh runs every 5 s; the registry view every 30 s

export class CoreContractsStore {
  registry = new RegistryEditor();
  preferences = new UxPreferences();
  constructor() { this.registry.onActivated = () => void this.refresh(); }
  activeView = $state<AppView>("overview");
  selectedContractId = $state<string | null>(null);
  selectedField = $state<string | null>(null);
  selectedBindingId = $state<string | null>(null);
  selectedFusionId = $state<string | null>(null);
  selectedDeviceId = $state<string | null>(null);
  contractFilter = $state<ListFilter>({ ...DEFAULT_FILTER });
  sourceFilter = $state<ListFilter>({ ...DEFAULT_FILTER });
  fusionFilter = $state<ListFilter>({ ...DEFAULT_FILTER });
  deviceFilter = $state<ListFilter>({ ...DEFAULT_FILTER });
  sourceTab = $state<"bindings" | "fusions">("bindings");
  contractHealthFilter = $state("all");
  contractSort = $state<"name" | "schema" | "quality">("name");
  graphFocus = $state("");
  graphMode = $state<GraphMode>("current");
  contracts = $state<Contract[]>([]);
  diagnostics = $state<DiagnosticProjection[]>([]);
  graph = $state<GraphSnapshot | null>(null);
  health = $state<HealthItem[]>([]);
  private selectedDetails = $state<Record<string, Contract>>({});
  connectionState = $state<ConnectionState>("loading");
  dataState = $state<DataState>("loading");
  errorMessage = $state<string | null>(null);
  revision = $state(0);
  lastUpdated = $state<string | null>(null);
  previewMode = $state(false);

  private hass: HassLike | null = null;
  private client: CoreContractsClient | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private refreshing = false;
  private pollCount = 0;

  /** Legacy compatibility: the contracts list search. */
  get search(): string { return this.contractFilter.query; }
  get filteredContracts(): Contract[] {
    const query = this.contractFilter.query.trim().toLowerCase();
    if (!query) return this.contracts;
    return this.contracts.filter((contract) =>
      `${contract.contract_id} ${contract.schema_id} ${contract.health}`.toLowerCase().includes(query),
    );
  }

  get selectedContract(): Contract | null {
    if (!this.selectedContractId) return null;
    return this.selectedDetails[this.selectedContractId]
      ?? this.contracts.find((contract) => contract.contract_id === this.selectedContractId)
      ?? null;
  }

  get selectedDiagnostics(): DiagnosticProjection | null {
    return this.diagnostics.find((item) => item.contract_id === this.selectedContractId) ?? null;
  }

  /** Configuration rows always prefer the registry (draft or active); graph data is the read-only fallback. */
  get rowContext(): RowContext {
    const registry = this.registry;
    return {
      bindings: registry.view ? registry.bindings : (this.graph?.bindings ?? []),
      fusions: registry.view ? registry.fusions : (this.graph?.fusions ?? []),
      devices: registry.devices,
      diagnostics: this.diagnostics,
      signals: this.graph?.signals ?? [],
      requirements: registry.view?.requirements ?? [],
      hass: registry.hass,
    };
  }
  get sourceRows() { return buildSourceRows(this.rowContext); }
  get fusionRows() { return buildFusionRows(this.rowContext, this.contracts); }
  get deviceRows() { return buildDeviceRows(this.rowContext, this.sourceRows); }
  get contractRows() { return buildContractRows(this.contracts, this.rowContext); }

  /** Time rendering follows the "Zeitangaben" preference everywhere. */
  when(value: string | null | undefined): string {
    if (!value) return "—";
    const mode = this.preferences.timeDisplay;
    if (mode === "relative") return formatRelativeDate(value);
    if (mode === "exact") return formatDateTime(value);
    return `${formatRelativeDate(value)} · ${formatDateTime(value)}`;
  }

  setHass(hass: HassLike | null): void {
    if (hass === this.hass) return;
    this.hass = hass;
    this.registry.setHass(hass);
    this.client = hass ? new CoreContractsClient(hass, this.registry.profile) : null;
    if (hass?.connection) {
      this.previewMode = false;
      void this.refresh();
      this.startPolling();
    } else if (!this.previewMode) {
      this.stopPolling();
      this.connectionState = "unavailable";
      this.dataState = "empty";
    }
  }

  start(): void {
    if (!this.hass?.connection) {
      this.connectionState = "unavailable";
      this.dataState = "empty";
      return;
    }
    void this.refresh();
    this.startPolling();
  }

  stop(): void {
    this.stopPolling();
  }

  private startPolling(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.refresh(), 5000);
  }

  private stopPolling(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  async refresh(): Promise<void> {
    if (!this.client || this.refreshing || this.previewMode) return;
    this.refreshing = true;
    const profile = this.registry.profile;
    // Background polling must not make the live shell oscillate between
    // connected and reconnecting. Only the first attempt after an unavailable
    // connection needs a loading transition; successful refreshes stay quiet.
    if (this.connectionState === "unavailable" && this.lastUpdated === null) {
      this.connectionState = "loading";
    }
    try {
      const revision = this.revision || undefined;
      const [contractsPayload, diagnosticsPayload, graphPayload, healthPayload] = await Promise.all([
        this.client.listContracts(revision),
        this.client.getDiagnostics(revision),
        this.client.getGraph(revision),
        this.client.getHealth(revision),
      ]);
      if (profile !== this.registry.profile) return;
      this.contracts = reconcileContracts(this.contracts, contractsPayload.contracts ?? []);
      this.selectedDetails = Object.fromEntries(
        Object.entries(this.selectedDetails).filter(([contractId]) =>
          this.contracts.some((contract) => contract.contract_id === contractId),
        ),
      );
      this.diagnostics = reconcileById(this.diagnostics, diagnosticsPayload.diagnostics ?? [], "projection_id");
      this.health = reconcileById(this.health, healthPayload.health ?? [], "contract_id");
      this.graph = graphPayload.graph ?? null;
      this.revision = Math.max(
        contractsPayload.revision ?? 0,
        diagnosticsPayload.revision ?? 0,
        graphPayload.revision ?? 0,
        healthPayload.revision ?? 0,
      );
      this.lastUpdated = new Date().toISOString();
      this.errorMessage = null;
      this.connectionState = "connected";
      this.dataState = this.deriveDataState(this.contracts);
      if (!this.selectedContractId && this.contracts[0]) {
        this.selectedContractId = this.contracts[0].contract_id;
      }
      if (this.selectedContractId && !this.contracts.some((item) => item.contract_id === this.selectedContractId)) {
        this.selectedContractId = this.contracts[0]?.contract_id ?? null;
      }
      // Configuration (registry view) is loaded once and re-read at a slower cadence.
      if (!this.registry.view || this.pollCount % REGISTRY_POLL_EVERY === 0) await this.registry.poll();
      this.pollCount += 1;
    } catch (error) {
      if (profile !== this.registry.profile) return;
      this.connectionState = this.contracts.length ? "offline" : "error";
      this.dataState = this.contracts.length ? "stale" : "empty";
      this.errorMessage = error instanceof Error ? error.message : "Unbekannter read-only Verbindungsfehler.";
    } finally {
      this.refreshing = false;
      if (profile !== this.registry.profile) void this.refresh();
    }
  }

  private deriveDataState(contracts: Contract[]): DataState {
    if (!contracts.length) return "empty";
    if (contracts.some((item) => item.health === "blocked")) return "blocked";
    if (contracts.some((item) => item.health === "degraded" || item.health === "unknown")) return "degraded";
    return "ready";
  }

  usePreview(): void {
    const data = previewData();
    this.previewMode = true;
    this.stopPolling();
    this.contracts = data.contracts;
    this.diagnostics = data.diagnostics;
    this.graph = data.graph;
    this.health = data.health;
    this.revision = data.graph.revision;
    this.selectedContractId = data.contracts[0]?.contract_id ?? null;
    this.connectionState = "connected";
    this.dataState = this.deriveDataState(data.contracts);
    this.lastUpdated = new Date().toISOString();
  }

  selectContract(contractId: string): void {
    this.selectedContractId = contractId;
    if (this.client && !this.previewMode) {
      const profile = this.registry.profile;
      void this.client
        .getContract(contractId)
        .then((payload) => {
          if (profile === this.registry.profile && payload.contract?.contract_id === contractId) {
            this.selectedDetails = { ...this.selectedDetails, [contractId]: payload.contract };
          }
        })
        .catch(() => undefined);
    }
  }

  setView(view: AppView): void {
    this.activeView = view;
    this.preferences.remember(view);
    if (!this.registry.view && !this.previewMode) void this.registry.refresh();
  }

  openTrace(contractId: string, field: string): void {
    this.selectContract(contractId);
    this.selectedField = field;
    this.activeView = "trace";
  }

  async switchProfile(profile: Profile) {
    await this.registry.switchProfile(profile);
    if (this.registry.profile !== profile) return;
    this.client = this.hass ? new CoreContractsClient(this.hass, profile) : null;
    this.contracts = []; this.diagnostics = []; this.health = []; this.graph = null;
    this.selectedDetails = {}; this.selectedContractId = null; this.revision = 0;
    this.selectedBindingId = null; this.selectedFusionId = null; this.selectedDeviceId = null;
    await this.refresh();
  }

  /** Open the binding dialog for a diagnostic finding; refuses stale revisions. */
  async repairBinding(profile: Profile, bindingId: string, revision: number) {
    if (!this.registry.admin) return;
    if (profile !== this.registry.profile) await this.switchProfile(profile);
    if (profile !== this.registry.profile) return;
    await this.registry.refresh();
    if (this.registry.view?.registry.revision?.revision !== revision) {
      this.registry.notice='Diagnose stammt aus einer anderen Revision. Diagnose aktualisieren und Reparatur erneut öffnen.';
      this.activeView='sources'; return;
    }
    const binding=this.registry.bindings.find(b=>b.binding_id===bindingId && b.profile_id===profile);
    if (!binding) {this.registry.notice='Binding ist im aktuellen Profil/Entwurf nicht vorhanden.'; this.activeView='sources'; return;}
    this.activeView='sources'; this.sourceTab='bindings'; this.selectedBindingId=bindingId; this.registry.select(binding);
  }

  setSearch(value: string): void {
    this.contractFilter = { ...this.contractFilter, query: value };
  }
}
