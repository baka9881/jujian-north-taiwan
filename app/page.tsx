"use client";

import { useMemo, useState, type CSSProperties } from "react";
import dataset from "@/data/processed/projects.json";
import amenityDataset from "@/data/processed/amenities.json";
import qualityDataset from "@/data/processed/quality-evidence.json";
import updateReportDataset from "@/data/processed/update-report.json";
import InteractiveMap from "./InteractiveMap";

type PriceSummary = {
  median: number;
  low: number;
  high: number;
  count: number;
  latestDate: string | null;
  source: string;
};

type PriceEvidence = {
  status: "matched" | "official-no-match" | "source-no-match";
  statusLabel: string;
  matchMethod: string;
  addressCorroborated: boolean | null;
  addressTokens: string[];
  lastCheckedAt: string;
  sourceUrl: string;
};

type AmenityCategory = "convenience" | "pxmart" | "costco" | "station" | "school" | "medical" | "market" | "park" | "pharmacy" | "parking";
type AmenityWeights = Record<AmenityCategory, number>;
type AmenityProfileKey = "balanced" | "student" | "family" | "driver" | "custom";

type AmenityPoi = {
  id: string;
  name: string;
  category: AmenityCategory;
  latitude: number;
  longitude: number;
  address: string | null;
};

type NearestAmenity = AmenityPoi & {
  distanceMeters: number;
  walkMinutes: number;
  routes: {
    walking: RouteSummary | null;
    driving: RouteSummary | null;
    peakDriving: RouteSummary | null;
  };
};

type RouteSummary = {
  durationMinutes: number;
  distanceMeters: number;
  profile: "pedestrian" | "auto";
  departure: string | null;
};

type ProjectAmenity = {
  location: {
    latitude: number;
    longitude: number;
    confidence: "high" | "medium" | "low" | "estimated";
    method: string;
    label: string;
    queryAddress: string;
  };
  score: number | null;
  rawScore: number;
  distanceScore: number | null;
  grade: string | null;
  scoreReliability: "verified" | "approximate" | "unavailable";
  nearest: Record<AmenityCategory, NearestAmenity | null>;
  categoryScores: Record<AmenityCategory, number>;
};

type AmenityDataset = {
  generatedAt: string;
  source: { name: string; url: string; license: string; service: string };
  methodology: {
    distance: string;
    walkingMetersPerMinute: number;
    disclaimer: string;
    peakDisclaimer: string;
    locationDisclaimer: string;
    scoreDisclaimer: string;
    defaultProfile: "balanced";
    profiles: Record<Exclude<AmenityProfileKey, "custom">, { label: string; description: string; weights: AmenityWeights }>;
    routing: { provider: string; providerUrl: string; data: string; profileLabels: Record<string, string>; peakDate: string };
  };
  categories: Record<AmenityCategory, { label: string; symbol: string }>;
  pois: AmenityPoi[];
  projects: Record<string, ProjectAmenity>;
};

type ProjectQuality = {
  status: "queued" | "reviewing" | "reviewed";
  statusLabel: string;
  lastReviewedAt: string | null;
  publishedEventCount: number;
  evidenceCount: number;
  defectEventCount: number;
  contractEventCount: number;
  defectReview: { status: string; label: string; categories: string[] };
  searchTerms: string[];
  defectSearchTerms: string[];
  sourceChecks: Array<{
    sourceId: string;
    status: string;
    checkedAt: string | null;
    matchCount: number | null;
    query?: string;
    resultLabel?: string;
    note?: string;
    url?: string;
  }>;
  locationReview: {
    status: "verified" | "approximate" | "awaiting-parcel-check";
    label: string;
    method: string;
    parcel: { sectionName: string; sectionCode: string; parcelNumber: string; parcelCode: string; officialMapUrl: string } | null;
  };
  events: Array<{
    id: string;
    eventType: "defect" | "contract";
    title: string;
    level: "A" | "B" | "C";
    category: string;
    outcome: string;
    publishedAt: string;
    sourceDate: string;
    summary: string;
    limitation: string;
    defectCategory: string | null;
    affectedArea: string | null;
    repairStatus: string | null;
    recurrence: string | null;
    caseCount: number | null;
    casesPer100Households: number | null;
    sources: Array<{ name: string; url: string }>;
  }>;
};

type QualityDataset = {
  generatedAt: string;
  methodology: { publishRule: string; noEventDisclaimer: string; defectPublishRule: string; normalizationDisclaimer: string; defectCategories: string[]; reviewStates: Record<string, string>; evidenceLevels: Record<"A" | "B" | "C", string> };
  sources: Array<{ id: string; name: string; url: string; level: string; access: string }>;
  summary: { projectCount: number; publishedEventCount: number; defectEventCount: number; contractEventCount: number; queuedCount: number; reviewedCount: number; verifiedLocationCount: number; approximateLocationCount: number; awaitingParcelCount: number };
  projects: Record<string, ProjectQuality>;
};

type RawProject = {
  id: string;
  name: string;
  region: "林口" | "A7";
  city: string;
  district: string;
  builder: string;
  households: number;
  zoning: string;
  mainUse: string;
  material: string;
  address: string;
  buildingLand: string;
  declaredDate: string | null;
  permitDate: string | null;
  permitNo: string;
  firstRegistrationDate: string | null;
  registryNumber: string;
  price: PriceSummary | null;
  priceEvidence: PriceEvidence;
  qualityStatus: string;
  amenityStatus: string;
  dataCompleteness: number;
  mapX: number;
  mapY: number;
};

type Project = RawProject & {
  latitude: number;
  longitude: number;
  amenity: ProjectAmenity;
  quality: ProjectQuality;
};

type ViewMode = "map" | "list";
type DetailTab = "summary" | "builder" | "price" | "cost" | "quality" | "amenity";
type SortKey = "newest" | "priceLow" | "priceHigh" | "households" | "quality";
type StageFilter = "all" | "presale" | "completed";
type BudgetFilter = "all" | "under50" | "50to60" | "60plus";
type AmenityFilter = "all" | "score80" | "convenience500" | "pxmart1000" | "station1200";
type QualityFilter = "all" | "defect" | "official-result" | "attention" | "no-event";

type UpdateReport = {
  generatedAt: string;
  status: "ok" | "attention";
  summary: {
    autoAddedCount: number;
    updatedExistingCount: number;
    ambiguousCount: number;
    missingFromCurrentSourceCount: number;
    historicalBacklogCount: number;
  };
};

const amenityData = amenityDataset as unknown as AmenityDataset;
const qualityData = qualityDataset as unknown as QualityDataset;
const updateReport = updateReportDataset as unknown as UpdateReport;
const projects = (dataset.projects as RawProject[]).map((project) => {
  const amenity = amenityData.projects[project.id];
  const quality = qualityData.projects[project.id];
  return {
    ...project,
    amenity,
    quality,
    latitude: amenity.location.latitude,
    longitude: amenity.location.longitude,
    amenityStatus: amenity.score === null ? "待地號定位" : `${amenity.score} 分 · ${amenity.grade}`,
  };
});
const amenityEntries = Object.entries(amenityData.categories) as Array<[AmenityCategory, { label: string; symbol: string }]>;
const priorityAmenityCategories: AmenityCategory[] = ["convenience", "station", "market", "medical"];
const amenityProfileEntries = Object.entries(amenityData.methodology.profiles) as Array<[Exclude<AmenityProfileKey, "custom">, { label: string; description: string; weights: AmenityWeights }]>;
const defaultAmenityWeights = { ...amenityData.methodology.profiles.balanced.weights };

function formatDate(value: string | null) {
  return value ? value.replaceAll("-", ".") : "尚未登錄";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 0 }).format(Math.round(value));
}

function clampNumber(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}

