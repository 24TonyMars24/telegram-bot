//cd C:\Users\danil\CascadeProjects\telegram-shop
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const sellerUsername = process.env.SELLER_USERNAME;

// Хранение корзин пользователей
const carts = new Map();

// Список категорий и товаров
const catalog = {
    'Электроника': [
        { id: 1, name: 'Смартфон', price: 2000, description: 'Pocox3Pro' },
        { id: 2, name: 'Ноутбук', price: 49999, description: 'MacPro' }
    ],
    'Одежда': [
        { id: 3, name: 'Футболка', price: 999, description: 'Хлопковая футболка "Первые"' },
        { id: 4, name: 'Джинсы', price: 2999, description: 'Джинсы Calvin Klein' }
    ]
};

// Главное меню
const mainKeyboard = {
    reply_markup: {
        keyboard: [
            ['🛍 Каталог', '🛒 Корзина'],
            ['ℹ️ О магазине', '📞 Связаться с продавцом']
        ],
        resize_keyboard: true
    }
};

// Команда start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 
        'Добро пожаловать в наш магазин! 👋\n\n' +
        'Выберите раздел в меню:',
        mainKeyboard
    );
});

// Обработка текстовых сообщений
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    switch(text) {
        case '🛍 Каталог':
            showCategories(chatId);
            break;
        case '🛒 Корзина':
            showCart(chatId);
            break;
        case 'ℹ️ О магазине':
            bot.sendMessage(chatId, 
                'Самый лучший и брендовый товар!📦.\n' +
                'Самая быстрая🚀 и качественная доставка🚚!\n'+
                'Работаем ради вас 24/7❤️!'
            );
            break;
        case '📞 Связаться с продавцом':
            bot.sendMessage(chatId, 
                `Напишите нашему менеджеру: @${sellerUsername}`
            );
            break;
    }
});

// Показ категорий
function showCategories(chatId) {
    const categories = Object.keys(catalog);
    const keyboard = {
        inline_keyboard: categories.map(category => ([
            { text: category, callback_data: `category_${category}` }
        ]))
    };
    
    bot.sendMessage(chatId, 'Выберите категорию:', {
        reply_markup: keyboard
    });
}

// Показ товаров категории
function showProducts(chatId, category) {
    const products = catalog[category];
    products.forEach(product => {
        const keyboard = {
            inline_keyboard: [
                [
                    { text: `Добавить в корзину (${product.price}₽)`, 
                      callback_data: `add_${product.id}` }
                ]
            ]
        };
        
        bot.sendMessage(chatId, 
            `*${product.name}*\n` +
            `Цена: ${product.price}₽\n` +
            `Описание: ${product.description}`,
            {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            }
        );
    });
}

// Показ корзины
function showCart(chatId) {
    const cart = carts.get(chatId) || [];
    
    if (cart.length === 0) {
        bot.sendMessage(chatId, 'Ваша корзина пуста 🛒');
        return;
    }

    const total = cart.reduce((sum, item) => sum + item.price, 0);
    const cartList = cart.map((item, index) => 
        `${index + 1}. ${item.name} - ${item.price}₽`
    ).join('\n');
    
    const keyboard = {
        inline_keyboard: [
            [{ text: '🗑 Очистить корзину', callback_data: 'clear_cart' }],
            [{ text: '✅ Оформить заказ', callback_data: 'checkout' }]
        ]
    };

    bot.sendMessage(chatId, 
        `🛒 *Ваша корзина:*\n\n${cartList}\n\n` +
        `*Итого: ${total}₽*`,
        {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        }
    );
}

// Обработка callback-запросов
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (data.startsWith('category_')) {
        const category = data.split('_')[1];
        showProducts(chatId, category);
    }
    else if (data.startsWith('add_')) {
        const productId = parseInt(data.split('_')[1]);
        let product = null;
        
        // Поиск товара по id
        for (const category of Object.values(catalog)) {
            const found = category.find(p => p.id === productId);
            if (found) {
                product = found;
                break;
            }
        }

        if (product) {
            if (!carts.has(chatId)) {
                carts.set(chatId, []);
            }
            carts.get(chatId).push(product);
            
            await bot.answerCallbackQuery(query.id, {
                text: '✅ Товар добавлен в корзину'
            });
            
            // Показываем мини-уведомление о состоянии корзины
            const cart = carts.get(chatId);
            const total = cart.reduce((sum, item) => sum + item.price, 0);
            bot.sendMessage(chatId, 
                `Товар "${product.name}" добавлен в корзину\n` +
                `Сумма корзины: ${total}₽`,
                {
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '🛒 Показать корзину', callback_data: 'show_cart' }
                        ]]
                    }
                }
            );
        }
    }
    else if (data === 'show_cart') {
        showCart(chatId);
    }
    else if (data === 'clear_cart') {
        carts.delete(chatId);
        await bot.answerCallbackQuery(query.id, {
            text: '🗑 Корзина очищена'
        });
        bot.sendMessage(chatId, 'Корзина очищена');
    }
    else if (data === 'checkout') {
        const cart = carts.get(chatId);
        if (cart && cart.length > 0) {
            const total = cart.reduce((sum, item) => sum + item.price, 0);
            const cartList = cart.map(item => 
                `${item.name} - ${item.price}₽`
            ).join('\n');

            // Создаем уникальный ID заказа
            const orderId = Date.now().toString(36) + Math.random().toString(36).substr(2);
            
            bot.sendMessage(chatId,
                `✅ *Заказ ${orderId} оформлен!*\n\n` +
                `*Состав заказа:*\n${cartList}\n\n` +
                `*Итого: ${total}₽*\n\n` +
                'Сейчас вы будете перенаправлены к продавцу.',
                {
                    parse_mode: 'Markdown'
                }
            );

            // Отправляем ссылку на продавца
            bot.sendMessage(chatId,
                `это учебный проект и реальные финансовые операции не предусмотренны.:\n` +
                `https://t.me/${sellerUsername}?start=order_${orderId}`,
                {
                    disable_web_page_preview: true
                }
            );

            // Очищаем корзину
            carts.delete(chatId);
        }
    }
 
    await bot.answerCallbackQuery(query.id);
});