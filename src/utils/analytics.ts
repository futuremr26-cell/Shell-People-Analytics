import {
  Employee,
  FilterState,
  InsightFinding,
  RecommendedAction,
  RiskFactorHit,
  ScoredEmployee,
} from '../types/employee';

export const SHEET_ID = '1qCLCSSBvNfqsWvNJzuuGrXkDDKH4rDgvMnKGkuBo5cI';
export const SHEET_GID = '1862049255';
export const GOOGLE_SHEET_GVIZ_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${SHEET_GID}`;
export const GOOGLE_SHEET_EDIT_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?gid=${SHEET_GID}#gid=${SHEET_GID}`;

export const HIGH_RISK_THRESHOLD = 55;
export const MODERATE_RISK_THRESHOLD = 35;

export interface ScoringRuleSpec {
  id: string;
  name: string;
  maxPoints: number;
  criteria: string;
}

export const FLIGHT_RISK_RULES: ScoringRuleSpec[] = [
  {
    id: 'employment-type',
    name: 'Contractual Flexibility',
    maxPoints: 25,
    criteria: 'Part-Time (+25 pts) or Contract (+20 pts) vs Full-Time (0 pts)',
  },
  {
    id: 'pay-gap',
    name: 'Pay vs Level Peer Median',
    maxPoints: 20,
    criteria: '>15% below Job Level median (+20 pts), 5–15% below (+12 pts), within 5% (+4 pts)',
  },
  {
    id: 'promotion-lag',
    name: 'Promotion Stagnation',
    maxPoints: 20,
    criteria: '5+ yrs since promotion (+20 pts), 3–4 yrs (+12 pts), 1–2 yrs (+5 pts)',
  },
  {
    id: 'tenure-role-window',
    name: 'Mobility Window',
    maxPoints: 15,
    criteria: '<3 yrs tenure (+15 pts), 3–6 yrs tenure (+10 pts), or 5+ yrs in same role (+8 pts)',
  },
  {
    id: 'travel-commute',
    name: 'Travel & Commute Strain',
    maxPoints: 10,
    criteria: 'Frequent travel (+6 pts) and/or 30+ km commute (+4 pts)',
  },
  {
    id: 'level-manager',
    name: 'Level & Manager Exposure',
    maxPoints: 10,
    criteria: 'Entry Level 1 (+10 pts) or Exec Level 5 (+6 pts), or ≤1 yr with current manager (+6 pts, capped at 10)',
  },
];

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function computeLevelMedians(employees: Employee[]): Map<number, number> {
  const byLevel = new Map<number, number[]>();
  for (const emp of employees) {
    const arr = byLevel.get(emp.jobLevel) ?? [];
    arr.push(emp.monthlyIncomeGbp);
    byLevel.set(emp.jobLevel, arr);
  }
  const medians = new Map<number, number>();
  for (const [level, incomes] of byLevel.entries()) {
    medians.set(level, median(incomes));
  }
  return medians;
}

