import { Midi } from '@tonejs/midi';
import * as fs from 'fs';

export namespace midi {

    export type pause_reason = 'end' | 'error' | 'manual';

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
        private debug: boolean

        constructor(debug?: boolean) {
            this.debug = debug || false;
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

        // Generates the contents of a storable json file used to read songs
        // This is probably the biggest bottleneck in performance
        // ToDo: make this more efficicent
        private generateNotes(midi: Midi): note[] {
            let tracks = midi.tracks;
            let notes: note[] = [];

            // Get all notes from each track
            for (let i = 0, il = tracks.length; i < il; i++) {
                let track = tracks[i];

                // Convert notes to json wrapper
                for (let x = 0, xl = track.notes.length; x < xl; x++) {
                    let updated_key = track.notes[x].midi; // Pianos have 88 keys - midi has 128. Minus 20 to match piano range, as only piano songs will be imported.
                    let note_object = new note(updated_key, track.notes[x].ticks, -1);
                    notes.push(note_object);
                }
            }

            // Put notes in order by ticks
            let sorted_notes: note[] = [];
            let sorting_notes: note[] = notes;

            // Continue until all notes are sorted
            while (sorting_notes.length > 0) {
                let remaining_notes: note[] = []; // Required as cannot change the array being used in the for loop
                let smallest_note_index: number = 0;

                // Get the smallest note & remaining notes
                for (let i = 0, il = sorting_notes.length; i < il; i++) {
                    let note_object: note = sorting_notes[i];
                    let smallest_note = sorting_notes[smallest_note_index];

                    // Found a smaller note_object
                    if (note_object.ticks < smallest_note.ticks || i === 0) {
                        smallest_note_index = i;
                    }
                }

                // Add remaining notes that still need to be sorted (Not smallest)
                for (let i = 0, il = sorting_notes.length; i < il; i++) {
                    if (i !== smallest_note_index) {
                        let note_object: note = sorting_notes[i];
                        remaining_notes.push(note_object);
                    }
                }

                sorted_notes.push(sorting_notes[smallest_note_index]);
                sorting_notes = remaining_notes; // Replace the array of notes needing to be sorted
            }

            // Add tick difference to each note_object
            for (let i = 0, il = sorted_notes.length - 1 < 1 ? 1 : sorted_notes.length - 1; i < il; i++) {
                let note_object: note = sorted_notes[i];
                let next_note: note = sorted_notes[i + 1];
                note_object.difference = next_note.ticks - note_object.ticks;
            }
            this.log(`Generated ${sorted_notes.length} notes.`, 'generateNotes');
            return sorted_notes;
        }

        // Generates a sequence_object for each tempo change in the song and assigns notes within its duration
        private generateSequences(midi: Midi, notes: note[]): sequence[] {
            let sequences: sequence[] = [];
            let sorting_notes = notes;
            let tempos = midi.header.tempos;

            // Create a new sequence_object for every tempo change
            for (let i = 0, il = tempos.length; i < il; i++) {
                let tempo = tempos[i];
                let sequence_object = new sequence(tempo.bpm, tempo.ticks);
                sequences.push(sequence_object);
            }

            // Sort notes into each sequence_object
            for (let i = 0, il = sequences.length; i < il; i++) {
                let sequence_object = sequences[i];

                // Not the last sequence_object, able to get next sequence_object
                if (i < il - 1) {
                    let next_sequence = sequences[i + 1];
                    let note_object = sorting_notes.shift();

                    while (note_object !== undefined && note_object.ticks < next_sequence.ticks) {
                        sequence_object.setNotes([...sequence_object.retreiveNotes(), note_object]);
                        note_object = sorting_notes.shift();
                    }
                }

                // Last element, no next sequence_object. Add remaining notes
                else {
                    sequence_object.setNotes(sorting_notes);
                }
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

        public async playSong(song_object: song, play_event_callback: (note_object: note) => void, cb?: (reason: pause_reason, song_object: song) => void, get_pause?: () => boolean) {
            let pause = get_pause || function () { return false }
            let callback = cb || function () { };
            let sequences = song_object.retreiveSequences();

            // Cannot use for loop as it will all be executed at once.
            for (let i = 0, il = sequences.length; i < il; i++) {
                let sequence_object = sequences[i];
                let tempo = sequence_object.tempo;
                let notes = sequence_object.retreiveNotes();
                let note_object = notes.shift();
                this.log(`Loading sequence with ${sequence_object.ticks} ticks and ${sequence_object.tempo} bpm`, 'playSong');

                // Repeats whenever a new note_object is to be played
                while (note_object !== undefined) {

                    // Pause boolean has been set to true
                    if (pause()) {
                        this.log(`Song '${song_object.title}' was paused`, 'playSong');
                        callback('manual', new song(song_object.title, song_object.ppq, sequences));
                        return; // terminate
                    }

                    let last_note = note_object;
                    let next_note = () => {
                        return new Promise<note | undefined>(
                            (resolve) => {
                                setTimeout(() => resolve(notes.shift()), last_note.difference * (60000 / (tempo * song_object.ppq)));
                            }
                        )
                    }

                    this.log(`Note '${note_object.key}' was played`, 'playSong');
                    play_event_callback(note_object);
                    note_object = await next_note();
                }

                // Song was unsuccessful in playing (Notes are still remaining)
                if (notes.length < sequence_object.retreiveNotes().length) {
                    callback('error', new song(song_object.title, song_object.ppq, sequences));
                }
            }

            // Song finished successfully
            callback('end', song_object);
        }
    }
}