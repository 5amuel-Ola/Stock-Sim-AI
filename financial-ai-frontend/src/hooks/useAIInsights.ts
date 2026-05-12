// Hooks for the three OpenAI agent endpoints.
// Long dedup interval (5 min) prevents hammering the AI APIs on every focus.

import useSWR from 'swr'
import { aiApi } from '../lib/aiApi'
import type { RiskAnalysis, TrendAnalysis, InvestmentSuggestions } from '../lib/types'

const AI_OPTIONS = {
  revalidateOnFocus: false,
  dedupingInterval: 5 * 60 * 1000, // 5 minutes
}

export function useRiskAnalysis() {
  return useSWR<RiskAnalysis>('risk-analysis', aiApi.getRiskAnalysis, AI_OPTIONS)
}

export function useTrendAnalysis() {
  return useSWR<TrendAnalysis>('trend-analysis', aiApi.getTrendAnalysis, AI_OPTIONS)
}

export function useInvestmentSuggestions() {
  return useSWR<InvestmentSuggestions>('suggestions', aiApi.getInvestmentSuggestions, AI_OPTIONS)
}
