const { 
    Client, 
    GatewayIntentBits, 
    MessageFlags, 
    ContainerBuilder, 
    TextDisplayBuilder, 
    ButtonBuilder, 
    ActionRowBuilder, 
    ButtonStyle,
    ChannelType,
    PermissionFlagsBits
} = require('discord.js');
require('dotenv').config();

// Ensure required environment tokens are present before startup
if (!process.env.DISCORD_TOKEN || !process.env.TICKET_CATEGORY_ID) {
    console.error('❌ Error: Missing configuration parameters in your local .env file.');
    process.exit(1);
}

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ] 
});

client.once('ready', () => {
    console.log(`🚀 Ticket Bot is online as ${client.user.tag}!`);
});

// 1. Command to Deploy the Ticket Support Panel
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content === '!deploy-tickets') {
        // Only allow administrators to deploy the master ticket panel
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ You do not have permission to use this command.');
        }

        // Build the text message component (replaces message.content)
        const panelText = new TextDisplayBuilder()
            .setContent('# 🎫 Central Support Hub\nWelcome to our support department. If you are experiencing technical issues, billing discrepancies, or need general assistance, please initiate a secure support ticket below.');

        // Build the interactive button to trigger the ticket creation
        const openTicketBtn = new ButtonBuilder()
            .setCustomId('create_ticket_btn')
            .setLabel('Open Support Ticket')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('✉️');

        const actionRow = new ActionRowBuilder().addComponents(openTicketBtn);

        // Build the main UI Container wrapper (replaces standard embeds)
        const panelContainer = new ContainerBuilder()
            .setAccentColor(0x5865F2) // Discord Blurple
            .addComponents(panelText, actionRow);

        try {
            // Send the message using the mandatory V2 component flag
            await message.channel.send({
                components: [panelContainer],
                flags: [MessageFlags.IsComponentsV2] // Activates UI v2 features
            });
        } catch (error) {
            console.error('Failed to deploy ticket panel layout:', error);
        }
    }
});

// 2. Interaction Handler to Process the Ticket Button
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'create_ticket_btn') {
        // Defer response to prevent timeouts while creating channels
        await interaction.deferReply({ ephemeral: true });

        const guild = interaction.guild;
        const user = interaction.user;
        const ticketChannelName = `ticket-${user.username.toLowerCase()}`;

        try {
            // Create a secure private channel for the user and staff members
            const ticketChannel = await guild.channels.create({
                name: ticketChannelName,
                type: ChannelType.GuildText,
                parent: process.env.TICKET_CATEGORY_ID,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.ViewChannel], // Lock out regular users
                    },
                    {
                        id: user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory
                        ],
                    },
                ],
            });

            // Build out the specific ticket content text dashboard
            const welcomeText = new TextDisplayBuilder()
                .setContent(`## 🛠️ Ticket Active: #${ticketChannel.name}\nHello ${user}, thank you for contacting our support division.\n\n### 📝 Next Steps:\nDetail your query extensively below. Specify error codes, steps to reproduce, or invoice numbers where applicable. A support specialist will review this data shortly.`);

            const closeTicketBtn = new ButtonBuilder()
                .setCustomId('close_ticket_btn')
                .setLabel('Close Ticket')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔒');

            const ticketActionRow = new ActionRowBuilder().addComponents(closeTicketBtn);

            const ticketContainer = new ContainerBuilder()
                .setAccentColor(0x2ECC71) // Safe Green
                .addComponents(welcomeText, ticketActionRow);

            // Send the UI Container dashboard inside the freshly provisioned channel
            await ticketChannel.send({
                content: `${user} | Staff Notification`, // Tag to alert parties
                components: [ticketContainer],
                flags: [MessageFlags.IsComponentsV2]
            });

            // Inform the user through an ephemeral notification that their workspace is ready
            await interaction.editReply({
                content: `✅ Your secure workspace has been created here: ${ticketChannel}`
            });

        } catch (error) {
            console.error('Error establishing ticket node:', error);
            await interaction.editReply({
                content: '❌ Internal system error occurred while generating your support channel.'
            });
        }
    }

    // 3. Logic to delete the channel when Close is clicked
    if (interaction.customId === 'close_ticket_btn') {
        await interaction.reply({ content: '🔒 Closing this channel in 5 seconds...' });
        
        setTimeout(async () => {
            try {
                await interaction.channel.delete();
            } catch (err) {
                console.error('Failed to purge channel:', err);
            }
        }, 5000);
    }
});

client.login(process.env.DISCORD_TOKEN);
