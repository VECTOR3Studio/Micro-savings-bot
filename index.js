require('dotenv').config();
const TGBot = require('node-telegram-bot-api');

const token = process.env.BOT_TOKEN;

const bot = new TGBot(token, { polling: true });

const userGoals = {};

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Welcome to the Micro-savings Bot! Use /save <amount> to save money.');
});

bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id,
        `I can help you save for your small goals.

Here's what you can do:
- /setgoal <name> <amount> (e.g., /setgoal New Book 50)
- /add <amount> [goal_name] (e.g., /add 10 or /add 5 New Book)
- /goals (See all your active goals)
- /progress <goal_name> (Check specific goal progress)

Let's start saving!`
);
});

bot.onText(/\/setgoal (.+) (\d+(\.\d{1,2})?)/, (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const goalName = match[1].trim();
    const targetAmount = parseFloat(match[2]);

    if(!userGoals[userId]) {
        userGoals[userId] = [];
    }

    const existingGoal = userGoals[userId].find(goal => goal.name.toLowerCase() === goalName.toLowerCase());
    if(existingGoal) {
        return bot.sendMessage(chatId, `You already have a goal named "${goalName}". Please choose a different name.`);
    }

    userGoals[userId].push({
        name: goalName,
        target: targetAmount,
        saved: 0,
    })

    bot.sendMessage(chatId, `Goal "${goalName}" set for $${targetAmount.toFixed(2)}. Start saving with /add <amount>! Good luck`);

    // Debuging, delete later
    console.log(JSON.stringify(userGoals, null, 2));
});

bot.onText(/\/setgoal$/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Usage: /setgoal <name> <amount> (e.g., /setgoal New Book 50)');
});

bot.onText(/\/add (\d+(\.\d{1,2})?)(?: (.+))?/, (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const amount = parseFloat(match[1]);
    const goalName = match[3] ? match[3].trim() : null;

    if(!userGoals[userId] || userGoals[userId].length === 0) {
        return bot.sendMessage(chatId, 'You have no active goals. Set one with /setgoal <name> <amount>.');
    }

    userGoals[userId].forEach(goal => {
        if(goalName.toLowerCase() === goal.name.toLowerCase()) {
            goal.saved += amount;
            bot.sendMessage(chatId, `Goal ${goalName} updated. You saved ${amount.toFixed(2)}. Total saved: ${goal.saved.toFixed(2)} / ${goal.target.toFixed(2)}`);
            // Debuging, delete later
            console.log(goal);

            if(goal.saved == goal.target){
                bot.sendMessage(chatId,`Goal ${goalName} met! Congratulations!`)
            }
        }
        console.log(goal.name);
    });

    
});
bot.onText(/\/add$/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Usage: /add <amount> [goal_name] (e.g., /add 10 or /add 5 New Book)');
});

bot.onText(/\/goals/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if(!userGoals[userId] || userGoals[userId].length === 0) {
        return bot.sendMessage(chatId, 'You have no active goals. Set one with /setgoal <name> <amount>.');
    }

    let response = 'Your active goals:\n';
    userGoals[userId].forEach(goal => {
        response += `- ${goal.name}: $${goal.saved.toFixed(2)} / $${goal.target.toFixed(2)}\n`;
    });

    bot.sendMessage(chatId, response);
});

console.log('Bot is running...');