function priceText(project: Project) {
  if (project.price) return `${project.price.median} 萬／坪`;
  return project.priceEvidence.status === "official-no-match" ? "官方尚無成交" : "價格待補";
}

function locationLabel(project: Project) {
  return project.amenity.location.label;
}

function formatDistance(meters: number) {
  return meters < 1000 ? `${meters} 公尺` : `${(meters / 1000).toFixed(1)} 公里`;
}

function amenityScoreFor(project: Project, weights: AmenityWeights) {
  if (project.amenity.score === null) return null;
  const entries = Object.entries(weights) as Array<[AmenityCategory, number]>;
  const totalWeight = entries.reduce((total, [, weight]) => total + weight, 0);
  if (!totalWeight) return 0;
  return Math.round(entries.reduce((total, [category, weight]) => total + project.amenity.categoryScores[category] * weight, 0) / totalWeight);
}

function amenityGrade(score: number | null) {
  if (score === null) return "需先完成定位";
  if (score >= 80) return "非常便利";
  if (score >= 65) return "便利";
  if (score >= 45) return "基本足夠";
  return "機能較少";
}

function amenityScoreText(project: Project, weights: AmenityWeights) {
  const score = amenityScoreFor(project, weights);
  return score === null ? "待定位" : `${score} 分`;
}

function amenityFilterMatches(project: Project, filter: AmenityFilter, weights: AmenityWeights) {
  if (filter === "all") return true;
  const score = amenityScoreFor(project, weights);
  if (score === null) return false;
  if (filter === "score80") return score >= 80;
  if (filter === "convenience500") return (project.amenity.nearest.convenience?.routes.walking?.durationMinutes ?? Infinity) <= 10;
  if (filter === "pxmart1000") return (project.amenity.nearest.pxmart?.routes.walking?.durationMinutes ?? Infinity) <= 20;
  if (filter === "station1200") return (project.amenity.nearest.station?.routes.walking?.durationMinutes ?? Infinity) <= 15;
  return true;
}

function routeTimeText(amenity: NearestAmenity) {
  const parts = [];
  if (amenity.routes.walking) parts.push(`步行 ${amenity.routes.walking.durationMinutes} 分`);
  if (amenity.routes.driving) parts.push(`開車 ${amenity.routes.driving.durationMinutes} 分`);
  if (amenity.routes.peakDriving) parts.push(`平日 8 時 ${amenity.routes.peakDriving.durationMinutes} 分`);
  return parts.length ? parts.join(" · ") : `${formatDistance(amenity.distanceMeters)}直線距離`;
}

function primaryRouteTimeText(category: AmenityCategory, amenity: NearestAmenity) {
  if (category === "costco" && amenity.routes.peakDriving) return `平日 8 時開車 ${amenity.routes.peakDriving.durationMinutes} 分`;
  if (amenity.routes.walking) return `步行 ${amenity.routes.walking.durationMinutes} 分`;
  if (amenity.routes.driving) return `開車 ${amenity.routes.driving.durationMinutes} 分`;
  return formatDistance(amenity.distanceMeters);
}

function defectEvents(project: Project) {
  return project.quality.events.filter((event) => event.eventType === "defect");
}

function contractEvents(project: Project) {
  return project.quality.events.filter((event) => event.eventType === "contract");
}

function hasQualityAttention(project: Project) {
  return project.quality.events.some((event) => event.outcome !== "符合");
}

function qualityFilterMatches(project: Project, filter: QualityFilter) {
  if (filter === "all") return true;
  if (filter === "defect") return project.quality.defectEventCount > 0;
  if (filter === "official-result") return project.quality.events.length > 0;
  if (filter === "attention") return hasQualityAttention(project);
  if (filter === "no-event") return project.quality.status === "reviewed" && project.quality.events.length === 0;
  return true;
}

function qualityRank(project: Project) {
  if (project.quality.defectEventCount > 0) return 4;
  if (hasQualityAttention(project)) return 3;
  if (project.quality.contractEventCount > 0) return 2;
  if (project.quality.status === "reviewed") return 1;
  return 0;
}

function qualityBadgeText(project: Project) {
  if (project.quality.defectEventCount > 0) return `實際瑕疵 ${project.quality.defectEventCount} 件`;
  if (hasQualityAttention(project)) return "契約查核需注意";
  if (project.quality.contractEventCount > 0) return `契約結果 ${project.quality.contractEventCount} 件`;
  return project.quality.status === "reviewed" ? "官方來源已查核" : "品質待查核";
}

function projectStage(project: Project) {
  return project.firstRegistrationDate ? "completed" : "presale";
}

function projectStageText(project: Project) {
  return projectStage(project) === "completed" ? "成屋" : "預售屋";
}

function medianValue(values: number[]) {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : Math.round((ordered[middle - 1] + ordered[middle]) * 5) / 10;
}

function regionMedian(project: Project) {
  return medianValue(projects
    .filter((item) => item.region === project.region && item.price)
    .map((item) => item.price!.median));
}

function priceComparison(project: Project) {
  const benchmark = regionMedian(project);
  if (!project.price || benchmark === null) return "區域比較待補";
  const difference = Math.round(((project.price.median - benchmark) / benchmark) * 100);
  if (Math.abs(difference) <= 2) return `與${project.region}中位數相近`;
  return `比${project.region}中位數${difference > 0 ? "高" : "低"} ${Math.abs(difference)}%`;
}

function dataConfidence(project: Project) {
  const checks = [
    Boolean(project.price && project.priceEvidence.status === "matched"),
    project.quality.status === "reviewed",
    project.quality.locationReview.status === "verified",
    project.amenity.scoreReliability === "verified",
  ];
  const covered = checks.filter(Boolean).length;
  return {
    covered,
    label: covered === 4 ? "資料充足" : covered >= 2 ? "部分資料可核對" : "資料仍有限",
  };
}

function shortQualityText(project: Project) {
  if (project.quality.defectEventCount > 0) return `找到 ${project.quality.defectEventCount} 筆房屋問題`;
  if (hasQualityAttention(project)) return "合約有項目要注意";
  return "目前沒找到明確問題";
}

function contractOutcomeText(event: ProjectQuality["events"][number]) {
  return event.outcome === "符合" ? "沒有發現不合格" : "有項目要注意";
}

function contractPlainTitle(event: ProjectQuality["events"][number]) {
  if (event.outcome === "符合") return "官方抽查合約，沒有發現不合格項目";
  return "官方抽查合約，發現 1 個項目不符合規定";
}

function contractPlainSummary(event: ProjectQuality["events"][number]) {
  if (event.outcome === "符合" && event.summary.includes("15 項")) {
    return "政府抽查了這份預售屋合約的 15 個項目，沒有任何一項被列為不合格。表格中的空白代表符合規定。";
  }
  if (event.outcome === "符合") {
    return "政府曾抽查這份預售屋合約，表格中的檢查項目都被列為符合規定。";
  }
  return "政府抽查時發現，「房地面積誤差與價款找補」這一項不符合規定，簽約前要特別核對這段內容。";
}

function contractPlainLimitation(event: ProjectQuality["events"][number]) {
  if (event.outcome === "符合") {
    return "這只表示合約內容通過當次抽查，不代表房屋施工一定沒問題，也不能證明不會漏水。";
  }
  return "這表示合約有一項需要注意，不代表房屋真的已經發生面積短少、施工問題或漏水。";
}

function budgetMatches(project: Project, budget: BudgetFilter) {
  if (budget === "all") return true;
  if (!project.price) return false;
  if (budget === "under50") return project.price.median < 50;
  if (budget === "50to60") return project.price.median >= 50 && project.price.median < 60;
  return project.price.median >= 60;
}

