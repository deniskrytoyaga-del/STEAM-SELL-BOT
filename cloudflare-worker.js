const API = "https://api.telegram.org/bot";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response("Steam Sale Bot is online. Telegram webhook: /telegram");
    }

    if (url.pathname === "/setup" && request.method === "GET") {
      if (!env.SETUP_SECRET || url.searchParams.get("key") !== env.SETUP_SECRET) {
        return new Response("Forbidden", { status: 403 });
      }
      const webhookUrl = url.origin + "/telegram";
      const result = await telegram(env, "setWebhook", {
        url: webhookUrl,
        secret_token: env.WEBHOOK_SECRET,
        allowed_updates: ["message", "callback_query"],
        drop_pending_updates: true
      });
      return Response.json(result);
    }

    if (url.pathname === "/telegram" && request.method === "POST") {
      if (request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET) {
        return new Response("Forbidden", { status: 403 });
      }
      const update = await request.json();
      ctx.waitUntil(handleUpdate(update, env));
      return new Response("OK");
    }

    return new Response("Not found", { status: 404 });
  }
};

async function telegram(env, method, body) {
  const response = await fetch(API + env.BOT_TOKEN + "/" + method, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  return await response.json();
}

async function sendText(env, chatId, text, keyboard) {
  return telegram(env, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: keyboard || {
      keyboard: [[{ text: "🔥 Действующие скидки" }]],
      resize_keyboard: true,
      is_persistent: true
    }
  });
}

async function handleUpdate(update, env) {
  if (update.callback_query) {
    const q = update.callback_query;
    await telegram(env, "answerCallbackQuery", { callback_query_id: q.id });
    const match = /^deals:(\d+)$/.exec(q.data || "");
    if (match) await showDeals(env, q.message.chat.id, Number(match[1]));
    return;
  }

  const message = update.message;
  if (!message || !message.chat) return;
  const text = (message.text || "").trim();
  if (text === "/start" || text === "/help") {
    await sendText(env, message.chat.id,
      "🎮 <b>Steam Sale Bot</b>\n\nПокажу актуальные скидки Steam Specials, отсортированные от самой большой скидки.\n\nНажми кнопку ниже 👇");
  } else if (text === "/deals" || text === "🔥 Действующие скидки") {
    await showDeals(env, message.chat.id, 0);
  } else {
    await sendText(env, message.chat.id, "Нажми «🔥 Действующие скидки», чтобы посмотреть предложения.");
  }
}

async function getDeals() {
  const response = await fetch("https://store.steampowered.com/api/featuredcategories/?cc=ru&l=russian", {
    headers: { "user-agent": "Mozilla/5.0 SteamSaleBot/1.0" }
  });
  if (!response.ok) throw new Error("Steam API returned " + response.status);
  const data = await response.json();
  const items = data?.specials?.items || [];
  return items
    .filter(x => x.discount_percent > 0)
    .sort((a, b) => b.discount_percent - a.discount_percent);
}

function price(value) {
  if (typeof value !== "number") return "—";
  return (value / 100).toLocaleString("ru-RU") + " ₽";
}

async function showDeals(env, chatId, page) {
  let deals;
  try {
    deals = await getDeals();
  } catch (error) {
    await sendText(env, chatId, "Не получилось загрузить скидки Steam. Попробуй ещё раз чуть позже.");
    return;
  }

  if (!deals.length) {
    await sendText(env, chatId, "Сейчас Steam не вернул предложения со скидками.");
    return;
  }

  const pageSize = 5;
  const start = page * pageSize;
  const current = deals.slice(start, start + pageSize);
  await sendText(env, chatId,
    "🔥 <b>АКТУАЛЬНЫЕ СКИДКИ STEAM</b>\nНайдено предложений: " + deals.length +
    "\nСтраница " + (page + 1) + " из " + Math.ceil(deals.length / pageSize));

  for (const game of current) {
    const name = escapeHtml(game.name || "Игра");
    const discount = Number(game.discount_percent) || 0;
    const oldPrice = game.original_price ?? game.original_price_text;
    const newPrice = game.final_price ?? game.final_price_text;
    const caption = "🎮 <b>" + name + "</b>\n🔥 Скидка: <b>-" + discount + "%</b>\n" +
      "Было: " + (typeof oldPrice === "number" ? price(oldPrice) : escapeHtml(String(oldPrice || "—"))) + "\n" +
      "Стало: <b>" + (typeof newPrice === "number" ? price(newPrice) : escapeHtml(String(newPrice || "—"))) + "</b>";
    const appId = game.id;
    const markup = { inline_keyboard: [[{
      text: "🎮 Открыть в Steam",
      url: "https://store.steampowered.com/app/" + appId + "/"
    }]] };
    const image = game.header_image || game.large_capsule_image || game.small_capsule_image;
    if (image) {
      await telegram(env, "sendPhoto", {
        chat_id: chatId, photo: image, caption, parse_mode: "HTML", reply_markup: markup
      });
    } else {
      await telegram(env, "sendMessage", {
        chat_id: chatId, text: caption, parse_mode: "HTML", reply_markup: markup
      });
    }
  }

  if (start + pageSize < deals.length) {
    await telegram(env, "sendMessage", {
      chat_id: chatId,
      text: "Показать следующую страницу?",
      reply_markup: { inline_keyboard: [[{ text: "➡️ Следующие игры", callback_data: "deals:" + (page + 1) }]] }
    });
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"
  }[ch]));
}
