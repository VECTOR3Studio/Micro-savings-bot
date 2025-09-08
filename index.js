require('dotenv').config();
const TGBot = require('node-telegram-bot-api');
const fs = require('fs'); // Node's file system module

const token = process.env.BOT_TOKEN;
const bot = new TGBot(token, { polling: true });

// --- File Paths for Persistence ---
const USER_GOALS_FILE = './userGoals.json';
const LAST_GOAL_FILE = './lastInteractedGoal.json';

// --- Global Data Stores ---
let userGoals = {};
let lastInteractedGoal = {};

// --- Persistence Functions ---
function loadUserData() {
    if (fs.existsSync(USER_GOALS_FILE)) {
        userGoals = JSON.parse(fs.readFileSync(USER_GOALS_FILE, 'utf8'));
        console.log('User goals loaded from file.');
    }
    if (fs.existsSync(LAST_GOAL_FILE)) {
        lastInteractedGoal = JSON.parse(fs.readFileSync(LAST_GOAL_FILE, 'utf8'));
        console.log('Last interacted goals loaded from file.');
    }
}

function saveUserData() {
    fs.writeFileSync(USER_GOALS_FILE, JSON.stringify(userGoals, null, 2), 'utf8');
    fs.writeFileSync(LAST_GOAL_FILE, JSON.stringify(lastInteractedGoal, null, 2), 'utf8');
    console.log('User data saved to files.');
}

// --- Helper for Progress Bar ---
function createProgressBar(current, target, length = 10) {
    if (target <= 0) return '🚫'; // Avoid division by zero
    const percentage = current / target;
    const filledBlocks = Math.round(length * percentage);
    const emptyBlocks = length - filledBlocks;
    const filledEmoji = '🟩'; // Green square
    const emptyEmoji = '⬜'; // White square
    return filledEmoji.repeat(filledBlocks) + emptyEmoji.repeat(emptyBlocks);
}

// --- Keyboard Definitions ---
const mainMenuKeyboard = {
    reply_markup: {
        keyboard: [
            [{ text: '📈 View Goals' }, { text: '➕ Add Savings' }],
            [{ text: '🎯 Set New Goal' }, { text: '⚙️ Manage Goals' }],
            [{ text: '❓ Help' }],
        ],
        resize_keyboard: true, // Make the keyboard smaller
        one_time_keyboard: false, // Keep it visible
    },
};

const manageGoalsKeyboard = (userId) => {
    const goals = userGoals[userId] || [];
    if (goals.length === 0) {
        return {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🎯 Set New Goal', callback_data: 'COMMAND_SETGOAL' }],
                ],
            },
        };
    }

    const inline_keyboard = goals.map(goal => ([
        { text: `🗑️ Delete "${goal.name}"`, callback_data: `DELETE_CONFIRM_${goal.name}` },
    ]));

    // Add a 'Back to Main Menu' button
    inline_keyboard.push([{ text: '↩️ Back to Main Menu', callback_data: 'MAIN_MENU' }]);

    return { reply_markup: { inline_keyboard } };
};

// --- Bot Command Handlers ---

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(
        chatId,
        `Welcome to your *Micro-Savings Bot*! 💰
I'm here to help you track your progress towards your financial goals.`,
        { ...mainMenuKeyboard, parse_mode: 'Markdown' }
    );
});

// Handle text messages from reply keyboard buttons
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;

    switch (text) {
        case '📈 View Goals':
            handleGoalsCommand(chatId, userId);
            break;
        case '➕ Add Savings':
            bot.sendMessage(chatId, 'Type `/add <amount> [goal_name]` (e.g., `/add 10` or `/add 5 New Book`) to add savings.');
            if (userGoals[userId] && userGoals[userId].length > 0) {
                const goalButtons = userGoals[userId].map(goal => ({
                    text: `➕ Add to "${goal.name}"`,
                    callback_data: `ADD_TO_GOAL_${goal.name}`
                }));
                bot.sendMessage(chatId, 'Or choose a goal to add to:', {
                    reply_markup: {
                        inline_keyboard: [goalButtons]
                    }
                });
            }
            break;
        case '🎯 Set New Goal':
            bot.sendMessage(chatId, 'Type `/setgoal <name> <amount>` (e.g., `/setgoal New Book 50`) to create a new goal.');
            break;
        case '⚙️ Manage Goals':
            bot.sendMessage(chatId, '*Manage Your Goals:*', { ...manageGoalsKeyboard(userId), parse_mode: 'Markdown' });
            break;
        case '❓ Help':
            handleHelpCommand(chatId);
            break;
        // Default: If it's not a known command or button text, it's user input
        default:
            // This is where you might handle /add without an explicit command, but for now stick to /add
            // Or you can ignore if it's not a command.
            if (!text.startsWith('/')) { // Only respond to non-command text
                bot.sendMessage(chatId, "I'm not sure what that means. Use the menu buttons or type a command like `/help`.");
            }
            break;
    }
});


