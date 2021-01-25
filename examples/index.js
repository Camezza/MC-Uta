import { mc_uta } from 'mc-uta';
import * as mineflayer from 'mineflayer';

let bot = mineflayer.createbot({
username: "robo",
});

let uta = mc_uta.plugin(bot);

bot.once('login', () => 
setTimeout(() => {
let note_blocks = uta.retreiveNearbyNoteBlocks();
uta.playMidi('midi/teddybear.mid', note_blocks);
}, 5 * 1000));
