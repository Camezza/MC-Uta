import { midi_plugin } from './src/midi';
const midi = new midi_plugin(true);
let data = midi.readMidiFile('midi/night_of_nights.mid');
midi.generateSongFile(data, 'songs', "night_of_nights", "Night of Nights");