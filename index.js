require('dotenv').config();
const TGBot = require('node-telegram-bot-api');
const fs = require('fs');

// --- Configuration ---
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  throw new Error('BOT_TOKEN is missing in environment variables');
}

const USER_GOALS_FILE = './userGoals.json';
const LAST_GOAL_FILE = './lastInteractedGoal.json';

// --- Initialize Bot ---
const bot = new TGBot(BOT_TOKEN, { polling: true });

// --- Global State Management ---
let userGoals = {};
let lastInteractedGoal = {};

/**
 * Loads persistent data from JSON files on startup
 */
function loadUserData() {
  try {
    if (fs.existsSync(USER_GOALS_FILE)) {
      const data = fs.readFileSync(USER_GOALS_FILE, 'utf8');
      userGoals = JSON.parse(data);
      console.log('User goals loaded successfully.');
    }

    if (fs.existsSync(LAST_GOAL_FILE)) {
      const data = fs.readFileSync(LAST_GOAL_FILE, 'utf8');
      lastInteractedGoal = JSON.parse(data);
      console.log('Last interacted goals loaded successfully.');
    }
  } catch (error) {
    console.error('Error loading user data:', error.message);
  }
}

/**
 * Saves current user data to JSON files
 */
function saveUserData() {
  try {
    fs.writeFileSync(USER_GOALS_FILE, JSON.stringify(userGoals, null, 2));
    fs.writeFileSync(LAST_GOAL_FILE, JSON.stringify(lastInteractedGoal, null, 2));
    console.log('User data saved successfully.');
  } catch (error) {
    console.error('Error saving user data:', error.message);
  }
}

/**
 * Creates a visual progress bar representation
 * @param {number} current - Current saved amount
 * @param {number} target - Target savings goal
 * @param {number} length - Length of progress bar in characters
 * @returns {string} Visual progress bar
 */
function createProgressBar(current, target, length = 10) {
  if (target <= 0) return '🚫'; // Prevent division by zero

  const percentage = Math.min(current / target, 1); // Cap at 100%
  const filledBlocks = Math.round(length * percentage);
  const emptyBlocks = length - filledBlocks;

  const filledEmoji = '🟩';
  const emptyEmoji = '⬜';

  return filledEmoji.repeat(filledBlocks) + emptyEmoji.repeat(emptyBlocks);
}

// --- Keyboard Definitions ---
const mainMenuKeyboard = {
  reply_markup: {
    keyboard: [
      ['📈 View Goals', '➕ Add Savings'],
      ['🎯 Set New Goal', '⚙️ Manage Goals'],
      ['❓ Help']
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  }
};

/**
 * Generates dynamic management keyboard based on user's goals
 * @param {number} userId - Telegram user ID
 * @returns {object} Inline keyboard markup
 */
function manageGoalsKeyboard(userId) {
  const goals = userGoals[userId] || [];
  
  if (goals.length === 0) {
    return {
      reply_markup: {
        inline_keyboard: [[{
          text: '🎯 Set New Goal',
          callback_data: 'COMMAND_SETGOAL'
        }]]
      }
    };
  }

  const inline_keyboard = goals.map(goal => [{
    text: `🗑️ Delete "${goal.name}"`,
    callback_data: `DELETE_CONFIRM_${goal.name}`
  }]);
  
  inline_keyboard.push([{
    text: '↩️ Back to Main Menu',
    callback_data: 'MAIN_MENU'
  }]);
  
  return { reply_markup: { inline_keyboard } };
}

// --- Command Handlers ---

/**
 * Handles /start command
 */
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  try {
    bot.sendMessage(
      chatId,
      `Welcome to your *Micro-Savings Bot*! 💰
I'm here to help you track your progress towards your financial goals.`,
      { ...mainMenuKeyboard, parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error(`Error in /start for user ${chatId}:`, error.message);
  }
});

/**
 * Handles Help command responses
 */
function handleHelpCommand(chatId) {
  try {
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
  } catch (error) {
    console.error(`Error in handleHelpCommand for user ${chatId}:`, error.message);
  }
}

bot.onText(/\/help/, (msg) => handleHelpCommand(msg.chat.id));

/**
 * Handles View Goals command (/goals and button)
 */
function handleGoalsCommand(chatId, userId) {
  try {
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
        { text: `👁️ Progress`, callback_data: `PROGRESS_GOAL_${goal.name}` }
      ]);
    });

    inline_keyboard_buttons.push([{
      text: '↩️ Back to Main Menu',
      callback_data: 'MAIN_MENU'
    }]);

    bot.sendMessage(chatId, response, {
      reply_markup: { inline_keyboard: inline_keyboard_buttons },
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error(`Error in handleGoalsCommand for user ${userId}:`, error.message);
    bot.sendMessage(chatId, '❗ An error occurred while retrieving your goals. Please try again.');
  }
}

