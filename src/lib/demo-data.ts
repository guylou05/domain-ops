import { analyzeDomains, generateDomainIdeas, type DomainAnalysis } from './domain-engine';
export async function getDemoOpportunities(): Promise<DomainAnalysis[]> { const ideas = generateDomainIdeas({ concept:'automation', industry:'SaaS', keywords:['workflow','agent','revenue'], location:'Austin', tlds:['.com','.ai','.io'], count:30, maxLength:18 }); return analyzeDomains(ideas, 'SaaS'); }
