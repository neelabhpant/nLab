"""Retail article summarisation — direct LLM call with structured JSON output."""

import asyncio
import json
import logging

from cachetools import TTLCache
from litellm import completion as litellm_completion

from app.models.retail import Article, UseCaseSpark, update_article
from app.services.llm import get_user_settings

logger = logging.getLogger(__name__)

_summary_cache: TTLCache[str, dict] = TTLCache(maxsize=200, ttl=1800)

_NO_TEMPERATURE_MODELS = {"gpt-5", "gpt-5-mini", "gpt-5-nano", "gpt-5.2"}

def get_retail_llm_settings() -> dict:
    """Return LLM settings for Retail space using global user settings."""
    settings = get_user_settings()
    provider = settings["provider"]
    if provider == "anthropic":
        return {
            "provider": "anthropic",
            "model": settings["anthropic_model"],
            "api_key": settings["anthropic_api_key"],
        }
    if provider == "groq":
        return {
            "provider": "groq",
            "model": settings["groq_model"],
            "api_key": settings["groq_api_key"],
        }
    return {
        "provider": "openai",
        "model": settings["openai_model"],
        "api_key": settings["openai_api_key"],
    }


def _retail_litellm_model(settings: dict) -> str:
    provider = settings["provider"]
    model = settings["model"]
    if provider == "openai":
        return f"openai/{model}"
    if provider == "groq":
        return f"groq/{model}" if not model.startswith("groq/") else model
    return f"{provider}/{model}"


