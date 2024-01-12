require('dotenv/config');
const { Client } = require('discord.js')
const { OpenAI } = require('openai')

const client = new Client({
    intents: ['Guilds', 'GuildMembers', 'GuildMessages', 'MessageContent']
});

client.on('ready', () => {
    console.log('The bot is online.');
});

const IGNORE_PREFIX = "!";

/* CHANNELS = General, Bot */
const CHANNELS = ['1190528653256306780', '1190532406902542466']

const openai = new OpenAI({
    apiKey: process.env.OPENAI_KEY,
});



client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (message.content.startsWith(IGNORE_PREFIX)) return;
    if (message.content.startsWith("Turn Off")) {
        return;
    }
    if (!CHANNELS.includes(message.channelId) && !message.mentions.users.has(client.user.id)) return;
    if (message.content.trim() === "") return;


    await message.channel.sendTyping();

    const sendTypingInterval = setInterval(() => {
        message.channel.sendTyping();
    }, 5000)

    let conversation = [];
    conversation.push({
        role: 'system',
        content: 'You\'re a friendly discord chatbot'
    })

    let prevMessages = await message.channel.messages.fetch({ limit: 10 });
    prevMessages.reverse();

    prevMessages.forEach((msg) => {

        // If the msg's author was a bot and not our bot return
        if (msg.author.bot && msg.author.id !== client.user.id) return;
        if (msg.content.startsWith(IGNORE_PREFIX)) return;

        // Reformatting username to match OpenAI's requirements
        const username = msg.author.username.replace(/\s+/g, '_').replace(/[^\w\s]/gi, '');

        // If message belongs to our bot, treat as an assistant
        if (msg.author.id === client.user.id) {
            conversation.push({
                role: 'assistant',
                name: username,
                content: msg.content
            })

            return;
        }

        // If the message was written by the user, send it as such
        conversation.push({
            role: 'user',
            name: username,
            content: msg.content 
        })
    });

    const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: conversation,
    }).catch((error) => console.error('OpenAI Error:\n', error));

    clearInterval(sendTypingInterval);

    if (!response) {
        message.reply("I'm having some trouble with the GPT Api");
        return;
    }

    // Work around Discord's 2000 character limit for our replies
    const responseMessage = response.choices[0].message.content
    const chunkSizeLimit = 2000;

    for (let i = 0; i < responseMessage.length; i += chunkSizeLimit) {
        const chunk = responseMessage.substring(i, i+chunkSizeLimit);

        // Ensure all messages are sent in order
        await message.reply(chunk);
    }

    message.reply();
})

client.login(process.env.TOKEN);