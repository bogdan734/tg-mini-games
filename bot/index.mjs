import { Bot, InlineKeyboard } from 'grammy'

const { BOT_TOKEN, WEBAPP_URL } = process.env
if (!BOT_TOKEN || !WEBAPP_URL) {
  console.error('Set BOT_TOKEN and WEBAPP_URL in bot/.env (see .env.example)')
  process.exit(1)
}

const bot = new Bot(BOT_TOKEN)

bot.command('start', (ctx) =>
  ctx.reply('Привет! Жми кнопку и выбирай игру 👇', {
    reply_markup: new InlineKeyboard().webApp('🎮 Играть', WEBAPP_URL),
  }),
)

bot.on('message', (ctx) =>
  ctx.reply('Нажми /start или кнопку меню, чтобы открыть игры.'),
)

// Menu button (bottom-left in chat) opens the Mini App directly.
await bot.api.setChatMenuButton({
  menu_button: { type: 'web_app', text: 'Игры', web_app: { url: WEBAPP_URL } },
})

await bot.api.setMyCommands([{ command: 'start', description: 'Открыть игры' }])

console.log('Bot started')
bot.start()
