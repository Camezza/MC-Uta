import { midi } from './src/midi';
import { minecraft } from './src/minecraft';
import * as mineflayer from 'mineflayer';

let options = {
    host: `192.168.0.51`,
    port: 50675,
    username: `Uta`,
    version: `1.16.4`,
};

let bot = mineflayer.createBot(options);
const minecraft_plugin = new minecraft.plugin(bot, true);

bot.once('login', () => {
    setTimeout(() => {
        if (bot.game.gameMode === 'survival') {
            let note_blocks = minecraft_plugin.retreiveNearbyNoteBlocks();
            minecraft_plugin.playNoteBlockSong('midi/bad_apple.mid', note_blocks);
        }
    }, 3000);
});

bot.on('noteHeard', (block, instrument, pitch) => {
    console.log(`[${instrument.name}] Located at ${block.position} with pitch ${pitch}`);
})
