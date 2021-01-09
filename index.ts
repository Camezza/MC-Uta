import { midi_plugin } from './src/midi';
const midi = new midi_plugin(true);
let data = midi.readMidiFile('midi/this_game.mid');
console.log(data.tracks[0].notes);