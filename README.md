<h1 align='center'>
  MC-Uta
</h1>

<p align='center'>
<img src='https://img.shields.io/github/issues/Camezza/MC-Uta'>
<img src='https://img.shields.io/github/forks/Camezza/MC-Uta'>
<img src='https://img.shields.io/github/stars/Camezza/MC-Uta'>
<img src='https://img.shields.io/github/license/Camezza/MC-Uta'>
</p>
<p align='center'><i>A mineflayer plugin allowing for advanced interaction with note blocks.</i></p>

---
## Installation
This plugin requires npm to install:<br>
`npm install -g mc-uta`

## Usage
ES6:<br>
```
import { mc_uta } from 'mc-uta';

let bot = mineflayer.createbot({
username: "bot",
host: "localhost",
port: 25565,
version: "1.16.4",
});

let uta = mc_uta.plugin(bot);
```
