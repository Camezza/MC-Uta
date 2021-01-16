import { midi } from './src/midi';
const plugin = new midi.plugin();
let data = plugin.readMidiFile('midi/night_of_nights.mid');
plugin.generateSongFile(data, 'songs', "night_of_nights", "Night of Nights");