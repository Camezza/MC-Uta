import * as mineflayer from 'mineflayer';
import * as prismarine_block from 'prismarine-block';
import { type } from 'os';
import * as vec3 from 'vec3';
import { midi } from './midi';
import { resolve } from 'path';
const midi_plugin = new midi.plugin(true);

export namespace minecraft {

    type note_block_type = 'basedrum' | 'base' | 'harp' | 'bell' | null;
    type note_block_sound = 'block.note_block.basedrum' | 'block.note_block.base' | 'block.note_block.harp' | 'block.note_block.bell';

    const note_block_bell = ['gold_block'];
    const note_block_base = ['oak_planks', 'spruce_planks', 'birch_planks', 'acacia_planks', 'dark_oak_planks', 'jungle_planks']; // cannot be bothered adding them all. Someone fork & commit
    const note_block_basedrum = ['stone', 'netherrack']; // likewise!
    const note_block_harp = ['air', 'note_block']; // we probably don't need to use this in the future and instead can blacklist blocks that cause other sounds

    interface note_block_wrapper {
        key: number,
        type: note_block_type,
        block: string,
        position: vec3.Vec3,
    }

    /*
    This class will need to do a number of things:
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

        // Retreives the type of block needed to mimic an octave. (+20, as midi starts two octaves below standard piano)
        private retreiveKeyType(key: number): note_block_type {
            let note_block: note_block_type;

            // Unable to cover 1+6 notes. (1, 83-88) (A0, G7-C8) 
            if (key > 82 + 20 || key < 2 + 20) {
                note_block = null;
            }

            // Bell needs to cover 24 notes. (G5-F#7) (Range: F#5-F#7) (59-82)
            else if (key > 58 + 20) {
                note_block = 'bell';
            }

            // Harp needs to cover 25 notes. (F#3-F#5) (Range: F#3-F#5) (34-58)
            else if (key > 33 + 20) {
                note_block = 'harp';
            }

            // base needs to cover 24 notes. (F#1-F3) (Range: F#1-F#3) (10-33)
            else if (key > 9 + 20) {
                note_block = 'base';
            }

            // basedrum needs to cover 8 notes. (A0-F1) (Range: A#0-A#2) (2-9) (basedrum starts at A#0)
            else {
                note_block = 'basedrum';
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

                case 'base':
                    sound = 'block.note_block.base';
                    break;

                case 'basedrum':
                    sound = 'block.note_block.basedrum';
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
                    relative_key = key - 58 - 20;
                    break;

                case 'harp':
                    relative_key = key - 34 - 20;
                    break;

                case 'base':
                    relative_key = key - 10 - 20;
                    break;

                case 'basedrum':
                    relative_key = key - 2 - 20;
                    break;

                default:
                    this.log(`FATAL: Cannot determine pitch for type of 'null'.`, 'retreiveNoteBlockPitch', true);
                    throw (`Program terminated to prevent internal error. Please enable debugging for details.`);

            }
            pitch = 2 ** ((relative_key - 12) / 12);
            return pitch;
        }

        public generateNoteBlockWrapper(key: number, type: note_block_type, block: string, position: vec3.Vec3): note_block_wrapper {
            let note_block: note_block_wrapper = {
                key: key,
                type: type,
                block: block,
                position: position,
            }
            this.log(`Generated note block wrapper with key '${note_block.key}' and type '${note_block.type}'`, 'generateNoteBlockWrapper');
            return note_block;
        }

        // Gets nearby note blocks and assigns them to wrappers
        public retreiveNearbyNoteBlocks(): note_block_wrapper[] {
            let note_blocks: note_block_wrapper[] = [];
            let for_each_axis = (radius: number, method: (index: number) => void) => {
                let diameter = radius * 2;
                for (let i = -(diameter / 2), il = diameter / 2; i <= il; i++) {
                    method(i);
                }
            }

            for_each_axis(5, (x) =>
                for_each_axis(5, (y) =>
                    for_each_axis(5, (z) => {
                        let position = this.bot.entity.position.floor();
                        let block_position = position.offset(x, y, z);
                        //this.log(`Checking block at position (${block_position.x}, ${block_position.y}, ${block_position.z})`, 'retreiveNearbyNoteBlocks'); // spammy!

                        // Note block at position
                        if (this.bot.blockAt(block_position)?.name === 'note_block') {
                            let tone_block_position = block_position.offset(0, -1, 0);
                            let above_block_position = block_position.offset(0, 1, 0);
                            let tone_block_type = this.bot.blockAt(tone_block_position)?.name;
                            let above_block_type = this.bot.blockAt(above_block_position)?.name;

                            // Tone block below exists & air above note block
                            if (tone_block_type !== undefined && above_block_type === 'air') {
                                let note_block: note_block_wrapper;

                                // Bell
                                if (note_block_bell.includes(tone_block_type)) {
                                    note_block = this.generateNoteBlockWrapper(-1, 'bell', tone_block_type, block_position);
                                }

                                // base
                                else if (note_block_base.includes(tone_block_type)) {
                                    note_block = this.generateNoteBlockWrapper(-1, 'base', tone_block_type, block_position);
                                }

                                // basedrum
                                else if (note_block_basedrum.includes(tone_block_type)) {
                                    note_block = this.generateNoteBlockWrapper(-1, 'basedrum', tone_block_type, block_position);
                                }

                                // Harp
                                else {
                                    note_block = this.generateNoteBlockWrapper(-1, 'harp', tone_block_type, block_position);
                                }

                                note_blocks.push(note_block);
                            }
                        }
                    })));
            return note_blocks;
        }

        // Plays a note block. Returns true if it was successful and false if it was insuccessful.
        private playNoteBlock(note_block: note_block_wrapper): boolean {
            let position = note_block.position;
            let block = this.bot.blockAt(position);

            // note block exists
            if (block?.name === 'note_block') {
                this.bot._client.write('block_dig', {
                    status: 0,
                    location: position,
                    face: 1 // play noteblock from the top
                });
                return true;
            }

            else return false;
        }

        // Increments a note block's pitch by right-clicking it. Returns true if it was successful, and false if it was insuccessful.
        private incrementNoteBlock(note_block: note_block_wrapper): boolean {
            let position = note_block.position;
            let block = this.bot.blockAt(position);

            // note block exists
            if (block?.name === 'note_block') {
                this.bot.activateBlock(block);
                return true;
            }

            else return false;
        }

        // returns midi key types that were not assigned to note blocks
        private retreiveRequiredTypes(note_blocks: note_block_wrapper[], key_range: number[]): note_block_type[] {
            let remaining_note_block_types: note_block_type[] = [];
            let note_block_types: note_block_type[] = [];

            // Add all needed midi keys (types) to an array
            for (let i = 0, il = key_range.length; i < il; i++) {
                let key = key_range[i];
                let type = this.retreiveKeyType(key);
                remaining_note_block_types.push(type);
            }

            // Add all available note blocks (types) to an array
            for (let i = 0, il = note_blocks.length; i < il; i++) {
                let note_block = note_blocks[i];
                let type = note_block.type;
                note_block_types.push(type);
            }

            // set index
            let remaining_nb_index = 0;

            // match remaining types with available types
            while (remaining_nb_index < remaining_note_block_types.length) {
                let remaining_note_block_type = remaining_note_block_types[remaining_nb_index];
                let remaining_nb_length = remaining_note_block_types.length;
                let nb_index = 0;

                // available note block types
                while (nb_index < note_block_types.length) {
                    let note_block_type = note_block_types[nb_index];

                    // a note block is available for the midi key
                    if (remaining_note_block_type === note_block_type) {
                        remaining_note_block_types.splice(remaining_nb_index); // remove required midi key from remaining array
                        note_block_types.splice(nb_index); // remove the now unavailable note block type
                        break; // kill loop
                    }

                    else nb_index++;
                }

                // Array hasn't changed, move index up
                if (remaining_note_block_types.length === remaining_nb_length) {
                    remaining_nb_index++;
                }
            }

            // Return keys that were not assigned to note blocks
            this.log(`Found ${remaining_note_block_types.length} keys that were unable to be assigned to note blocks`, 'retreiveRequiredTypes');
            return remaining_note_block_types;
        }

        // Adds midi values to note block objects & returns null when there aren't enough note blocks for all the keys.
        private assignNoteBlockKeys(note_blocks: note_block_wrapper[], key_range: number[]): note_block_wrapper[] | null {
            let assigned_note_blocks: note_block_wrapper[] = [];
            let counter = 0;
            let required = key_range.length;

            // try for each midi key
            for (let i = 0; i < required; i++) {
                let key = key_range[i];
                let type = this.retreiveKeyType(key);

                // go through note block list
                // ToDo: remove note blocks from note_blocks array for performance
                for (let x = 0, xl = note_blocks.length; x < xl; x++) {
                    let note_block = note_blocks[x];

                    // noteblock has same sound, add
                    if (type === note_block.type && note_block.key === -1) {
                        assigned_note_blocks.push(this.generateNoteBlockWrapper(key, type, note_block.block, note_block.position));
                        counter++;
                        x = xl; // stop loop
                    }
                }
            }

            // there are enough note blocks for keys
            if (counter === required) {
                this.log(`Successfully assigned ${required} keys to note blocks.`, 'assignNoteBlockKeys');
                return assigned_note_blocks;
            }

            // not enough note blocks
            else {
                this.log(`ERROR: Not enough note blocks for midi key range! (${required - counter} required of ${required})`, 'assignNoteBlockKeys', true);
                return null;
            }
        }

        // TODO: FIX THIS!!!!!!!!!
        public async tuneNoteBlock(note_block: note_block_wrapper): Promise<note_block_wrapper | null> {
            return new Promise<note_block_wrapper | null>((resolve) => {
                let position = note_block.position;

                // Leaves a 50ms delay before incrementing a note block
                let increment_timeout = async (block: note_block_wrapper): Promise<boolean> => {
                    return new Promise<boolean> ((played) => {
                        setTimeout(() => played(this.incrementNoteBlock(block)), 50);
                    });
                }

                // Handles note block sounds when played
                let note_handler = async (block: prismarine_block.Block, instrument: mineflayer.Instrument, sound_key: number) => {
                    let sound_position = block.position;

                    // Sound sourced from same position as note block
                    if (position.equals(sound_position)) {
                        let sound_type = instrument.name;

                        // Same sound type
                        if (sound_type == note_block.type) {
                            let difference = sound_key - note_block.key;
                            let value = difference < 0 ? 24 + difference : difference;

                            // Tune note block
                            for (let i = 0, il = value; i < il; i++) {
                                let success = await increment_timeout(note_block);

                                if (!success) {
                                    resolve(null);
                                }
                            }

                            // Remove sound listener
                            this.bot.removeListener('noteHeard', note_handler);
                            resolve(note_block);
                        }
                    }
                }

                this.bot.on('noteHeard', note_handler);
                let success = this.playNoteBlock(note_block);

                if (!success) {
                    resolve(null);
                }
            });
        }

        // Plays a midi song using note blocks specified
        public async playNoteBlockSong(midi_path: string, note_blocks: note_block_wrapper[], callback?: (reason: midi.pause_reason, song?: midi.song_wrapper) => void, pause?: boolean) {
            let song_folder_path = './songs';
            let song_name = 'cache';

            // Generate song data for midi
            let data = midi_plugin.readMidiFile(midi_path);
            let file = midi_plugin.generateSongFile(data, song_folder_path, song_name, data.name);
            let song = midi_plugin.retreiveSongData(`${song_folder_path}/${song_name}.json`);

            // Gather nearby note blocks
            // not currently needed as we specify through note_blocks parameter

            // Verify that we have the required note blocks to play
            let midi_key_range = midi_plugin.retreiveKeysUsed(song);
            let required_types = this.retreiveRequiredTypes(note_blocks, midi_key_range);
            let verified_note_blocks = this.assignNoteBlockKeys(note_blocks, midi_key_range);

            console.log(required_types);

            // have enough note blocks for all required keys
            if (verified_note_blocks !== null) {

                // tune all note blocks
                for (let i = 0, il = verified_note_blocks.length; i < il; i++) {
                    let note_block = await this.tuneNoteBlock(verified_note_blocks[i]);

                    // error has occured, unable to tune note block
                    if (note_block === null) {
                        console.log("NOT SUCCESS");
                        // error callback?
                    }
                }

                // what to do when playing a note
                let play_event = (note: midi.note_wrapper) => {
                    let key = note.key;

                    // find the required note block & play note
                    for (let i = 0, il = note_blocks.length; i < il; i++) {
                        let note_block = note_blocks[i];

                        if (note_block.key === key) {
                            let success = this.playNoteBlock(note_block);

                            // Unable to play note block!
                            if (!success) {
                                console.log("NOT SUCCESS");
                                // pause song???
                                // error callback???
                            }
                        }
                    }
                }

                // play the song
                midi_plugin.playSong(song, play_event, callback);
            } // else error callback?
        }

        public test(song: midi.song_wrapper) {
            let note_handler = (note: midi.note_wrapper) => {
                if (note.key < 103 && note.key > 21) {
                    let pitch = this.retreiveNoteBlockPitch(note.key);
                    let sound = this.retreiveNoteBlockSound(this.retreiveKeyType(note.key));
                    this.bot.chat(`/playsound minecraft:${sound} ambient @a ~ ~ ~ 10 ${pitch}`);
                }
            }
            midi_plugin.playSong(song, note_handler);
        }

    }
}