function handleHelpCommand(chatId) {
    bot.sendMessage(
        chatId,
        `*How I can help you save:*

- *📈 View Goals:* See all your active goals and their progress.
- *➕ Add Savings:* Quickly add money to your goals.
- *🎯 Set New Goal:* Create a new savings target.
- *⚙️ Manage Goals:* Delete existing goals.

*Commands you can type:*
- \`/setgoal <name> <amount>\` (e.g., \`/setgoal New Book 50\`)
- \`/add <amount> [goal_name]\` (e.g., \`/add 10\` or \`/add 5 New Book\`)
- \`/goals\` (Same as 'View Goals')
- \`/progress <goal_name>\` (Check specific goal progress)
- \`/delete <goal_name>\`
- \`/help\` (Shows this message)

Let's make saving easy! 🚀`,
        { ...mainMenuKeyboard, parse_mode: 'Markdown' }
    );
}
bot.onText(/\/help/, (msg) => handleHelpCommand(msg.chat.id));


bot.onText(/\/setgoal (.+) (\d+(\.\d{1,2})?)/, (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const goalName = match[1].trim();
    const targetAmount = parseFloat(match[2]);

    if (!userGoals[userId]) {
        userGoals[userId] = [];
    }

    const existingGoal = userGoals[userId].find(goal => goal.name.toLowerCase() === goalName.toLowerCase());
    if (existingGoal) {
        return bot.sendMessage(chatId, `❌ You already have a goal named "*${goalName}*". Please choose a different name.`, { parse_mode: 'Markdown' });
    }

    userGoals[userId].push({
        name: goalName,
        target: targetAmount,
        saved: 0,
    });

    lastInteractedGoal[userId] = goalName;
    saveUserData(); // Save data after a change

    bot.sendMessage(
        chatId,
        `🎯 Goal "*${goalName}*" set for *$${targetAmount.toFixed(2)}*.
Ready to start saving! Use \`/add <amount>\` to contribute.`,
        { ...mainMenuKeyboard, parse_mode: 'Markdown' }
    );
});

bot.onText(/\/setgoal$/, (msg) => {
    bot.sendMessage(chatId, 'Usage: `/setgoal <name> <amount>` (e.g., `/setgoal New Book 50`)', { parse_mode: 'Markdown' });
});

bot.onText(/\/add (\d+(\.\d{1,2})?)(?: (.+))?/, async (msg, match) => { // Added 'async'
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const amount = parseFloat(match[1]);
    let specifiedGoalName = match[3] ? match[3].trim() : null;

    if (!userGoals[userId] || userGoals[userId].length === 0) {
        return bot.sendMessage(chatId, '🚫 You have no active goals. Set one with `/setgoal <name> <amount>`.', { parse_mode: 'Markdown' });
    }

    let targetGoal = null;
    let actualGoalNameUsed = null;

    if (specifiedGoalName) {
        targetGoal = userGoals[userId].find(goal => goal.name.toLowerCase() === specifiedGoalName.toLowerCase());
        if (!targetGoal) {
            return bot.sendMessage(chatId, `❌ Goal "*${specifiedGoalName}*" not found. Please check the name or set a new goal.`, { parse_mode: 'Markdown' });
        }
        actualGoalNameUsed = targetGoal.name;
    } else {
        const lastGoalNameForUser = lastInteractedGoal[userId];
        if (lastGoalNameForUser) {
            targetGoal = userGoals[userId].find(goal => goal.name.toLowerCase() === lastGoalNameForUser.toLowerCase());
            if (!targetGoal) {
                console.error(`Error: Last interacted goal "${lastGoalNameForUser}" not found for user ${userId}.`);
                return bot.sendMessage(chatId, `⚠️ It seems the last goal you interacted with ("*${lastGoalNameForUser}*") is no longer available. Please specify a goal name (e.g., \`/add 10 MyGoal\`).`, { parse_mode: 'Markdown' });
            }
            actualGoalNameUsed = targetGoal.name;
        } else {
            return bot.sendMessage(chatId, '🤷‍♀️ Please specify a goal name (e.g., `/add 10 MyGoal`) or set a goal first with `/setgoal`.', { parse_mode: 'Markdown' });
        }
    }

    if (targetGoal) {
        targetGoal.saved += amount;
        lastInteractedGoal[userId] = actualGoalNameUsed;
        saveUserData(); // Save data after a change

        const progress = (targetGoal.saved / targetGoal.target) * 100;
        const progressBar = createProgressBar(targetGoal.saved, targetGoal.target);

        let message = `*${targetGoal.name}* updated! You added *$${amount.toFixed(2)}*.`;
        message += `\n${progressBar} ${progress.toFixed(2)}%`;
        message += `\nTotal saved: *$${targetGoal.saved.toFixed(2)}* / *$${targetGoal.target.toFixed(2)}*`;

        if (targetGoal.saved >= targetGoal.target) {
            message += `\n\n🎉 *Congratulations!* You've reached your goal "*${targetGoal.name}*"! 🎉`;
            // Optional: You could ask if they want to archive/delete it here
        }

        bot.sendMessage(chatId, message, { ...mainMenuKeyboard, parse_mode: 'Markdown' });
        console.log(`Updated goal for user ${userId}:`, targetGoal);
    }
});

