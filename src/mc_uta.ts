import * as mineflayer from 'mineflayer';
import * as prismarine_block from 'prismarine-block';
import * as vec3 from 'vec3';
import { midi } from './midi';

export namespace mc_uta {

    export type callback_reason = midi.song_event | 'missing';
    export type note_block_type = 'basedrum' | 'bass' | 'harp' | 'bell';
    export type note_block_sound = 'block.note_block.basedrum' | 'block.note_block.bass' | 'block.note_block.harp' | 'block.note_block.bell';

    const note_block_bell = ['gold_block'];
    const note_block_base = ['oak_planks', 'spruce_planks', 'birch_planks', 'acacia_planks', 'dark_oak_planks', 'jungle_planks']; // cannot be bothered adding them all. Someone fork & commit
    const note_block_basedrum = ['stone', 'netherrack']; // likewise!

    const note_block_sound = {
        basedrum: 'block.note_block.basedrum',
        bass: 'block.note_block.bass',
        harp: 'block.note_block.harp',
        bell: 'block.note_block.bell',
    };

    // Find the relative key (0-24) for a note block & determine the pitch from that value (-20, as midi starts two octaves below standard piano)
    const note_block_relative_key_offset = {
        bell: -58 - 20,
        harp: -34 - 20,
        bass: -10 - 20,
        basedrum: -2 - 20,
    }

    export class note_block {
        public key: number;
        public type: note_block_type;
        public block: string;
        public position: vec3.Vec3;

        constructor(key: number, type: note_block_type, block: string, position: vec3.Vec3) {
            this.key = key;
            this.type = type;
            this.block = block;
            this.position = position;
        }
    }

    /*
    This class will need to do a number of things:
    - Play + Pause songs.
    - Automatically fix note inaccuracies while playing a song through retuning selected note blocks
    */

    export class plugin {
        private bot: mineflayer.Bot;
        private debug: boolean;
        private midi_plugin: midi.plugin;
        public pauseMidi: () => void;

