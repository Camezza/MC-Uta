import * as mineflayer from 'mineflayer';

/*
This class will need to do a number of things:
- Recognise MIDI note values and be able to translate it to minecraft note-block sounds & pitches
- Discover note blocks nearby and identify the block underneath to determine sound
- Ability to 'tune' note blocks through listening for certain notes and right-clicking a certain amount of times
- A way of reading song json files & matching the keys and tempo with note blocks
- Play + Pause songs.
- Automatically fix note inaccuracies while playing a song through retuning selected note blocks
*/

export class minecraft {
    private bot: mineflayer.Bot;

    constructor(bot: mineflayer.Bot) {
        this.bot = bot;
    }

    
}