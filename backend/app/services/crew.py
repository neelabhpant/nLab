import logging
from enum import Enum

from crewai import Agent, Crew, Process, Task

from app.services.llm import get_llm
from app.services.tools import (
    CompareAssetsTool,
    GetCurrentPriceTool,
    GetHistoricalDataTool,
    GetNewsTool,
    GetSentimentTool,
)

logger = logging.getLogger(__name__)


class QueryType(str, Enum):
    PRICE = "price"
    NEWS = "news"
    ANALYSIS = "analysis"
    ADVICE = "advice"


def _classify_query(query: str) -> QueryType:
    """Classify user query to determine which agents to involve."""
    q = query.lower()

    advice_signals = [
        "should i", "recommend", "advice", "advise", "suggest",
        "worth buying", "good investment", "what do you think",
        "portfolio", "strategy", "hold or sell", "buy or sell",
    ]
    if any(signal in q for signal in advice_signals):
        return QueryType.ADVICE

    news_signals = [
        "news", "headline", "brief", "latest", "happening",
        "update", "event", "announce", "sentiment",
    ]
    if any(signal in q for signal in news_signals):
        return QueryType.NEWS

    analysis_signals = [
        "compare", "correlation", "vs", "versus", "relative",
        "outperform", "underperform", "diverge", "trend",
        "normalize", "overlay", "analysis", "sentiment",
        "mood", "feeling", "outlook", "bullish", "bearish",
    ]
    if any(signal in q for signal in analysis_signals):
        return QueryType.ANALYSIS

    return QueryType.PRICE