export function scoreEmployees(employees: Employee[]): ScoredEmployee[] {
  const levelMedians = computeLevelMedians(employees);

  return employees.map((emp) => {
    const breakdown: RiskFactorHit[] = [];
    const peerMedian = levelMedians.get(emp.jobLevel) ?? emp.monthlyIncomeGbp;

    // 1. Contractual Flexibility (max 25)
    let empTypePts = 0;
    let empTypeReason = 'Full-Time permanent contract';
    if (emp.employmentType === 'Part-Time') {
      empTypePts = 25;
      empTypeReason = 'Part-Time employment (historically elevated turnover)';
    } else if (emp.employmentType === 'Contract') {
      empTypePts = 20;
      empTypeReason = 'Fixed-term / Contract engagement';
    }
    breakdown.push({
      ruleId: 'employment-type',
      label: 'Contractual Flexibility',
      points: empTypePts,
      maxPoints: 25,
      reason: empTypeReason,
    });

    // 2. Pay vs Level Peer Median (max 20)
    const payGapRatio = peerMedian > 0 ? (peerMedian - emp.monthlyIncomeGbp) / peerMedian : 0;
    let payPts = 0;
    let payReason = `At or above L${emp.jobLevel} median (£${Math.round(peerMedian).toLocaleString()})`;
    if (payGapRatio > 0.15) {
      payPts = 20;
      payReason = `${(payGapRatio * 100).toFixed(0)}% below L${emp.jobLevel} median (£${Math.round(peerMedian).toLocaleString()})`;
    } else if (payGapRatio > 0.05) {
      payPts = 12;
      payReason = `${(payGapRatio * 100).toFixed(0)}% below L${emp.jobLevel} median (£${Math.round(peerMedian).toLocaleString()})`;
    } else if (payGapRatio > 0) {
      payPts = 4;
      payReason = `Slightly below L${emp.jobLevel} median (£${Math.round(peerMedian).toLocaleString()})`;
    }
    breakdown.push({
      ruleId: 'pay-gap',
      label: 'Pay vs Level Peer Median',
      points: payPts,
      maxPoints: 20,
      reason: payReason,
    });

    // 3. Promotion Stagnation (max 20)
    let promoPts = 0;
    let promoReason = 'Promoted within past year';
    if (emp.yearsSinceLastPromotion >= 5) {
      promoPts = 20;
      promoReason = `${emp.yearsSinceLastPromotion} yrs since last promotion`;
    } else if (emp.yearsSinceLastPromotion >= 3) {
      promoPts = 12;
      promoReason = `${emp.yearsSinceLastPromotion} yrs since last promotion`;
    } else if (emp.yearsSinceLastPromotion >= 1) {
      promoPts = 5;
      promoReason = `${emp.yearsSinceLastPromotion} yr(s) since last promotion`;
    }
    breakdown.push({
      ruleId: 'promotion-lag',
      label: 'Promotion Stagnation',
      points: promoPts,
      maxPoints: 20,
      reason: promoReason,
    });

    // 4. Mobility Window (max 15)
    let tenurePts = 0;
    let tenureReason = 'Established tenure & active role progression';
    if (emp.yearsAtCompany < 3) {
      tenurePts = 15;
      tenureReason = `Early tenure (${emp.yearsAtCompany} yrs at Shell)`;
    } else if (emp.yearsAtCompany <= 6) {
      tenurePts = 10;
      tenureReason = `Mid-tenure inflection (${emp.yearsAtCompany} yrs at Shell)`;
    } else if (emp.yearsInCurrentRole >= 5) {
      tenurePts = 8;
      tenureReason = `${emp.yearsInCurrentRole} yrs in current role`;
    }
    breakdown.push({
      ruleId: 'tenure-role-window',
      label: 'Mobility Window',
      points: tenurePts,
      maxPoints: 15,
      reason: tenureReason,
    });

    // 5. Travel & Commute Strain (max 10)
    let travelPts = 0;
    const travelParts: string[] = [];
    if (emp.businessTravel === 'Travel_Frequently') {
      travelPts += 6;
      travelParts.push('Frequent travel');
    }
    if (emp.distanceFromHomeKm >= 30) {
      travelPts += 4;
      travelParts.push(`${emp.distanceFromHomeKm} km commute`);
    }
    breakdown.push({
      ruleId: 'travel-commute',
      label: 'Travel & Commute Strain',
      points: travelPts,
      maxPoints: 10,
      reason: travelParts.length > 0 ? travelParts.join(' · ') : 'Manageable commute & travel load',
    });

    // 6. Level & Manager Exposure (max 10)
    let levelMgrPts = 0;
    const levelMgrParts: string[] = [];
    if (emp.jobLevel === 1) {
      levelMgrPts += 10;
      levelMgrParts.push('Entry Level 1');
    } else if (emp.jobLevel === 5) {
      levelMgrPts += 6;
      levelMgrParts.push('Senior Level 5');
    }
    if (emp.yearsWithCurrManager <= 1) {
      levelMgrPts += 6;
      levelMgrParts.push(`${emp.yearsWithCurrManager} yr with manager`);
    }
    levelMgrPts = Math.min(10, levelMgrPts);
    breakdown.push({
      ruleId: 'level-manager',
      label: 'Level & Manager Exposure',
      points: levelMgrPts,
      maxPoints: 10,
      reason: levelMgrParts.length > 0 ? levelMgrParts.join(' · ') : `Level ${emp.jobLevel}, stable manager tenure`,
    });

    const flightRiskScore = breakdown.reduce((sum, f) => sum + f.points, 0);
    const riskTier: 'High' | 'Moderate' | 'Low' =
      flightRiskScore >= HIGH_RISK_THRESHOLD
        ? 'High'
        : flightRiskScore >= MODERATE_RISK_THRESHOLD
        ? 'Moderate'
        : 'Low';

    return {
      ...emp,
      flightRiskScore,
      riskTier,
      riskBreakdown: breakdown,
      levelMedianIncome: peerMedian,
    };
  });
}