bot.onText(/\/add$/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Usage: `/add <amount> [goal_name]` (e.g., `/add 10` or `/add 5 New Book`)', { parse_mode: 'Markdown' });
});


bot.onText(/\/progress (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const goalNameQuery = match[1].trim();

    if (!userGoals[userId] || userGoals[userId].length === 0) {
        return bot.sendMessage(chatId, '🚫 You have no active goals. Set one with `/setgoal <name> <amount>`.', { parse_mode: 'Markdown' });
    }

    const targetGoal = userGoals[userId].find(goal => goal.name.toLowerCase() === goalNameQuery.toLowerCase());

    if (!targetGoal) {
        return bot.sendMessage(chatId, `❌ Goal "*${goalNameQuery}*" not found. Please check the name.`, { parse_mode: 'Markdown' });
    }

    const progress = (targetGoal.saved / targetGoal.target) * 100;
    const progressBar = createProgressBar(targetGoal.saved, targetGoal.target);

    let message = `*Progress for "${targetGoal.name}":*`;
    message += `\n${progressBar} ${progress.toFixed(2)}%`;
    message += `\nSaved: *$${targetGoal.saved.toFixed(2)}* out of *$${targetGoal.target.toFixed(2)}*`;

    if (targetGoal.saved >= targetGoal.target) {
        message += `\n🎉 *You've reached this goal!*`;
    } else {
        message += `\nYou need to save *$${(targetGoal.target - targetGoal.saved).toFixed(2)}* more!`;
    }

    bot.sendMessage(chatId, message, { ...mainMenuKeyboard, parse_mode: 'Markdown' });

    lastInteractedGoal[userId] = targetGoal.name;
    saveUserData(); // Save data after a change
});

bot.onText(/\/progress$/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Usage: `/progress <goal_name>` (e.g., `/progress New Book`)', { parse_mode: 'Markdown' });
});


function handleGoalsCommand(chatId, userId) {
    if (!userGoals[userId] || userGoals[userId].length === 0) {
        return bot.sendMessage(
            chatId,
            `🤷‍♀️ You don't have any active goals yet!
Let's create one: Use the "🎯 Set New Goal" button or type \`/setgoal <name> <amount>\`.`,
            { ...mainMenuKeyboard, parse_mode: 'Markdown' }
        );
    }

    let response = '*Your Active Goals:* 📋\n\n';
    const inline_keyboard_buttons = [];

    userGoals[userId].forEach(goal => {
        const progress = (goal.saved / goal.target) * 100;
        const progressBar = createProgressBar(goal.saved, goal.target);

        response += `*${goal.name}*\n`;
        response += `${progressBar} ${progress.toFixed(2)}%\n`;
        response += `$${goal.saved.toFixed(2)} / $${goal.target.toFixed(2)}\n\n`;

        inline_keyboard_buttons.push([
            { text: `➕ Add to "${goal.name}"`, callback_data: `ADD_TO_GOAL_${goal.name}` },
            { text: `👁️ Progress`, callback_data: `PROGRESS_GOAL_${goal.name}` },
            // { text: `🗑️ Delete`, callback_data: `DELETE_CONFIRM_${goal.name}` }, // Moved to Manage Goals
        ]);
    });

    // Add back to main menu
    inline_keyboard_buttons.push([{ text: '↩️ Back to Main Menu', callback_data: 'MAIN_MENU' }]);


    bot.sendMessage(chatId, response, {
        reply_markup: {
            inline_keyboard: inline_keyboard_buttons,
        },
        parse_mode: 'Markdown'
    });
}
bot.onText(/\/goals/, (msg) => handleGoalsCommand(msg.chat.id, msg.from.id));


