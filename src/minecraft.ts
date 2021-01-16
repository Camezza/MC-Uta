import * as mineflayer from 'mineflayer';
import * as vec3 from 'vec3';
import { midi } from './midi';
const plugin = new midi.plugin(true);

export namespace minecraft {

    type note_block_type = 'drum' | 'bass' | 'harp' | 'bell' | null;

    const note_block_bell = ['gold_block'];
    const note_block_bass = ['oak_planks', 'spruce_planks', 'birch_planks', 'acacia_planks', 'dark_oak_planks', 'jungle_planks']; // cannot be bothered adding them all. Someone fork & commit
    const note_block_drum = ['stone', 'netherrack'];
    const note_block_harp = ['air', 'note_block'];

    interface note_block_wrapper {
        key: number,
        type: note_block_type,
        block: string | null,
        position: vec3.Vec3 | null,
    }

    /*
    This class will need to do a number of things:
    - Recognise MIDI note values and be able to translate it to minecraft note-block sounds & pitches
    - Discover note blocks nearby and identify the block underneath to determine sound
    - Ability to 'tune' note blocks through listening for certain notes and right-clicking a certain amount of times
    - A way of reading song json files & matching the keys and tempo with note blocks
    - Play + Pause songs.
    - Automatically fix note inaccuracies while playing a song through retuning selected note blocks
    */

    export class plugin {
        private bot: mineflayer.Bot;
        private debug: boolean;

        constructor(bot: mineflayer.Bot, debug?: boolean) {
            this.bot = bot;
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

        private retreiveKeyType(key: number): note_block_type {
            let note_block: note_block_type;

            // Unable to cover 1+6 notes. (1, 83-88) (A0, G7-C8) 
            if (key > 82 || key < 2) {
                note_block = null;
            }

            // Bell needs to cover 24 notes. (G5-F#7) (Range: F#5-F#7) (59-82)
            else if (key > 58) {
                note_block = 'bell';
            }

            // Harp needs to cover 25 notes. (F#3-F#5) (Range: F#3-F#5) (34-58)
            else if (key > 33) {
                note_block = 'harp';
            }

            // Bass needs to cover 24 notes. (F#1-F3) (Range: F#1-F#3) (10-33)
            else if (key > 9) {
                note_block = 'bass';
            }

            // Drum needs to cover 8 notes. (A0-F1) (Range: A#0-A#2) (2-9) (Drum starts at A#0)
            else {
                note_block = 'drum';
            }
            return note_block;
        }

        private retreiveBlockType(note_block: note_block_type): note_block_block {
            let block: note_block_block;
            switch (note_block) {
                case 'bell':
                    block: note_block_bell = 'd';


            }
        }

        public generateNoteBlockWrapper(note: midi.note_wrapper): note_block_wrapper {
            let note_block: note_block_wrapper = {
                key: note.key,
                type: this.retreiveKeyType(note.key),
                block: null,
                position: null,
            }
            return note_block;
        }
    }
}