bot.onText(/\/goals/, (msg) => handleGoalsCommand(msg.chat.id, msg.from.id));

// --- Message Event Handlers ---

/**
 * Handles replies from custom keyboards and fallback messages
 */
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  try {
    switch (text) {
      case '📈 View Goals':
        handleGoalsCommand(chatId, userId);
        break;
        
      case '➕ Add Savings':
        showAddSavingsOptions(chatId, userId);
        break;
        
      case '🎯 Set New Goal':
        showSetGoalInstructions(chatId);
        break;
        
      case '⚙️ Manage Goals':
        showManageGoalsMenu(chatId, userId);
        break;
        
      case '❓ Help':
        handleHelpCommand(chatId);
        break;
        
      default:
        // Ignore commands handled elsewhere and non-command messages
        if (!text.startsWith('/') && text.trim() !== '') {
          bot.sendMessage(
            chatId,
            "I'm not sure what that means. Use the menu buttons or type a command like `/help`.",
            { parse_mode: 'Markdown' }
          );
        }
    }
  } catch (error) {
    console.error(`Error processing message from user ${userId}:`, error.message);
    bot.sendMessage(chatId, '❗ Something went wrong. Please try again later.');
  }
});

// --- Specific Action Helpers ---

/**
 * Shows add savings options for interactive experience
 */
function showAddSavingsOptions(chatId, userId) {
  try {
    bot.sendMessage(
      chatId, 
      'Type `/add <amount> [goal_name]` (e.g., `/add 10` or `/add 5 New Book`) to add savings.'
    );

    if (userGoals[userId] && userGoals[userId].length > 0) {
      const goalButtons = userGoals[userId].map(goal => ({
        text: `➕ Add to "${goal.name}"`,
        callback_data: `ADD_TO_GOAL_${goal.name}`
      }));

      bot.sendMessage(chatId, 'Or choose a goal to add to:', {
        reply_markup: { inline_keyboard: [goalButtons] }
      });
    }
  } catch (error) {
    console.error(`Error showing add savings options for user ${userId}:`, error.message);
  }
}

/**
 * Provides instructions for setting new goals
 */
function showSetGoalInstructions(chatId) {
  try {
    bot.sendMessage(
      chatId, 
      'Type `/setgoal <name> <amount>` (e.g., `/setgoal New Book 50`) to create a new goal.'
    );
  } catch (error) {
    console.error(`Error providing set goal instructions for chat ${chatId}:`, error.message);
  }
}

/**
 * Displays the goal management interface
 */