function streetViewEmbedUrl(project: Project) {
  const latitude = project.latitude.toFixed(6);
  const longitude = project.longitude.toFixed(6);
  return `https://www.google.com/maps/embed?origin=mfe&pb=!6m6!1m5!2m2!1d${latitude}!2d${longitude}!4f-0!5f1`;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("全部");
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");
  const [budgetFilter, setBudgetFilter] = useState<BudgetFilter>("all");
  const [priceOnly, setPriceOnly] = useState(false);
  const [minHouseholds, setMinHouseholds] = useState(0);
  const [amenityFilter, setAmenityFilter] = useState<AmenityFilter>("all");
  const [amenityProfile, setAmenityProfile] = useState<AmenityProfileKey>("balanced");
  const [amenityWeights, setAmenityWeights] = useState<AmenityWeights>(defaultAmenityWeights);
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>("all");
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [selectedId, setSelectedId] = useState(projects[0].id);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>("summary");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [methodOpen, setMethodOpen] = useState(false);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [amenityLayers, setAmenityLayers] = useState<AmenityCategory[]>([]);
  const [mapScopeIds, setMapScopeIds] = useState<string[] | null>(null);
  const [streetViewInteractive, setStreetViewInteractive] = useState(false);
  const [notice, setNotice] = useState("");
  const [costArea, setCostArea] = useState(35);
  const [publicRatio, setPublicRatio] = useState(34);
  const [managementFeePerPing, setManagementFeePerPing] = useState(80);
  const [parkingManagementFee, setParkingManagementFee] = useState(0);
  const [houseTaxableValue, setHouseTaxableValue] = useState(0);
  const [landTaxableValue, setLandTaxableValue] = useState(0);

  const baseFiltered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const result = projects.filter((project) => {
      const matchesQuery =
        !needle ||
        [project.name, project.builder, project.address, project.city, project.region, project.amenity.nearest.station?.name || ""]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      return (
        matchesQuery &&
        (region === "全部" || project.region === region) &&
        (stageFilter === "all" || projectStage(project) === stageFilter) &&
        budgetMatches(project, budgetFilter) &&
        (!priceOnly || Boolean(project.price)) &&
        amenityFilterMatches(project, amenityFilter, amenityWeights) &&
        qualityFilterMatches(project, qualityFilter) &&
        project.households >= minHouseholds
      );
    });

    return [...result].sort((a, b) => {
      if (sortBy === "households") return b.households - a.households;
      if (sortBy === "priceLow") return (a.price?.median ?? Infinity) - (b.price?.median ?? Infinity);
      if (sortBy === "priceHigh") return (b.price?.median ?? -1) - (a.price?.median ?? -1);
      if (sortBy === "quality") return qualityRank(b) - qualityRank(a) || (b.declaredDate || "").localeCompare(a.declaredDate || "");
      return (b.declaredDate || "").localeCompare(a.declaredDate || "");
    });
  }, [amenityFilter, amenityWeights, budgetFilter, minHouseholds, priceOnly, qualityFilter, query, region, sortBy, stageFilter]);

  const filtered = useMemo(() => {
    if (mapScopeIds === null) return baseFiltered;
    const visible = new Set(mapScopeIds);
    return baseFiltered.filter((project) => visible.has(project.id));
  }, [baseFiltered, mapScopeIds]);

  const active = filtered.find((project) => project.id === selectedId) || baseFiltered.find((project) => project.id === selectedId) || filtered[0] || baseFiltered[0] || projects[0];
  const compareProjects = compareIds
    .map((id) => projects.find((project) => project.id === id))
    .filter(Boolean) as Project[];
  const pricedCount = filtered.filter((project) => project.price).length;
  const qualityResultCount = filtered.filter((project) => project.quality.contractEventCount > 0).length;
  const qualityDefectCount = filtered.filter((project) => project.quality.defectEventCount > 0).length;
  const completedCount = filtered.filter((project) => project.firstRegistrationDate).length;
  const presaleCount = filtered.length - completedCount;
  const builderProjects = useMemo(
    () => projects
      .filter((project) => project.builder === active.builder)
      .sort((a, b) => (b.declaredDate || "").localeCompare(a.declaredDate || "")),
    [active.builder],
  );
  const builderCompletedCount = builderProjects.filter((project) => project.firstRegistrationDate).length;
  const builderPricedCount = builderProjects.filter((project) => project.price).length;
  const hasFilters = query || region !== "全部" || stageFilter !== "all" || budgetFilter !== "all" || amenityFilter !== "all" || qualityFilter !== "all" || priceOnly || minHouseholds > 0 || sortBy !== "newest" || mapScopeIds !== null;
  const advancedFilterCount = Number(priceOnly) + Number(minHouseholds > 0) + Number(amenityFilter !== "all") + Number(qualityFilter !== "all") + Number(sortBy !== "newest");
  const activeNearestPois = active.amenity.score === null
    ? []
    : amenityEntries
      .map(([category]) => active.amenity.nearest[category])
      .filter(Boolean) as NearestAmenity[];
  const activeAmenityScore = amenityScoreFor(active, amenityWeights);
  const activeDefectEvents = defectEvents(active);
  const activeContractEvents = contractEvents(active);
  const activePriorityAmenityEntries = amenityEntries.filter(([category]) => priorityAmenityCategories.includes(category));
  const activeMoreAmenityEntries = amenityEntries.filter(([category]) => !priorityAmenityCategories.includes(category));
  const activeQualityAttention = hasQualityAttention(active);
  const activeQualityHeadline = activeDefectEvents.length
    ? `找到 ${activeDefectEvents.length} 筆房屋問題`
    : activeQualityAttention
      ? "合約有項目要注意"
      : "目前沒找到明確的房屋問題";
  const activeConfidence = dataConfidence(active);
  const activeRegionMedian = regionMedian(active);
  const estimatedPrivateArea = Math.round(costArea * (1 - publicRatio / 100) * 10) / 10;
  const estimatedPublicArea = Math.round(costArea * (publicRatio / 100) * 10) / 10;
  const annualManagementFee = Math.round(costArea * managementFeePerPing * 12);
  const annualParkingManagementFee = Math.round(parkingManagementFee * 12);
  const annualHouseTax = Math.round(houseTaxableValue * 0.012);
  const annualLandTax = Math.round(landTaxableValue * 0.002);
  const taxesComplete = houseTaxableValue > 0 && landTaxableValue > 0;
  const annualHoldingCost = annualManagementFee + annualParkingManagementFee + annualHouseTax + annualLandTax;
  const monthlyHoldingCost = Math.round(annualHoldingCost / 12);
  const effectivePrivateUnitPrice = active.price && estimatedPrivateArea > 0
    ? Math.round((active.price.median / (1 - publicRatio / 100)) * 10) / 10
    : null;

  function applyAmenityProfile(profile: Exclude<AmenityProfileKey, "custom">) {
    setAmenityProfile(profile);
    setAmenityWeights({ ...amenityData.methodology.profiles[profile].weights });
  }

  function updateAmenityWeight(category: AmenityCategory, value: number) {
    setAmenityProfile("custom");
    setAmenityWeights((current) => ({ ...current, [category]: value }));
  }

  function selectProject(project: Project, openDetail = false) {
    setSelectedId(project.id);
    setDetailTab("summary");
    setStreetViewInteractive(false);
    if (openDetail) setDetailOpen(true);
  }

  function toggleCompare(id: string) {
    setNotice("");
    setCompareIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 3) {
        setNotice("一次最多比較 3 個建案");
        return current;
      }
      return [...current, id];
    });
  }

  function clearFilters() {
    setQuery("");
    setRegion("全部");
    setStageFilter("all");
    setBudgetFilter("all");
    setPriceOnly(false);
    setMinHouseholds(0);
    setAmenityFilter("all");
    setQualityFilter("all");
    setSortBy("newest");
    setMapScopeIds(null);
  }

  function selectBuilderProject(project: Project) {
    setQuery("");
    setRegion("全部");
    setStageFilter("all");
    setBudgetFilter("all");
    setPriceOnly(false);
    setMinHouseholds(0);
    setAmenityFilter("all");
    setQualityFilter("all");
    setMapScopeIds(null);
    setSelectedId(project.id);
    setDetailTab("builder");
  }

  function toggleAmenityLayer(category: AmenityCategory) {
    setAmenityLayers((current) => current.includes(category)
      ? current.filter((item) => item !== category)
      : [...current, category]);
  }

  return (
    <main className="app-shell">
      <header className="site-header">
        <a className="site-brand" href="#top" aria-label="居鑑首頁">
          <span>居</span>
          <div><strong>居鑑</strong><small>建案履歷資料庫</small></div>
        </a>
        <nav aria-label="主要功能">
          <button className={viewMode === "map" ? "active" : ""} type="button" onClick={() => setViewMode("map")}>建案地圖</button>
          <button className={viewMode === "list" && sortBy !== "quality" && priceOnly ? "active" : ""} type="button" onClick={() => { setViewMode("list"); setPriceOnly(true); setQualityFilter("all"); setSortBy("priceHigh"); }}>成交行情</button>
          <button className={viewMode === "list" && sortBy === "quality" ? "active" : ""} type="button" onClick={() => { setViewMode("list"); setPriceOnly(false); setQualityFilter("all"); setSortBy("quality"); setDetailTab("quality"); }}>品質查核</button>
        </nav>
        <div className="header-tools">
          <span><i />官方資料 {projects.length} 案</span>
          <button type="button" onClick={() => setMethodOpen(true)}>資料說明</button>
        </div>
      </header>

      <section className="filter-bar" id="top" aria-label="搜尋篩選">
        <label className="global-search">
          <span aria-hidden="true">⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋區域、捷運、建案或建商" aria-label="搜尋區域、捷運、建案或建商" />
          {query && <button type="button" onClick={() => setQuery("")} aria-label="清除搜尋">×</button>}
        </label>

        <label className="filter-select"><span>區域</span><select value={region} onChange={(event) => { setRegion(event.target.value); setMapScopeIds(null); }}><option>全部</option><option>林口</option><option>A7</option></select></label>
        <label className="filter-select budget-select"><span>預算</span><select value={budgetFilter} onChange={(event) => setBudgetFilter(event.target.value as BudgetFilter)} aria-label="每坪成交預算"><option value="all">不限</option><option value="under50">50 萬以下</option><option value="50to60">50–60 萬</option><option value="60plus">60 萬以上</option></select></label>
        <label className="filter-select"><span>狀態</span><select value={stageFilter} onChange={(event) => setStageFilter(event.target.value as StageFilter)} aria-label="建案狀態"><option value="all">全部</option><option value="presale">預售屋</option><option value="completed">成屋</option></select></label>
        <div className="advanced-filter-wrap">
          <button type="button" className={`advanced-filter-button ${advancedFilterCount ? "active" : ""}`} aria-expanded={advancedFiltersOpen} onClick={() => setAdvancedFiltersOpen((value) => !value)}>更多條件{advancedFilterCount ? ` ${advancedFilterCount}` : ""} <span>⌄</span></button>
          {advancedFiltersOpen && <section className="advanced-filter-panel" aria-label="進階篩選">
            <header><strong>進階篩選</strong><button type="button" onClick={() => setAdvancedFiltersOpen(false)}>完成</button></header>
            <label><span>生活機能</span><select value={amenityFilter} onChange={(event) => setAmenityFilter(event.target.value as AmenityFilter)}><option value="all">不限</option><option value="score80">目前權重 80 分以上</option><option value="convenience500">超商步行 10 分內</option><option value="pxmart1000">全聯步行 20 分內</option><option value="station1200">車站步行 15 分內</option></select></label>
            <label><span>品質查核</span><select value={qualityFilter} onChange={(event) => setQualityFilter(event.target.value as QualityFilter)}><option value="all">不限</option><option value="defect">有實際瑕疵履歷</option><option value="official-result">有官方查核結果</option><option value="attention">有需注意事項</option><option value="no-event">已查核、無刊登事件</option></select></label>
            <label><span>社區戶數</span><select value={minHouseholds} onChange={(event) => setMinHouseholds(Number(event.target.value))}><option value="0">不限</option><option value="100">100 戶以上</option><option value="300">300 戶以上</option><option value="500">500 戶以上</option></select></label>
            <label><span>排序方式</span><select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortKey)}><option value="newest">最新備查</option><option value="priceLow">單價低到高</option><option value="priceHigh">單價高到低</option><option value="households">戶數多到少</option><option value="quality">品質查核結果</option></select></label>
            <button type="button" className={`price-toggle ${priceOnly ? "active" : ""}`} onClick={() => setPriceOnly((value) => !value)}><span>{priceOnly ? "✓" : ""}</span>只看有成交資料</button>
            {hasFilters && <button type="button" className="panel-clear" onClick={clearFilters}>清除全部條件</button>}
          </section>}
        </div>
        {hasFilters && <button type="button" className="clear-filters" onClick={clearFilters}>清除</button>}

        <div className="view-switch" aria-label="檢視模式">
          <button type="button" className={viewMode === "map" ? "active" : ""} onClick={() => setViewMode("map")}><span aria-hidden="true">⌖</span> 地圖</button>
          <button type="button" className={viewMode === "list" ? "active" : ""} onClick={() => setViewMode("list")}><span aria-hidden="true">☷</span> 列表</button>
        </div>
      </section>

      {viewMode === "map" ? (
        <section className="map-workspace">
          <section className="map-stage" aria-label={`${active.name} 站內地圖`}>
            <InteractiveMap
              projects={baseFiltered.length ? baseFiltered : [active]}
              activeId={active.id}
              onSelect={(id) => {
                const project = projects.find((item) => item.id === id);
                if (project) selectProject(project, true);
              }}
              onSearchArea={(ids) => setMapScopeIds(ids)}
              onClearArea={() => setMapScopeIds(null)}
              onRegionSelect={(nextRegion) => { setRegion(nextRegion); setMapScopeIds(null); }}
              scopeActive={mapScopeIds !== null}
              pois={amenityData.pois}
              visibleAmenityCategories={amenityLayers}
            />
            <details className="map-legend">
              <summary>圖例</summary>
              <div><span title="尚未有首次登記日期"><i className="presale" /> 預售屋 <b>{presaleCount}</b></span><span title="已有首次登記日期"><i className="completed" /> 成屋 <b>{completedCount}</b></span></div>
            </details>
            <details className="amenity-layer-control">
              <summary>生活機能{amenityLayers.length ? ` ${amenityLayers.length}` : ""}</summary>
              <div>{amenityEntries.map(([category, meta]) => <button type="button" key={category} className={amenityLayers.includes(category) ? "active" : ""} onClick={(event) => { event.preventDefault(); toggleAmenityLayer(category); }}><i className={`poi-${category}`}>{meta.symbol}</i>{meta.label}</button>)}</div>
            </details>
            <div className="map-gesture-hint">滾輪縮放 · 拖曳移動</div>
          </section>
        </section>
      ) : (
        <section className="list-workspace">
          <div className="list-heading"><div><p>{sortBy === "quality" ? "QUALITY REVIEW" : "PROJECT LIST"}</p><h1>{sortBy === "quality" ? "品質查核" : "建案列表"}</h1></div><span>共 {filtered.length} 案 · {pricedCount} 案有成交資料</span></div>
          {sortBy === "quality" && <section className="quality-overview"><div><span>完成查核</span><strong>{qualityData.summary.reviewedCount}</strong><small>／{qualityData.summary.projectCount} 案</small></div><div className={qualityDefectCount ? "attention" : ""}><span>實際瑕疵</span><strong>{qualityDefectCount}</strong><small>案</small></div><div><span>契約結果</span><strong>{qualityResultCount}</strong><small>案</small></div><p>先看實際瑕疵，再看契約事項；點進建案才顯示證據與限制。</p></section>}
          {filtered.length === 0 ? (
            <div className="list-empty"><strong>沒有符合的建案</strong><button type="button" onClick={clearFilters}>清除全部條件</button></div>
          ) : (
            <div className="project-grid">
              {filtered.map((project) => (
                <article className="project-grid-card" key={project.id}>
                  <button type="button" className="grid-card-main" onClick={() => { selectProject(project, true); if (sortBy === "quality") setDetailTab("quality"); }}>
                    <div className="project-placeholder"><span>{project.region}</span><strong>{project.price ? `${project.price.median}` : project.priceEvidence.status === "official-no-match" ? "尚無" : "待補"}</strong><small>{project.price ? "萬／坪" : "官方成交"}</small></div>
                    <div className="grid-card-copy"><div><span>{project.city} · {project.district}</span><i className={project.quality.defectEventCount ? "attention" : hasQualityAttention(project) ? "attention" : project.quality.events.length ? "has-result" : "reviewed"}>{qualityBadgeText(project)}</i></div><h2>{project.name}</h2><p>{project.builder}</p><dl><div><dt>戶數</dt><dd>{project.households} 戶</dd></div><div><dt>備查</dt><dd>{formatDate(project.declaredDate)}</dd></div><div><dt>機能</dt><dd>{amenityScoreText(project, amenityWeights)}</dd></div></dl></div>
                  </button>
                  <button type="button" className={`grid-compare ${compareIds.includes(project.id) ? "checked" : ""}`} onClick={() => toggleCompare(project.id)}>{compareIds.includes(project.id) ? "✓ 已加入比較" : "＋ 加入比較"}</button>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {detailOpen && (
        <aside className="detail-drawer" aria-label={`${active.name} 詳細資料`}>
          <header><button type="button" onClick={() => setDetailOpen(false)} aria-label="關閉">×</button><div className="drawer-header-meta"><span>{active.region} · {active.city}{active.district}</span><b className={projectStage(active)}>{projectStageText(active)}</b></div><h2>{active.name}</h2><p>起造人：{active.builder}</p></header>
          <section className={`project-visual ${streetViewInteractive ? "interactive" : ""}`} aria-label={`${active.name} 附近街景`}>
            <iframe
              key={active.id}
              title={`${active.name} 附近 Google Street View`}
              src={streetViewEmbedUrl(active)}
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
            />
            <span className="visual-source">附近實景 · Google Street View</span>
            {!streetViewInteractive && <button type="button" className="visual-activate" onClick={() => setStreetViewInteractive(true)}><strong>查看建案附近實景</strong><small>點擊後可轉動與沿街查看</small></button>}
          </section>
          <p className="project-visual-note">顯示現有定位附近最近可用街景，不一定正對建案入口；預售屋可能是施工前或尚未更新的畫面。</p>
          <div className="drawer-glance"><strong>{priceText(active)}</strong><span>{active.households} 戶</span><span>機能 {amenityScoreText(active, amenityWeights)}</span></div>
          <nav>{(["summary", "builder", "price", "cost", "quality", "amenity"] as DetailTab[]).map((tab) => <button key={tab} type="button" className={detailTab === tab ? "active" : ""} onClick={() => setDetailTab(tab)}>{{ summary: "總覽", builder: "建商", price: "價格", cost: "持有", quality: "品質", amenity: "機能" }[tab]}</button>)}</nav>
          <div className="drawer-content">
            {detailTab === "summary" && (
              <section className="summary-dashboard">
                <div className="summary-heading"><span>第 3 步 · 看結論與證據</span><h3>30 秒掌握這個建案</h3><p>先看結論；需要時再展開來源與計算方式。</p></div>
                <div className="summary-decisions">
                  <button type="button" onClick={() => setDetailTab("price")}>
                    <span>價格合理性</span><strong>{priceText(active)}</strong><small>{priceComparison(active)} · {active.price ? `${active.price.count} 筆官方樣本` : active.priceEvidence.statusLabel}</small><b>看價格依據 →</b>
                  </button>
                  <button type="button" className={activeDefectEvents.length || activeQualityAttention ? "attention" : "clear"} onClick={() => setDetailTab("quality")}>
                    <span>房屋與合約紀錄</span><strong>{activeQualityHeadline}</strong><small>{activeContractEvents.length ? `另有 ${activeContractEvents.length} 筆官方合約抽查` : "官方資料已查過一輪"}</small><b>看清楚查了什麼 →</b>
                  </button>
                  <button type="button" className={activeAmenityScore === null ? "unavailable" : "clear"} onClick={() => setDetailTab("amenity")}>
                    <span>生活機能</span><strong>{activeAmenityScore === null ? "等待定位" : `${activeAmenityScore} 分 · ${amenityGrade(activeAmenityScore)}`}</strong><small>{active.amenity.nearest.station?.routes.walking ? `最近車站步行 ${active.amenity.nearest.station.routes.walking.durationMinutes} 分` : locationLabel(active)}</small><b>看附近設施 →</b>
                  </button>
                  <button type="button" className={activeConfidence.covered >= 3 ? "clear" : "unavailable"} onClick={() => setMethodOpen(true)}>
                    <span>資料可信度</span><strong>{activeConfidence.label}</strong><small>價格、品質、位置與機能共 {activeConfidence.covered}／4 項可核對</small><b>看資料來源 →</b>
                  </button>
                </div>
                <button type="button" className="holding-cost-snapshot" onClick={() => setDetailTab("cost")}><span>自住持有成本</span><strong>買下後，每月還要付多少？</strong><small>房屋稅＋地價稅＋管理費＋車位管理費</small><b>開始試算 →</b></button>
                <button type="button" className="builder-snapshot" onClick={() => setDetailTab("builder")}><span>建商履歷</span><strong>{active.builder}</strong><small>已收錄 {builderProjects.length} 案 · 售後處理資料不足，暫不評分</small><b>查看履歷 →</b></button>
                <p className="summary-caution">沒有瑕疵紀錄不代表沒有問題；成交與路線時間也不是目前開價或即時導航。</p>
                <details className="summary-official-details">
                  <summary>查看官方基本資料</summary>
                  <div className={`stage-evidence ${projectStage(active)}`}><span>{projectStageText(active)}</span><strong>{active.firstRegistrationDate ? `已於 ${formatDate(active.firstRegistrationDate)} 首次登記` : "目前尚未有首次登記日期"}</strong></div>
                  <div className="drawer-facts"><div><span>申報備查</span><strong>{formatDate(active.declaredDate)}</strong></div><div><span>建照日期</span><strong>{formatDate(active.permitDate)}</strong></div><div><span>首次登記</span><strong>{formatDate(active.firstRegistrationDate)}</strong></div><div><span>主要建材</span><strong>{active.material}</strong></div><div><span>主要用途</span><strong>{active.mainUse}</strong></div><div><span>使用分區</span><strong>{active.zoning}</strong></div></div>
                  <div className="drawer-address"><span>坐落街道</span><strong>{active.city}{active.district}{active.address}</strong><span>坐落基地</span><strong>{active.buildingLand}</strong><small>{locationLabel(active)}，非精確基地界址。</small>{active.quality.locationReview.parcel && <a className="parcel-map-link" href={active.quality.locationReview.parcel.officialMapUrl} target="_blank" rel="noreferrer">用國土測繪圖資服務雲核對地號 ↗</a>}</div>
                  <details><summary>建照與官方資料編號</summary><p>{active.permitNo}</p><p>{active.registryNumber}</p></details>
                </details>
              </section>
            )}
            {detailTab === "builder" && <section><h3>建商履歷</h3><div className="builder-profile"><span>本資料庫辨識名稱</span><strong>{active.builder}</strong><p>目前以官方資料中的起造人名稱進行完全相同比對。</p></div><div className="builder-service-status"><span>售後處理</span><strong>資料不足，暫不評分</strong><p>目前沒有足以核對處理速度、修繕結果與是否復發的完整紀錄；不以建案數量推測售後品質。</p></div><div className="builder-stats"><div><span>已收錄</span><strong>{builderProjects.length}</strong><small>個建案</small></div><div><span>成屋</span><strong>{builderCompletedCount}</strong><small>個建案</small></div><div><span>有成交</span><strong>{builderPricedCount}</strong><small>個建案</small></div></div><div className="builder-projects">{builderProjects.map((project) => <button type="button" className={project.id === active.id ? "active" : ""} onClick={() => selectBuilderProject(project)} key={project.id}><span className={projectStage(project)}>{projectStageText(project)}</span><div><strong>{project.name}</strong><small>{project.region} · 備查 {formatDate(project.declaredDate)}</small></div><b>{priceText(project)}</b></button>)}</div><p className="builder-disclaimer">目前僅統計本資料庫已收錄的林口與 A7 建案，不代表該建商的完整作品或品質排名。</p></section>}
            {detailTab === "price" && <section><h3>成交行情</h3>{active.price ? <><div className="drawer-price"><span>中位單價</span><strong>{active.price.median}</strong><small>萬／坪</small><p>{active.price.low}–{active.price.high} 萬／坪</p></div><div className="region-benchmark"><span>{active.region}區域基準</span><strong>{activeRegionMedian ?? "待補"} 萬／坪</strong><b>{priceComparison(active)}</b></div><div className="drawer-facts two"><div><span>有效樣本</span><strong>{active.price.count} 筆</strong></div><div><span>最新交易</span><strong>{formatDate(active.price.latestDate)}</strong></div></div><p className="drawer-note">來源：{active.price.source}。區域基準取本資料庫同區有官方成交建案的中位數；成交價不是目前開價，也不是估價結果。</p></> : <div className="drawer-empty price-unavailable"><span>{active.priceEvidence.statusLabel}</span><strong>{active.priceEvidence.status === "official-no-match" ? "目前沒有可安全歸戶的官方成交" : "成交資料尚待配對"}</strong><p>{active.priceEvidence.status === "official-no-match" ? "已核對官方已發布資料；這不代表建案沒有銷售，近期交易可能尚未申報或公開。" : "目前來源未成功配對，不代表沒有交易。"}</p><small>查核更新 {formatDate(active.priceEvidence.lastCheckedAt)} · {active.priceEvidence.matchMethod}</small><a href={active.priceEvidence.sourceUrl} target="_blank" rel="noreferrer">查看官方資料入口 ↗</a></div>}</section>}
            {detailTab === "cost" && (
              <section className="holding-cost-section">
                <div className="holding-cost-heading"><span>只算自住</span><h3>買下後，每月還要付多少？</h3><p>先填你看的房型與社區費用，就能把固定支出換算成每月金額。</p></div>
                <div className={`holding-cost-total ${taxesComplete ? "complete" : "partial"}`}>
                  <span>{taxesComplete ? "自住固定支出" : "目前算得到的固定支出"}</span>
                  <div><small>平均每月約</small><strong>NT$ {formatCurrency(monthlyHoldingCost)}</strong></div>
                  <p>一年約 NT$ {formatCurrency(annualHoldingCost)}</p>
                  {!taxesComplete && <b>尚未含完整稅金</b>}
                </div>
                <p className="holding-cost-alert">本站沒有每一戶的稅籍資料與社區收費。管理費先用示範值；房屋稅與地價稅要看稅單輸入，才不會拿買價亂算。</p>

                <h4 className="holding-cost-subtitle">1. 填入你的房型與管理費</h4>
                <div className="holding-cost-inputs">
                  <label><span>權狀坪數</span><div><input type="number" min="1" max="300" step="0.1" value={costArea} onChange={(event) => setCostArea(clampNumber(Number(event.target.value), 1, 300))} /><small>坪</small></div></label>
                  <label><span>公設比</span><div><input type="number" min="0" max="60" step="0.1" value={publicRatio} onChange={(event) => setPublicRatio(clampNumber(Number(event.target.value), 0, 60))} /><small>%</small></div></label>
                  <label><span>管理費</span><div><input type="number" min="0" max="1000" step="1" value={managementFeePerPing} onChange={(event) => setManagementFeePerPing(clampNumber(Number(event.target.value), 0, 1000))} /><small>元／坪／月</small></div></label>
                  <label><span>車位管理費</span><div><input type="number" min="0" max="20000" step="100" value={parkingManagementFee} onChange={(event) => setParkingManagementFee(clampNumber(Number(event.target.value), 0, 20000))} /><small>元／月</small></div></label>
                </div>

                <div className="public-ratio-result">
                  <span>公設比換成白話</span>
                  <strong>權狀 {costArea} 坪，公設約 {estimatedPublicArea} 坪</strong>
                  <p>主建物＋附屬建物約 <b>{estimatedPrivateArea} 坪</b>。這不是室內淨坪，陽台等附屬空間仍算在裡面。</p>
                  {effectivePrivateUnitPrice !== null && <small>依本案成交中位數粗估，換算到主建物＋附屬建物約 {effectivePrivateUnitPrice} 萬／坪。</small>}
                </div>

                <h4 className="holding-cost-subtitle">2. 從稅單填入課稅金額</h4>
                <div className="holding-tax-inputs">
                  <label><span>房屋課稅現值</span><input type="number" min="0" step="1000" value={houseTaxableValue || ""} placeholder="看房屋稅單，不是買價" onChange={(event) => setHouseTaxableValue(clampNumber(Number(event.target.value), 0, 1000000000))} /><small>本站用自住 1.2% 保守試算；符合全國單一自住房屋等條件時，可能適用 1.0%。</small></label>
                  <label><span>土地課稅地價持分</span><input type="number" min="0" step="1000" value={landTaxableValue || ""} placeholder="看地價稅單上的持分" onChange={(event) => setLandTaxableValue(clampNumber(Number(event.target.value), 0, 1000000000))} /><small>本站用自用住宅用地 2‰ 試算，實際仍要符合資格並完成申請。</small></label>
                </div>

                <h4 className="holding-cost-subtitle">3. 一年固定支出拆開看</h4>
                <div className="holding-cost-breakdown">
                  <div><span>管理費</span><strong>NT$ {formatCurrency(annualManagementFee)}</strong><small>每年</small></div>
                  <div><span>車位管理費</span><strong>NT$ {formatCurrency(annualParkingManagementFee)}</strong><small>每年</small></div>
                  <div className={houseTaxableValue ? "" : "missing"}><span>房屋稅</span><strong>{houseTaxableValue ? `NT$ ${formatCurrency(annualHouseTax)}` : "待輸入"}</strong><small>每年</small></div>
                  <div className={landTaxableValue ? "" : "missing"}><span>地價稅</span><strong>{landTaxableValue ? `NT$ ${formatCurrency(annualLandTax)}` : "待輸入"}</strong><small>每年</small></div>
                </div>

                <div className="holding-cost-notes"><strong>這裡沒有算進去</strong><p>房貸本息、水電瓦斯、火災地震險、修繕基金與臨時增加的社區費用，因為它們不是每個建案都相同的固定金額。</p></div>
                <div className="holding-cost-sources"><a href="https://www.etax.nat.gov.tw/etwmain/tax-info/understanding/tax-saving-manual/local/house-tax/5qYVKWW" target="_blank" rel="noreferrer">財政部房屋稅說明 ↗</a><a href="https://www.etax.nat.gov.tw/etwmain/tax-info/understanding/tax-saving-secret/3A3RBO0" target="_blank" rel="noreferrer">財政部自用住宅地價稅說明 ↗</a></div>
                <p className="holding-cost-disclaimer">這是自住情境的概算，不是稅額核定；實際金額以稅捐機關稅單、社區規約與管委會公告為準。</p>
              </section>
            )}
            {detailTab === "quality" && (
              <section>
                <h3>房屋問題與合約檢查</h3>
                <div className={`defect-summary ${activeDefectEvents.length ? "attention" : "reviewed"}`}>
                  <div>
                    <span>目前找到的房屋問題</span>
                    <strong>{activeDefectEvents.length ? `${activeDefectEvents.length} 筆` : "目前 0 筆"}</strong>
                    <b>{activeDefectEvents.length ? "有資料可核對" : "目前沒有明確紀錄"}</b>
                  </div>
                  <p>{activeDefectEvents.length
                    ? "這些紀錄可以確認是哪個建案、發生什麼問題。仍要一起看是否修好、後來有沒有再發生。"
                    : "目前查過的官方資料裡，沒有找到能明確對上這個建案的漏水或施工問題。但沒有紀錄，不代表房屋一定沒有問題。"}</p>
                  {active.quality.lastReviewedAt && <small>上次查資料：{formatDate(active.quality.lastReviewedAt)}</small>}
                </div>

                {activeDefectEvents.length > 0 && (
                  <>
                    <h4 className="quality-section-title">實際瑕疵履歷</h4>
                    <div className="quality-events">
                      {activeDefectEvents.map((event) => (
                        <article key={event.id}>
                          <header><span>{event.category}</span><b className={event.outcome === "符合" ? "pass" : "attention"}>{event.outcome}</b><i>證據 {event.level}</i></header>
                          <h5>{event.title}</h5>
                          <p>{event.summary}</p>
                          <dl className="quality-event-facts">
                            {event.defectCategory && <div><dt>問題</dt><dd>{event.defectCategory}</dd></div>}
                            {event.affectedArea && <div><dt>位置</dt><dd>{event.affectedArea}</dd></div>}
                            {event.repairStatus && <div><dt>修繕</dt><dd>{event.repairStatus}</dd></div>}
                            {event.recurrence && <div><dt>復發</dt><dd>{event.recurrence}</dd></div>}
                            {event.caseCount !== null && <div><dt>件數</dt><dd>{event.caseCount} 件</dd></div>}
                            {event.casesPer100Households !== null && <div><dt>每百戶</dt><dd>{event.casesPer100Households} 件</dd></div>}
                          </dl>
                          <aside><strong>判讀限制</strong>{event.limitation}</aside>
                          <footer>
                            <small>資料日期 {formatDate(event.sourceDate)}</small>
                            <div>{event.sources.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>{source.name} ↗</a>)}</div>
                          </footer>
                        </article>
                      ))}
                    </div>
                  </>
                )}

                <details className="quality-contract-details">
                  <summary><span>官方有沒有查到合約問題？</span><b>{activeContractEvents.length} 筆</b></summary>
                  {activeContractEvents.length > 0 ? (
                    <div className="quality-events contract-events">
                      {activeContractEvents.map((event) => (
                        <article key={event.id}>
                          <header><span>官方抽查</span><b className={event.outcome === "符合" ? "pass" : "attention"}>{contractOutcomeText(event)}</b><i>官方資料</i></header>
                          <h5>{contractPlainTitle(event)}</h5>
                          <p>{contractPlainSummary(event)}</p>
                          <aside><strong>這不能代表什麼？</strong>{contractPlainLimitation(event)}</aside>
                          <details className="original-source-copy"><summary>查看政府原本怎麼寫</summary><p>{event.summary}</p><p>{event.limitation}</p></details>
                          <footer><small>查核日期 {formatDate(event.sourceDate)}</small><div>{event.sources.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>查看政府原始資料 ↗</a>)}</div></footer>
                        </article>
                      ))}
                    </div>
                  ) : <p className="quality-empty-note">目前沒有找到能明確對上這個建案的官方合約抽查資料。</p>}
                </details>

                <details className="quality-advanced-details">
                  <summary>我們查了哪些資料？</summary>
                  <h4 className="quality-section-title">已經查過的官方來源</h4>
                  <div className="quality-source-checks">
                    {active.quality.sourceChecks.map((check) => {
                      const source = qualityData.sources.find((item) => item.id === check.sourceId);
                      if (!source) return null;
                      return (
                        <a href={check.url || source.url} target="_blank" rel="noreferrer" key={check.sourceId}>
                          <div>
                            <strong>{source.name}</strong>
                            <small>{check.note || `${source.access} · 證據等級 ${source.level}`}</small>
                          </div>
                          <span className={check.status}>{check.resultLabel || (check.status === "not-reviewed" ? "待查核" : "已查核")}</span>
                        </a>
                      );
                    })}
                  </div>
                  <div className="defect-category-list" aria-label="已查核的瑕疵類型">{active.quality.defectReview.categories.map((category) => <span key={category}>✓ {category}</span>)}</div>
                  <details className="quality-review-details"><summary>實際瑕疵查核關鍵字</summary><div>{active.quality.defectSearchTerms.map((term) => <span key={term}>{term}</span>)}</div></details>
                  <details className="quality-review-details"><summary>契約與行政查核關鍵字</summary><div>{active.quality.searchTerms.map((term) => <span key={term}>{term}</span>)}</div></details>
                  <div className="evidence-levels">{(["A", "B", "C"] as const).map((level) => <article key={level}><b>{level}</b><div><strong>{{ A: "可直接核對", B: "多來源互證", C: "僅供追查" }[level]}</strong><p>{qualityData.methodology.evidenceLevels[level]}</p></div></article>)}</div>
                  <p className="quality-method-note">{qualityData.methodology.defectPublishRule}</p>
                  <p className="quality-method-note">{qualityData.methodology.publishRule}</p>
                  <p className="quality-method-note">{qualityData.methodology.normalizationDisclaimer}</p>
                </details>
              </section>
            )}
            {detailTab === "amenity" && (
              <section>
                <h3>生活機能</h3>
                {active.amenity.score === null ? (
                  <div className="amenity-unavailable"><span>等待地號核對</span><strong>暫不顯示精確機能分數</strong><p>{amenityData.methodology.scoreDisclaimer}</p><dl><div><dt>官方坐落街道</dt><dd>{active.city}{active.district}{active.address}</dd></div><div><dt>官方坐落基地</dt><dd>{active.buildingLand}</dd></div></dl>{active.quality.locationReview.parcel && <a href={active.quality.locationReview.parcel.officialMapUrl} target="_blank" rel="noreferrer">用國土測繪圖資服務雲核對地號 ↗</a>}</div>
                ) : (
                  <>
                    <div className="amenity-score-card"><div className="amenity-score-ring" style={{ "--amenity-score": `${activeAmenityScore ?? 0}%` } as CSSProperties}><strong>{activeAmenityScore}</strong><span>分</span></div><div><span>{active.amenity.scoreReliability === "verified" ? "可信定位評估" : "道路位置估算"}</span><strong>{amenityGrade(activeAmenityScore)}</strong><p>{locationLabel(active)} · 資料更新 {formatDate(amenityData.generatedAt)}</p></div></div>
                    <div className="amenity-profile-block">
                      <span>依你的生活方式評分</span>
                      <div className="amenity-profiles">
                        {amenityProfileEntries.map(([profile, config]) => <button type="button" aria-pressed={amenityProfile === profile} className={amenityProfile === profile ? "active" : ""} onClick={() => applyAmenityProfile(profile)} key={profile}>{config.label}</button>)}
                      </div>
                      <p>{amenityProfile === "custom" ? "目前使用你調整後的自訂權重。" : amenityData.methodology.profiles[amenityProfile].description}</p>
                    </div>
                    <details className="amenity-weight-editor">
                      <summary>調整各項權重</summary>
                      <div>{amenityEntries.map(([category, meta]) => <label key={category}><span>{meta.label}</span><input type="range" min="0" max="30" step="1" value={amenityWeights[category]} onChange={(event) => updateAmenityWeight(category, Number(event.target.value))} /><strong>{amenityWeights[category]}</strong></label>)}</div>
                    </details>
                    <h4 className="amenity-section-title">最常用的附近設施</h4>
                    <div className="drawer-amenities amenity-priority">{activePriorityAmenityEntries.map(([category, meta]) => { const nearest = active.amenity.nearest[category]; return <div key={category}><i className={`poi-${category}`}>{meta.symbol}</i><span>{meta.label}</span>{nearest ? <><strong>{nearest.name}</strong><p>{primaryRouteTimeText(category, nearest)}</p></> : <><strong>附近資料不足</strong><p>不計入分數</p></>}</div>; })}</div>
                    <details className="amenity-more-details">
                      <summary>查看其餘 {activeMoreAmenityEntries.length} 類設施</summary>
                      <div className="drawer-amenities">{activeMoreAmenityEntries.map(([category, meta]) => { const nearest = active.amenity.nearest[category]; return <div key={category}><i className={`poi-${category}`}>{meta.symbol}</i><span>{meta.label}</span>{nearest ? <><strong>{nearest.name}</strong><p>{routeTimeText(nearest)}</p></> : <><strong>附近資料不足</strong><p>不計入分數</p></>}</div>; })}</div>
                    </details>
                    <details className="amenity-advanced-details">
                      <summary>查看設施地圖與計算方式</summary>
                      <div className="drawer-map"><InteractiveMap projects={[active]} activeId={active.id} compact pois={activeNearestPois} visibleAmenityCategories={amenityEntries.map(([category]) => category)} /></div>
                      <small className="drawer-map-note">地圖標記為各類最近設施；時間依道路網預先估算，不是即時導航。{amenityData.methodology.locationDisclaimer}</small>
                      <div className="amenity-route-method"><strong>路線時間怎麼算</strong><p>{amenityData.methodology.disclaimer}</p><p>{amenityData.methodology.peakDisclaimer}</p><a href={amenityData.methodology.routing.providerUrl} target="_blank" rel="noreferrer">查看 {amenityData.methodology.routing.provider} 路線矩陣說明 ↗</a></div>
                    </details>
                  </>
                )}
                <a className="amenity-source-link" href={amenityData.source.url} target="_blank" rel="noreferrer">{amenityData.source.name} · {amenityData.source.license} ↗</a>
              </section>
            )}
          </div>
        </aside>
      )}

      {compareIds.length > 0 && <div className="compare-bar"><div>{compareProjects.map((project) => <button type="button" key={project.id} onClick={() => toggleCompare(project.id)}>{project.name}<span>×</span></button>)}</div><small>{compareIds.length}／3</small><button type="button" onClick={() => setCompareOpen(true)}>比較建案</button>{notice && <em>{notice}</em>}</div>}

      {compareOpen && (
        <div className="modal-layer" role="presentation" onMouseDown={() => setCompareOpen(false)}>
          <section className="compare-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setCompareOpen(false)}>×</button>
            <div className="compare-heading"><span>把取捨放在同一張表</span><h2>建案比較</h2><p>{compareProjects.length < 2 ? "再選一個建案，就能看出差異。" : "價格、品質、生活與資料可信度分開比較，不用看模糊總分。"}</p></div>
            <div className="table-scroll"><table><thead><tr><th>項目</th>{compareProjects.map((p) => <th key={p.id}>{p.name}<small>{p.region} · {projectStageText(p)}</small></th>)}</tr></thead><tbody>
              <tr><th>官方中位單價</th>{compareProjects.map((p) => <td key={p.id}><strong>{priceText(p)}</strong><small>{p.price ? `${p.price.count} 筆樣本` : p.priceEvidence.statusLabel}</small></td>)}</tr>
              <tr><th>區域價格比較</th>{compareProjects.map((p) => <td key={p.id}>{priceComparison(p)}</td>)}</tr>
              <tr><th>品質紀錄</th>{compareProjects.map((p) => <td key={p.id}>{shortQualityText(p)}<small>{p.quality.contractEventCount ? `另有 ${p.quality.contractEventCount} 件契約查核` : "官方來源已完成首輪查核"}</small></td>)}</tr>
              <tr><th>生活機能</th>{compareProjects.map((p) => { const score = amenityScoreFor(p, amenityWeights); return <td key={p.id}><strong>{amenityScoreText(p, amenityWeights)}</strong><small>{amenityGrade(score)}{p.amenity.nearest.station?.routes.walking ? ` · 車站步行 ${p.amenity.nearest.station.routes.walking.durationMinutes} 分` : ""}</small></td>; })}</tr>
              <tr><th>建商履歷</th>{compareProjects.map((p) => <td key={p.id}>{p.builder}<small>售後處理資料不足，暫不評分</small></td>)}</tr>
              <tr><th>資料可信度</th>{compareProjects.map((p) => { const confidence = dataConfidence(p); return <td key={p.id}><strong>{confidence.label}</strong><small>{confidence.covered}／4 項可核對</small></td>; })}</tr>
              <tr><th>基本資料</th>{compareProjects.map((p) => <td key={p.id}>{p.households} 戶<small>備查 {formatDate(p.declaredDate)}</small></td>)}</tr>
            </tbody></table></div>
          </section>
        </div>
      )}

      {methodOpen && <div className="modal-layer" role="presentation" onMouseDown={() => setMethodOpen(false)}><section className="method-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" type="button" onClick={() => setMethodOpen(false)}>×</button><h2>資料怎麼看？</h2><div><article><span>官方</span><strong>建案基本身分</strong><p>起造人、戶數、基地、建照與申報日期。</p></article><article><span className="coral">成交</span><strong>歷史季度＋本期實價樣本</strong><p>顯示筆數、區間與中位數；排除解約並去除重複，不代表目前開價。</p></article><article><span>機能</span><strong>十類設施＋道路路線時間</strong><p>以 OpenStreetMap 道路網估算步行、開車及平日 08:00 時間，並可依生活方式調整權重；不是即時導航。</p></article><article><span className="gray">品質</span><strong>實際瑕疵與契約查核分開</strong><p>只有能確認建案、問題與發生事實的證據才列入瑕疵履歷；契約違規不會被當成漏水證據。</p></article><article><span>維護</span><strong>安全更新已啟用</strong><p>更新於 {formatDate(updateReport.generatedAt)}。新案會自動加入；既有案不自動刪除，歧義資料不覆蓋。目前另保留 {updateReport.summary.historicalBacklogCount} 案歷史候選。</p></article></div><footer>{dataset.sources.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>{source.name} ↗</a>)}<a href={amenityData.source.url} target="_blank" rel="noreferrer">OpenStreetMap ↗</a><a href={amenityData.methodology.routing.providerUrl} target="_blank" rel="noreferrer">Valhalla 路線矩陣 ↗</a><a href="https://judgment.judicial.gov.tw/readme.aspx?ot=in" target="_blank" rel="noreferrer">司法院裁判查詢 ↗</a></footer></section></div>}
    </main>
  );
}