        constructor(bot: mineflayer.Bot, debug?: boolean) {
            this.bot = bot;
            this.debug = debug || false;
            this.midi_plugin = new midi.plugin(this.debug);
            this.pauseMidi = () => { };
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
        private retreiveKeyType(key: number): note_block_type | null {
            let note_block_object: note_block_type | null;

            // Unable to cover 1+6 notes. (1, 83-88) (A0, G7-C8) 
            if (key > 82 + 20 || key < 2 + 20) {
                note_block_object = null;
            }

            // Bell needs to cover 24 notes. (G5-F#7) (Range: F#5-F#7) (59-82)
            else if (key > 58 + 20) {
                note_block_object = 'bell';
            }

            // Harp needs to cover 25 notes. (F#3-F#5) (Range: F#3-F#5) (34-58)
            else if (key > 33 + 20) {
                note_block_object = 'harp';
            }

            // bass needs to cover 24 notes. (F#1-F3) (Range: F#1-F#3) (10-33)
            else if (key > 9 + 20) {
                note_block_object = 'bass';
            }

            // basedrum needs to cover 8 notes. (A0-F1) (Range: A#0-A#2) (2-9) (basedrum starts at A#0)
            else {
                note_block_object = 'basedrum';
            }
            return note_block_object;
        }

        // Unused for now
        /*private retreiveNoteBlockPitch(key: number): number {
            let relative_key = this.retreiveNoteBlockRelativeKey(key);
            let pitch = 2 ** ((relative_key - 12) / 12);
            return pitch;
        }*/

        private generateNoteBlockWrapper(key: number, type: note_block_type, block: string, position: vec3.Vec3): note_block {
            let note_block_object: note_block = {
                key: key,
                type: type,
                block: block,
                position: position,
            }
            this.log(`Generated note block wrapper with key '${note_block_object.key}' and type '${note_block_object.type}'`, 'generateNoteBlockWrapper');
            return note_block_object;
        }

        // get number of available keys
        private retreiveRequiredTypes(note_blocks: note_block[], key_range: number[]): note_block_type[] {
            let note_types: note_block_type[] = ['basedrum', 'bass', 'harp', 'bell'];
            let available_types: Record<string, number> = { basedrum: 0, base: 0, harp: 0, bell: 0 };
            let required_types: Record<string, number> = { basedrum: 0, base: 0, harp: 0, bell: 0 };
            let types: note_block_type[] = [];

            // get the number of available keys
            note_blocks.forEach((note_block_object: note_block) => {
                let type = note_block_object.type;

                // only allow keys playable on note blocks
                if (type !== null) {
                    available_types[type]++;
                }
            });

            // Get the number of required keys
            key_range.forEach((key: number) => {
                let type = this.retreiveKeyType(key);

                // only allow keys playable on note blocks
                if (type !== null) {
                    required_types[type]++;
                }
            });

            let assigned_types: Record<string, number> = {
                basedrum: required_types.basedrum - available_types.basedrum,
                bass: required_types.bass - available_types.bass,
                harp: required_types.harp - available_types.harp,
                bell: required_types.bell - available_types.bell,
            };

            let add_duplicate_types = (type: note_block_type, count: number) => {
                count = count < 0 ? 0 : count;

                // Add duplicate types to array
                for (let i = 0, il = count; i < il; i++) {
                    types.push(type);
                }
            }

            for (let i = 0, il = note_types.length; i < il; i++) {
                let type = note_types[i];

                if (type !== null) {
                    add_duplicate_types(type, assigned_types[type]);
                }
            }
            return types;
        }

        private retreiveNoteBlockKeyRange(key_range: number[]): number[] {
            let note_block_key_range: number[] = [];
            for (let i = 0, il = key_range.length; i < il; i++) {
                let key = key_range[i];
                let type = this.retreiveKeyType(key);

                // Key can be played on a note block (Has type)
                if (type !== null) {
                    note_block_key_range.push(key);
                }
            }
            return note_block_key_range;
        }

        // Sorts note blocks by their type in a record
        private sortNoteBlocksByType(note_blocks: note_block[]): Record<string, note_block[]> {
            let sorted_note_blocks: Record<string, note_block[]> = { basedrum: [], bass: [], harp: [], bell: [] };

            // Sort each note block into type category
            note_blocks.forEach((note_block_object) => {
                let type = note_block_object.type;

                // add note blocks with same type to array
                if (type === null) throw new Error(`Unable to determine note block type 'null'`);
                sorted_note_blocks[type].push(note_block_object);
            });

            return sorted_note_blocks;
        }

        // Sorts note blocks by their key in a record
        private sortNoteBlocksByKeys(note_blocks: note_block[]): Record<number, note_block> {
            let sorted_note_blocks: Record<number, note_block> = {};

            // Add key entry for note block key
            note_blocks.forEach((note_block_object) => {
                let key = note_block_object.key;
                if (sorted_note_blocks[key]) throw new Error(`Note block array cannot contain duplicate key values`);
                sorted_note_blocks[key] = note_block_object;
            });

            return sorted_note_blocks;
        }

        private assignNoteBlockKeys(note_blocks: note_block[], key_range: number[]): note_block[] {
            let sorted_note_blocks = this.sortNoteBlocksByType(note_blocks);
            let assigned_note_blocks: note_block[] = [];

            for (let i = 0, il = key_range.length; i < il; i++) {
                let key = key_range[i];
                let type = this.retreiveKeyType(key);

                // Cannot assign key to note block without a type
                if (type === null) throw new Error(`Unable to determine note block type 'null'`);
                let unassigned_note_block = sorted_note_blocks[type].shift();

                // Not enough note blocks for all keys
                if (unassigned_note_block === undefined) {
                    this.log(`ERROR: Not enough note blocks for keys`, 'assignNoteBlockKeys', true);
                    throw new Error('Insufficient note blocks for key range');
                }

                // Assign key to note block and add to array
                else {
                    let assigned_note_block = this.generateNoteBlockWrapper(key, type, unassigned_note_block.block, unassigned_note_block.position);
                    assigned_note_blocks.push(assigned_note_block);
                    this.log(`Successfully assigned note key '${key}' to note block at ${assigned_note_block.position}.`, 'assignNoteBlockKeys');
                }
            };
            return assigned_note_blocks;
        }

        // Plays a note block. Returns true if it was successful and false if it was insuccessful.
        private async playNoteBlock(note_block_object: note_block): Promise<boolean> {
            return new Promise<boolean>((resolve) => {
                let position = note_block_object.position;
                let block = this.bot.blockAt(position);

                // note block exists
                if (block?.name === 'note_block') {
                    this.bot.lookAt(block.position.offset(0.5, 0.5, 0.5), false);
                    this.bot._client.write('block_dig', {
                        status: 0,
                        location: position,
                        face: 1 // play note block from the top
                    });
                    this.bot.swingArm();
                    resolve(true);
                }

                else resolve(false);
            })
        }

        // Increments a note block's pitch by right-clicking it. Returns true if it was successful, and false if it was insuccessful.
        private async incrementNoteBlock(note_block_object: note_block): Promise<boolean> {
            return new Promise<boolean>((resolve) => {
                let position = note_block_object.position;
                let block = this.bot.blockAt(position);

                // note block exists
                if (block?.name === 'note_block') {
                    this.bot.lookAt(block.position.offset(0.5, 0.5, 0.5), false);
                    this.bot._client.write('block_place', {
                        location: block.position,
                        direction: 1,
                        hand: 0,
                        cursorX: 0.5,
                        cursorY: 0.5,
                        cursorZ: 0.5,
                    });
                    this.bot.swingArm();
                    resolve(true);
                }

                else resolve(false);
            });
        }

        // TODO: Fix this spaghetti mess
        private async tuneNoteBlock(note_block_object: note_block): Promise<note_block | null> {
            return new Promise<note_block | null>((resolve) => {
                let position = note_block_object.position;

                // Leaves a 50ms delay before incrementing a note block
                let increment_timeout = async (block: note_block): Promise<boolean> => {
                    return new Promise<boolean>((played) => {
                        setTimeout(() => played(this.incrementNoteBlock(block)), 50);
                    });
                }

                // Handles note block sounds when played
                let note_handler = async (block: prismarine_block.Block, instrument: any, sound_key: number) => {
                    this.log(`Sound received: '${instrument.name}' with key '${sound_key}'`, 'tuneNoteBlocks');
                    let sound_position = block.position;

                    // Sound sourced from same position as note block
                    if (position.equals(sound_position)) {
                        let type = note_block_object.type
                        let sound_type = instrument.name;

                        // Same sound
                        if (sound_type == type) {
                            this.bot.removeListener('noteHeard', note_handler);
                            let difference = note_block_relative_key_offset[type] + note_block_object.key - sound_key;
                            let value = difference < 0 ? 25 + difference : difference;

                            // Tune note block
                            for (let i = 0, il = value; i < il; i++) {
                                let success = await increment_timeout(note_block_object);

                                // Tuning was unsuccessful; Unable to increment note block tone
                                if (!success) {
                                    this.log(`ERROR: Tuning insuccessful; Unable to increment note block tone`, 'tuneNoteBlock', true);
                                    resolve(null);
                                }
                            }

                            // Remove sound listener
                            this.log(`Successfully tuned note block with key '${note_block_object.key}' & type '${note_block_object.type}'`, 'tuneNoteBlock');
                            resolve(note_block_object);
                        }
                    }
                }

                this.bot.on('noteHeard', note_handler);
                let success = this.playNoteBlock(note_block_object);

                if (!success) {
                    resolve(null);
                }
            });
        }

        // Gets nearby note blocks and assigns them to wrappers
        public retreiveNearbyNoteBlocks(): note_block[] {
            let note_blocks: note_block[] = [];
            let for_each_axis = (radius: number, method: (index: number) => void) => {
                let diameter = radius * 2;
                for (let i = -(diameter / 2), il = diameter / 2; i <= il; i++) {
                    method(i);
                }
            }

            for_each_axis(4, (x) =>
                for_each_axis(4, (y) =>
                    for_each_axis(4, (z) => {
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
                                let note_block_object: note_block;

                                // Bell
                                if (note_block_bell.includes(tone_block_type)) {
                                    note_block_object = this.generateNoteBlockWrapper(-1, 'bell', tone_block_type, block_position);
                                }

                                // bass
                                else if (note_block_base.includes(tone_block_type)) {
                                    note_block_object = this.generateNoteBlockWrapper(-1, 'bass', tone_block_type, block_position);
                                }

                                // basedrum
                                else if (note_block_basedrum.includes(tone_block_type)) {
                                    note_block_object = this.generateNoteBlockWrapper(-1, 'basedrum', tone_block_type, block_position);
                                }

                                // Harp
                                else {
                                    note_block_object = this.generateNoteBlockWrapper(-1, 'harp', tone_block_type, block_position);
                                }

                                note_blocks.push(note_block_object);
                            }
                        }
                    })));
            return note_blocks;
        }

