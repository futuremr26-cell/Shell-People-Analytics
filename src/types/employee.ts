export type TabId = 'overview' | 'deep-dive' | 'insights';

export interface Employee {
  employeeId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  gender: string;
  age: number;
  maritalStatus: string;
  department: string;
  jobTitle: string;
  jobLevel: number;
  employmentType: string;
  location: string;
  hireDate: string;
  hireYear: number | null;
  yearsAtCompany: number;
  yearsInCurrentRole: number;
  yearsSinceLastPromotion: number;
  yearsWithCurrManager: number;
  education: string;
  distanceFromHomeKm: number;
  businessTravel: string;
  monthlyIncomeGbp: number;
  attrition: 'Yes' | 'No';
}

export interface RiskFactorHit {
  ruleId: string;
  label: string;
  points: number;
  maxPoints: number;
  reason: string;
}

export interface ScoredEmployee extends Employee {
  flightRiskScore: number;
  riskTier: 'High' | 'Moderate' | 'Low';
  riskBreakdown: RiskFactorHit[];
  levelMedianIncome: number;
}

export interface FilterState {
  department: string;
  location: string;
  employmentType: string;
  gender: string;
  attrition: 'All' | 'No' | 'Yes';
}

export interface DataSourceMeta {
  sourceType: 'google-sheets' | 'csv-upload';
  sourceLabel: string;
  lastSyncedAt: Date;
  rowCount: number;
}

export interface InsightFinding {
  id: string;
  category: string;
  headline: string;
  detail: string;
  metricValue: string;
  severity: 'critical' | 'warning' | 'positive' | 'neutral';
}

export interface RecommendedAction {
  id: string;
  priority: 'Immediate' | 'Near-Term' | 'Monitor';
  title: string;
  targetCohort: string;
  rationale: string;
  expectedImpact: string;
}