export function applyFilters(employees: ScoredEmployee[], filters: FilterState): ScoredEmployee[] {
  return employees.filter((emp) => {
    if (filters.department !== 'All' && emp.department !== filters.department) return false;
    if (filters.location !== 'All' && emp.location !== filters.location) return false;
    if (filters.employmentType !== 'All' && emp.employmentType !== filters.employmentType) return false;
    if (filters.gender !== 'All' && emp.gender !== filters.gender) return false;
    if (filters.attrition !== 'All' && emp.attrition !== filters.attrition) return false;
    return true;
  });
}

export function formatGBP(amount: number): string {
  return `£${Math.round(amount).toLocaleString('en-GB')}`;
}

export function formatCompactGBP(amount: number): string {
  if (amount >= 1_000_000) {
    return `£${(amount / 1_000_000).toFixed(2)}M`;
  }
  if (amount >= 1_000) {
    return `£${(amount / 1_000).toFixed(1)}k`;
  }
  return formatGBP(amount);
}

export function formatTravelLabel(travel: string): string {
  if (travel === 'Travel_Frequently') return 'Frequent Travel';
  if (travel === 'Travel_Rarely') return 'Rare Travel';
  if (travel === 'Non-Travel') return 'Non-Travel';
  return travel.replace(/_/g, ' ');
}

export interface GroupStats {
  label: string;
  total: number;
  active: number;
  left: number;
  attritionRate: number;
  avgIncome: number;
}

export function groupByCategory(
  employees: ScoredEmployee[],
  accessor: (e: ScoredEmployee) => string,
  order?: string[]
): GroupStats[] {
  const map = new Map<string, { total: number; active: number; left: number; incomeSum: number }>();

  if (order) {
    for (const key of order) {
      map.set(key, { total: 0, active: 0, left: 0, incomeSum: 0 });
    }
  }

  for (const e of employees) {
    const key = accessor(e);
    const curr = map.get(key) ?? { total: 0, active: 0, left: 0, incomeSum: 0 };
    curr.total += 1;
    if (e.attrition === 'Yes') curr.left += 1;
    else curr.active += 1;
    curr.incomeSum += e.monthlyIncomeGbp;
    map.set(key, curr);
  }

  const list: GroupStats[] = Array.from(map.entries()).map(([label, v]) => ({
    label,
    total: v.total,
    active: v.active,
    left: v.left,
    attritionRate: v.total > 0 ? (v.left / v.total) * 100 : 0,
    avgIncome: v.total > 0 ? v.incomeSum / v.total : 0,
  }));

  if (!order) {
    list.sort((a, b) => b.total - a.total);
  }
  return list;
}

export function groupByAgeBand(employees: ScoredEmployee[]): GroupStats[] {
  const bands = ['<25', '25–34', '35–44', '45–54', '55+'];
  return groupByCategory(
    employees,
    (e) => {
      if (e.age < 25) return '<25';
      if (e.age <= 34) return '25–34';
      if (e.age <= 44) return '35–44';
      if (e.age <= 54) return '45–54';
      return '55+';
    },
    bands
  );
}

export function groupByTenureBand(employees: ScoredEmployee[]): GroupStats[] {
  const bands = ['<2 yrs', '2–5 yrs', '6–10 yrs', '11–15 yrs', '16+ yrs'];
  return groupByCategory(
    employees,
    (e) => {
      if (e.yearsAtCompany < 2) return '<2 yrs';
      if (e.yearsAtCompany <= 5) return '2–5 yrs';
      if (e.yearsAtCompany <= 10) return '6–10 yrs';
      if (e.yearsAtCompany <= 15) return '11–15 yrs';
      return '16+ yrs';
    },
    bands
  );
}