bot.onText(/\/delete (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const goalNameToDelete = match[1].trim();

    if (!userGoals[userId] || userGoals[userId].length === 0) {
        return bot.sendMessage(chatId, '🚫 You have no active goals to delete. Set one with `/setgoal`.', { parse_mode: 'Markdown' });
    }

    const goalIndex = userGoals[userId].findIndex(
        (goal) => goal.name.toLowerCase() === goalNameToDelete.toLowerCase()
    );

    if (goalIndex === -1) {
        return bot.sendMessage(chatId, `❌ Goal "*${goalNameToDelete}*" not found. Please check the name.`, { parse_mode: 'Markdown' });
    }

    const deletedGoal = userGoals[userId][goalIndex];
    userGoals[userId].splice(goalIndex, 1);

    if (lastInteractedGoal[userId] && lastInteractedGoal[userId].toLowerCase() === deletedGoal.name.toLowerCase()) {
        delete lastInteractedGoal[userId];
    }
    saveUserData(); // Save data after a change

    bot.sendMessage(
        chatId,
        `🗑️ Goal "*${deletedGoal.name}*" (target: *$${deletedGoal.target.toFixed(2)}*) has been deleted.`,
        { ...mainMenuKeyboard, parse_mode: 'Markdown' }
    );
    console.log(`Goal "${deletedGoal.name}" deleted for user ${userId}. Remaining goals:`, JSON.stringify(userGoals[userId]));
});

bot.onText(/\/delete$/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Usage: `/delete <goal_name>` (e.g., `/delete New Book`)', { parse_mode: 'Markdown' });
});

// --- Callback Query Handler (for inline buttons) ---
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const data = query.data;

    // Acknowledge the query to remove the loading state on the button
    await bot.answerCallbackQuery(query.id);

    if (data.startsWith('ADD_TO_GOAL_')) {
        const goalName = data.replace('ADD_TO_GOAL_', '');
        lastInteractedGoal[userId] = goalName; // Mark this as the last interacted goal
        saveUserData(); // Save data after a change
        bot.sendMessage(chatId, `Okay! Now, how much would you like to add to "*${goalName}*"?
Just type the amount, e.g., \`/add 15\`.`, { parse_mode: 'Markdown' });
    } else if (data.startsWith('PROGRESS_GOAL_')) {
        const goalName = data.replace('PROGRESS_GOAL_', '');
        // Re-use the /progress command logic
        // This is a bit of a hack as we're not sending a message, but calling the function
        const mockMsg = { chat: { id: chatId }, from: { id: userId }, text: `/progress ${goalName}` };
        bot.emit('text', mockMsg, [`/progress ${goalName}`, goalName]); // Manually trigger the text handler
    } else if (data.startsWith('DELETE_CONFIRM_')) {
        const goalName = data.replace('DELETE_CONFIRM_', '');
        // Send a confirmation prompt with yes/no buttons
        bot.sendMessage(chatId, `❓ Are you sure you want to delete goal "*${goalName}*"? This action cannot be undone.`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '✅ Yes, Delete it', callback_data: `DELETE_FINAL_${goalName}` }],
                    [{ text: '❌ No, Keep it', callback_data: 'MAIN_MENU' }],
                ],
            },
            parse_mode: 'Markdown'
        });
    } else if (data.startsWith('DELETE_FINAL_')) {
        const goalName = data.replace('DELETE_FINAL_', '');
        // Re-use the /delete command logic
        const mockMsg = { chat: { id: chatId }, from: { id: userId }, text: `/delete ${goalName}` };
        bot.emit('text', mockMsg, [`/delete ${goalName}`, goalName]); // Manually trigger the text handler
    } else if (data === 'MAIN_MENU') {
        bot.sendMessage(chatId, '🏡 Back to Main Menu!', { ...mainMenuKeyboard, parse_mode: 'Markdown' });
    } else if (data === 'COMMAND_SETGOAL') {
        bot.sendMessage(chatId, 'Okay, let\'s set a new goal! Please type `/setgoal <name> <amount>` (e.g., `/setgoal Dream Vacation 1200`).', { parse_mode: 'Markdown' });
    }
});


// --- Initial Load of Data ---
loadUserData();
console.log('Bot is running...');