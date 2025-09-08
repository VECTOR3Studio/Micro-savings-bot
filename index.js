require('dotenv').config();
const TGBot = require('node-telegram-bot-api');

const token = process.env.BOT_TOKEN;

const bot = new TGBot(token, { polling: true });

const userGoals = {};

const lastInteractedGoal = {};

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

    //Set Last Interacted Goal
    lastInteractedGoal[userId] = goalName;

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
    let specifiedGoalName = match[3] ? match[3].trim() : null;

    if(!userGoals[userId] || userGoals[userId].length === 0) {
        return bot.sendMessage(chatId, 'You have no active goals. Set one with /setgoal <name> <amount>.');
    }

    let targetGoal = null;
    let actualGoalNameUsed = null;

    if (specifiedGoalName) {
        // User explicitly provided a goal name
        targetGoal = userGoals[userId].find(goal => goal.name.toLowerCase() === specifiedGoalName.toLowerCase());
        if (!targetGoal) {
            return bot.sendMessage(chatId, `Goal "${specifiedGoalName}" not found. Please check the name or set a new goal.`);
        }
        actualGoalNameUsed = targetGoal.name;
    } else {
        // User did NOT specify a goal name, try to use the last interacted goal
        const lastGoalNameForUser = lastInteractedGoal[userId];
        if (lastGoalNameForUser) {
            targetGoal = userGoals[userId].find(goal => goal.name.toLowerCase() === lastGoalNameForUser.toLowerCase());
            if (!targetGoal) {
                // This could happen if the last goal was somehow removed or renamed
                console.error(`Error: Last interacted goal "${lastGoalNameForUser}" not found for user ${userId}.`);
                return bot.sendMessage(chatId, `It seems the last goal you interacted with ("${lastGoalNameForUser}") is no longer available. Please specify a goal name (e.g., /add 10 MyGoal).`);
            }
            actualGoalNameUsed = targetGoal.name;
        } else {
            // No last interacted goal and no goal name specified
            return bot.sendMessage(chatId, 'Please specify a goal name (e.g., /add 10 MyGoal) or set a goal first with /setgoal.');
        }
    }

    if (targetGoal) {
        targetGoal.saved += amount;
        lastInteractedGoal[userId] = actualGoalNameUsed; // Update last interacted goal

        const progress = (targetGoal.saved / targetGoal.target) * 100;

        let message = `Goal "${targetGoal.name}" updated! You saved $${amount.toFixed(2)}.`;
        message += `\nTotal saved: $${targetGoal.saved.toFixed(2)} / $${targetGoal.target.toFixed(2)} (${progress.toFixed(2)}%)`;

        if (targetGoal.saved >= targetGoal.target) {
            message += `\n\n🎉 Congratulations! You've reached your goal "${targetGoal.name}"!`;
            // Optional: You might want to 'archive' or remove completed goals here
        }

        bot.sendMessage(chatId, message);
        console.log(`Updated goal for user ${userId}:`, targetGoal); // Debugging
    }
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

