# KRISHNA MURTHY CHANDAKA
**AI Engineering Lead | Multi-Agent Systems | LangGraph · MCP · RAG**

📱 09730252456 | ✉️ krishna.chandaka@gmail.com | 📍 Hyderabad, India
🔗 linkedin.com/in/krishnamurthy-chandaka | 💻 github.com/kmnaidu

---

## SUMMARY

AI Engineering Leader with 21 years architecting production systems. Currently building multi-agent platforms using LangGraph, RAG pipelines, and Model Context Protocol (MCP) — with two production systems shipping today: an AI-Powered Test Automation Framework at Entain (10-engineer team, 80% faster test design) and a personal AI Stock Analyzer (14 features, 12,400+ LOC, 50+ days uptime at ₹0 infrastructure cost). Fluent across the modern AI stack — Google Gemini, OpenAI, Anthropic Claude, Upstash Vector, Redis. Strong track record in engineering leadership across product companies (Entain, Scientific Games, Motorola, Tata Elxsi).

---

## AI ENGINEERING SKILLS

**Multi-Agent & Orchestration:**
LangGraph (StateGraph, Conditional Routing) · Multi-Agent Systems · ReAct Agents (Tool-Calling) · Agent Orchestration · Synthesis Agents · AI Workflows

**LLM & RAG:**
RAG (Retrieval-Augmented Generation) · Prompt Engineering · LLM Tool Calling · Vector Embeddings (768-dim) · Semantic Search · SSE Streaming · Context Management

**LLM Models & APIs:**
Google Gemini (2.5 Flash, 2.0 Flash, Flash-Lite) · OpenAI GPT-4 · Anthropic Claude 3.5 · Gemini Embedding API · Multi-Model Fallback Strategies

**MCP & Tool Integration:**
Model Context Protocol (MCP) · MCP Server Development (Python, Node.js) · MCP Client Integration · Tool Definition · Cross-System AI Bridges

**AI Infrastructure:**
Upstash Redis · Upstash Vector DB · Multi-Key API Rotation · Rate Limit Resilience · Hybrid Caching · AI Observability · LLM Cost Optimization · Graceful Degradation

**Full-Stack:**
TypeScript · Node.js · Express · React · Python · REST APIs · Server-Sent Events · Microservices · Vercel · Render

**Engineering Leadership:**
Team Management · Technical Mentoring · Engineering Strategy · Stakeholder Management · AI Adoption Roadmap


---

## FEATURED PROJECT

### AI Stock Portfolio Analyzer (Production)
**Live:** stock-portfolio-analyzer-ten.vercel.app | **GitHub:** github.com/kmnaidu/stock-portfolio-dashboard

**Production AI system I use daily for investment decisions — 50+ days uptime, <50ms cached responses, 99%+ reliability.** Demonstrates end-to-end AI engineering: data ingestion → embeddings → multi-agent orchestration → user-facing responses.

Full-stack AI analysis platform — 14 features, $0/month infrastructure:

| Feature | AI Pattern |
|---------|-----------|
| 5-Agent Deep Analysis | Multi-Agent orchestration with Synthesis layer |
| LangGraph Decision Agent | Conditional StateGraph routing (7 nodes) |
| ReAct Chat Agent | LLM tool-calling, 4 tools, 5 reasoning rounds |
| RAG Pipeline | Yahoo Finance + Google RSS + Redis → Gemini |
| Vector Similarity Search | Gemini Embeddings (768-dim) + Upstash Vector |
| MCP Server (5 tools) | Live Indian market data for any AI IDE |
| Daily WhatsApp Briefing | Autonomous agent: launchd → Gemini → Twilio |
| Hybrid Cache | In-memory (30s) + Redis (1-day TTL), 95% hit rate |
| AI Observability | Every LLM call tracked — model, timing, success |
| Multi-Key Resilience | 4 keys × 3 models = 12 fallback attempts |
| SSE Streaming | Word-by-word real-time AI responses |

**Tech Stack:** React · TypeScript · Node.js · LangGraph · Google Gemini · Upstash Redis · Upstash Vector · Twilio · Vercel · Render

**Production Metrics:** 12,400+ LOC · 50ms cached response · 95% LLM success rate · 32 stocks tracked

---

## SYSTEMS DESIGNED & ARCHITECTED

| System | Architecture Highlights |
|--------|------------------------|
| **Multi-Agent Stock Analysis** | 5 specialist agents (Analyst, Technical, Risk, News, Synthesis) with sequential orchestration + 2s delays for rate limit resilience |
| **AI Test Automation Framework** | 6 specialist agents (Ticket Analyst, Test Designer, Frontend/API Experts, Code Reviewer, Quality Gate) with MCP integration across Jira/GitLab/TestRail/Xray |
| **LangGraph Decision Agent** | Conditional StateGraph (7 nodes) — short-circuits to AVOID on structural problems, saving 2 LLM calls per decision |
| **RAG Pipeline** | Hybrid cache (in-memory 30s + Redis 7-day TTL), 95% hit rate, sub-50ms cached responses |
| **MCP Server (5 tools)** | Reusable across AI IDEs (Kiro, Cursor, Claude Desktop) — get_stock_price, get_nifty_levels, get_index_futures, get_commodity_futures, get_market_pulse |
| **AI Observability Layer** | Tracks every LLM call across all agents — model, key, timing, success rate, token estimates |
| **Multi-Key LLM Resilience** | 4 API keys × 3 models = 12 fallback attempts, achieved 95% success rate on free tier |