        // Plays a midi song using note blocks specified
        // ToDo: Use pause() function instead of relying on parameters
        public async playMidi(song_path: string | midi.song, note_blocks: note_block[], cb?: (reason: callback_reason, value: string | midi.song | note_block_type[]) => void) {
            let callback = cb || function () { };
            let terminate = false;
            let song: midi.song;

            // Generate song data for midi file
            if (typeof song_path === 'string') {
                let data = this.midi_plugin.readMidiFile(song_path);
                song = this.midi_plugin.generateSongData(data, data.name);
            }

            // Play existing saved song
            else if (typeof song_path === 'object') {
                song = song_path;
            }

            // didn't specify midi path or song wrapper
            else throw new Error(`Invalid data specified for parameter 'song_path'`);

            // Gather nearby note blocks
            // not currently needed as we specify through note_blocks parameter

            // Verify that we have the required note blocks to play
            let midi_key_range = this.midi_plugin.retreiveKeyRange(song);
            let note_block_key_range = this.retreiveNoteBlockKeyRange(midi_key_range);
            let required_types = this.retreiveRequiredTypes(note_blocks, note_block_key_range);

            // what to do when playing a note
            let play_event = (note: midi.note, sorted_note_blocks: Record<number, note_block>) => {
                let key = note.key;
                let note_block_object = sorted_note_blocks[key];

                // Key can be played on note block
                if (note_block_object !== undefined) {
                    let success = this.playNoteBlock(sorted_note_blocks[key]);

                    // Unable to play note block (missing)
                    if (!success) {
                        terminate = true;
                        this.log(`ERROR: Unable to play note block!`, 'playNoteBlockSong', true);
                        callback('error', 'unable to play note block');
                    }
                }
            }

            let midi_callback = (reason: midi.song_event, song: midi.song) => {

                // Prevent executing callback twice after pausing manually
                if (!terminate) {
                    terminate = reason === 'start' ? false : true;

                    switch (reason) {
                        case 'start':
                            this.pauseMidi = this.midi_plugin.pauseSong;
                            callback('start', song);
                            break;

                        case 'end':
                            callback('end', song);
                            break;

                        case 'pause':
                            callback('pause', song);
                            break;

                        case 'error':
                            callback('error', 'error whilst parsing midi json file');
                            break;

                        default:
                            throw new Error('No reason specified for midi song termination');
                    }
                }
            }

            // have enough note blocks for all required keys
            if (required_types.length < 1) {
                let verified_note_blocks = this.assignNoteBlockKeys(note_blocks, note_block_key_range);
                let sorted_note_blocks = this.sortNoteBlocksByKeys(verified_note_blocks);

                // tune all note blocks
                for (let i = 0, il = verified_note_blocks.length; i < il; i++) {
                    let note_block_object = await this.tuneNoteBlock(verified_note_blocks[i]);

                    // error has occured, unable to tune note block
                    if (note_block_object === null) {
                        terminate = true;
                        this.log(`ERROR: Note block was unable to be tuned`, 'playNoteBlockSong', true);
                        callback('error', 'unable to tune note block');
                        break;
                    }
                }

                // play the song
                this.midi_plugin.playSong(song, (note) => play_event(note, sorted_note_blocks), midi_callback);
            }

            // Not enough note blocks for required song
            else {
                terminate = true;
                this.log(`ERROR: Missing note blocks required to play song`, 'playNoteBlockSong', true);
                callback('missing', required_types);
            }
        }
    }
}