def build_crew(user_query: str) -> Crew:
    """Build a CrewAI crew tailored to the user's query."""
    llm = get_llm()
    query_type = _classify_query(user_query)

    price_tool = GetCurrentPriceTool()
    historical_tool = GetHistoricalDataTool()
    compare_tool = CompareAssetsTool()
    news_tool = GetNewsTool()
    sentiment_tool = GetSentimentTool()

    market_agent = Agent(
        role="Crypto Market Data Specialist",
        goal="Retrieve and present accurate real-time and historical crypto market data",
        backstory=(
            "You are a seasoned crypto market data specialist with deep expertise "
            "in cryptocurrency markets. You excel at fetching precise pricing data, "
            "tracking market movements, and presenting market statistics clearly. "
            "You always provide exact numbers with proper formatting."
        ),
        tools=[price_tool, historical_tool, news_tool],
        llm=llm,
        verbose=False,
    )

    analysis_agent = Agent(
        role="Quantitative Crypto Analyst",
        goal="Analyze price trends, correlations, and comparative performance across crypto assets",
        backstory=(
            "You are a quantitative analyst specializing in cryptocurrency markets. "
            "You use normalized price comparisons, Pearson correlation analysis, and "
            "trend identification to provide rigorous data-driven insights. You always "
            "back your analysis with specific numbers and statistical measures."
        ),
        tools=[compare_tool, historical_tool, price_tool, sentiment_tool],
        llm=llm,
        verbose=False,
    )

    advisor_agent = Agent(
        role="Personal Financial Advisor",
        goal="Translate data and analysis into clear, practical financial guidance",
        backstory=(
            "You are an experienced financial advisor who synthesizes market data "
            "and quantitative analysis into actionable insights. You provide balanced, "
            "thoughtful advice that considers risk, diversification, and the user's "
            "perspective. You always include appropriate disclaimers about crypto "
            "volatility and the importance of doing one's own research."
        ),
        tools=[],
        llm=llm,
        verbose=False,
    )

    tasks: list[Task] = []

    if query_type == QueryType.PRICE:
        tasks.append(Task(
            description=(
                f"Answer the following user question about cryptocurrency prices: {user_query}\n\n"
                "Use your tools to fetch the latest market data. Present the information "
                "clearly with exact prices, percentage changes, and market caps where relevant. "
                "Format large numbers with commas for readability."
            ),
            expected_output="A clear, data-rich response with current crypto market data.",
            agent=market_agent,
        ))

    elif query_type == QueryType.NEWS:
        tasks.append(Task(
            description=(
                f"Answer the following user question about crypto news: {user_query}\n\n"
                "Use the get_news tool to fetch recent articles. Also fetch current prices "
                "for context.\n\n"
                "YOUR RESPONSE MUST follow this EXACT format:\n"
                "1. Start with 1-2 sentences of market overview in plain text (include current "
                "prices and 24h changes inline, e.g. 'BTC at $68,000 (+0.3%)').\n"
                "2. Then output a fenced code block tagged 'news-cards' containing a JSON array "
                "of the top 5 stories. Each object must have exactly these keys:\n"
                '   {"title": "...", "source": "...", "url": "https://...", '
                '"summary": "1-2 sentence summary", "coins": ["BTC"]}\n'
                "   The url field MUST be the exact URL from the tool output for each article.\n\n"
                "Example of the EXACT format:\n"
                "Markets are holding steady with BTC at $68,000 (+0.3%) and XRP at $1.43 (+7.5%).\n\n"
                "```news-cards\n"
                '[{"title": "Example headline", "source": "CoinDesk", '
                '"url": "https://example.com/article", '
                '"summary": "Brief summary of the story.", "coins": ["BTC"]}]\n'
                "```\n\n"
                "IMPORTANT: Do NOT use bullet points or markdown lists. Only the overview text "
                "and the news-cards code block. No other text after the code block."
            ),
            expected_output=(
                "A 1-2 sentence market overview followed by a ```news-cards``` fenced code "
                "block containing a JSON array of article objects."
            ),
            agent=market_agent,
        ))

    elif query_type == QueryType.ANALYSIS:
        tasks.append(Task(
            description=(
                f"Perform a comparative analysis based on the user query: {user_query}\n\n"
                "You MUST use your tools to answer. Do NOT give generic instructions.\n"
                "1. Use get_current_price to fetch current prices for context.\n"
                "2. Use compare_assets with the relevant coin IDs, days, and method='minmax' "
                "to get normalized data and correlation.\n"
                "Present the results clearly: correlation coefficient, price changes over "
                "the period, which asset outperformed, and any divergences or convergences."
            ),
            expected_output=(
                "A data-driven comparative analysis with actual correlation coefficients, "
                "price changes, and trend observations from the tools."
            ),
            agent=analysis_agent,
        ))

    elif query_type == QueryType.ADVICE:
        tasks.append(Task(
            description=(
                f"Gather current market data relevant to the user query: {user_query}\n\n"
                "Fetch current prices, 24h changes, and market caps for any assets mentioned."
            ),
            expected_output="Current market data for the relevant cryptocurrencies.",
            agent=market_agent,
        ))
        tasks.append(Task(
            description=(
                f"Perform comparative analysis relevant to the user query: {user_query}\n\n"
                "Use compare_assets to analyze correlations and relative performance. "
                "Identify trends, divergences, and relative strength."
            ),
            expected_output=(
                "Quantitative analysis with correlations, price change percentages, "
                "and trend observations."
            ),
            agent=analysis_agent,
        ))
        tasks.append(Task(
            description=(
                f"Based on the market data and analysis from the previous agents, "
                f"provide financial guidance for the user query: {user_query}\n\n"
                "Synthesize the data and analysis into clear, actionable advice. "
                "Consider risk factors, market conditions, and diversification. "
                "Include appropriate disclaimers about cryptocurrency investment risks."
            ),
            expected_output=(
                "Clear, balanced financial guidance that synthesizes the data and "
                "analysis, with appropriate risk disclaimers."
            ),
            agent=advisor_agent,
        ))

    agents = [market_agent]
    if query_type in (QueryType.ANALYSIS, QueryType.ADVICE):
        agents.append(analysis_agent)
    if query_type == QueryType.ADVICE:
        agents.append(advisor_agent)

    return Crew(
        agents=agents,
        tasks=tasks,
        process=Process.sequential,
        verbose=False,
    )


def build_market_brief_crew() -> Crew:
    """Build a single-agent crew for generating a daily market brief."""
    llm = get_llm()

    brief_agent = Agent(
        role="Market Brief Writer",
        goal="Fetch live crypto data and write a concise 3-4 sentence market brief",
        backstory=(
            "You are a financial journalist with access to live market data tools. "
            "You fetch current prices and news, then distill them into a clear, "
            "insightful 3-4 sentence market brief. Be specific with numbers."
        ),
        tools=[GetCurrentPriceTool(), GetNewsTool()],
        llm=llm,
        verbose=False,
    )

    brief_task = Task(
        description=(
            "1. Use get_current_price to fetch prices for bitcoin and ripple\n"
            "2. Use get_news to fetch the latest 5 crypto headlines\n"
            "3. Write a concise 3-4 sentence market brief including BTC and XRP prices "
            "with 24h movements, and reference any significant news.\n"
            "Write in flowing prose only — no markdown, no bullet points, no headers."
        ),
        expected_output="A concise 3-4 sentence market brief in plain prose with real prices.",
        agent=brief_agent,
    )

    return Crew(
        agents=[brief_agent],
        tasks=[brief_task],
        process=Process.sequential,
        verbose=False,
    )