SUMMARIZE_SYSTEM_PROMPT = """You are a senior retail industry strategist advising a Director of Global AI Industry Solutions at Cloudera. Your job is to read retail industry articles and produce strategic intelligence that can be used in customer conversations with Fortune 500 retail executives.

You produce two outputs: an article summary and use case sparks.

## ARTICLE SUMMARY REQUIREMENTS

1. Write a 3-sentence summary that captures the strategic insight, not just what happened. Focus on WHY this matters for enterprise data and AI adoption in retail.
2. Provide 3-5 key takeaways as concise bullet points.
3. Assign topic tags from this controlled vocabulary ONLY (pick 2-4 most relevant):
   supply-chain, inventory-management, demand-forecasting,
   personalization, customer-360, loyalty, customer-engagement,
   workforce-optimization, store-operations, associate-enablement,
   pricing-optimization, promotion, markdown,
   shrink-prevention, loss-prevention, fraud-detection,
   agentic-commerce, conversational-AI, AI-agents,
   real-time-analytics, streaming-data, edge-computing,
   data-governance, compliance, data-sovereignty,
   omnichannel, unified-commerce, last-mile,
   product-innovation, private-label, CPG,
   sustainability, ESG, circular-economy,
   tariffs, trade, macro-economics,
   mergers-acquisitions, bankruptcy, restructuring
4. Assign a relevance score using the rubric below.

## RELEVANCE SCORING RUBRIC

- 0.90-1.0: Article directly describes a data/AI infrastructure problem that Cloudera solves in production. Mentions real-time data, multi-agent AI, hybrid deployment, or data governance challenges explicitly.
- 0.80-0.89: Article reveals a clear enterprise data challenge (siloed systems, latency issues, scale barriers) where Cloudera has architectural advantages.
- 0.70-0.79: Article discusses retail AI/technology adoption with implied data platform needs, but doesn't describe specific infrastructure challenges.
- 0.60-0.69: General retail business news with tangential data/AI relevance.
- 0.50-0.59: Retail news with no meaningful data/AI angle (exec appointments, pure financial results, store openings).
- Below 0.50: Not relevant. Score accordingly.

## USE CASE SPARK REQUIREMENTS

Generate a use case spark ONLY if the article describes a problem where Cloudera's platform has a genuine technical advantage. If the article is purely about financial results, executive appointments, or topics with no data/AI angle, set use_case_sparks to an empty array [].

CLOUDERA PLATFORM CAPABILITIES (reference these specifically):
- NiFi: Real-time data ingestion from any source (POS, IoT, APIs, clickstream, sensor data, supplier feeds)
- Kafka: Event streaming and real-time message processing
- Spark: Large-scale batch and stream processing, ML model training
- Iceberg: Open table format for lakehouse architecture, time-travel queries, schema evolution
- CML (Cloudera Machine Learning): Model training, experiments, MLOps, model registry, Jupyter notebooks
- Agent Studio: Multi-agent AI orchestration, agentic workflows, tool-equipped AI agents working together
- RAG Studio: Enterprise knowledge retrieval, document Q&A, knowledge base management
- AI Inference Service: Production model serving with NVIDIA NIM integration, GPU-optimized inference
- Data Warehouse (Impala/Hive): SQL analytics at scale
- SDX: Security, governance, data lineage, fine-grained access control
- CDP Private Cloud: On-premises and hybrid deployment, air-gapped environments, data sovereignty compliance
- Data Visualization: Dashboards, reporting, business intelligence

CLOUDERA COMPETITIVE DIFFERENTIATORS (use these in sparks):
- Hybrid/on-prem deployment: Retailers with data sovereignty requirements, edge deployment needs, or regulatory constraints cannot use cloud-only platforms like Databricks or Snowflake
- Real-time streaming: NiFi + Kafka pipeline is production-proven at retail scale. Snowflake cannot do real-time streaming natively.
- Unified platform: Single platform from data ingestion to AI agents, vs. competitors requiring 5-10 stitched-together point solutions
- Open standards: No vendor lock-in (Iceberg, Spark, Kubernetes). Databricks pushes proprietary Delta Lake.
- Governance at scale: SDX provides lineage, access control, and audit that Databricks Unity Catalog cannot match in on-prem environments
- Edge-to-cloud: Same platform runs at store edge, regional data center, and public cloud. No other vendor offers this.

Each spark MUST include ALL of these fields:

**title**: Specific and action-oriented.
BAD: "Enhancing Customer Engagement through AI" (vague, generic)
BAD: "Data-Driven Retail Optimization" (could be any vendor)
GOOD: "Real-time Store Associate Knowledge Agent" (specific)
GOOD: "Multi-Agent Shrink Detection Pipeline" (action-oriented)

**retail_problem**: The specific DATA or SYSTEMS challenge.
It must describe: what data is siloed, what systems cannot communicate, what latency requirement is unmet, what governance gap exists, or what scale barrier blocks the solution.
BAD: "Retailers need to improve customer engagement" (business goal)
BAD: "Companies want better analytics" (too vague)
GOOD: "In-store POS transaction data and digital app behavior sit in separate systems with no real-time unification, making it impossible to personalize in-store experiences based on online browsing history. Current batch ETL processes create 24-48 hour delays that make recommendations stale." (specific data problem)

**description**: 2-3 sentences explaining the use case with a concrete data architecture. Must reference at least 3 specific Cloudera components by name and explain what each does in the flow.

**cloudera_capabilities**: List of specific Cloudera components with their role in this use case. Format: ["NiFi: ingest POS streams", "Kafka: real-time event processing", "CML: recommendation model"]

**architecture_flow**: A single-line data pipeline showing how data moves through the system:
"POS + App clickstream → NiFi → Kafka → Spark/Iceberg unified profile → CML recommendation model → AI Inference Service → Agent Studio orchestration → Store associate mobile app"

**competitive_advantage**: One concrete sentence on why Cloudera wins this over Databricks, Snowflake, or cloud-native solutions.
BAD: "Cloudera is better for this use case" (no substance)
GOOD: "Snowflake cannot process real-time POS streams with sub-second latency, and Databricks has no edge deployment capability for in-store inference, making Cloudera the only platform that can run this entire pipeline from store edge to cloud." (specific, defensible)

**confidence**: Score using this rubric:
- 0.90-1.0: Article describes a problem Cloudera has solved in production for a retail customer. Maps directly to Agent Studio, RAG Studio, or real-time streaming use case.
- 0.80-0.89: Clear data/AI architecture need where Cloudera has a strong technical advantage (hybrid, real-time, governance).
- 0.70-0.79: Solid retail AI opportunity but competitors could also address it. Cloudera angle exists but is not unique.
- 0.60-0.69: Tangential connection to data platforms.
- Below 0.60: Do NOT generate a spark. Return empty array.

## QUALITY GATE — CHECK BEFORE RETURNING EACH SPARK

1. Could this spark appear unchanged on Databricks' or Snowflake's website? If yes → revise to add Cloudera-specific angle or drop it.
2. Does the retail_problem mention a specific data or systems challenge (silos, latency, scale, governance)? If it only states a business goal → revise to identify the underlying data problem.
3. Does the description reference at least 3 specific Cloudera components with their roles? If not → add them.
4. Is the competitive_advantage concrete and defensible? Does it name a specific competitor limitation? If not → revise.
5. Is the architecture_flow a real data pipeline with named components? If it's just "data → AI → insights" → revise.

If a spark fails any of these checks, either fix it or remove it. Fewer high-quality sparks are better than many generic ones.

Respond ONLY in valid JSON. No preamble, no markdown code fences, no explanation outside the JSON structure."""

