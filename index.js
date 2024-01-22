require('dotenv/config');
const { Client } = require('discord.js');
const { OpenAI } = require('openai');

const client = new Client({
    intents: ['Guilds', 'GuildMembers', 'GuildMessages', 'MessageContent']
});

client.on('ready', () => {
    console.log('The bot is online.');
});

const IGNORE_PREFIX = "!";
const CHANNELS = ['1190528653256306780', '1190532406902542466']
const openai = new OpenAI({
    apiKey: process.env.OPENAI_KEY,
});

// Select gpt version being used
const gptVersion = "gpt-4-1106-preview";

// Create gpt assistant
async function createAssistant() {
    try {
        const assistant = await openai.beta.assistants.create({
            name: "Discord Chatbot",
            instructions: "You are a friendly discord chatbot. Be thoughtful and kind in your responses :)",
            tools: [{ type: "code_interpreter" }],
            model: gptVersion,
        });

        // Additional code to use 'assistant' goes here
        console.log("Assistant created:", assistant);
    } catch (error) {
        console.error("Error creating assistant:", error);
    }
}

createAssistant();

client.on('messageCreate', async (message) => {

    if (message.author.bot || message.content.startsWith(IGNORE_PREFIX)) return;
    if (!CHANNELS.includes(message.channelId) && !message.mentions.users.has(client.user.id)) return;
    if (message.content.trim() === "") return;

    await message.channel.sendTyping();

    const sendTypingInterval = setInterval(() => {
        message.channel.sendTyping();
    }, 5000);

    // Fetch previous messages for context
    let prevMessages = await message.channel.messages.fetch({ limit: 10 });
    prevMessages = prevMessages.reverse();

    // Create a thread
    const thread = await openai.beta.threads.create();

    // Add previous messages to the thread
    for (let msg of prevMessages.values()) {
        if (msg.author.bot && msg.author.id !== client.user.id) continue;
        if (msg.content.startsWith(IGNORE_PREFIX)) continue;
        if (msg.length == 0) continue;
        const content = msg.content;

        await openai.beta.threads.messages.create(thread.id, {
            role: "user",
            content: content,
        });
    }

    // Add the current message to the thread
    await openai.beta.threads.messages.create(thread.id, {
        role: 'user',
        content: message.content
    });

    // Get a response from the assistant
    const run = await openai.beta.threads.runs.create(thread.id, {
        assistant_id: assistant.id,
    });

    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);

    // Polling mechanism for runStatus completion
    while (runStatus.status !== 'completed') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    }

    // Get the last assistant message
    const messages = await openai.beta.threads.messages.list(thread.id);
    const lastMessageForRun = messages.data.filter(
        message => message.run_id === run.id && message.role === 'assistant'
    ).pop();

    clearInterval(sendTypingInterval);

    // Reply with the assistant's message
    if (lastMessageForRun) {

        // Convert lastMessageForRun into a string
        const responseMessage = lastMessageForRun.content[0].text.value

        // Handle Discord's character limit
        const chunkSizeLimit = 2000;

        for (let i = 0; i < responseMessage.length; i += chunkSizeLimit) {
            const chunk = responseMessage.substring(i, i + chunkSizeLimit);
            await message.reply(chunk);
        }
    } else {
        message.reply("I'm having some trouble understanding that.");
    }
});

client.login(process.env.TOKEN);
