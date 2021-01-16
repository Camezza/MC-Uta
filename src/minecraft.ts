import * as mineflayer from 'mineflayer';
import { type } from 'os';
import * as vec3 from 'vec3';
import { midi } from './midi';
const plugin = new midi.plugin(true);

export namespace minecraft {

    type note_block_type = 'drum' | 'bass' | 'harp' | 'bell' | null;
    type note_block_sound = 'block.note_block.bassdrum' | 'block.note_block.bass' | 'block.note_block.harp' | 'block.note_block.bell';

    type note_block_bell = 'gold_block';
    type note_block_bass = 'oak_planks' | 'spruce_planks' | 'birch_planks' | 'acacia_planks' | 'dark_oak_planks' | 'jungle_planks'; // cannot be bothered adding them all. Someone fork & commit
    type note_block_drum = 'stone' | 'netherrack'; // likewise!
    type note_block_harp = 'air' | 'note_block'; // we probably don't need to use this in the future and instead can blacklist blocks that cause other sounds

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
                console.log(`\x1b[32m[${header}] \x1b[0m${error ? '\x1b[31m' : '\x1b[2m'}${message}\x1b[0m`);
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

        private retreiveNoteBlockSound(note_block: note_block_type): note_block_sound {
            let sound: note_block_sound;
            switch (note_block) {
                case 'bell':
                    sound = 'block.note_block.bell';
                    break;

                case 'harp':
                    sound = 'block.note_block.harp';
                    break;

                case 'bass':
                    sound = 'block.note_block.bass';
                    break;

                case 'drum':
                    sound = 'block.note_block.bassdrum';
                    break;

                default:
                    this.log(`FATAL: Cannot determine sound for type of 'null'.`, 'retreiveNoteBlockSound', true);
                    throw (`Program terminated to prevent internal error. Please enable debugging for details.`);
            }
            return sound;
        }

        private retreiveNoteBlockPitch(key: number): number {
            let pitch: number;
            let note_block = this.retreiveKeyType(key);
            let relative_key;

            // Find the relative key (0-24) for a note block & determine the pitch from that value
            switch (note_block) {
                case 'bell':
                    relative_key = key - 58;
                    break;

                case 'harp':
                    relative_key = key - 34;
                    break;

                case 'bass':
                    relative_key = key - 10;
                    break;

                case 'drum':
                    relative_key = key - 2;
                    break;

                default:
                    this.log(`FATAL: Cannot determine pitch for type of 'null'.`, 'retreiveNoteBlockPitch', true);
                    throw (`Program terminated to prevent internal error. Please enable debugging for details.`);                    

            }
            pitch = 2^((relative_key - 12)/12);
            return pitch;
        }

        public generateNoteBlockWrapper(key: number, type: note_block_type, block?: string | null, position?: vec3.Vec3 | null): note_block_wrapper {
            let note_block: note_block_wrapper = {
                key: key,
                type: this.retreiveKeyType(key),
                block: block || null,
                position: position || null,
            }
            this.log(`Generated note block wrapper with key '${note_block.key}' and type '${note_block.type}'`, 'generateNoteBlockWrapper');
            return note_block;
        }

    }
}