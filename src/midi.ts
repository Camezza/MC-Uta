import { Midi } from '@tonejs/midi';
import * as fs from 'fs';
import { stringify } from 'querystring';

// Objects used in readable song files

interface note_wrapper {
    key: number,
    ticks: number,
    difference: number,
}

interface sequence_wrapper {
    tempo: number,
    signature: [number, number],
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
            console.log(`\x1b[35m$[${header}] \x1b[0m${error ? '\x1b[31m' : "\x1b[2m"}${message}\x1b[0m`);
        }
    }

    // Generates an object that holds sequences of a midi files
    private generateSongWrapper(title: string, sequences?: sequence_wrapper[]): song_wrapper {
        sequences = sequences || [];
        let song: song_wrapper = {
            title: title,
            sequences: sequences,
        }

        this.log(`Successfully generated song wrapper with title '${title}'.`, 'generateSongWrapper');
        return song;
    }

    // Generates a sequence which contains the tempo, signature & notes for a particular part of the song.
    private generateSequenceWrapper(tempo: number, signature: [number, number], notes?: note_wrapper[]): sequence_wrapper {
        notes = notes || [];
        let sequence: sequence_wrapper = {
            tempo: tempo,
            signature: signature,
            notes: notes,
        };

        this.log(`Successfully generated sequence wrapper with tempo ${tempo} & signature ${signature[0]}/${signature[1]}.`, 'generateSequenceWrapper');
        return sequence;
    }

    // Generates a note which contains the key, ticks passed & difference in ticks until the next note is played.
    private generateNoteWrapper(key: number, ticks: number, difference: number): note_wrapper {
        let note: note_wrapper = {
            key: key,
            ticks: ticks,
            difference: difference,
        }

        this.log(`Successfully generated node wrapper with key #${key} & difference ${difference} ticks.`);
        return note;
    }

    // Reads data from a midi file & returns its contents
    public readMidiFile(path: string): Midi {
        let midi_data = fs.readFileSync(path);
        let midi = new Midi(midi_data);
        return midi;
    }

    // Generates a song file from a midi file
    public generateSongFile(data: Midi, title: string, filename: string) {
        let path = `midi/${filename}.json`;
        //fs.writeFileSync(path, );
    }
}

export { midi_plugin };