export function generateInsights(filtered: ScoredEmployee[]): InsightFinding[] {
  if (filtered.length === 0) {
    return [];
  }

  const findings: InsightFinding[] = [];
  const total = filtered.length;
  const leavers = filtered.filter((e) => e.attrition === 'Yes');
  const active = filtered.filter((e) => e.attrition === 'No');
  const overallAttrition = (leavers.length / total) * 100;

  // 1. Overall attrition & payroll snapshot
  const activePayroll = active.reduce((s, e) => s + e.monthlyIncomeGbp, 0);
  const leaverPayroll = leavers.reduce((s, e) => s + e.monthlyIncomeGbp, 0);
  findings.push({
    id: 'workforce-attrition',
    category: 'Workforce Stability',
    headline:
      overallAttrition >= 20
        ? `Elevated attrition rate at ${overallAttrition.toFixed(1)}% across filtered cohort`
        : overallAttrition === 0
        ? 'Zero attrition recorded in the selected segment'
        : `Workforce attrition stands at ${overallAttrition.toFixed(1)}% (${leavers.length} of ${total})`,
    detail:
      leavers.length > 0
        ? `Departures represent ${formatGBP(leaverPayroll)}/mo in exited payroll compared to ${formatGBP(activePayroll)}/mo active run-rate.`
        : `All ${active.length} employees in this filtered slice remain active, representing ${formatGBP(activePayroll)}/mo in active payroll.`,
    metricValue: `${overallAttrition.toFixed(1)}%`,
    severity: overallAttrition >= 22 ? 'critical' : overallAttrition >= 15 ? 'warning' : 'positive',
  });

  // 2. Employment type vulnerability
  const byType = groupByCategory(filtered, (e) => e.employmentType).filter((g) => g.total >= 2);
  if (byType.length >= 2) {
    const highestType = [...byType].sort((a, b) => b.attritionRate - a.attritionRate)[0];
    const fullTime = byType.find((t) => t.label === 'Full-Time');
    if (highestType.attritionRate > 0) {
      const comparison =
        fullTime && highestType.label !== 'Full-Time'
          ? ` vs ${fullTime.attritionRate.toFixed(1)}% for Full-Time staff`
          : '';
      findings.push({
        id: 'employment-type-gap',
        category: 'Contract Exposure',
        headline: `${highestType.label} staff exhibit the highest turnover at ${highestType.attritionRate.toFixed(1)}%`,
        detail: `${highestType.left} of ${highestType.total} ${highestType.label} employees departed${comparison}.`,
        metricValue: `${highestType.attritionRate.toFixed(1)}%`,
        severity: highestType.attritionRate >= 30 ? 'critical' : highestType.attritionRate >= 18 ? 'warning' : 'neutral',
      });
    }
  }

  // 3. Department hotspot
  const byDept = groupByCategory(filtered, (e) => e.department).filter((d) => d.total >= 3);
  if (byDept.length >= 2) {
    const sortedDepts = [...byDept].sort((a, b) => b.attritionRate - a.attritionRate);
    const worstDept = sortedDepts[0];
    const bestDept = sortedDepts[sortedDepts.length - 1];
    findings.push({
      id: 'department-hotspot',
      category: 'Business Unit Variance',
      headline: `${worstDept.label} leads departmental attrition (${worstDept.attritionRate.toFixed(1)}%)`,
      detail: `Compared with ${bestDept.label} at ${bestDept.attritionRate.toFixed(1)}%, ${worstDept.label} shows a ${(worstDept.attritionRate - bestDept.attritionRate).toFixed(1)} pp turnover spread across ${worstDept.total} staff.`,
      metricValue: `${worstDept.left}/${worstDept.total} left`,
      severity: worstDept.attritionRate >= 25 ? 'critical' : worstDept.attritionRate >= 18 ? 'warning' : 'neutral',
    });
  }

  // 4. Location hotspot
  const byLoc = groupByCategory(filtered, (e) => e.location).filter((l) => l.total >= 3);
  if (byLoc.length >= 2) {
    const sortedLocs = [...byLoc].sort((a, b) => b.attritionRate - a.attritionRate);
    const topLoc = sortedLocs[0];
    const lowLoc = sortedLocs[sortedLocs.length - 1];
    findings.push({
      id: 'location-variance',
      category: 'UK Site Footprint',
      headline: `${topLoc.label} records highest site turnover at ${topLoc.attritionRate.toFixed(1)}%`,
      detail: `${lowLoc.label} is the most stable hub in this view at ${lowLoc.attritionRate.toFixed(1)}% attrition (${lowLoc.active} active).`,
      metricValue: topLoc.label,
      severity: topLoc.attritionRate >= 24 ? 'warning' : 'neutral',
    });
  }

  // 5. Pay & Compensation disparity
  if (leavers.length > 0 && active.length > 0) {
    const avgActivePay = mean(active.map((e) => e.monthlyIncomeGbp));
    const avgLeaverPay = mean(leavers.map((e) => e.monthlyIncomeGbp));
    const payDiffPct = ((avgActivePay - avgLeaverPay) / avgActivePay) * 100;
    findings.push({
      id: 'compensation-spread',
      category: 'Compensation Signal',
      headline:
        payDiffPct > 3
          ? `Departed employees earned ${payDiffPct.toFixed(1)}% less per month on average`
          : payDiffPct < -3
          ? `Departed employees earned ${Math.abs(payDiffPct).toFixed(1)}% more than retained peers`
          : 'Monthly pay is broadly balanced between active staff and leavers',
      detail: `Active employees average ${formatGBP(avgActivePay)}/mo vs ${formatGBP(avgLeaverPay)}/mo for leavers.`,
      metricValue: formatGBP(avgActivePay - avgLeaverPay),
      severity: payDiffPct > 5 ? 'warning' : 'neutral',
    });
  }

  // 6. Active Flight-Risk concentration
  const highRiskActive = active.filter((e) => e.flightRiskScore >= HIGH_RISK_THRESHOLD);
  const promoStalledActive = active.filter((e) => e.yearsSinceLastPromotion >= 4);
  findings.push({
    id: 'flight-risk-concentration',
    category: 'Forward Retention Risk',
    headline: `${highRiskActive.length} active employee${highRiskActive.length === 1 ? '' : 's'} score ${HIGH_RISK_THRESHOLD}+ on Flight Risk`,
    detail: `${promoStalledActive.length} active staff have gone 4+ years without a promotion; average active tenure is ${active.length > 0 ? mean(active.map((e) => e.yearsAtCompany)).toFixed(1) : '0.0'} yrs.`,
    metricValue: `${highRiskActive.length} high risk`,
    severity: highRiskActive.length >= 10 ? 'critical' : highRiskActive.length >= 4 ? 'warning' : 'positive',
  });

  return findings;
}

