"""
ai_engine.py
Core "brain" of Nova.
Takes text commands and returns structured responses.
"""

import datetime
import random
import re
import requests

NAME = "Nova"


GREETING_TRIGGERS = ("hi", "hello", "hey", "yo", "sup")
IDENTITY_TRIGGERS = (
    "who are you",
    "what is your name",
    "what's your name",
    "your name",
    "how are you"
)

THANKS_TRIGGERS = ("thank you", "thanks", "thx")
JOKE_TRIGGERS = ("tell me a joke", "make me laugh", "joke")
EXIT_TRIGGERS = ("bye", "exit", "goodbye")


JOKES = [
    "Why do programmers prefer dark mode? Because light attracts bugs.",
    "I told my computer I needed a break, and now it won't stop sending me KitKats.",
    "Why do Java developers wear glasses? Because they don't see sharp."
]


GREETING_REPLIES = [
    f"Hey there! I'm {NAME}. What can I do for you?",
    f"Hello! {NAME} here, ready to help.",
    "Hi! How can I help you today?"
]


def _make(reply, type_="unknown", action=None, url=None, query=None):
    return {
        "reply": reply,
        "type": type_,
        "action": action,
        "url": url,
        "query": query
    }



# ---------------- TIME ----------------

def _handle_time():
    now = datetime.datetime.now().strftime("%I:%M %p")
    return _make(
        f"It's currently {now}.",
        type_="time"
    )


# ---------------- DATE ----------------

def _handle_date():
    today = datetime.datetime.now().strftime("%A, %B %d, %Y")
    return _make(
        f"Today is {today}.",
        type_="date"
    )



# ---------------- SEARCH ----------------

def _handle_search(query):

    query = query.strip()

    if not query:
        return _make(
            "What would you like me to search for?",
            type_="search"
        )

    return _make(
        f"Searching Google for {query}.",
        type_="search",
        action="search",
        query=query
    )



# ---------------- OPEN APPS ----------------

def _handle_open(target):

    targets = {

        "google": "https://www.google.com",
        "youtube": "https://www.youtube.com",
        "github": "https://github.com",
        "linkedin": "https://www.linkedin.com",
        "gmail": "https://mail.google.com",

        "whatsapp": "https://web.whatsapp.com",
        "spotify": "https://open.spotify.com",
        "discord": "https://discord.com",
        "chatgpt": "https://chat.openai.com",
        "canva": "https://www.canva.com",
        "drive": "https://drive.google.com",
        "calendar": "https://calendar.google.com"
    }


    if target in targets:

        return _make(
            f"Opening {target}.",
            type_="open",
            action=target,
            url=targets[target]
        )


    return _make(
        "I can open Google, YouTube, GitHub, LinkedIn, Gmail, WhatsApp, Spotify, Discord, ChatGPT, Canva, Drive and Calendar.",
        type_="open"
    )



# ---------------- NEWS ----------------

def get_news():

    try:

        url = "https://newsapi.org/v2/top-headlines?country=in&apiKey=YOUR_NEWS_API_KEY"

        response = requests.get(url)

        data = response.json()

        headlines = []


        for article in data.get("articles", [])[:5]:

            headlines.append(article["title"])


        if not headlines:
            return "I couldn't find latest news right now."


        return "Here are today's top news: " + " | ".join(headlines)


    except Exception:

        return "Sorry, I couldn't fetch latest news right now."




# ---------------- OTHER RESPONSES ----------------

def _handle_greeting():
    return _make(
        random.choice(GREETING_REPLIES),
        type_="greeting"
    )


def _handle_identity():

    return _make(
        f"I'm {NAME}, your personal voice assistant built with Python and Flask.",
        type_="identity"
    )


def _handle_thanks():

    return _make(
        "You're welcome! Anything else I can help with?",
        type_="greeting"
    )


def _handle_joke():

    return _make(
        random.choice(JOKES),
        type_="joke"
    )


def _handle_help():

    return _make(
        "You can ask me for time, date, latest news, web search, open apps, calculations or general help.",
        type_="help"
    )



def _handle_weather():

    return _make(
        "I can help you look up weather, but live weather API is not connected yet.",
        type_="weather"
    )



# ---------------- CALCULATOR ----------------

def _handle_calculation(text):

    expression = text.lower()

    match = re.search(
        r"calculate\s+(.+)",
        expression
    )


    if match:
        expr = match.group(1)

    else:
        expr = expression



    if not re.fullmatch(
        r"[0-9\s+\-*/().]+",
        expr
    ):

        return _make(
            "I can calculate basic arithmetic like 5+8.",
            type_="calculation"
        )


    try:

        result = eval(
            expr,
            {"__builtins__": {}},
            {}
        )


    except:

        return _make(
            "I couldn't calculate that.",
            type_="calculation"
        )


    return _make(
        f"The result is {result}.",
        type_="calculation"
    )



# ---------------- MAIN COMMAND HANDLER ----------------

def process_command(text):


    if not text or not text.strip():

        return _make(
            "I didn't catch that.",
            type_="unknown"
        )


    cleaned = text.strip().lower()



    if cleaned.startswith("search"):

        return _handle_search(
            cleaned[6:]
        )



    if cleaned.startswith("open "):

        return _handle_open(
            cleaned[5:].strip()
        )



    if cleaned.startswith("calculate"):

        return _handle_calculation(cleaned)



    if any(cleaned.startswith(g) for g in GREETING_TRIGGERS):

        return _handle_greeting()



    if any(t in cleaned for t in IDENTITY_TRIGGERS):

        return _handle_identity()



    if any(t in cleaned for t in THANKS_TRIGGERS):

        return _handle_thanks()



    if any(t in cleaned for t in JOKE_TRIGGERS):

        return _handle_joke()



    if any(t in cleaned for t in EXIT_TRIGGERS):

        return _make(
            "Goodbye! I'll be here whenever you need me.",
            type_="exit"
        )



    if cleaned in ("help","what can you do"):

        return _handle_help()



    if "weather" in cleaned:

        return _handle_weather()



    if "news" in cleaned or "latest news" in cleaned or "headlines" in cleaned:

        return _make(
            get_news(),
            type_="news"
        )



    if "time" in cleaned:

        return _handle_time()



    if "date" in cleaned or "day" in cleaned:

        return _handle_date()



    return _make(
        "I'm not sure how to help with that yet. Try asking for help.",
        type_="unknown"
    )
