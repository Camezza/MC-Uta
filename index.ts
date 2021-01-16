import { midi } from './src/midi';
const plugin = new midi.plugin();
let data = midi.readMidiFile('midi/night_of_nights.mid');
midi.generateSongFile(data, 'songs', "night_of_nights", "Night of Nights");