---

## EXPERIENCE

### Tech Lead
**Entain India (formerly Ivy Comptech) — Ladbrokes, Coral Sportsbook**
Sep 2019 – Present | Hyderabad | 6 yrs 10 mos

**AI Engineering & Innovation (2024–Present):**
- Architected an AI-Powered Test Automation Framework integrating multi-agent orchestration, MCP servers, AI steering files, and event-driven hooks
- Built MCP integrations for Jira Cloud, GitLab API, TestRail, Xray, and a custom Project Bridge — enabling AI to search code across repos, automate test case design, and manage workflows end-to-end
- Designed specialist AI agents: Ticket Analyst, Test Designer, Frontend Expert, API Expert, Code Reviewer, Quality Gate — orchestrated in phased workflows with conditional routing
- Implemented AI Steering Files encoding team standards and conventions, loaded conditionally based on context
- Configured event-driven AI Hooks for quality gates, automated linting, Gherkin validation, and post-task test execution
- Driving company-wide AI adoption strategy and engineer enablement

**Impact Metrics:**
- Test case design: 2-3 hours → 15-30 min (80% faster, ~40 hours/week saved across team)
- Code generation: 4-6 hours → 30-60 min (75% faster, enabled 2x faster feature delivery)
- PR review cycle: 1-2 days → same-day (50% faster, reduced developer context switching)
- Cross-repo search: 30+ min → <30 sec (98% faster, accelerated debugging)
- SDET onboarding: 2-4 weeks → 3-5 days (75% faster, reduced ramp-up cost by ~₹3 lakh per new hire)
- Regression coverage: 80% automated, enabling weekly release cycles vs monthly

**Team Leadership & Platform Automation (2019–Present):**
- Currently leading 10 engineers (managed teams up to 20) automating Ladbrokes and Coral sportsbook platforms
- 80% regression suite automation; architected frameworks using Java, Playwright, Selenium, Cypress, Cucumber, Karate DSL
- Established CI/CD pipelines with Jenkins, BrowserStack, LambdaTest, TestRail

---

### Lead Engineer
**Scientific Games Pvt Ltd (WMS)** | Aug 2012 – Aug 2019 | Pune | 7 yrs 1 mo

- Led test engineering for RGS casino games platform with regulatory compliance
- Built automation using Selenium WebDriver, TestNG, JMeter performance testing
- Automated COAT back office platform end-to-end
- Managed cross-functional QA teams across multiple release cycles

---

### Test Lead
**AgreeYa Mobility** | Nov 2011 – Aug 2012 | Pune | 10 mos

- Led BDD test automation using Cucumber + Selenium Ruby
- Managed team of 4 engineers

---

### Senior Software Engineer (Automation Test Lead)
**Motorola Mobility** | Apr 2010 – Nov 2011 | Hyderabad | 1 yr 8 mos

- Built Invader+ web automation framework with Selenium
- Automated 40%+ of browser compliance test suite

---

### Earlier Roles (2005 – 2010)

- **Azingo Inc.** (Senior QA Engineer) — JavaScript test development for mobile web widgets
- **Mascon Global / Motorola Client** (Senior Software Engineer) — Bluetooth connectivity testing
- **Tata Elxsi Ltd** (Test Engineer) — Bluetooth interoperability and stress testing across device portfolio


---

## EDUCATION

**MCA (Master of Computer Applications)** — Andhra University | 2001 – 2004
**B.Sc Computer Science** — Andhra University | 1998 – 2001

---

## AI CERTIFICATIONS & LEARNING

- Generative AI: Working with Large Language Models (LinkedIn Learning, 2025)
- LangGraph & Multi-Agent Systems (production implementation)
- Model Context Protocol (MCP) — server development and enterprise integration
- RAG Architecture & Vector Embeddings (production implementation)

---

## LANGUAGES

English (Fluent — Business/Technical) · Telugu (Native) · Hindi (Conversational)

---

## PUBLICATIONS & THOUGHT LEADERSHIP

- "How I Built an AI Stock Portfolio Analyzer Using RAG, Multi-Agents, LangGraph, Vector DB, and Redis" — LinkedIn & Medium
- "AI-Powered Test Automation Framework" — Enterprise document driving AI adoption
- 5 published technical articles on AI Engineering patterns (3,800+ total impressions, 80+ reactions)
- Open-source: github.com/kmnaidu/stock-portfolio-dashboard
- MCP server published — reusable across AI IDEs (Kiro, Cursor, Claude Desktop)
