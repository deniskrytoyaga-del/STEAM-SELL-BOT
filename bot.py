import os, json, time, html
import requests

TOKEN = os.environ["BOT_TOKEN"]
API = f"https://api.telegram.org/bot{TOKEN}"
STATE_FILE = "state.json"
STEAM_URL = "https://store.steampowered.com/api/featuredcategories/?cc=ru&l=russian"
PAGE_SIZE = 6

def load_state():
    try:
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"offset": 0, "pages": {}}

state = load_state()

def save_state():
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)

def tg(method, **data):
    r = requests.post(f"{API}/{method}", data=data, timeout=25)
    r.raise_for_status()
    payload = r.json()
    if not payload.get("ok"):
        raise RuntimeError(payload)
    return payload.get("result")

def keyboard():
    return {"keyboard": [[{"text": "🔥 Действующие скидки"}]], "resize_keyboard": True}

def get_deals():
    r = requests.get(STEAM_URL, timeout=25, headers={"User-Agent":"SteamSaleBot/1.0"})
    r.raise_for_status()
    data = r.json()
    items = (data.get("specials") or {}).get("items") or []
    deals = []
    for item in items:
        pct = int(item.get("discount_percent") or 0)
        if pct <= 0:
            continue
        deals.append({
            "id": item.get("id"),
            "name": item.get("name", "Без названия"),
            "discount": pct,
            "old": item.get("original_price"),
            "new": item.get("final_price"),
            "image": item.get("header_image") or item.get("large_capsule"),
            "url": f"https://store.steampowered.com/app/{item.get('id')}/"
        })
    return sorted(deals, key=lambda x: x["discount"], reverse=True)

def money(value):
    if value is None:
        return "—"
    try:
        return f"{int(value)/100:.2f} ₽"
    except Exception:
        return str(value)

def show_deals(chat_id, page=0):
    deals = get_deals()
    if not deals:
        tg("sendMessage", chat_id=chat_id, text="Пока не удалось получить список скидок Steam. Попробуй чуть позже.")
        return
    start = page * PAGE_SIZE
    chunk = deals[start:start+PAGE_SIZE]
    tg("sendMessage", chat_id=chat_id,
       text=f"🔥 <b>Скидки Steam</b>\nНайдено предложений: {len(deals)}\nСортировка: от большей скидки к меньшей.",
       parse_mode="HTML", reply_markup=json.dumps(keyboard(), ensure_ascii=False))
    for game in chunk:
        caption = (f"<b>{html.escape(game['name'])}</b>\n"
                   f"🔥 Скидка: <b>−{game['discount']}%</b>\n"
                   f"Было: {money(game['old'])} → Стало: <b>{money(game['new'])}</b>")
        markup = {"inline_keyboard":[[{"text":"🎮 Открыть в Steam","url":game["url"]}]]}
        if game["image"]:
            tg("sendPhoto", chat_id=chat_id, photo=game["image"], caption=caption,
               parse_mode="HTML", reply_markup=json.dumps(markup, ensure_ascii=False))
        else:
            tg("sendMessage", chat_id=chat_id, text=caption, parse_mode="HTML",
               reply_markup=json.dumps(markup, ensure_ascii=False))
    if start + PAGE_SIZE < len(deals):
        markup = {"inline_keyboard":[[{"text":"➡️ Следующие игры","callback_data":f"page:{page+1}"}]]}
        tg("sendMessage", chat_id=chat_id, text="Показать следующие предложения?", reply_markup=json.dumps(markup, ensure_ascii=False))

def handle(update):
    msg = update.get("message") or {}
    if msg:
        chat_id = msg["chat"]["id"]
        text = (msg.get("text") or "").strip()
        if text.startswith("/start"):
            tg("sendMessage", chat_id=chat_id,
               text="Привет! Я <b>Steam Sale Bot</b> 🎮\nНажми кнопку ниже — покажу актуальные скидки Steam.",
               parse_mode="HTML", reply_markup=json.dumps(keyboard(), ensure_ascii=False))
        elif text == "🔥 Действующие скидки" or text.startswith("/deals"):
            show_deals(chat_id)
        elif text.startswith("/help"):
            tg("sendMessage", chat_id=chat_id, text="Нажми «🔥 Действующие скидки», чтобы получить подборку актуальных распродаж.")
        return
    cq = update.get("callback_query") or {}
    if cq:
        data = cq.get("data", "")
        chat_id = cq["message"]["chat"]["id"]
        tg("answerCallbackQuery", callback_query_id=cq["id"])
        if data.startswith("page:"):
            show_deals(chat_id, int(data.split(":")[1]))

def main():
    # GitHub Actions starts this worker on a schedule; update offset is committed after each run.
    try:
        updates = tg("getUpdates", offset=state.get("offset", 0), timeout=0, allowed_updates=json.dumps(["message","callback_query"]))
        for upd in updates:
            state["offset"] = upd["update_id"] + 1
            try:
                handle(upd)
            except Exception as e:
                print("Update handling error:", repr(e))
        save_state()
    except Exception as e:
        print("Telegram polling error:", repr(e))
        save_state()
        raise

if __name__ == "__main__":
    main()