export function getWatchlist(filtered: ScoredEmployee[], limit = 10): {
  employees: ScoredEmployee[];
  mode: 'active' | 'leavers-validation';
} {
  const activePool = filtered.filter((e) => e.attrition === 'No');
  if (activePool.length > 0) {
    return {
      employees: [...activePool]
        .sort((a, b) => b.flightRiskScore - a.flightRiskScore || a.monthlyIncomeGbp - b.monthlyIncomeGbp)
        .slice(0, limit),
      mode: 'active',
    };
  }
  return {
    employees: [...filtered]
      .sort((a, b) => b.flightRiskScore - a.flightRiskScore || a.monthlyIncomeGbp - b.monthlyIncomeGbp)
      .slice(0, limit),
    mode: 'leavers-validation',
  };
}

export function generateRecommendations(filtered: ScoredEmployee[]): RecommendedAction[] {
  if (filtered.length === 0) return [];

  const actions: RecommendedAction[] = [];
  const active = filtered.filter((e) => e.attrition === 'No');
  const pool = active.length > 0 ? active : filtered;

  // 1. High flight-risk & under-median pay cohort
  const underpaidHighRisk = pool.filter(
    (e) => e.flightRiskScore >= HIGH_RISK_THRESHOLD && e.monthlyIncomeGbp < e.levelMedianIncome * 0.92
  );
  if (underpaidHighRisk.length > 0) {
    const topDepts = [...new Set(underpaidHighRisk.map((e) => e.department))].slice(0, 2).join(', ');
    actions.push({
      id: 'comp-calibration',
      priority: 'Immediate',
      title: 'Targeted Compensation Calibration for High-Risk Outliers',
      targetCohort: `${underpaidHighRisk.length} high-risk staff paid >8% below level median (${topDepts})`,
      rationale:
        'Employees combining below-median pay with secondary stressors (contract status or promotion lag) carry the steepest near-term exit probability.',
      expectedImpact: 'Closes structural pay gaps before annual review cycle',
    });
  }

  // 2. Part-Time & Contract retention
  const nonFullTime = filtered.filter((e) => e.employmentType !== 'Full-Time');
  const nonFtAttrition =
    nonFullTime.length > 0
      ? (nonFullTime.filter((e) => e.attrition === 'Yes').length / nonFullTime.length) * 100
      : 0;
  const activeNonFt = active.filter((e) => e.employmentType !== 'Full-Time').length;
  if (nonFullTime.length >= 2 && (nonFtAttrition >= 20 || activeNonFt >= 3)) {
    actions.push({
      id: 'flexible-contract-pathway',
      priority: 'Immediate',
      title: 'Convert Critical Part-Time & Contract Talent to Permanent Tracks',
      targetCohort: `${activeNonFt} active non-full-time staff (${nonFtAttrition.toFixed(1)}% historical attrition)`,
      rationale:
        'Non-full-time categories show markedly elevated turnover compared to Full-Time peers in the filtered dataset.',
      expectedImpact: 'Stabilizes institutional knowledge and reduces contractor backfill cost',
    });
  }

  // 3. Promotion lag intervention
  const stalled = pool.filter((e) => e.yearsSinceLastPromotion >= 4);
  if (stalled.length > 0) {
    actions.push({
      id: 'career-progression-sprint',
      priority: 'Near-Term',
      title: 'Run Structured Career Progression & Lateral Mobility Reviews',
      targetCohort: `${stalled.length} employees with 4+ years since last promotion`,
      rationale:
        'Extended time without grade progression erodes retention across mid-career engineering and operational specialists.',
      expectedImpact: 'Unlocks internal job moves and reduces mid-tenure attrition',
    });
  }

  // 4. Entry-level onboarding & Level 1 support
  const level1 = filtered.filter((e) => e.jobLevel === 1);
  const level1Attrition =
    level1.length > 0 ? (level1.filter((e) => e.attrition === 'Yes').length / level1.length) * 100 : 0;
  if (level1.length >= 3 && level1Attrition >= 20) {
    actions.push({
      id: 'level1-mentorship',
      priority: 'Near-Term',
      title: 'Strengthen Level 1 Onboarding & First-Year Manager Check-Ins',
      targetCohort: `Level 1 cohort (${level1Attrition.toFixed(1)}% attrition across ${level1.length} staff)`,
      rationale:
        'Entry-grade roles experience disproportionate early exits when manager tenure or progression clarity is limited.',
      expectedImpact: 'Lifts 24-month retention in early-career pipelines',
    });
  }

  // 5. Fallback / Site-specific monitoring
  const byLoc = groupByCategory(filtered, (e) => e.location).filter((l) => l.total >= 3);
  if (byLoc.length > 0) {
    const worstLoc = [...byLoc].sort((a, b) => b.attritionRate - a.attritionRate)[0];
    if (worstLoc.attritionRate >= 18 || actions.length < 3) {
      actions.push({
        id: 'site-pulse-review',
        priority: worstLoc.attritionRate >= 22 ? 'Near-Term' : 'Monitor',
        title: `Conduct Site-Level Stay Interviews at ${worstLoc.label}`,
        targetCohort: `${worstLoc.label} hub (${worstLoc.active} active · ${worstLoc.attritionRate.toFixed(1)}% attrition)`,
        rationale:
          'Localised commute, shift structure, and business-unit pressures vary materially across UK operating sites.',
        expectedImpact: 'Surfaces site-specific friction before resignation notices',
      });
    }
  }

  return actions.slice(0, 4);
}
