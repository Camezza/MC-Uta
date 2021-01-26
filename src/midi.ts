import { Midi } from '@tonejs/midi';
import * as fs from 'fs';
const timsort = require('timsort');

export namespace midi {

    export type song_event = 'start' | 'end' | 'pause' | 'error';

    export class note {
        public key: number;
        public ticks: number;
        public difference: number;

        constructor(key: number, ticks: number, difference: number) {
            this.key = key;
            this.ticks = ticks;
            this.difference = difference;
        }
    }

    export class sequence {
        public tempo: number;
        public ticks: number;
        public notes: note[];

        constructor(tempo: number, ticks: number, notes?: note[]) {
            this.tempo = tempo;
            this.ticks = ticks;
            this.notes = notes || [];
        }

        public retreiveNotes(): note[] {
            return [...this.notes];
        }

        public setNotes(notes: note[]) {
            this.notes = [...notes];
        }
    }

    export class song {
        public title: string;
        public ppq: number;
        private sequences: sequence[];

        // Generates an object that holds sequences of a midi files
        constructor(title: string, ppq: number, sequences?: sequence[]) {
            this.title = title;
            this.ppq = ppq;
            this.sequences = sequences || [];
        }

        public retreiveSequences(): sequence[] {
            return [...this.sequences];
        }

        public setSequences(sequences: sequence[]) {
            this.sequences = sequences;
        }
    }

    export class plugin {
        private debug: boolean;
        public pauseSong: () => void;

        constructor(debug?: boolean) {
            this.debug = debug || false;
            this.pauseSong = () => { };
        }

        // Logs detailed messages to the console if debugging is enabled
        private async log(message: string, header?: string, error?: boolean) {
            header = header || "Log";
            error = error || false;

            // Only log messages during debugging
            if (this.debug) {
                console.log(`\x1b[35m[${header}] \x1b[0m${error ? '\x1b[31m' : '\x1b[2m'}${message}\x1b[0m`);
            }
        }

        // Generates the notes used in sequences
        private generateNotes(midi: Midi) {
            let tracks = midi.tracks;
            let data: Array<number[]> = [];
            let notes: note[] = [];

            // Get all notes & ticks from each track and place into seperate arrays
            for (let i = 0, il = tracks.length; i < il; i++) {
                let track = tracks[i];

                // Add notes & ticks to arrays
                for (let x = 0, xl = track.notes.length; x < xl; x++) {
                    data.push([track.notes[x].midi, track.notes[x].ticks]); // push array [midi, ticks]
                }
            }

            // Define comparison for timsort
            let comparison = (a: number[], b: number[]): number => {
                return a[1] - b[1];
            }

            // Use timsort algorithm to sort the masses of notes quickly
            timsort.sort(data, comparison);

            // Create note objects for sorted data
            for (let i = 0, il = data.length; i < il; i++) {
                let object = data[i]; // get the [midi, ticks] from data
                let note_object: note;

                // Not the last element
                if (i < il - 1) {
                    let next_object = data[i + 1];
                    let tick_difference = next_object[1] - object[1];
                    note_object = new note(object[0], object[1], tick_difference);
                }

                // Last element
                else note_object = new note(object[0], object[1], 0);
                notes.push(note_object);
            }
            this.log(`Generated a total of ${notes.length} notes from midi '${midi.name}'.`, 'generateNotes');
            return notes;
        }