function showManageGoalsMenu(chatId, userId) {
  try {
    bot.sendMessage(
      chatId, 
      '*Manage Your Goals:*', 
      { ...manageGoalsKeyboard(userId), parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error(`Error displaying manage goals menu for user ${userId}:`, error.message);
  }
}

// --- Main Functional Commands ---

/**
 * Handles goal creation via /setgoal command
 */
bot.onText(/\/setgoal (.+) (\d+(\.\d{1,2})?)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const goalName = match[1].trim();
  const targetAmount = parseFloat(match[2]);

  try {
    if (!userGoals[userId]) {
      userGoals[userId] = [];
    }

    if( targetAmount <= 0 ) {
      return bot.sendMessage(
        chatId, 
        '❌ The target amount must be a positive number greater than zero. Please try again.',
        { parse_mode: 'Markdown' }
      );
    }

    const existingGoal = userGoals[userId].find(g => g.name.toLowerCase() === goalName.toLowerCase());
    if (existingGoal) {
      return bot.sendMessage(
        chatId, 
        `❌ You already have a goal named "*${goalName}*". Please choose a different name.`,
        { parse_mode: 'Markdown' }
      );
    }

    userGoals[userId].push({ name: goalName, target: targetAmount, saved: 0 });
    lastInteractedGoal[userId] = goalName;
    saveUserData();

    bot.sendMessage(
      chatId,
      `🎯 Goal "*${goalName}*" set for *$${targetAmount.toFixed(2)}*.
Ready to start saving! Use \`/add <amount>\` to contribute.`,
      { ...mainMenuKeyboard, parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error(`Error setting new goal for user ${userId}:`, error.message);
    bot.sendMessage(chatId, '❗ Failed to create goal. Please try again.');
  }
});

/**
 * Handles invalid /setgoal usage
 */
bot.onText(/\/setgoal$/, (msg) => {
  const chatId = msg.chat.id;
  try {
    bot.sendMessage(
      chatId, 
      'Usage: `/setgoal <name> <amount>` (e.g., `/setgoal New Book 50`)', 
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error(`Error with setgoal usage message for chat ${chatId}:`, error.message);
  }
});

/**
 * Handles adding funds to a goal via /add command
 */
bot.onText(/\/add (\d+(\.\d{1,2})?)(?: (.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const amount = parseFloat(match[1]);
  const specifiedGoalName = match[3] ? match[3].trim() : null;

  try {
    if (!userGoals[userId] || userGoals[userId].length === 0) {
      return bot.sendMessage(
        chatId, 
        '🚫 You have no active goals. Set one with `/setgoal <name> <amount>`.', 
        { parse_mode: 'Markdown' }
      );
    }

    let targetGoal = null;
    let actualGoalNameUsed = null;

    if (specifiedGoalName) {
      targetGoal = userGoals[userId].find(g => g.name.toLowerCase() === specifiedGoalName.toLowerCase());
      
      if (!targetGoal) {
        return bot.sendMessage(
          chatId, 
          `❌ Goal "*${specifiedGoalName}*" not found. Please check the name or set a new goal.`,
          { parse_mode: 'Markdown' }
        );
      }
      actualGoalNameUsed = targetGoal.name;
    } else {
      const lastGoalNameForUser = lastInteractedGoal[userId];
      if (lastGoalNameForUser) {
        targetGoal = userGoals[userId].find(g => g.name.toLowerCase() === lastGoalNameForUser.toLowerCase());
        
        if (!targetGoal) {
          console.warn(`Last interacted goal "${lastGoalNameForUser}" not found for user ${userId}`);
          return bot.sendMessage(
            chatId, 
            `⚠️ It seems the last goal you interacted with ("*${lastGoalNameForUser}*") is no longer available. Please specify a goal name (e.g., \`/add 10 MyGoal\`).`,
            { parse_mode: 'Markdown' }
          );
        }
        actualGoalNameUsed = targetGoal.name;
      } else {
        return bot.sendMessage(
          chatId,
          '🤷‍♀️ Please specify a goal name (e.g., `/add 10 MyGoal`) or set a goal first with `/setgoal`.',
          { parse_mode: 'Markdown' }
        );
      }
    }

    targetGoal.saved += amount;
    lastInteractedGoal[userId] = actualGoalNameUsed;
    saveUserData();

    const progress = (targetGoal.saved / targetGoal.target) * 100;
    const progressBar = createProgressBar(targetGoal.saved, targetGoal.target);

    let message = `*${targetGoal.name}* updated! You added *$${amount.toFixed(2)}*.`;
    message += `\n${progressBar} ${progress.toFixed(2)}%`;
    message += `\nTotal saved: *$${targetGoal.saved.toFixed(2)}* / *$${targetGoal.target.toFixed(2)}*`;

    if (targetGoal.saved >= targetGoal.target) {
      message += `\n\n🎉 *Congratulations!* You've reached your goal "*${targetGoal.name}*"! 🎉`;
    }

    bot.sendMessage(chatId, message, { ...mainMenuKeyboard, parse_mode: 'Markdown' });
    console.log(`Updated goal for user ${userId}:`, targetGoal);
  } catch (error) {
    console.error(`Error adding funds for user ${userId}:`, error.message);
    bot.sendMessage(chatId, '❗ Failed to add funds. Please try again.');
  }
});

/**
 * Handles invalid /add usage
 */
bot.onText(/\/add$/, (msg) => {
  const chatId = msg.chat.id;
  try {
    bot.sendMessage(
      chatId,
      'Usage: `/add <amount> [goal_name]` (e.g., `/add 10` or `/add 5 New Book`)',
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error(`Error with add usage message for chat ${chatId}:`, error.message);
  }
});

/**
 * Handles checking specific goal progress via /progress command
 */
bot.onText(/\/progress (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const goalNameQuery = match[1].trim();

  try {
    if (!userGoals[userId] || userGoals[userId].length === 0) {
      return bot.sendMessage(
        chatId, 
        '🚫 You have no active goals. Set one with `/setgoal <name> <amount>`.', 
        { parse_mode: 'Markdown' }
      );
    }

    const targetGoal = userGoals[userId].find(g => g.name.toLowerCase() === goalNameQuery.toLowerCase());
    
    if (!targetGoal) {
      return bot.sendMessage(
        chatId, 
        `❌ Goal "*${goalNameQuery}*" not found. Please check the name.`,
        { parse_mode: 'Markdown' }
      );
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
    saveUserData();
  } catch (error) {
    console.error(`Error getting progress for user ${userId}:`, error.message);
    bot.sendMessage(chatId, '❗ Failed to retrieve progress information. Please try again.');
  }
});

/**
 * Handles invalid /progress usage
 */
bot.onText(/\/progress$/, (msg) => {
  const chatId = msg.chat.id;
  try {
    bot.sendMessage(
      chatId,
      'Usage: `/progress <goal_name>` (e.g., `/progress New Book`)',
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error(`Error with progress usage message for chat ${chatId}:`, error.message);
  }
});

/**
 * Handles goal deletion via /delete command
 */
bot.onText(/\/delete (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const goalNameToDelete = match[1].trim();

  try {
    if (!userGoals[userId] || userGoals[userId].length === 0) {
      return bot.sendMessage(
        chatId, 
        '🚫 You have no active goals to delete. Set one with `/setgoal`.', 
        { parse_mode: 'Markdown' }
      );
    }

    const goalIndex = userGoals[userId].findIndex(
      g => g.name.toLowerCase() === goalNameToDelete.toLowerCase()
    );

    if (goalIndex === -1) {
      return bot.sendMessage(
        chatId, 
        `❌ Goal "*${goalNameToDelete}*" not found. Please check the name.`,
        { parse_mode: 'Markdown' }
      );
    }

    const deletedGoal = userGoals[userId].splice(goalIndex, 1)[0];
    
    if (
      lastInteractedGoal[userId] &&
      lastInteractedGoal[userId].toLowerCase() === deletedGoal.name.toLowerCase()
    ) {
      delete lastInteractedGoal[userId];
    }
    
    saveUserData();

    bot.sendMessage(
      chatId,
      `🗑️ Goal "*${deletedGoal.name}*" (target: *$${deletedGoal.target.toFixed(2)}*) has been deleted.`,
      { ...mainMenuKeyboard, parse_mode: 'Markdown' }
    );
    
    console.log(`Goal "${deletedGoal.name}" deleted for user ${userId}`);
  } catch (error) {
    console.error(`Error deleting goal for user ${userId}:`, error.message);
    bot.sendMessage(chatId, '❗ Failed to delete goal. Please try again.');
  }
});

/**
 * Handles invalid /delete usage
 */
bot.onText(/\/delete$/, (msg) => {
  const chatId = msg.chat.id;
  try {
    bot.sendMessage(
      chatId,
      'Usage: `/delete <goal_name>` (e.g., `/delete New Book`)',
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error(`Error with delete usage message for chat ${chatId}:`, error.message);
  }
});

// --- Callback Query Handler ---

/**
 * Handles all inline button interactions
 */
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const data = query.data;

  try {
    await bot.answerCallbackQuery(query.id);

    if (data.startsWith('ADD_TO_GOAL_')) {
      const goalName = data.replace('ADD_TO_GOAL_', '');
      processAddToGoalRequest(chatId, userId, goalName);
    } else if (data.startsWith('PROGRESS_GOAL_')) {
      const goalName = data.replace('PROGRESS_GOAL_', '');
      simulateProgressCommand(chatId, userId, goalName);
    } else if (data.startsWith('DELETE_CONFIRM_')) {
      const goalName = data.replace('DELETE_CONFIRM_', '');
      confirmDeleteGoal(chatId, goalName);
    } else if (data.startsWith('DELETE_FINAL_')) {
      const goalName = data.replace('DELETE_FINAL_', '');
      simulateDeleteCommand(chatId, userId, goalName);
    } else if (data === 'MAIN_MENU') {
      goToMainMenu(chatId);
    } else if (data === 'COMMAND_SETGOAL') {
      promptNewGoalCreation(chatId);
    }
  } catch (error) {
    console.error(`Error processing callback query for user ${userId}:`, error.message);
    bot.sendMessage(chatId, '❗ An error occurred processing your request. Please try again.');
  }
});

// --- Callback Helpers ---

/**
 * Processes "Add to Goal" request flow
 */
function processAddToGoalRequest(chatId, userId, goalName) {
  try {
    lastInteractedGoal[userId] = goalName;
    saveUserData();
    
    bot.sendMessage(
      chatId, 
      `Okay! Now, how much would you like to add to "*${goalName}*"?\nJust type the amount, e.g., \`/add 15\`.`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error(`Error processing add to goal request for user ${userId}:`, error.message);
  }
}

/**
 * Simulates /progress command execution
 */
function simulateProgressCommand(chatId, userId, goalName) {
  const mockMsg = { chat: { id: chatId }, from: { id: userId }, text: `/progress ${goalName}` };
  bot.emit('text', mockMsg, [`/progress ${goalName}`, goalName]);
}

/**
 * Sends confirmation prompt before deleting a goal
 */
function confirmDeleteGoal(chatId, goalName) {
  try {
    bot.sendMessage(
      chatId, 
      `❓ Are you sure you want to delete goal "*${goalName}*"? This action cannot be undone.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Yes, Delete it', callback_data: `DELETE_FINAL_${goalName}` }],
            [{ text: '❌ No, Keep it', callback_data: 'MAIN_MENU' }]
          ]
        },
        parse_mode: 'Markdown'
      }
    );
  } catch (error) {
    console.error(`Error confirming delete goal for chat ${chatId}:`, error.message);
  }
}

/**
 * Simulates /delete command execution
 */
/**
 * Deletes a goal for a user (shared logic)
 */
function deleteGoalForUser(userId, goalName) {
  if (!userGoals[userId] || userGoals[userId].length === 0) {
    return { success: false, message: 'You have no active goals to delete.' };
  }

  const goalIndex = userGoals[userId].findIndex(
    g => g.name.toLowerCase() === goalName.toLowerCase()
  );

  if (goalIndex === -1) {
    return { success: false, message: `Goal "${goalName}" not found.` };
  }

  const deletedGoal = userGoals[userId].splice(goalIndex, 1)[0];
  
  if (
    lastInteractedGoal[userId] &&
    lastInteractedGoal[userId].toLowerCase() === deletedGoal.name.toLowerCase()
  ) {
    delete lastInteractedGoal[userId];
  }
  
  saveUserData();
  return { 
    success: true, 
    message: `Goal "${deletedGoal.name}" has been deleted.`,
    goal: deletedGoal
  };
}

// Then update the /delete handler:
bot.onText(/\/delete (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const goalNameToDelete = match[1].trim();

  try {
    const result = deleteGoalForUser(userId, goalNameToDelete);
    
    if (!result.success) {
      return bot.sendMessage(chatId, `🚫 ${result.message}`, { parse_mode: 'Markdown' });
    }

    bot.sendMessage(
      chatId,
      `🗑️ Goal "*${result.goal.name}*" (target: *$${result.goal.target.toFixed(2)}*) has been deleted.`,
      { ...mainMenuKeyboard, parse_mode: 'Markdown' }
    );
    
    console.log(`Goal "${result.goal.name}" deleted for user ${userId}`);
  } catch (error) {
    console.error(`Error deleting goal for user ${userId}:`, error.message);
    bot.sendMessage(chatId, '❗ Failed to delete goal. Please try again.');
  }
});

// And update the callback handler:
function simulateDeleteCommand(chatId, userId, goalName) {
  try {
    const result = deleteGoalForUser(userId, goalName);
    
    if (!result.success) {
      return bot.sendMessage(chatId, `🚫 ${result.message}`, { parse_mode: 'Markdown' });
    }

    bot.sendMessage(
      chatId,
      `🗑️ Goal "*${result.goal.name}*" (target: *$${result.goal.target.toFixed(2)}*) has been deleted.`,
      { ...mainMenuKeyboard, parse_mode: 'Markdown' }
    );
    
    console.log(`Goal "${result.goal.name}" deleted for user ${userId}`);
  } catch (error) {
    console.error(`Error in delete simulation for user ${userId}:`, error.message);
    bot.sendMessage(chatId, '❗ Failed to delete goal. Please try again.');
  }
}
/**
 * Returns user to main menu
 */
function goToMainMenu(chatId) {
  try {
    bot.sendMessage(
      chatId, 
      '🏡 Back to Main Menu!', 
      { ...mainMenuKeyboard, parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error(`Error going to main menu for chat ${chatId}:`, error.message);
  }
}

/**
 * Prompts user to initiate new goal creation
 */
function promptNewGoalCreation(chatId) {
  try {
    bot.sendMessage(
      chatId,
      'Okay, let\'s set a new goal! Please type `/setgoal <name> <amount>` (e.g., `/setgoal Dream Vacation 1200`).',
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error(`Error prompting new goal creation for chat ${chatId}:`, error.message);
  }
}

// --- Startup ---
loadUserData();
console.log('Bot started successfully and listening for messages...');