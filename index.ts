import { midi } from './src/midi';
import { minecraft } from './src/minecraft';
import * as mineflayer from 'mineflayer';

let options = {
    host: `192.168.0.51`,
    port: 50426,
    username: `Uta`,
    version: `1.16.4`,
};

let bot = mineflayer.createBot(options);

const midi_plugin = new midi.plugin();
const minecraft_plugin = new minecraft.plugin(bot, true);
let data = midi_plugin.readMidiFile('midi/bad_apple.mid');
let file = midi_plugin.generateSongFile(data, 'songs', "bad_apple", "bad_apple");
let song = midi_plugin.retreiveSongData('songs/bad_apple.json');

bot.once('login', () => {
    minecraft_plugin.test(song);
})
