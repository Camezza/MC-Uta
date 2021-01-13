import { Midi } from '@tonejs/midi';
import * as fs from 'fs';

/*
** Objects used in readable song files
*/

interface note_wrapper {
    key: number,
    ticks: number,
    difference: number,
}

interface sequence_wrapper {
    tempo: number,
    ticks: number,
    notes: note_wrapper[],
}

interface song_wrapper {
    title: string,
    sequences: sequence_wrapper[],
}

// Methods

class midi_plugin {
    debug: boolean

    constructor(debug: boolean) {
        this.debug = debug || false;
    }

    // Logs detailed messages to the console if debugging is enabled
    private log(message: string, header?: string, error?: boolean) {
        header = header || "Log";
        error = error || false;

        // Only log messages during debugging
        if (this.debug) {
            console.log(`\x1b[35m[${header}] \x1b[0m${error ? '\x1b[31m' : '\x1b[2m'}${message}\x1b[0m`);
        }
    }

    // Generates an object that holds sequences of a midi files
    private generateSongWrapper(title: string, sequences?: sequence_wrapper[]): song_wrapper {
        sequences = sequences || [];
        let song: song_wrapper = {
            title: title,
            sequences: sequences,
        }

        this.log(`Generated song wrapper with title '${title}'.`, 'generateSongWrapper');
        return song;
    }

    // Generates a sequence which contains the tempo, signature & notes for a particular part of the song.
    private generateSequenceWrapper(tempo: number, ticks: number, notes?: note_wrapper[]): sequence_wrapper {
        notes = notes || [];
        let sequence: sequence_wrapper = {
            tempo: tempo,
            ticks: ticks,
            notes: notes,
        };

        this.log(`Generated sequence wrapper with tempo ${tempo} & ${ticks} ticks.`, 'generateSequenceWrapper');
        return sequence;
    }

    // Generates a note which contains the key, ticks passed & difference in ticks until the next note is played.
    private generateNoteWrapper(key: number, ticks: number, difference: number): note_wrapper {
        let note: note_wrapper = {
            key: key,
            ticks: ticks,
            difference: difference,
        }

        this.log(`Generated node wrapper with key #${key} & difference ${difference} ticks.`, 'generateNoteWrapper');
        return note;
    }

    // Generates the contents of a storable json file used to read songs
    // In order to generate a song, we need to:

    // [Note creation]
    // - Convert notes to json wrapper format and place them into an array
    // - Sort notes by their ticks
    // - Set tick difference for sorted notes

    // [Sequence creation]
    // - Divide each tempo change into a sequence object
    // - Go through every note and place it into its respective sequence, correspondant to its ticks. (Use a loop for this.)

    private retreiveNotes(midi: Midi): note_wrapper[] {
        let tracks = midi.tracks;
        let notes: note_wrapper[] = [];

        // Get all notes from each track
        for (let i = 0, il = tracks.length; i < il; i++) {
            let track = tracks[i];

            // Convert notes to json wrapper
            for (let x = 0, xl = track.notes.length; x < xl; x++) {
                let note: note_wrapper = {
                    key: track.notes[x].midi,
                    ticks: track.notes[x].ticks,
                    difference: -1,
                };

                notes.push(note);
            }
        }

        // Put notes in order by ticks
        let sorted_notes: note_wrapper[] = [];
        let sorting_notes: note_wrapper[] = notes;

        // Continue until all notes are sorted
        while (sorting_notes.length > 0) {
            let remaining_notes: note_wrapper[] = []; // Required as cannot change the array being used in the for loop
            let smallest_note_index: number = 0;

            // Get the smallest note & remaining notes
            for (let i = 0, il = sorting_notes.length; i < il; i++) {
                let note: note_wrapper = sorting_notes[i];
                let smallest_note = sorting_notes[smallest_note_index];

                // Found a smaller note
                if (note.ticks < smallest_note.ticks || i === 0) {
                    smallest_note_index = i;
                }
            }

            // Add remaining notes that still need to be sorted (Not smallest)
            for (let i = 0, il = sorting_notes.length; i < il; i++) {
                if (i !== smallest_note_index) {
                    let note: note_wrapper = sorting_notes[i];
                    remaining_notes.push(note);
                }
            }

            sorted_notes.push(sorting_notes[smallest_note_index]);
            sorting_notes = remaining_notes; // Replace the array of notes needing to be sorted
        }

        // Add tick difference to each note
        for (let i = 0, il = sorted_notes.length - 1 < 1 ? 1 : sorted_notes.length - 1; i < il; i++) {
            let note: note_wrapper = sorted_notes[i];
            let next_note: note_wrapper = sorted_notes[i + 1];
            note.difference = next_note.ticks - note.ticks;
        }
        this.log(`Retreived ${sorted_notes.length} notes.`, 'retreiveNotes');
        return sorted_notes;
    }

    private retreiveSequences(midi: Midi, notes: note_wrapper[]): sequence_wrapper[] {
        let sequences: sequence_wrapper[] = [];
        let sorting_notes = notes;
        let tempos = midi.header.tempos;

        // Create a new sequence for every tempo change
        for (let i = 0, il = tempos.length; i < il; i++) {
            let tempo = tempos[i];
            let sequence: sequence_wrapper = {
                tempo: tempo.bpm,
                ticks: tempo.ticks,
                notes: []
            };
            sequences.push(sequence);
        }

        // Sort notes into each sequence
        for (let i = 0, il = sequences.length - 1 < 1 ? 1 : sequences.length - 1; i < il; i++) {
            let sequence = sequences[i];

            // Not the last sequence, able to get next sequence
            if (i < il - 1) {
                let next_sequence = sequences[i + 1];
                let note = sorting_notes.shift();

                while (note !== undefined && note.ticks < next_sequence.ticks) {
                    sequence.notes.push(note);
                    note = sorting_notes.shift();
                }
            }

            // Last element, no next sequence. Add remaining notes
            else {
                sequence.notes = sorting_notes;
            }
        }
        this.log(`Created a total of ${sequences.length} sequences from ${notes.length} notes.`, 'retreiveSequences');
        return sequences;
    }

    // Generates the contents of a storable json file used to read songs
    private generateSongData(midi: Midi, title: string): song_wrapper {
        let song = this.generateSongWrapper(title);
        let notes = this.retreiveNotes(midi);
        let sequences = this.retreiveSequences(midi, notes);
        song.title = title;
        song.sequences = sequences;
        this.log(`Generated song data for '${title}'.`, 'generateSongData');
        return song;
    }

    // Reads data from a midi file & returns its contents
    public readMidiFile(path: string): Midi {
        let midi_data = fs.readFileSync(path);
        let midi = new Midi(midi_data);
        this.log(`Read data from midi file '${path}'.`, 'readMidiFile');
        return midi;
    }

    // Generates a song file from a midi file
    public generateSongFile(midi: Midi, folder: string, filename: string, title: string) {
        let path = `${folder}/${filename}.json`;
        let data = this.generateSongData(midi, title);
        fs.writeFileSync(path, JSON.stringify(data), 'utf8');
        this.log(`Created song '${title}' at '${path}'`, 'generateSongFile');
    }
}

export { midi_plugin };