SUMMARIZE_USER_TEMPLATE = """ARTICLE TITLE: {title}
SOURCE: {source_id}
CONTENT:
{content}

Return ONLY valid JSON with this exact structure:
{{
  "summary": "3 strategic sentences",
  "key_takeaways": ["takeaway 1", "takeaway 2", "takeaway 3"],
  "tags": ["tag-from-controlled-vocabulary"],
  "relevance_score": 0.75,
  "use_case_sparks": [
    {{
      "title": "Specific Action-Oriented Title",
      "description": "2-3 sentences with data architecture and 3+ Cloudera components",
      "cloudera_capabilities": ["NiFi: role", "Kafka: role", "CML: role"],
      "retail_problem": "Specific data/systems challenge description",
      "architecture_flow": "Source → NiFi → Kafka → Spark/Iceberg → CML → Output",
      "competitive_advantage": "Why Cloudera wins over Databricks/Snowflake (specific)",
      "confidence": 0.82
    }}
  ]
}}"""


def _summarize_sync(article: Article) -> dict:
    content = article.raw_content or article.title
    if not content or len(content.strip()) < 20:
        return {
            "summary": article.title,
            "key_takeaways": [],
            "tags": [],
            "relevance_score": 0.3,
            "use_case_sparks": [],
        }

    user_prompt = SUMMARIZE_USER_TEMPLATE.format(
        title=article.title,
        source_id=article.source_id,
        content=content[:4000],
    )

    settings = get_retail_llm_settings()
    model_string = _retail_litellm_model(settings)
    model_name = settings["model"]

    kwargs: dict = {
        "model": model_string,
        "messages": [
            {"role": "system", "content": SUMMARIZE_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "api_key": settings["api_key"],
        "max_completion_tokens": 1500,
    }
    if model_name not in _NO_TEMPERATURE_MODELS:
        kwargs["temperature"] = 0.2

    response = litellm_completion(**kwargs)
    raw = response.choices[0].message.content.strip()

    start = raw.find("{")
    end = raw.rfind("}") + 1
    if start < 0 or end <= start:
        return {
            "summary": raw[:300],
            "key_takeaways": [],
            "tags": [],
            "relevance_score": 0.3,
            "use_case_sparks": [],
        }

    return json.loads(raw[start:end])


async def summarize_article(article: Article) -> Article:
    if article.id in _summary_cache:
        cached = _summary_cache[article.id]
        article.summary = cached.get("summary")
        article.key_takeaways = cached.get("key_takeaways", [])
        article.tags = cached.get("tags", [])
        article.relevance_score = cached.get("relevance_score")
        article.use_case_sparks = [
            UseCaseSpark(**s) for s in cached.get("use_case_sparks", [])
        ]
        return article

    try:
        result = await asyncio.to_thread(_summarize_sync, article)
        _summary_cache[article.id] = result

        article.summary = result.get("summary")
        article.key_takeaways = result.get("key_takeaways", [])
        article.tags = result.get("tags", [])
        article.relevance_score = result.get("relevance_score")
        article.use_case_sparks = [
            UseCaseSpark(**s) for s in result.get("use_case_sparks", [])
        ]

        update_article(article.id, {
            "summary": article.summary,
            "key_takeaways": article.key_takeaways,
            "tags": article.tags,
            "relevance_score": article.relevance_score,
            "use_case_sparks": [s.model_dump() for s in article.use_case_sparks],
        })
    except Exception as e:
        logger.warning("Summarization failed for %s: %s", article.id, e)

    return article


async def batch_summarize(articles: list[Article], max_concurrent: int = 3) -> list[Article]:
    sem = asyncio.Semaphore(max_concurrent)

    async def _with_sem(article: Article) -> Article:
        async with sem:
            return await summarize_article(article)

    results = await asyncio.gather(
        *[_with_sem(a) for a in articles],
        return_exceptions=True,
    )
    return [r for r in results if isinstance(r, Article)]
