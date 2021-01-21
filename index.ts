import { midi } from './src/midi';
import { minecraft } from './src/minecraft';
import * as mineflayer from 'mineflayer';

let options = {
    host: `192.168.0.51`,
    port: 50760,
    username: `Uta`,
    version: `1.16.4`,
};

let bot = mineflayer.createBot(options);
const minecraft_plugin = new minecraft.plugin(bot, true);

bot.once('login', () => {
    setTimeout(() => {
        if (bot.game.gameMode === 'survival') {
            let note_blocks = minecraft_plugin.retreiveNearbyNoteBlocks();
            minecraft_plugin.playNoteBlockSong('midi/this_game.mid', note_blocks, (reason) => {console.log(`Midi was paused: ${reason}`)});
        }
    }, 3000);
});