        // Generates a sequence_object for each tempo change in the song and assigns notes within its duration
        private generateSequences(midi: Midi, notes: note[]) {
            let sequences: sequence[] = [];
            let tempos = midi.header.tempos;
            let sorting_notes = [...notes];

            // Get previous sequence notes from a sequences ticks
            let get_previous_sequence_notes = (ticks: number): note[] => {
                let sequence_notes: note[] = [];
                let note_object = sorting_notes.shift();

                // Less ticks than sequence ticks
                while (note_object && note_object.ticks < ticks) {
                    sequence_notes.push(note_object);
                    note_object = sorting_notes.shift();
                }

                return sequence_notes;
            }

            // Create sequences from tempos and add notes
            for (let i = 0, il = tempos.length; i < il; i++) {
                let tempo = tempos[i];
                let sequence_object: sequence;

                // Not the last sequence
                if (i < il - 1) {
                    let next_tempo = tempos[i + 1];
                    sequence_object = new sequence(tempo.bpm, tempo.ticks, get_previous_sequence_notes(next_tempo.ticks));
                }

                // Last sequence, add remaining notes
                else {
                    sequence_object = new sequence(tempo.bpm, tempo.ticks, notes);
                }
                sequences.push(sequence_object);
            }

            this.log(`Created a total of ${sequences.length} sequences from ${notes.length} notes.`, 'generateSequences');
            return sequences;
        }

        // Generates the contents of a storable json file used to read songs
        public generateSongData(midi: Midi, title: string): song {
            let song_object = new song(title, midi.header.ppq);
            let notes = this.generateNotes(midi);
            let sequences = this.generateSequences(midi, notes); 
            song_object.setSequences(sequences); 
            this.log(`Generated song data for '${title}'.`, 'generateSongData');
            return song_object;
        }

        // Reads data from a midi file & returns its contents
        public readMidiFile(path: string): Midi {
            let midi_data = fs.readFileSync(path);
            let midi = new Midi(midi_data);
            this.log(`Read data from midi file '${path}'.`, 'readMidiFile');
            return midi;
        }

        // Gets an array of keys that are used in a song
        public retreiveKeyRange(song_object: song): number[] {
            let notes: note[] = [];
            let notes_used: number[] = [];
            let sequences = song_object.retreiveSequences();

            // Grab all notes from the song
            for (let i = 0, il = sequences.length; i < il; i++) {
                let sequence_object = sequences[i];
                notes = [...notes, ...sequence_object.retreiveNotes()];
            }

            // fill array of notes used
            for (let i = 0, il = notes.length; i < il; i++) {
                let note_object = notes[i];
                if (!notes_used.includes(note_object.key)) {
                    notes_used.push(note_object.key);
                }
            }

            this.log(`Retreived ${notes_used.length} keys currently used in song '${song_object.title}'`, 'retreiveKeysUsed');
            return notes_used;
        }

        public async playSong(song_object: song, play_event_callback: (note_object: note) => void, cb?: (reason: song_event, song_object: song) => void) {
            let pause = false;
            let callback = cb || function () { };
            let sequences = song_object.retreiveSequences();

            this.pauseSong = () => {
                pause = true;
            }
            callback('start', song_object);

            // Cannot use for loop as it will all be executed at once.
            for (let i = 0, il = sequences.length; i < il; i++) {
                let sequence_object = sequences[i];
                let notes = sequence_object.retreiveNotes();
                let played_notes = 0;
                let maximum_notes = notes.length;
                let note_object = notes.shift();
                this.log(`Loading sequence with ${sequence_object.ticks} ticks and ${sequence_object.tempo} bpm`, 'playSong');

                // Repeats whenever a new note_object is to be played
                while (note_object !== undefined) {

                    // Pause boolean has been set to true
                    if (pause) {
                        this.log(`Song '${song_object.title}' was paused`, 'playSong');
                        callback('pause', new song(song_object.title, song_object.ppq, sequences));
                        return; // terminate
                    }

                    let last_note = note_object;
                    let next_note = () => {
                        return new Promise<note | undefined>(
                            (resolve) => {
                                setTimeout(() => resolve(notes.shift()), last_note.difference * (60000 / (sequence_object.tempo * song_object.ppq)));
                            }
                        )
                    }

                    this.log(`Note '${note_object.key}' was played`, 'playSong');
                    play_event_callback(note_object);
                    played_notes++;
                    note_object = await next_note();
                }

                // Song was unsuccessful in playing (Notes are still remaining)
                if (played_notes < maximum_notes) {
                    callback('error', new song(song_object.title, song_object.ppq, sequences));
                }
            }

            // Song finished successfully
            callback('end', song_object);
        }
    }
}