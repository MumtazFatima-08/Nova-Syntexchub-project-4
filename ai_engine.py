"""
ai_engine.py
Core "brain" of Nova. Pure Python, no Flask/HTTP here — this module just
takes a text command in and returns a structured dict out, so it can be
unit-tested and reused independently of the web server.
"""

import datetime
import random
import re

NAME = "Nova"

GREETING_TRIGGERS = ("hi", "hello", "hey", "yo", "sup")
IDENTITY_TRIGGERS = ("who are you", "what is your name", "what's your name", "your name", "how are you")
THANKS_TRIGGERS = ("thank you", "thanks", "thx")
JOKE_TRIGGERS = ("tell me a joke", "make me laugh", "joke")
EXIT_TRIGGERS = ("bye", "exit", "goodbye")

JOKES = [
    "Why do programmers prefer dark mode? Because light attracts bugs.",
    "I told my computer I needed a break, and now it won't stop sending me KitKats.",
    "Why do Java developers wear glasses? Because they don't see sharp.",
]

GREETING_REPLIES = [
    f"Hey there! I'm {NAME}. What can I do for you?",
    f"Hello! {NAME} here, ready to help.",
    "Hi! How can I help you today?",
]


def _make(reply, type_="unknown", action=None, url=None, query=None):
    return {"reply": reply, "type": type_, "action": action, "url": url, "query": query}


def _handle_time() -> dict:
    now = datetime.datetime.now().strftime("%I:%M %p")
    return _make(f"It's currently {now}.", type_="time")


def _handle_date() -> dict:
    today = datetime.datetime.now().strftime("%A, %B %d, %Y")
    return _make(f"Today is {today}.", type_="date")


def _handle_search(query: str) -> dict:
    query = query.strip()
    if not query:
        return _make("What would you like me to search for?", type_="search")
    return _make(
        f"Searching Google for {query}.",
        type_="search",
        action="search",
        query=query,
    )


def _handle_open(target: str) -> dict:
    targets = {
        "google": "https://www.google.com",
        "youtube": "https://www.youtube.com",
        "github": "https://github.com",
        "linkedin": "https://www.linkedin.com",
        "gmail": "https://mail.google.com",
    }
    if target in targets:
        return _make(f"Opening {target}.", type_="open", action=target, url=targets[target])
    return _make("I can open Google, YouTube, GitHub, LinkedIn, or Gmail.", type_="open")


def _handle_greeting() -> dict:
    return _make(random.choice(GREETING_REPLIES), type_="greeting")


def _handle_identity() -> dict:
    return _make(f"I'm {NAME}, your personal voice assistant built with Python and Flask.", type_="identity")


def _handle_thanks() -> dict:
    return _make("You're welcome! Anything else I can help with?", type_="greeting")


def _handle_joke() -> dict:
    return _make(random.choice(JOKES), type_="joke")


def _handle_help() -> dict:
    return _make(
        "You can ask me for the time, the date, a web search, to open apps like Google or YouTube, or just say hello. Try commands like 'search Python' or 'open Gmail'.",
        type_="help",
    )


def _handle_weather() -> dict:
    return _make("I can help you look up the weather, but I can't check live forecasts from here. Try asking a weather website or app directly.", type_="weather")


def _handle_calculation(text: str) -> dict:
    expression = text.strip().lower()
    match = re.search(r"calculate\s+(.+)", expression)
    if match:
        expr = match.group(1).strip()
    else:
        expr = expression

    if not re.fullmatch(r"[0-9\s+\-*/().]+", expr):
        return _make("I can calculate basic arithmetic like 5+8 or 100*45.", type_="calculation")

    try:
        result = eval(expr, {"__builtins__": {}}, {})
    except Exception:
        return _make("I couldn't evaluate that expression. Try a simple calculation like 5+8.", type_="calculation")

    return _make(f"The result is {result}.", type_="calculation")


def process_command(text: str) -> dict:
    if not text or not text.strip():
        return _make("I didn't catch that. Could you say it again?", type_="unknown")

    cleaned = text.strip().lower()

    if cleaned.startswith("search"):
        query = cleaned[6:].strip()
        return _handle_search(query)

    if cleaned.startswith("open "):
        target = cleaned[5:].strip()
        return _handle_open(target)

    if cleaned.startswith("calculate"):
        return _handle_calculation(cleaned)

    if any(cleaned.startswith(g) for g in GREETING_TRIGGERS):
        return _handle_greeting()

    if any(t in cleaned for t in IDENTITY_TRIGGERS):
        if "how are you" in cleaned:
            return _make("I'm doing great and ready to help you.", type_="identity")
        return _handle_identity()

    if any(t in cleaned for t in THANKS_TRIGGERS):
        return _handle_thanks()

    if any(t in cleaned for t in JOKE_TRIGGERS):
        return _handle_joke()

    if any(t in cleaned for t in EXIT_TRIGGERS):
        return _make("Goodbye! I'll be here whenever you need me.", type_="exit")

    if cleaned in ("help", "what can you do"):
        return _handle_help()

    if "weather" in cleaned:
        return _handle_weather()

    if "time" in cleaned:
        return _handle_time()

    if "date" in cleaned or "day" in cleaned:
        return _handle_date()

    return _make("I'm not sure how to help with that yet. Try asking for the time, the date, a search, or say help.", type_="unknown")